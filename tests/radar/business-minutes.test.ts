/**
 * Testes de business minutes.
 *
 * Uso: npx tsx tests/radar/business-minutes.test.ts
 * Saída: stdout com PASS/FAIL.
 */
import { businessMinutesBetween } from "@/lib/business-minutes";

type TestCase = { name: string; from: string; to: string; expected: number };

const cases: TestCase[] = [
  // Mesmo dia útil 10:00 -> 12:00 = 120 min
  { name: "same-day 10-12", from: "2026-05-04T10:00:00-03:00", to: "2026-05-04T12:00:00-03:00", expected: 120 },
  // Fora do horário (antes das 8h) deve clamp
  { name: "before-hours 06-09", from: "2026-05-04T06:00:00-03:00", to: "2026-05-04T09:00:00-03:00", expected: 60 },
  // Cruza horário não-útil 17:00 -> 19:00 = só conta até 18 = 60 min
  { name: "after-hours 17-19", from: "2026-05-04T17:00:00-03:00", to: "2026-05-04T19:00:00-03:00", expected: 60 },
  // Sexta 17:00 -> Segunda 09:00 = 60min sexta + 60min segunda = 120 min
  { name: "weekend skip", from: "2026-05-01T17:00:00-03:00", to: "2026-05-04T09:00:00-03:00", expected: 120 },
  // Sábado inteiro
  { name: "saturday only", from: "2026-05-02T10:00:00-03:00", to: "2026-05-02T12:00:00-03:00", expected: 0 },
  // Domingo inteiro
  { name: "sunday only", from: "2026-05-03T10:00:00-03:00", to: "2026-05-03T12:00:00-03:00", expected: 0 },
  // from == to
  { name: "zero-range", from: "2026-05-04T10:00:00-03:00", to: "2026-05-04T10:00:00-03:00", expected: 0 },
  // Inverso: to < from deve dar 0 (nunca negativo)
  { name: "negative", from: "2026-05-04T12:00:00-03:00", to: "2026-05-04T10:00:00-03:00", expected: 0 },
];

let passed = 0;
let failed = 0;
for (const tc of cases) {
  const actual = businessMinutesBetween(new Date(tc.from), new Date(tc.to));
  const ok = actual === tc.expected;
  console.log(`${ok ? "PASS" : "FAIL"} ${tc.name}: expected ${tc.expected}, got ${actual}`);
  if (ok) passed++; else failed++;
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
