import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";
import { format, subDays, addDays, parseISO } from "date-fns";

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

function getLocalDateString(date: Date): string {
  const tzOffset = -3 * 60; // UTC-3 in minutes
  const localTime = new Date(date.getTime() + tzOffset * 60 * 1000);
  return localTime.toISOString().slice(0, 10);
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

  // ── 1. Rankings via último snapshot do período (valores absolutos) ────────────
  let members: RankingRow[] = [];
  let dataSource: "live" | "cache" | "snapshots" = "cache";
  let cachedAt: string | undefined;

  const rankingsRegistry = await prisma.apiRegistry.findFirst({
    where: { path: "/devbi/rankings", isActive: true },
    select: { id: true },
  });

  type ChartPoint = Record<string, string | number>;
  let chartData: ChartPoint[] = [];
  let dailyBreakdown: ChartPoint[] = [];
  let calculatedFromSnapshots = false;

  if (rankingsRegistry) {
    // Busca 2 dias antes e 1 dia depois do período para garantir que não haja cortes de fuso horário (UTC)
    const dbStart = format(subDays(parseISO(startDate), 2), "yyyy-MM-dd");
    const dbEnd   = format(addDays(parseISO(endDate), 1), "yyyy-MM-dd");

    const snapshots = await prisma.apiSnapshot.findMany({
      where: {
        apiRegistryId: rankingsRegistry.id,
        teamConfigId,
        capturedAt: {
          gte: new Date(`${dbStart}T00:00:00Z`),
          lte: new Date(`${dbEnd}T23:59:59Z`),
        },
      },
      orderBy: { capturedAt: "asc" },
      select: { payload: true, capturedAt: true },
    });

    // Agrupa por data local (mantém o último snapshot de cada dia)
    const lastSnapByDate = new Map<string, Array<Record<string, unknown>>>();
    for (const snap of snapshots) {
      const date = getLocalDateString(snap.capturedAt);
      if (Array.isArray(snap.payload)) {
        lastSnapByDate.set(date, snap.payload as Array<Record<string, unknown>>);
      }
    }

    const allDates = [...lastSnapByDate.keys()].sort();
    const periodDates = allDates.filter((d) => d >= startDate && d <= endDate);

    if (periodDates.length > 0) {
      // Usa valores ABSOLUTOS do último snapshot do período
      const lastDate = periodDates[periodDates.length - 1];
      const lastPayload = lastSnapByDate.get(lastDate) ?? [];
      members = parseRankings(lastPayload);

      calculatedFromSnapshots = true;
      dataSource = "snapshots";
      const latestSnapshot = snapshots[snapshots.length - 1];
      cachedAt = latestSnapshot.capturedAt.toISOString();
    }

    // ── 2. Snapshots diários: gráfico de tendência + breakdown por dia ────────
    // Agrupa apenas reprovas para o gráfico/breakdown
    const rejectionsByDate = new Map<string, Record<string, number>>();
    for (const [date, payload] of lastSnapByDate.entries()) {
      const users: Record<string, number> = {};
      for (const u of payload) {
        const name = String(u.userName ?? "");
        if (name) users[name] = Number(u.qaRejections) || 0;
      }
      rejectionsByDate.set(date, users);
    }

    const allDatesWithRejections = [...lastSnapByDate.keys()].sort();
    const periodDatesWithRejections = allDatesWithRejections.filter((d) => d >= startDate && d <= endDate);

    // chartData: valor acumulado por dia (gráfico de tendência)
    chartData = periodDatesWithRejections.map((date) => ({
      date,
      ...(rejectionsByDate.get(date) ?? {}),
    }));

    // dailyBreakdown: delta entre dias consecutivos (reprovas novas no dia)
    dailyBreakdown = periodDatesWithRejections.map((date) => {
      const curr     = rejectionsByDate.get(date) ?? {};
      const prevIdx  = allDatesWithRejections.indexOf(date) - 1;
      const prev     = prevIdx >= 0 ? (rejectionsByDate.get(allDatesWithRejections[prevIdx]) ?? {}) : {};
      const allNames = new Set([...Object.keys(curr), ...Object.keys(prev)]);
      const row: ChartPoint = { date };
      for (const name of allNames) {
        row[name] = Math.max(0, (curr[name] ?? 0) - (prev[name] ?? 0));
      }
      return row;
    });
  }

  // Fallback para CardsFlow live se não calculou via snapshots
  if (!calculatedFromSnapshots) {
    try {
      const rankingsRaw = await CardflowService.getRankings(teamConfig.teamId, startDate, endDate);
      members = parseRankings(rankingsRaw);
      dataSource = "live";
    } catch {
      // Fallback para o último snapshot absoluto se tudo falhar
      if (rankingsRegistry) {
        const snap = await prisma.apiSnapshot.findFirst({
          where: { apiRegistryId: rankingsRegistry.id, teamConfigId },
          orderBy: { capturedAt: "desc" },
          select: { payload: true, capturedAt: true },
        });
        if (snap) {
          members = parseRankings(snap.payload);
          dataSource = "cache";
          cachedAt = snap.capturedAt.toISOString();
        }
      }
    }
  }

  const totalSubmissions = members.reduce((s, m) => s + m.qaSubmissions, 0);
  const totalRejections  = members.reduce((s, m) => s + m.qaRejections,  0);
  const teamHitRate = totalSubmissions > 0
    ? Math.round(((totalSubmissions - totalRejections) / totalSubmissions) * 1000) / 10
    : null;

  // ── 3. Reprovas internas detectadas por movimentação de estágio ─────────────
  // Busca com buffer UTC e filtra por data local (UTC-3)
  const detectedRaw = await prisma.detectedReprova.findMany({
    where: {
      teamConfigId,
      detectedAt: {
        gte: new Date(`${format(subDays(parseISO(startDate), 1), "yyyy-MM-dd")}T00:00:00.000Z`),
        lte: new Date(`${format(addDays(parseISO(endDate), 1), "yyyy-MM-dd")}T23:59:59.999Z`),
      },
    },
    select: { userId: true, userName: true, detectedAt: true },
    orderBy: { detectedAt: "asc" },
  });
  const detectedRows = detectedRaw.filter((r) => {
    const d = getLocalDateString(r.detectedAt);
    return d >= startDate && d <= endDate;
  });

  // Agrupa por membro
  const detectedByMember: Record<string, number> = {};
  for (const r of detectedRows) {
    const name = r.userName;
    detectedByMember[name] = (detectedByMember[name] ?? 0) + 1;
  }

  // Agrupa por dia (UTC-3)
  const detectedByDay: Record<string, Record<string, number>> = {};
  for (const r of detectedRows) {
    const day = getLocalDateString(r.detectedAt);
    if (!detectedByDay[day]) detectedByDay[day] = {};
    const name = r.userName;
    detectedByDay[day][name] = (detectedByDay[day][name] ?? 0) + 1;
  }

  // Gera array de dias dentro do período
  const detectedDailyBreakdown: ChartPoint[] = [];
  const start = parseISO(startDate);
  const end   = parseISO(endDate);
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const day = format(d, "yyyy-MM-dd");
    detectedDailyBreakdown.push({ date: day, ...(detectedByDay[day] ?? {}) });
  }

  const detectedReprovas = {
    byMember: detectedByMember,
    byDay:    detectedDailyBreakdown,
    total:    detectedRows.length,
  };

  // ── 4. Trust Layer ─────────────────────────────────────────────────────────
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
    members,
    teamKpi: {
      totalSubmissions,
      totalRejections,
      teamHitRate,
      alertCount: members.filter((m) => m.qaStatus === "Alerta Comport.").length,
    },
    chartData,
    dailyBreakdown,
    detectedReprovas,
    dataSource,
    cachedAt,
    reprovaMeta: {
      devReprova:       trustMeta("dev_reprova_summary"),
      alertComport:     trustMeta("dev_alerta_comportamental"),
      qaRejectionsWeek: trustMeta("qa_rejections_semana"),
    },
  });
}
