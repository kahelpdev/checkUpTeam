import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";
import { format, subDays, parseISO, addDays } from "date-fns";

// Ajuste de fuso horário (-3h) para agrupamento correto em data local brasileira
function getLocalDateString(date: Date): string {
  const adjusted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return adjusted.toISOString().slice(0, 10);
}

type RankingRow = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  qaSubmissions: number;
  qaApprovals: number;
  qaRejections: number;
  qaHitRate: number | null;
  qaStatus: string | null;
};

function parseRankings(raw: unknown): RankingRow[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((r) => ({
    userId:        String(r.userId ?? ""),
    userName:      String(r.userName ?? ""),
    avatarUrl:     r.avatarUrl ? String(r.avatarUrl) : null,
    qaSubmissions: Number(r.qaSubmissions) || 0,
    qaApprovals:   Number(r.qaApprovals)   || 0,
    qaRejections:  Number(r.qaRejections)  || 0,
    qaHitRate:     r.qaHitRate  != null ? Number(r.qaHitRate)  : null,
    qaStatus:      r.qaStatus   ? String(r.qaStatus)   : null,
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const teamConfigId = searchParams.get("teamConfigId");
  const startDate = searchParams.get("startDate") ?? format(new Date(), "yyyy-MM-dd");
  const endDate   = searchParams.get("endDate")   ?? format(new Date(), "yyyy-MM-dd");

  if (!teamConfigId) {
    return NextResponse.json({ error: "teamConfigId obrigatório" }, { status: 400 });
  }

  const teamConfig = await prisma.teamsConfig.findUnique({ where: { id: teamConfigId } });
  if (!teamConfig) {
    return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
  }

  // ── 1. Rankings para o período exato via CardsFlow ────────────────────────
  let rankingsRaw: unknown = null;
  let dataSource: "live" | "cache" = "live";
  let cachedAt: string | undefined;

  try {
    rankingsRaw = await CardflowService.getRankings(teamConfig.teamId, startDate, endDate);
  } catch {
    dataSource = "cache";
    const registry = await prisma.apiRegistry.findFirst({
      where: { path: "/devbi/rankings", isActive: true },
      select: { id: true },
    });
    if (registry) {
      const snap = await prisma.apiSnapshot.findFirst({
        where: { apiRegistryId: registry.id, teamConfigId },
        orderBy: { capturedAt: "desc" },
        select: { payload: true, capturedAt: true },
      });
      if (snap) {
        rankingsRaw = snap.payload;
        cachedAt = snap.capturedAt.toISOString();
      }
    }
  }

  const members = parseRankings(rankingsRaw);

  const totalSubmissions = members.reduce((s, m) => s + m.qaSubmissions, 0);
  const totalRejections  = members.reduce((s, m) => s + m.qaRejections,  0);
  const teamHitRate = totalSubmissions > 0
    ? Math.round(((totalSubmissions - totalRejections) / totalSubmissions) * 1000) / 10
    : null;

  // ── 2. Snapshots diários: gráfico de tendência + breakdown por dia ────────
  const rankingsRegistry = await prisma.apiRegistry.findFirst({
    where: { path: "/devbi/rankings", isActive: true },
    select: { id: true },
  });

  type ChartPoint = Record<string, string | number>;
  let chartData: ChartPoint[] = [];
  let dailyBreakdown: ChartPoint[] = [];
  let rejectionsToday: Record<string, number> = {};

  if (rankingsRegistry) {
    // 2.1. Calcular Reprovas de Hoje (Fuso Horário Brasil)
    const todayLocal = new Date();
    const todayStr = getLocalDateString(todayLocal);
    const yesterdayStr = getLocalDateString(subDays(todayLocal, 1));

    // Busca snapshots próximos de hoje e ontem (margem de 2 dias antes e 1 depois)
    const dbGteToday = new Date(todayLocal.getTime() - 2 * 24 * 60 * 60 * 1000);
    const dbLteToday = new Date(todayLocal.getTime() + 24 * 60 * 60 * 1000);

    const todaySnapshots = await prisma.apiSnapshot.findMany({
      where: {
        apiRegistryId: rankingsRegistry.id,
        teamConfigId,
        capturedAt: { gte: dbGteToday, lte: dbLteToday },
      },
      orderBy: { capturedAt: "asc" },
      select: { payload: true, capturedAt: true },
    });

    const snapsByLocalDateToday = new Map<string, Record<string, number>>();
    for (const snap of todaySnapshots) {
      const dateStr = getLocalDateString(snap.capturedAt);
      const users: Record<string, number> = {};
      if (Array.isArray(snap.payload)) {
        for (const u of snap.payload as Array<Record<string, unknown>>) {
          const name = String(u.userName ?? "");
          if (name) users[name] = Number(u.qaRejections) || 0;
        }
      }
      snapsByLocalDateToday.set(dateStr, users);
    }

    const currToday = snapsByLocalDateToday.get(todayStr) ?? {};
    const prevYesterday = snapsByLocalDateToday.get(yesterdayStr) ?? {};

    let baseline = prevYesterday;
    if (Object.keys(baseline).length === 0 && todaySnapshots.length > 0) {
      const firstSnap = todaySnapshots.find((s) => getLocalDateString(s.capturedAt) === todayStr);
      if (firstSnap && Array.isArray(firstSnap.payload)) {
        const users: Record<string, number> = {};
        for (const u of firstSnap.payload as Array<Record<string, unknown>>) {
          const name = String(u.userName ?? "");
          if (name) users[name] = Number(u.qaRejections) || 0;
        }
        baseline = users;
      }
    }

    for (const name of Object.keys(currToday)) {
      rejectionsToday[name] = Math.max(0, (currToday[name] ?? 0) - (baseline[name] ?? 0));
    }

    // 2.2. Agrupamento para Histórico/Breakdown do período selecionado
    // Para compensar diferenças de fuso horário, buscamos 2 dias antes e 1 dia depois
    const dbGte = subDays(parseISO(startDate), 2);
    const dbLte = addDays(parseISO(endDate), 1);

    const snapshots = await prisma.apiSnapshot.findMany({
      where: {
        apiRegistryId: rankingsRegistry.id,
        teamConfigId,
        capturedAt: { gte: dbGte, lte: dbLte },
      },
      orderBy: { capturedAt: "asc" },
      select: { payload: true, capturedAt: true },
    });

    const lastSnapByDate = new Map<string, Record<string, number>>();
    const baselineDate = format(subDays(parseISO(startDate), 1), "yyyy-MM-dd");

    for (const snap of snapshots) {
      const date = getLocalDateString(snap.capturedAt);
      if (date >= baselineDate && date <= endDate) {
        const users: Record<string, number> = {};
        if (Array.isArray(snap.payload)) {
          for (const u of snap.payload as Array<Record<string, unknown>>) {
            const name = String(u.userName ?? "");
            if (name) users[name] = Number(u.qaRejections) || 0;
          }
        }
        lastSnapByDate.set(date, users);
      }
    }

    const allDates   = [...lastSnapByDate.keys()].sort();
    const periodDates = allDates.filter((d) => d >= startDate && d <= endDate);

    // chartData: valor acumulado por dia (gráfico de tendência)
    chartData = periodDates.map((date) => ({
      date,
      ...(lastSnapByDate.get(date) ?? {}),
    }));

    // dailyBreakdown: delta entre dias consecutivos (reprovas novas no dia)
    dailyBreakdown = periodDates.map((date) => {
      const curr     = lastSnapByDate.get(date) ?? {};
      const prevIdx  = allDates.indexOf(date) - 1;
      const prev     = prevIdx >= 0 ? (lastSnapByDate.get(allDates[prevIdx]) ?? {}) : {};
      const allNames = new Set([...Object.keys(curr), ...Object.keys(prev)]);
      const row: ChartPoint = { date };
      for (const name of allNames) {
        row[name] = Math.max(0, (curr[name] ?? 0) - (prev[name] ?? 0));
      }
      return row;
    });
  }

  // Mapeia rejectionsToday para os membros da lista
  const membersWithToday = members.map((m) => ({
    ...m,
    rejectionsToday: rejectionsToday[m.userName] ?? 0,
  }));

  // ── 3. Trust Layer ─────────────────────────────────────────────────────────
  const metricKeys = ["dev_reprova_summary", "dev_alerta_comportamental", "qa_rejections_semana"];
  const period = format(new Date(), "yyyy-MM-dd");

  const [metricResults, activeIncidents] = await Promise.all([
    prisma.metricResult.findMany({ where: { metricKey: { in: metricKeys }, period } }),
    prisma.dataIncident.findMany({ where: { metricKey: { in: metricKeys }, status: { in: ["open", "investigating"] } } }),
  ]);

  const resMap = new Map(metricResults.map((r) => [r.metricKey, r]));
  const incMap = new Map(activeIncidents.map((i) => [i.metricKey, i.id]));
  const trustMeta = (key: string) => ({
    status: (resMap.get(key)?.status ?? "no_data") as "high" | "medium" | "review" | "no_data",
    incidentId: incMap.get(key) ?? null,
  });

  return NextResponse.json({
    members: membersWithToday,
    teamKpi: {
      totalSubmissions,
      totalRejections,
      teamHitRate,
      alertCount: members.filter((m) => m.qaStatus === "Alerta Comport.").length,
    },
    chartData,
    dailyBreakdown,
    dataSource,
    cachedAt,
    reprovaMeta: {
      devReprova:       trustMeta("dev_reprova_summary"),
      alertComport:     trustMeta("dev_alerta_comportamental"),
      qaRejectionsWeek: trustMeta("qa_rejections_semana"),
    },
  });
}
