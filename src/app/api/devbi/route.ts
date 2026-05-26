import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";
import { getDevbiExecutionStages } from "@/lib/devbi-config";
import { format, subDays, parseISO } from "date-fns";
import { businessMinutesBetween } from "@/lib/business-minutes";

const PATHS = [
  "/devbi/kpis",
  "/devbi/rankings",
  "/devbi/current-tasks",
  "/devbi/workload",
  "/devbi/demand-chart",
] as const;

// ─── Response cache in-memory (TTL 30s) ────────────────────────────────────

type CacheEntry = { payload: unknown; at: number };
const respCache = new Map<string, CacheEntry>();
const RESP_TTL = 30_000;

function cacheKey(teamConfigId: string, startDate: string, endDate: string, projectId: string) {
  return `${teamConfigId}|${startDate}|${endDate}|${projectId}`;
}

// ─── Bulk snapshot resolver (1 query para registry + 1 para snapshots) ─────

async function getSnapshotMap(teamConfigId: string) {
  const registries = await prisma.apiRegistry.findMany({
    where: { path: { in: [...PATHS] }, isActive: true },
    select: { id: true, path: true },
  });
  const ids = registries.map((r) => r.id);
  if (ids.length === 0) return { map: new Map<string, unknown>(), latestAt: null as Date | null };

  const snaps = await prisma.apiSnapshot.findMany({
    where: { apiRegistryId: { in: ids }, teamConfigId },
    orderBy: { capturedAt: "desc" },
    distinct: ["apiRegistryId"],
    select: { apiRegistryId: true, payload: true, capturedAt: true },
  });

  const idToPath = new Map(registries.map((r) => [r.id, r.path]));
  const map = new Map<string, unknown>();
  let latestAt: Date | null = null;
  for (const s of snaps) {
    const path = idToPath.get(s.apiRegistryId);
    if (path) map.set(path, s.payload);
    if (!latestAt || s.capturedAt > latestAt) latestAt = s.capturedAt;
  }
  return { map, latestAt };
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

  if (parseISO(startDate) > parseISO(endDate)) {
    return NextResponse.json({ error: "startDate posterior a endDate" }, { status: 400 });
  }

  const teamConfig = await prisma.teamsConfig.findUnique({ where: { id: teamConfigId } });
  if (!teamConfig) {
    return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
  }

  // ── Response cache hit ──
  const key = cacheKey(teamConfigId, startDate, endDate, projectId);
  const cached = respCache.get(key);
  if (cached && Date.now() - cached.at < RESP_TTL) {
    return NextResponse.json(cached.payload, {
      headers: {
        "X-Data-Source": "memo",
        "X-Cache-Age": String(Date.now() - cached.at),
      },
    });
  }

  const chartStart = format(subDays(parseISO(startDate), 7), "yyyy-MM-dd");

  // ── Live-mix: Promise.allSettled, fallback granular por endpoint ──
  const results = await Promise.allSettled([
    CardflowService.getKpis(teamConfig.teamId, startDate, endDate),
    CardflowService.getRankings(teamConfig.teamId, startDate, endDate, projectId),
    CardflowService.getCurrentTasks(teamConfig.teamId),
    CardflowService.getWorkload(teamConfig.teamId, startDate, endDate),
    CardflowService.getDemandChart(teamConfig.teamId, chartStart, endDate),
  ]);

  const anyFailed = results.some((r) => r.status === "rejected");
  let snapshotMap: Map<string, unknown> | null = null;
  let latestAt: Date | null = null;
  if (anyFailed) {
    const snap = await getSnapshotMap(teamConfigId);
    snapshotMap = snap.map;
    latestAt = snap.latestAt;
  }

  const pickRaw = (i: number, path: string) =>
    results[i].status === "fulfilled"
      ? (results[i] as PromiseFulfilledResult<unknown>).value
      : snapshotMap?.get(path) ?? null;

  const kpisRaw         = pickRaw(0, "/devbi/kpis");
  const rankingsRaw     = pickRaw(1, "/devbi/rankings");
  const currentTasksRaw = pickRaw(2, "/devbi/current-tasks");
  const workloadRaw     = pickRaw(3, "/devbi/workload");
  const demandRaw       = pickRaw(4, "/devbi/demand-chart");

  const parsedChart = parseDemandChart(demandRaw);
  const dataSource: "live" | "mixed" | "cache" = anyFailed
    ? (results.every((r) => r.status === "rejected") ? "cache" : "mixed")
    : "live";

  const executionStages = await getDevbiExecutionStages();
  const executionStagesSet = new Set(executionStages);
  const allCurrentTasks = parseCurrentTasks(currentTasksRaw);
  const availableStages = [
    ...new Set(
      allCurrentTasks
        .map((t) => t.currentStage)
        .filter((s): s is string => s !== null && s !== "")
    ),
  ].sort();
  const filteredCurrentTasks = allCurrentTasks.filter(
    (t) => t.eventId !== null && t.currentStage !== null && executionStagesSet.has(t.currentStage)
  );

  // ── Trust Layer E3 Integration ──
  const metricKeys = ["total_cards_abertos", "eventos_pendentes", "sla_em_risco", "resolvidos_hoje", "tempo_em_etapa_por_pessoa"];
  const definitions = await prisma.metricDefinition.findMany({
    where: { key: { in: metricKeys } }
  });
  const defMap = new Map(definitions.map((d) => [d.key, d]));

  const period = format(new Date(), "yyyy-MM-dd");
  const metricResults = await prisma.metricResult.findMany({
    where: {
      metricKey: { in: metricKeys },
      teamConfigId: teamConfig.id,
      period
    }
  });
  const resMap = new Map(metricResults.map((r) => [r.metricKey, r]));

  const activeIncidents = await prisma.dataIncident.findMany({
    where: {
      metricKey: { in: metricKeys },
      status: { in: ["open", "investigating"] }
    }
  });
  const incidentByKey = new Map(activeIncidents.map((i) => [i.metricKey, i.id]));

  const getKpiMeta = (key: string, originalVal: number) => {
    const def = defMap.get(key);
    const result = resMap.get(key);
    const incidentId = incidentByKey.get(key);
    
    let val = originalVal;
    let status = result?.status ?? "no_data";
    
    if (result) {
      const useRevised = def?.displayMode === "revised" && result.valueSourceB !== null;
      const rawVal = useRevised ? result.valueSourceB : (result.valueSourceA ?? originalVal);
      val = rawVal !== null ? Number(rawVal) : originalVal;
    }
    
    return {
      value: val,
      status: status as any,
      incidentId
    };
  };

  const parsedKpis = parseKpis(kpisRaw);
  const kpisPayload = parsedKpis ? {
    cardsAbertos: getKpiMeta("total_cards_abertos", parsedKpis.cardsAbertos),
    eventosPendentes: getKpiMeta("eventos_pendentes", parsedKpis.eventosPendentes),
    slaEmRisco: getKpiMeta("sla_em_risco", parsedKpis.slaEmRisco),
    resolvidosHoje: getKpiMeta("resolvidos_hoje", parsedKpis.resolvidosHoje),
  } : null;

  const tempoDef = defMap.get("tempo_em_etapa_por_pessoa");
  const useRevisedTempo = tempoDef?.displayMode === "revised";

  let recalculatedCurrentTasks = filteredCurrentTasks;
  if (useRevisedTempo) {
    const activeEventIds = filteredCurrentTasks.map((t) => t.eventId).filter((id): id is string => id !== null);
    if (activeEventIds.length > 0) {
      const activeStages = await prisma.factEventStageHistory.findMany({
        where: {
          eventId: { in: activeEventIds },
          teamConfigId: teamConfig.id,
          exitedAt: null
        }
      });
      const activeStageByEventAndStage = new Map<string, Date>();
      for (const s of activeStages) {
        activeStageByEventAndStage.set(`${s.eventId}|${s.stage}`, s.enteredAt);
      }

      const now = new Date();

      recalculatedCurrentTasks = filteredCurrentTasks.map((t) => {
        if (!t.eventId || !t.currentStage) return t;
        const key = `${t.eventId}|${t.currentStage}`;
        const enteredAt = activeStageByEventAndStage.get(key);
        if (enteredAt) {
          const recalculatedMins = businessMinutesBetween(enteredAt, now);
          return {
            ...t,
            businessMinutesInStage: recalculatedMins
          };
        }
        return t;
      });
    }
  }

  const tempoResult = resMap.get("tempo_em_etapa_por_pessoa");
  const tempoIncidentId = incidentByKey.get("tempo_em_etapa_por_pessoa");
  const tempoEmEtapaMeta = {
    status: tempoResult?.status ?? "no_data",
    incidentId: tempoIncidentId
  };

  const payload = {
    kpis:            kpisPayload,
    rankings:        parseRankings(rankingsRaw),
    currentTasks:    recalculatedCurrentTasks,
    tempoEmEtapaMeta,
    executionStages,
    availableStages,
    workload:        parseWorkload(workloadRaw),
    demandChart:     parsedChart.slice(-14),
    weeklyChangePct: calcWeeklyChange(parsedChart),
    dataSource,
    cachedAt: dataSource === "live" ? null : latestAt?.toISOString() ?? null,
    sourcesPerEndpoint: results.map((r, i) => ({
      path: PATHS[i],
      source: r.status === "fulfilled" ? "live" : "cache",
    })),
  };

  respCache.set(key, { payload, at: Date.now() });

  const liveCount = results.filter((r) => r.status === "fulfilled").length;
  const headers: Record<string, string> = {
    "X-Data-Source": dataSource,
    "X-Endpoints-Live": String(liveCount),
  };
  if (dataSource !== "live" && latestAt) {
    headers["X-Cached-At"] = latestAt.toISOString();
  }

  return NextResponse.json(payload, { headers });
}
