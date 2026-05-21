// Serviço de embeddings — Gemini gemini-embedding-001 (768 dim).
// Reusa GEMINI_API_KEY já configurada no container.
//
// Padrões:
// - Documento: concatenação estruturada com tags [Campo: valor], pulando vazios.
// - Retry exponencial em 429 / 5xx (3 tentativas, base 500ms).
// - Toda escrita do vetor no banco usa $executeRaw com cast ::vector
//   (Prisma 7.8 não tipa vector — coluna marcada como Unsupported no schema).
// - SELECT do relatório usa $queryRaw com aliases camelCase (findUnique
//   também funciona pois embedding não é referenciado no select).

import { GoogleGenerativeAI, type TaskType } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIM = 768;

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface RelatorioFields {
  equipe?: string | null;
  nome?: string | null;
  comoSeSentiu?: string | null;
  atividadesRealizadas?: string | null;
  impedimentos?: string | null;
  demandasPendenteColaborador?: string | null;
  demandasPendenteLideranca?: string | null;
  entregasPlanejadas?: string | null;
  motivoNaoEntrega?: string | null;
  motivoHoraExtra?: string | null;
}

export function buildDocumento(r: RelatorioFields): string {
  const parts: string[] = [];
  const push = (label: string, val?: string | null) => {
    const trimmed = val?.trim();
    if (trimmed) parts.push(`[${label}: ${trimmed}]`);
  };
  push("Equipe", r.equipe);
  push("Colaborador", r.nome);
  push("Como se sentiu", r.comoSeSentiu);
  push("Atividades", r.atividadesRealizadas);
  push("Impedimentos", r.impedimentos);
  push("Demandas colaborador", r.demandasPendenteColaborador);
  push("Demandas liderança", r.demandasPendenteLideranca);
  push("Entregas planejadas", r.entregasPlanejadas);
  push("Motivo não entrega", r.motivoNaoEntrega);
  push("Motivo hora extra", r.motivoHoraExtra);
  return parts.join(" ");
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number; statusCode?: number })?.status
        ?? (err as { statusCode?: number })?.statusCode;
      const retriable = status === 429 || (typeof status === "number" && status >= 500);
      if (!retriable || i === attempts - 1) throw err;
      const delay = baseMs * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function embed(text: string, taskType: TaskType): Promise<number[]> {
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await withRetry(() =>
    model.embedContent({
      content: { role: "user", parts: [{ text }] },
      taskType,
    })
  );
  const values = result.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("[embeddings] resposta sem values");
  }
  // gemini-embedding-001 retorna 3072 dim por default. SDK 0.24 nao expoe
  // outputDimensionality, entao truncamos para EMBEDDING_DIM. Isso e seguro
  // porque o modelo usa Matryoshka Representation Learning — os primeiros K
  // elementos sao um embedding valido por construcao.
  if (values.length < EMBEDDING_DIM) {
    throw new Error(`[embeddings] dim ${values.length} < ${EMBEDDING_DIM} (modelo retornou menos que o esperado)`);
  }
  const truncated = values.slice(0, EMBEDDING_DIM);
  // Re-normaliza (L2) — apos truncamento MRL, magnitude muda; cosine distance
  // e robusto, mas mantemos vetores unitarios por convencao do pgvector.
  const norm = Math.sqrt(truncated.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? truncated.map((v) => v / norm) : truncated;
}

export function embedDocument(text: string): Promise<number[]> {
  return embed(text, "RETRIEVAL_DOCUMENT" as TaskType);
}

export function embedQuery(text: string): Promise<number[]> {
  return embed(text, "RETRIEVAL_QUERY" as TaskType);
}

// Formato pgvector aceito por cast ::vector — string "[a,b,c,...]"
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

// Persiste embedding em uma linha. Idempotente.
export async function persistEmbedding(id: string, values: number[]): Promise<void> {
  const literal = toVectorLiteral(values);
  await prisma.$executeRaw`
    UPDATE relatorios_diarios
       SET embedding = ${literal}::vector,
           embedding_updated_at = NOW(),
           embedding_model = ${EMBEDDING_MODEL}
     WHERE id = ${id}
  `;
}

// Carrega o relatório, monta o documento e persiste o embedding.
// Fire-and-forget seguro: nunca propaga erro para o caller.
export async function embedAndStore(id: string): Promise<void> {
  try {
    const r = await prisma.relatorioDiario.findUnique({
      where: { id },
      select: {
        equipe: true,
        nome: true,
        comoSeSentiu: true,
        atividadesRealizadas: true,
        impedimentos: true,
        demandasPendenteColaborador: true,
        demandasPendenteLideranca: true,
        entregasPlanejadas: true,
        motivoNaoEntrega: true,
        motivoHoraExtra: true,
      },
    });
    if (!r) {
      console.error(`[embeddings] Relatório ${id} não encontrado`);
      return;
    }
    const doc = buildDocumento(r);
    if (!doc) {
      console.error(`[embeddings] Relatório ${id} sem campos textuais — pulado`);
      return;
    }
    const values = await embedDocument(doc);
    await persistEmbedding(id, values);
  } catch (err) {
    console.error(`[embeddings] Falha ao processar ${id}:`, err);
  }
}
