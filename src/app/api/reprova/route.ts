import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queryNsscard } from "@/lib/nsscard-db";
import type { QueryResultRow } from "pg";
import { format } from "date-fns";

interface ReprovaByDev extends QueryResultRow {
  user_id: string; user_name: string; reprovacoes: string; dias_com_reprova: string;
}
interface DeliveryByDev extends QueryResultRow { user_id: string; entregas: string }
interface DailyRow extends QueryResultRow { dia: Date | string; user_name: string; reprovacoes: string }
interface MonthlyRow extends QueryResultRow { mes: string; user_name: string; reprovacoes: string }

// In-memory cache per (teamId, startDate, endDate) — 5 min TTL
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const teamConfigId = searchParams.get("teamConfigId");
  const startDate    = searchParams.get("startDate") ?? format(new Date(), "yyyy-MM-dd");
  const endDate      = searchParams.get("endDate")   ?? format(new Date(), "yyyy-MM-dd");

  if (!teamConfigId) {
    return NextResponse.json({ error: "teamConfigId obrigatório" }, { status: 400 });
  }

  const teamConfig = await prisma.teamsConfig.findUnique({ where: { id: teamConfigId } });
  if (!teamConfig) {
    return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
  }

  const cacheKey = `${teamConfig.teamId}:${startDate}:${endDate}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, { headers: { "X-Data-Source": "memo" } });
  }

  const teamId = teamConfig.teamId;

  const [reprovaByDev, deliveriesByDev, dailyRows, monthlyRows] = await Promise.all([
    // Reprovas por dev no período (via event_stage_logs, code DevRep)
    queryNsscard<ReprovaByDev>(`
      SELECT u.id AS user_id, u.name AS user_name,
             COUNT(*) AS reprovacoes,
             COUNT(DISTINCT (esl.entered_at AT TIME ZONE 'America/Sao_Paulo')::date) AS dias_com_reprova
      FROM event_stage_logs esl
      JOIN workflow_stages ws ON ws.id = esl.to_stage_id
      JOIN support_card_events sce ON sce.id = esl.support_card_event_id
      JOIN users u ON u.id = esl.user_id
      WHERE ws.code = 'DevRep'
        AND sce.team_id = $1
        AND (esl.entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
        AND (esl.entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
      GROUP BY u.id, u.name
      ORDER BY reprovacoes DESC
    `, [teamId, startDate, endDate]),

    // Entregas por dev no período
    queryNsscard<DeliveryByDev>(`
      SELECT assigned_to_user_id AS user_id, COUNT(*) AS entregas
      FROM support_card_events
      WHERE team_id = $1
        AND (resolved_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
        AND (resolved_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
        AND resolved_at IS NOT NULL
      GROUP BY assigned_to_user_id
    `, [teamId, startDate, endDate]),

    // Breakdown diário de reprovas no período
    queryNsscard<DailyRow>(`
      SELECT (esl.entered_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
             u.name AS user_name, COUNT(*) AS reprovacoes
      FROM event_stage_logs esl
      JOIN workflow_stages ws ON ws.id = esl.to_stage_id
      JOIN support_card_events sce ON sce.id = esl.support_card_event_id
      JOIN users u ON u.id = esl.user_id
      WHERE ws.code = 'DevRep'
        AND sce.team_id = $1
        AND (esl.entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
        AND (esl.entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
      GROUP BY dia, u.id, u.name
      ORDER BY dia
    `, [teamId, startDate, endDate]),

    // Tendência mensal — últimos 6 meses (janela fixa, independente do filtro)
    queryNsscard<MonthlyRow>(`
      SELECT TO_CHAR(DATE_TRUNC('month', esl.entered_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS mes,
             u.name AS user_name, COUNT(*) AS reprovacoes
      FROM event_stage_logs esl
      JOIN workflow_stages ws ON ws.id = esl.to_stage_id
      JOIN support_card_events sce ON sce.id = esl.support_card_event_id
      JOIN users u ON u.id = esl.user_id
      WHERE ws.code = 'DevRep'
        AND sce.team_id = $1
        AND esl.entered_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', esl.entered_at AT TIME ZONE 'America/Sao_Paulo'), u.id, u.name
      ORDER BY mes
    `, [teamId]),
  ]);

  // Mapa de entregas por user_id
  const deliveriesMap = new Map(deliveriesByDev.map((r) => [r.user_id, Number(r.entregas)]));

  // Members com reprova (apenas quem teve reprova no período)
  const members = reprovaByDev.map((r) => {
    const reprovacoes = Number(r.reprovacoes);
    const entregas    = deliveriesMap.get(r.user_id) ?? 0;
    const taxaReprovaPct = entregas > 0
      ? Math.round((reprovacoes / entregas) * 1000) / 10
      : null;
    return {
      userId:        r.user_id,
      userName:      r.user_name,
      reprovacoes,
      entregas,
      taxaReprovaPct,
      diasComReprova: Number(r.dias_com_reprova),
    };
  });

  // Breakdown diário — pivot por dev
  const dailyMap = new Map<string, Record<string, number>>();
  for (const r of dailyRows) {
    const day = r.dia instanceof Date ? r.dia.toISOString().slice(0, 10) : String(r.dia);
    if (!dailyMap.has(day)) dailyMap.set(day, {});
    dailyMap.get(day)![r.user_name] = Number(r.reprovacoes);
  }
  const dailyBreakdown = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, byUser]) => ({ date, ...byUser }));

  // Tendência mensal — pivot por dev
  const monthlyMap = new Map<string, Record<string, number>>();
  for (const r of monthlyRows) {
    if (!monthlyMap.has(r.mes)) monthlyMap.set(r.mes, {});
    monthlyMap.get(r.mes)![r.user_name] = Number(r.reprovacoes);
  }
  const monthlyTrend = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, byUser]) => ({ month, ...byUser }));

  // KPIs da equipe
  const totalReprovacoes = members.reduce((s, m) => s + m.reprovacoes, 0);
  const totalEntregas    = [...deliveriesMap.values()].reduce((s, v) => s + v, 0);
  const taxaMedia = totalEntregas > 0
    ? Math.round((totalReprovacoes / totalEntregas) * 1000) / 10
    : null;
  const teamKpi = {
    totalReprovacoes,
    totalEntregas,
    taxaMedia,
    devsComReprova: members.filter((m) => m.reprovacoes > 0).length,
  };

  // Trust layer (banco checkupteam)
  const metricKeys = ["dev_reprova_summary", "dev_alerta_comportamental", "qa_rejections_semana"];
  const period = format(new Date(), "yyyy-MM-dd");
  const [metricResults, activeIncidents] = await Promise.all([
    prisma.metricResult.findMany({ where: { metricKey: { in: metricKeys }, period } }),
    prisma.dataIncident.findMany({
      where: { metricKey: { in: metricKeys }, status: { in: ["open", "investigating"] } },
    }),
  ]);
  const resMap = new Map(metricResults.map((r) => [r.metricKey, r]));
  const incMap = new Map(activeIncidents.map((i) => [i.metricKey, i.id]));
  const trustMeta = (key: string) => ({
    status:     (resMap.get(key)?.status ?? "no_data") as "high" | "medium" | "review" | "no_data",
    incidentId: incMap.get(key) ?? null,
  });

  const responseData = {
    members,
    teamKpi,
    dailyBreakdown,
    monthlyTrend,
    dataSource: "db" as const,
    reprovaMeta: {
      devReprova:       trustMeta("dev_reprova_summary"),
      alertComport:     trustMeta("dev_alerta_comportamental"),
      qaRejectionsWeek: trustMeta("qa_rejections_semana"),
    },
  };

  cache.set(cacheKey, { data: responseData, ts: Date.now() });
  return NextResponse.json(responseData, { headers: { "X-Data-Source": "db" } });
}
