/**
 * Testes dos calculators puros de métricas.
 * Uso: npx tsx tests/radar/metric-calculators.test.ts
 */
import {
  calcTotalCardsAbertos,
  calcResolvidosHoje,
  calcEventosPendentes,
  calcTempoMedioEmExecucao,
  computeStatus,
} from "@/jobs/metric-calculators";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, msg = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${msg ? " — " + msg : ""}`);
  if (ok) passed++; else failed++;
}

// total_cards_abertos
{
  const r = calcTotalCardsAbertos(
    { cardsAbertos: 142 },
    [
      { eventId: "e1", currentStage: "x" }, { eventId: "e2", currentStage: "y" }, { eventId: "e1", currentStage: "z" },
      { eventId: null, currentStage: null },
    ]
  );
  check("total_cards_abertos source A", r.valueSourceA === 142);
  check("total_cards_abertos source B (distinct + skip null)", r.valueSourceB === 2);
}

// resolvidos_hoje
{
  const today = "2026-05-25";
  const r = calcResolvidosHoje(
    { resolvidosHoje: 15 },
    [{ date: today, total: 30, resolved: 10 }, { date: today, total: 5, resolved: 5 }, { date: "2026-05-24", total: 1, resolved: 1 }],
    today
  );
  check("resolvidos_hoje source A", r.valueSourceA === 15);
  check("resolvidos_hoje source B (soma só do dia)", r.valueSourceB === 15);
}

// eventos_pendentes
{
  const r = calcEventosPendentes(
    { eventosPendentes: 7 },
    [{ eventId: "e1" }, { eventId: null }, { eventId: "e2" }, { eventId: "e1" }]
  );
  check("eventos_pendentes source A", r.valueSourceA === 7);
  check("eventos_pendentes source B (count distinct not null)", r.valueSourceB === 2);
}

// tempo_medio_em_execucao
{
  const r = calcTempoMedioEmExecucao(
    [
      { currentStage: "Em Execução", businessMinutesInStage: 100 },
      { currentStage: "Em Execução", businessMinutesInStage: 200 },
      { currentStage: "Em QA", businessMinutesInStage: 999 },
      { currentStage: null, businessMinutesInStage: null },
    ],
    [
      { stage: "Em Execução", durationBusinessMinutes: 120, exitedAt: null },
      { stage: "Em Execução", durationBusinessMinutes: 180, exitedAt: null },
      { stage: "Em QA", durationBusinessMinutes: 999, exitedAt: null },
    ]
  );
  check("tempo_medio source A (média só do stage)", r.valueSourceA === 150);
  check("tempo_medio source B (média do recálculo só do stage)", r.valueSourceB === 150);
}

// computeStatus
{
  check("status: no_data", computeStatus(null, null, 5) === "no_data");
  check("status: medium (só A)", computeStatus(100, null, 5) === "medium");
  check("status: high (bate)", computeStatus(100, 102, 5) === "high");
  check("status: review (delta > tolerance)", computeStatus(100, 110, 5) === "review");
  check("status: high (sem tolerance config)", computeStatus(100, 100, null) === "high");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
