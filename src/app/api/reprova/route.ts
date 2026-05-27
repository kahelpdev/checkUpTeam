import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";
import { format, subDays, parseISO } from "date-fns";

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

  // ── 1. Rankings para o período exato via Snapshots (delta) ──────────────────
  let members: RankingRow[] = [];
  let dataSource: "live" | "cache" = "cache";
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
    // Busca 1 dia antes do período para ter baseline do delta do primeiro dia
    const snapStart = format(subDays(parseISO(startDate), 1), "yyyy-MM-dd");

    const snapshots = await prisma.apiSnapshot.findMany({
      where: {
        apiRegistryId: rankingsRegistry.id,
        teamConfigId,
        capturedAt: {
          gte: new Date(`${snapStart}T00:00:00`),
          lte: new Date(`${endDate}T23:59:59`),
        },
      },
      orderBy: { capturedAt: "asc" },
      select: { payload: true, capturedAt: true },
    });

    // Agrupa por data local
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
      // Coleta todos os usuários únicos
      const userMap = new Map<string, { userName: string; avatarUrl: string | null }>();
      for (const date of periodDates) {
        const payload = lastSnapByDate.get(date) ?? [];
        for (const u of payload) {
          const userId = String(u.userId ?? "");
          const userName = String(u.userName ?? "");
          if (userId && userName) {
            userMap.set(userId, {
              userName,
              avatarUrl: u.avatarUrl ? String(u.avatarUrl) : null,
            });
          }
        }
      }

      // Inicializa acumuladores
      const userStats = new Map<string, { submissions: number; rejections: number; approvals: number }>();
      for (const userId of userMap.keys()) {
        userStats.set(userId, { submissions: 0, rejections: 0, approvals: 0 });
      }

      // Soma deltas diários
      for (const date of periodDates) {
        const currPayload = lastSnapByDate.get(date) ?? [];
        const prevIdx = allDates.indexOf(date) - 1;
        const prevPayload = prevIdx >= 0 ? (lastSnapByDate.get(allDates[prevIdx]) ?? []) : [];

        const prevMap = new Map<string, Record<string, unknown>>();
        for (const u of prevPayload) {
          const userId = String(u.userId ?? "");
          if (userId) prevMap.set(userId, u);
        }

        for (const currU of currPayload) {
          const userId = String(currU.userId ?? "");
          if (!userId) continue;

          const prevU = prevMap.get(userId);

          const currSub = Number(currU.qaSubmissions) || 0;
          const currRej = Number(currU.qaRejections) || 0;
          const currApp = Number(currU.qaApprovals) || 0;

          const prevSub = prevU ? (Number(prevU.qaSubmissions) || 0) : 0;
          const prevRej = prevU ? (Number(prevU.qaRejections) || 0) : 0;
          const prevApp = prevU ? (Number(prevU.qaApprovals) || 0) : 0;

          const deltaSub = Math.max(0, currSub - prevSub);
          const deltaRej = Math.max(0, currRej - prevRej);
          const deltaApp = Math.max(0, currApp - prevApp);

          const stats = userStats.get(userId)!;
          stats.submissions += deltaSub;
          stats.rejections  += deltaRej;
          stats.approvals   += deltaApp;
        }
      }

      // Pega status do último dia
      const lastDate = periodDates[periodDates.length - 1];
      const lastPayload = lastSnapByDate.get(lastDate) ?? [];
      const lastUserStatusMap = new Map<string, { status: string | null; hitRate: number | null }>();
      for (const u of lastPayload) {
        const userId = String(u.userId ?? "");
        if (userId) {
          lastUserStatusMap.set(userId, {
            status: u.qaStatus ? String(u.qaStatus) : null,
            hitRate: u.qaHitRate != null ? Number(u.qaHitRate) : null,
          });
        }
      }

      members = Array.from(userMap.entries()).map(([userId, info]) => {
        const stats = userStats.get(userId)!;
        const lastInfo = lastUserStatusMap.get(userId);
        
        const hitRate = stats.submissions > 0
          ? Math.round(((stats.submissions - stats.rejections) / stats.submissions) * 1000) / 10
          : null;

        return {
          userId,
          userName: info.userName,
          avatarUrl: info.avatarUrl,
          qaSubmissions: stats.submissions,
          qaApprovals: stats.approvals,
          qaRejections: stats.rejections,
          qaHitRate: hitRate,
          qaStatus: lastInfo?.status ?? null,
        };
      });

      calculatedFromSnapshots = true;
      dataSource = "cache";
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
    members,
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
