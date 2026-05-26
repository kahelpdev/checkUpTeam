import { MetricStatus } from "@/types/radar";

export interface CalcResult {
  valueSourceA: number | null;
  valueSourceB: number | null;
  value: number | null;
  deltaPct: number | null;
}

export function computeStatus(valueA: number | null, valueB: number | null, tolerancePct: number | null): MetricStatus {
  if (valueA === null && valueB === null) return "no_data";
  if (valueA === null || valueB === null) return "medium";
  if (tolerancePct === null || tolerancePct === undefined) return "high";
  if (valueA === 0 && valueB === 0) return "high";
  const ref = Math.max(Math.abs(valueA), Math.abs(valueB));
  if (ref === 0) return "high";
  const delta = Math.abs(valueA - valueB) / ref * 100;
  return delta <= tolerancePct ? "high" : "review";
}

function deltaPct(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  const ref = Math.max(Math.abs(a), Math.abs(b));
  if (ref === 0) return 0;
  return Math.abs(a - b) / ref * 100;
}

function pickValueMirror(a: number | null, b: number | null): number | null {
  return a ?? b;
}

// ── Calculators ──────────────────────────────────────────────────────────────

type Kpis = { cardsAbertos?: number; resolvidosHoje?: number; eventosPendentes?: number; slaEmRisco?: number };
type CurrentTask = { eventId?: string | null; currentStage?: string | null; businessMinutesInStage?: number | null };
type DemandPoint = { date: string; total: number; resolved: number };
type FactRow = { stage: string; durationBusinessMinutes: number | null; exitedAt: Date | null };

export function calcTotalCardsAbertos(kpis: Kpis, currentTasks: CurrentTask[]): CalcResult {
  const a = typeof kpis.cardsAbertos === "number" ? kpis.cardsAbertos : null;
  const distinct = new Set<string>();
  for (const t of currentTasks) if (t.eventId) distinct.add(t.eventId);
  const b = distinct.size;
  return { valueSourceA: a, valueSourceB: b, value: pickValueMirror(a, b), deltaPct: deltaPct(a, b) };
}

export function calcResolvidosHoje(kpis: Kpis, demand: DemandPoint[], today: string): CalcResult {
  const a = typeof kpis.resolvidosHoje === "number" ? kpis.resolvidosHoje : null;
  const b = demand.filter((d) => d.date === today).reduce((s, d) => s + (typeof d.resolved === "number" ? d.resolved : 0), 0);
  return { valueSourceA: a, valueSourceB: b, value: pickValueMirror(a, b), deltaPct: deltaPct(a, b) };
}

export function calcEventosPendentes(kpis: Kpis, currentTasks: CurrentTask[]): CalcResult {
  const a = typeof kpis.eventosPendentes === "number" ? kpis.eventosPendentes : null;
  const distinct = new Set<string>();
  for (const t of currentTasks) if (t.eventId) distinct.add(t.eventId);
  const b = distinct.size;
  return { valueSourceA: a, valueSourceB: b, value: pickValueMirror(a, b), deltaPct: deltaPct(a, b) };
}

export function calcSlaEmRisco(kpis: Kpis, factRows: FactRow[], thresholdMin: number): CalcResult {
  const a = typeof kpis.slaEmRisco === "number" ? kpis.slaEmRisco : null;
  const b = factRows.filter((r) => r.exitedAt === null && (r.durationBusinessMinutes ?? 0) > thresholdMin).length;
  return { valueSourceA: a, valueSourceB: b, value: pickValueMirror(a, b), deltaPct: deltaPct(a, b) };
}

function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  return Math.round(sum / values.length);
}

export function calcTempoMedioEmExecucao(currentTasks: CurrentTask[], factRows: FactRow[]): CalcResult {
  const stage = "Em Execução";
  const a = averageOf(
    currentTasks
      .filter((t) => t.currentStage === stage && typeof t.businessMinutesInStage === "number")
      .map((t) => t.businessMinutesInStage as number)
  );
  const b = averageOf(
    factRows
      .filter((r) => r.stage === stage && typeof r.durationBusinessMinutes === "number")
      .map((r) => r.durationBusinessMinutes as number)
  );
  return { valueSourceA: a, valueSourceB: b, value: pickValueMirror(a, b), deltaPct: deltaPct(a, b) };
}
