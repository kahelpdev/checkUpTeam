import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGeminiModel } from "@/lib/gemini";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const equipe = searchParams.get("equipe") || undefined;
  const dataInicio = searchParams.get("dataInicio");
  const dataFim = searchParams.get("dataFim");

  const where = {
    ...(equipe && { equipe }),
    ...(dataInicio && dataFim && {
      dataDia: {
        gte: new Date(dataInicio),
        lte: new Date(`${dataFim}T23:59:59`),
      },
    }),
  };

  const reports = await prisma.relatorioDiario.findMany({
    where,
    orderBy: [{ equipe: "asc" }, { dataDia: "desc" }],
    take: 200,
  });

  if (reports.length === 0) {
    return NextResponse.json(
      { error: "Nenhum relatório encontrado para o período selecionado" },
      { status: 404 }
    );
  }

  const context = reports.map((r) => ({
    colaborador: r.nome,
    equipe: r.equipe,
    data: r.dataDia.toISOString().split("T")[0],
    sentimento: r.comoSeSentiu,
    atividades: r.atividadesRealizadas,
    impedimentos: r.impedimentos,
    demandasLideranca: r.demandasPendenteLideranca,
    horaExtra: r.horaExtra,
    tempoHoraExtra: r.tempoHoraExtra,
    motivoHoraExtra: r.motivoHoraExtra,
    entregasPlanejadas: r.entregasPlanejadas,
  }));

  const periodo = dataInicio && dataFim ? `${dataInicio} a ${dataFim}` : "período selecionado";

  const prompt = `Você é um assistente executivo da empresa New Standard. Gere um relatório executivo para o CEO com base nos relatórios diários dos colaboradores.

Período: ${periodo}
Equipe: ${equipe || "Todas as equipes"}
Total de relatórios analisados: ${reports.length}

Dados:
${JSON.stringify(context, null, 2)}

Gere um resumo executivo profissional em português brasileiro com as seguintes seções:
1. **Visão Geral** — sentimento geral e produtividade das equipes no período
2. **Principais Impedimentos** — bloqueios mais frequentes ou críticos identificados
3. **Demandas Pendentes para Liderança** — ações que requerem decisão ou apoio gerencial
4. **Horas Extras** — quem realizou, tempo aproximado total, motivos principais
5. **Próximas Entregas** — o que está planejado para os próximos dias
6. **Destaques Positivos** — conquistas e pontos favoráveis do período

Seja conciso e executivo. Use bullet points. Não liste dados brutos, apenas análises e conclusões.`;

  try {
    const geminiModel = getGeminiModel();
    const result = await geminiModel.generateContent(prompt);
    const summary = result.response.text();
    return NextResponse.json({ summary, period: periodo, totalReports: reports.length });
  } catch (e) {
    console.error("Gemini error:", e);
    const message = e instanceof Error ? e.message : "Erro ao gerar resumo com IA";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
