// @deprecated use /api/relatorios/rag-query (busca semântica via pgvector).
// Este endpoint continua respondendo durante a transição, mas adiciona o header
// `X-Deprecated` em toda response. Será removido em release futuro.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGeminiModel } from "@/lib/gemini";

const DEPRECATION_HEADER = { "X-Deprecated": "use /api/relatorios/rag-query" };

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, model, equipe, nome, dataInicio, dataFim } = body as {
    query: string;
    model?: string;
    equipe?: string;
    nome?: string;
    dataInicio?: string;
    dataFim?: string;
  };

  if (!query?.trim()) {
    return NextResponse.json({ error: "Query é obrigatória" }, { status: 400 });
  }

  const where = {
    ...(equipe && { equipe }),
    ...(nome && { nome: { contains: nome, mode: "insensitive" as const } }),
    ...(dataInicio && dataFim && {
      dataDia: {
        gte: new Date(dataInicio),
        lte: new Date(`${dataFim}T23:59:59`),
      },
    }),
  };

  const reports = await prisma.relatorioDiario.findMany({
    where,
    orderBy: { dataDia: "desc" },
    take: 500,
  });

  const context = reports.map((r) => ({
    colaborador: r.nome,
    equipe: r.equipe,
    data: r.dataDia.toISOString().split("T")[0],
    sentimento: r.comoSeSentiu,
    atividades: r.atividadesRealizadas,
    impedimentos: r.impedimentos,
    demandasColaborador: r.demandasPendenteColaborador,
    demandasLideranca: r.demandasPendenteLideranca,
    entregasPlanejadas: r.entregasPlanejadas,
    horaExtra: r.horaExtra,
    tempoHoraExtra: r.tempoHoraExtra,
  }));

  const dataMin = context.length > 0 ? context[context.length - 1].data : null;
  const dataMax = context.length > 0 ? context[0].data : null;

  const prompt = `Você é um assistente de gestão de equipes da empresa New Standard. Você tem acesso aos relatórios diários dos colaboradores.

Conjunto de dados disponível:
- Total de relatórios carregados: ${context.length}
- Período coberto: ${dataMin && dataMax ? `${dataMin} até ${dataMax}` : "sem dados"}
- Filtros aplicados pelo usuário: ${[
    equipe && `equipe=${equipe}`,
    nome && `nome contém "${nome}"`,
    dataInicio && `de ${dataInicio}`,
    dataFim && `até ${dataFim}`,
  ].filter(Boolean).join(", ") || "nenhum"}

Relatórios (JSON):
${JSON.stringify(context)}

Pergunta do líder: ${query}

Instruções:
1. Responda em português brasileiro, de forma objetiva e direta.
2. Cite nomes e datas (formato dd/mm/aaaa) sempre que relevante.
3. Se a pergunta se refere a um período fora de "${dataMin} até ${dataMax}", diga explicitamente que esses dados não estão no conjunto carregado e sugira ao usuário aplicar o filtro de data correspondente acima da tela e refazer a pergunta.
4. Se a pergunta se refere a um colaborador que não aparece nos dados, informe claramente e liste quais colaboradores estão presentes.
5. Não invente dados. Se não houver informação, diga que não há.`;

  try {
    const geminiModel = getGeminiModel(model);
    const result = await geminiModel.generateContent(prompt);
    const answer = result.response.text();
    return NextResponse.json({ answer }, { headers: DEPRECATION_HEADER });
  } catch (e) {
    console.error("Gemini error:", e);
    const message = e instanceof Error ? e.message : "Erro ao consultar IA";
    return NextResponse.json({ error: message }, { status: 500, headers: DEPRECATION_HEADER });
  }
}
