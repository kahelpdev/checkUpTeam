import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import {
  calcTotalCardsAbertos,
  calcResolvidosHoje,
  calcEventosPendentes,
  calcSlaEmRisco,
  calcTempoMedioEmExecucao,
  computeStatus,
  CalcResult,
} from "@/jobs/metric-calculators";

type SnapMap = Map<string, unknown>;

async function loadSnapshotMap(teamConfigId: string): Promise<SnapMap> {
  const registries = await prisma.apiRegistry.findMany({
    where: { path: { in: ["/devbi/kpis", "/devbi/current-tasks", "/devbi/demand-chart"] } },
    select: { id: true, path: true },
  });
  const ids = registries.map((r) => r.id);
  const idToPath = new Map(registries.map((r) => [r.id, r.path]));
  if (ids.length === 0) return new Map();

  const snaps = await prisma.apiSnapshot.findMany({
    where: { apiRegistryId: { in: ids }, teamConfigId },
    orderBy: { capturedAt: "desc" },
    distinct: ["apiRegistryId"],
    select: { apiRegistryId: true, payload: true },
  });

  const out: SnapMap = new Map();
  for (const s of snaps) {
    const path = idToPath.get(s.apiRegistryId);
    if (path) out.set(path, s.payload);
  }
  return out;
}

function pickKpis(map: SnapMap): { cardsAbertos?: number; resolvidosHoje?: number; eventosPendentes?: number; slaEmRisco?: number } {
  const raw = map.get("/devbi/kpis");
  const r = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
  if (!r) return {};
  return {
    cardsAbertos: typeof r.cardsAbertos === "number" ? r.cardsAbertos : (parseInt(String(r.cardsAbertos)) || undefined),
    resolvidosHoje: typeof r.resolvidosHoje === "number" ? r.resolvidosHoje : (parseInt(String(r.resolvidosHoje)) || undefined),
    eventosPendentes: typeof r.eventosPendentes === "number" ? r.eventosPendentes : (parseInt(String(r.eventosPendentes)) || undefined),
    slaEmRisco: typeof r.slaEmRisco === "number" ? r.slaEmRisco : (parseInt(String(r.slaEmRisco)) || undefined),
  };
}

function pickCurrentTasks(map: SnapMap): Array<{ eventId: string | null; currentStage: string | null; businessMinutesInStage: number | null }> {
  const raw = map.get("/devbi/current-tasks");
  if (!Array.isArray(raw)) return [];
  return raw as Array<{ eventId: string | null; currentStage: string | null; businessMinutesInStage: number | null }>;
}

function pickDemand(map: SnapMap): Array<{ date: string; total: number; resolved: number }> {
  const raw = map.get("/devbi/demand-chart");
  if (!Array.isArray(raw)) return [];
  return raw as Array<{ date: string; total: number; resolved: number }>;
}

const SLA_THRESHOLD_MIN = parseInt(process.env.RADAR_SLA_THRESHOLD_MIN ?? "480", 10);

async function calculateForTeam(metricKey: string, teamConfigId: string): Promise<CalcResult | null> {
  const map = await loadSnapshotMap(teamConfigId);
  const kpis = pickKpis(map);
  const currentTasks = pickCurrentTasks(map);
  const demand = pickDemand(map);

  switch (metricKey) {
    case "total_cards_abertos":
      return calcTotalCardsAbertos(kpis, currentTasks);
    case "resolvidos_hoje":
      return calcResolvidosHoje(kpis, demand, format(new Date(), "yyyy-MM-dd"));
    case "eventos_pendentes":
      return calcEventosPendentes(kpis, currentTasks);
    case "sla_em_risco": {
      const facts = await prisma.factEventStageHistory.findMany({
        where: { teamConfigId, exitedAt: null },
        select: { stage: true, durationBusinessMinutes: true, exitedAt: true },
      });
      return calcSlaEmRisco(kpis, facts, SLA_THRESHOLD_MIN);
    }
    case "tempo_medio_em_execucao": {
      const facts = await prisma.factEventStageHistory.findMany({
        where: { teamConfigId, stage: "Em Execução" },
        orderBy: { enteredAt: "desc" },
        take: 200,
        select: { stage: true, durationBusinessMinutes: true, exitedAt: true },
      });
      return calcTempoMedioEmExecucao(currentTasks, facts);
    }
    default:
      return null;
  }
}

/**
 * Job C — calcula metric_results para todas as métricas, por team.
 * Idempotente: upsert por (metricKey, teamConfigId, period).
 */
export async function runComputeMetricResults(): Promise<{ metricsCalculated: number }> {
  const definitions = await prisma.metricDefinition.findMany({
    where: { confidence: { in: ["draft", "released"] } },
  });
  const teams = await prisma.teamsConfig.findMany({ where: { isActive: true } });

  const period = format(new Date(), "yyyy-MM-dd");
  let count = 0;

  for (const def of definitions) {
    for (const team of teams) {
      const calc = await calculateForTeam(def.key, team.id);
      if (!calc) continue;
      const status = computeStatus(calc.valueSourceA, calc.valueSourceB, def.tolerancePct);
      await prisma.metricResult.upsert({
        where: { metricKey_teamConfigId_period: { metricKey: def.key, teamConfigId: team.id, period } },
        update: {
          value: calc.value ?? 0,
          valueSourceA: calc.valueSourceA,
          valueSourceB: calc.valueSourceB,
          deltaPct: calc.deltaPct,
          status,
          calculatedAt: new Date(),
        },
        create: {
          metricKey: def.key,
          teamConfigId: team.id,
          period,
          value: calc.value ?? 0,
          valueSourceA: calc.valueSourceA,
          valueSourceB: calc.valueSourceB,
          deltaPct: calc.deltaPct,
          status,
        },
      });
      count++;
    }
  }

  return { metricsCalculated: count };
}
