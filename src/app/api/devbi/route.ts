import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";
import { format, subDays } from "date-fns";

// ─── Helpers para ler snapshots do banco ───────────────────────────────────

async function getSnapshotPayload<T>(path: string, teamConfigId: string): Promise<T | null> {
  const registry = await prisma.apiRegistry.findFirst({
    where: { path, isActive: true },
    select: { id: true },
  });
  if (!registry) return null;
  const snap = await prisma.apiSnapshot.findFirst({
    where: { apiRegistryId: registry.id, teamConfigId },
    orderBy: { capturedAt: "desc" },
    select: { payload: true, capturedAt: true },
  });
  if (!snap) return null;
  return snap.payload as T;
}

// ─── Parsers de payload (normaliza strings numéricas) ─────────────────────

function parseKpis(raw: unknown) {
  const r = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
  if (!r) return null;
  return {
    cardsAbertos:    parseInt(String(r.cardsAbertos))    || 0,
    eventosPendentes:parseInt(String(r.eventosPendentes))|| 0,
    slaEmRisco:      parseInt(String(r.slaEmRisco))      || 0,
    resolvidosHoje:  parseInt(String(r.resolvidosHoje))  || 0,
  };
}

function parseDemandChart(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((e) => ({
    date:     String(e.date),
    total:    parseInt(String(e.total))    || 0,
    resolved: parseInt(String(e.resolved)) || 0,
  }));
}

function parseRankings(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((r) => ({
    userId:        String(r.userId ?? ""),
    userName:      String(r.userName ?? ""),
    avatarUrl:     r.avatarUrl ? String(r.avatarUrl) : null,
    kanbanScore:   Number(r.kanbanScore)   || 0,
    qaSubmissions: Number(r.qaSubmissions) || 0,
    qaApprovals:   Number(r.qaApprovals)   || 0,
    qaRejections:  Number(r.qaRejections)  || 0,
    qaHitRate:     r.qaHitRate != null ? Number(r.qaHitRate) : null,
    qaStatus:      String(r.qaStatus ?? ""),
    slaScore:      Number(r.slaScore)      || 0,
    slaPct:        r.slaPct  != null ? Number(r.slaPct)  : null,
    slaProfile:    String(r.slaProfile ?? ""),
    eventsResolved:Number(r.eventsResolved)|| 0,
    fastTrackCount:Number(r.fastTrackCount)|| 0,
    onTimeCount:   Number(r.onTimeCount)   || 0,
    breachedCount: Number(r.breachedCount) || 0,
  }));
}

function parseCurrentTasks(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((t) => ({
    userId:               String(t.userId ?? ""),
    userName:             String(t.userName ?? ""),
    avatarUrl:            t.avatarUrl ? String(t.avatarUrl) : null,
    eventId:              t.eventId   ? String(t.eventId)   : null,
    eventTitle:           t.eventTitle? String(t.eventTitle): null,
    priority:             t.priority  ? String(t.priority)  : null,
    currentStage:         t.currentStage ? String(t.currentStage) : null,
    teamName:             t.teamName  ? String(t.teamName)  : null,
    projectName:          t.projectName ? String(t.projectName) : null,
    stageEnteredAt:       t.stageEnteredAt ? String(t.stageEnteredAt) : null,
    businessMinutesInStage: t.businessMinutesInStage != null ? Number(t.businessMinutesInStage) : null,
  }));
}

function parseWorkload(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((w) => ({
    userId:         String(w.userId ?? ""),
    userName:       String(w.userName ?? ""),
    avatarUrl:      w.avatarUrl ? String(w.avatarUrl) : null,
    activeEvents:   Number(w.activeEvents)   || 0,
    resolvedEvents: Number(w.resolvedEvents) || 0,
    totalEvents:    Number(w.totalEvents)    || 0,
  }));
}

// ─── Cálculo comparativo semanal ─────────────────────────────────────────

function calcWeeklyChange(chart: { date: string; total: number }[]) {
  const sorted = [...chart].sort((a, b) => a.date.localeCompare(b.date));
  const last14  = sorted.slice(-14);
  const prev    = last14.slice(0, 7).reduce((s, d) => s + d.total, 0);
  const curr    = last14.slice(7).reduce((s, d) => s + d.total, 0);
  return prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : 0;
}

// ─── Handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const teamConfigId = searchParams.get("teamConfigId") ?? "";
  const projectId    = searchParams.get("projectId")    ?? "";
  const endDate      = searchParams.get("endDate")      ?? format(new Date(), "yyyy-MM-dd");
  const startDate    = searchParams.get("startDate")    ?? format(subDays(new Date(), 29), "yyyy-MM-dd");

  if (!teamConfigId) {
    return NextResponse.json({ error: "teamConfigId obrigatório" }, { status: 400 });
  }

  // Resolve o teamId do cardsFlow a partir do teamConfigId interno
  const teamConfig = await prisma.teamsConfig.findUnique({ where: { id: teamConfigId } });
  if (!teamConfig) {
    return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
  }

  const chartStart = format(subDays(new Date(startDate), 7), "yyyy-MM-dd");
  let dataSource: "live" | "cache" = "live";
  let cachedAt: string | null = null;

  // ── 1. Tenta chamada ao vivo para todos os endpoints ──
  try {
    const [kpisArr, rankings, currentTasks, workload, demandChart] = await Promise.all([
      CardflowService.getKpis(teamConfig.teamId, startDate, endDate),
      CardflowService.getRankings(teamConfig.teamId, startDate, endDate, projectId),
      CardflowService.getCurrentTasks(teamConfig.teamId),
      CardflowService.getWorkload(teamConfig.teamId, startDate, endDate),
      CardflowService.getDemandChart(teamConfig.teamId, chartStart, endDate),
    ]);

    const kpis        = parseKpis(kpisArr);
    const parsedChart = parseDemandChart(demandChart);

    return NextResponse.json({
      kpis,
      rankings:     parseRankings(rankings),
      currentTasks: parseCurrentTasks(currentTasks),
      workload:     parseWorkload(workload),
      demandChart:  parsedChart.slice(-14),
      weeklyChangePct: calcWeeklyChange(parsedChart),
      dataSource: "live",
    });

  } catch {
    // ── 2. API indisponível — lê do banco (api_snapshots) ──
    dataSource = "cache";

    const [kpisRaw, rankingsRaw, currentTasksRaw, workloadRaw, demandRaw] = await Promise.all([
      getSnapshotPayload("/devbi/kpis",          teamConfigId),
      getSnapshotPayload("/devbi/rankings",       teamConfigId),
      getSnapshotPayload("/devbi/current-tasks",  teamConfigId),
      getSnapshotPayload("/devbi/workload",        teamConfigId),
      getSnapshotPayload("/devbi/demand-chart",   teamConfigId),
    ]);

    // Busca o timestamp do snapshot mais recente para exibir ao usuário
    const registry = await prisma.apiRegistry.findFirst({
      where: { path: "/devbi/kpis", isActive: true },
      select: { id: true },
    });
    if (registry) {
      const snap = await prisma.apiSnapshot.findFirst({
        where: { apiRegistryId: registry.id, teamConfigId },
        orderBy: { capturedAt: "desc" },
        select: { capturedAt: true },
      });
      cachedAt = snap?.capturedAt.toISOString() ?? null;
    }

    const parsedChart = parseDemandChart(demandRaw);

    return NextResponse.json(
      {
        kpis:         parseKpis(kpisRaw),
        rankings:     parseRankings(rankingsRaw),
        currentTasks: parseCurrentTasks(currentTasksRaw),
        workload:     parseWorkload(workloadRaw),
        demandChart:  parsedChart.slice(-14),
        weeklyChangePct: calcWeeklyChange(parsedChart),
        dataSource,
        cachedAt,
      },
      {
        headers: {
          "X-Data-Source": "cache",
          ...(cachedAt ? { "X-Cached-At": cachedAt } : {}),
        },
      }
    );
  }
}
