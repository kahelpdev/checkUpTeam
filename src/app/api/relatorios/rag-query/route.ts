// POST /api/relatorios/rag-query
//
// Busca semântica sobre relatorios_diarios + síntese Gemini com citações por id.
//
// Pipeline:
//   1. embedQuery(question)  → vetor 768 dim (taskType: RETRIEVAL_QUERY)
//   2. SELECT top-K por distância cosseno (operador <=>)
//   3. Prompt Gemini estrito ("use APENAS os relatórios fornecidos, cite [id: <uuid>]")
//
// Erros são distintos por etapa (502 embed, 500 retrieval, 502 síntese) pra
// facilitar diagnóstico no log do container.

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getGeminiModel, DEFAULT_GEMINI_MODEL } from "@/lib/gemini";
import { embedQuery, toVectorLiteral } from "@/lib/embeddings";
import type { RagQueryRequest, RagQueryResponse, RagSource } from "@/types/rag";

const MAX_TOPK = 50;
const DEFAULT_TOPK = 10;

interface Row {
  id: string;
  equipe: string;
  nome: string;
  data_dia: Date;
  como_se_sentiu: string;
  atividades_realizadas: string;
  impedimentos: string;
  demandas_pendente_colaborador: string;
  demandas_pendente_lideranca: string;
  entregas_planejadas: string;
  score: number;
}

export async function POST(req: NextRequest) {
  let body: RagQueryRequest;
  try {
    body = (await req.json()) as RagQueryRequest;
  } catch {
    return NextResponse.json({ error: "Body inválido (JSON esperado)" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Campo 'question' é obrigatório" }, { status: 400 });
  }

  const topK = Math.min(MAX_TOPK, Math.max(1, body.topK ?? DEFAULT_TOPK));
  const filters = body.filters ?? {};

  // 1. Embedding da pergunta
  let queryVec: number[];
  try {
    queryVec = await embedQuery(question);
  } catch (e) {
    console.error("[rag-query] embedQuery falhou:", e);
    return NextResponse.json({ error: "Falha ao gerar embedding da pergunta" }, { status: 502 });
  }
  const queryLiteral = toVectorLiteral(queryVec);

  // 2. Filtros parametrizados (cosine distance via <=>; score = 1 - dist)
  const conditions: Prisma.Sql[] = [Prisma.sql`embedding IS NOT NULL`];
  if (filters.equipe) conditions.push(Prisma.sql`equipe = ${filters.equipe}`);
  if (filters.dataInicio) conditions.push(Prisma.sql`data_dia >= ${new Date(filters.dataInicio)}`);
  if (filters.dataFim) conditions.push(Prisma.sql`data_dia <= ${new Date(`${filters.dataFim}T23:59:59`)}`);
  const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

  let rows: Row[];
  try {
    rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT id, equipe, nome, data_dia, como_se_sentiu, atividades_realizadas,
             impedimentos, demandas_pendente_colaborador, demandas_pendente_lideranca,
             entregas_planejadas,
             1 - (embedding <=> ${queryLiteral}::vector) AS score
        FROM relatorios_diarios
        ${whereSql}
        ORDER BY embedding <=> ${queryLiteral}::vector
        LIMIT ${topK}
    `);
  } catch (e) {
    console.error("[rag-query] retrieval falhou:", e);
    return NextResponse.json({ error: "Falha no retrieval (banco ou pgvector)" }, { status: 500 });
  }

  const sources: RagSource[] = rows.map((r) => ({
    id: r.id,
    equipe: r.equipe,
    nome: r.nome,
    dataDia: r.data_dia.toISOString().split("T")[0],
    score: Number(r.score),
  }));

  // 3. Fallback explícito quando o retrieval volta vazio
  if (rows.length === 0) {
    const empty: RagQueryResponse = {
      answer:
        "Nenhum relatório indexado corresponde à pergunta com os filtros atuais. " +
        "Verifique se o backfill de embeddings foi executado " +
        "(`npm run backfill:embeddings`) e se há dados no período/equipe consultados.",
      sources: [],
      modelo: DEFAULT_GEMINI_MODEL,
      retrievalCount: 0,
    };
    return NextResponse.json(empty);
  }

  // 4. Síntese Gemini — prompt estrito anti-alucinação
  const contextoTxt = rows
    .map((r) => {
      const data = r.data_dia.toISOString().split("T")[0];
      return `### Relatório ${r.id}
- Data: ${data}
- Equipe: ${r.equipe}
- Colaborador: ${r.nome}
- Como se sentiu: ${r.como_se_sentiu}
- Atividades: ${r.atividades_realizadas}
- Impedimentos: ${r.impedimentos}
- Demandas colaborador: ${r.demandas_pendente_colaborador}
- Demandas liderança: ${r.demandas_pendente_lideranca}
- Entregas planejadas: ${r.entregas_planejadas}`;
    })
    .join("\n\n");

  const prompt = `Você é um assistente de gestão de equipes da CheckUp Team.
Responda em português a pergunta abaixo usando APENAS os relatórios fornecidos.
Cite o id do relatório (formato "[id: <uuid>]") em CADA afirmação que fizer.
Se nenhum relatório responder, diga isso claramente — não invente.

Relatórios:
${contextoTxt}

Pergunta: ${question}

Resposta:`;

  let answer: string;
  try {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    answer = result.response.text();
  } catch (e) {
    console.error("[rag-query] síntese Gemini falhou:", e);
    return NextResponse.json({ error: "Falha na síntese Gemini" }, { status: 502 });
  }

  const response: RagQueryResponse = {
    answer,
    sources,
    modelo: DEFAULT_GEMINI_MODEL,
    retrievalCount: rows.length,
  };
  return NextResponse.json(response);
}
