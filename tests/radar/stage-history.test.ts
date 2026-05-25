/**
 * Testa só a lógica pura de detecção de transição.
 * O job em si lê do DB; aqui exercita a função que decide se há transição.
 *
 * Uso: npx tsx tests/radar/stage-history.test.ts
 */
import { detectTransitions, SnapshotEntry, StageTransition } from "@/jobs/reconstructStageHistory";

function fmt(t: StageTransition[]): string {
  return t.map((x) => `${x.eventId}:${x.action}:${x.stage}@${x.at.toISOString()}`).join("|");
}

let passed = 0;
let failed = 0;

function check(name: string, actual: string, expected: string) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}\n  expected: ${expected}\n  actual:   ${actual}`);
  if (ok) passed++; else failed++;
}

// Caso 1: 2 snapshots, mesmo evento permanece no stage
{
  const snaps: SnapshotEntry[] = [
    { snapshotId: "s1", capturedAt: new Date("2026-05-04T10:00:00Z"), teamConfigId: "t1", members: [
      { userId: "u1", userName: "X", avatarUrl: null, eventId: "e1", eventTitle: "T", priority: null, currentStage: "Em Execução", teamName: null, projectName: null, stageEnteredAt: null, businessMinutesInStage: null },
    ]},
    { snapshotId: "s2", capturedAt: new Date("2026-05-04T10:30:00Z"), teamConfigId: "t1", members: [
      { userId: "u1", userName: "X", avatarUrl: null, eventId: "e1", eventTitle: "T", priority: null, currentStage: "Em Execução", teamName: null, projectName: null, stageEnteredAt: null, businessMinutesInStage: null },
    ]},
  ];
  const transitions = detectTransitions(snaps, new Map());
  check("same stage no transition", fmt(transitions), "e1:open:Em Execução@2026-05-04T10:00:00.000Z");
}

// Caso 2: mudou de stage → fecha antiga + abre nova
{
  const snaps: SnapshotEntry[] = [
    { snapshotId: "s1", capturedAt: new Date("2026-05-04T10:00:00Z"), teamConfigId: "t1", members: [
      { userId: "u1", userName: "X", avatarUrl: null, eventId: "e1", eventTitle: "T", priority: null, currentStage: "Em Execução", teamName: null, projectName: null, stageEnteredAt: null, businessMinutesInStage: null },
    ]},
    { snapshotId: "s2", capturedAt: new Date("2026-05-04T11:00:00Z"), teamConfigId: "t1", members: [
      { userId: "u1", userName: "X", avatarUrl: null, eventId: "e1", eventTitle: "T", priority: null, currentStage: "Em QA", teamName: null, projectName: null, stageEnteredAt: null, businessMinutesInStage: null },
    ]},
  ];
  const transitions = detectTransitions(snaps, new Map());
  check(
    "stage change",
    fmt(transitions),
    "e1:open:Em Execução@2026-05-04T10:00:00.000Z|e1:close:Em Execução@2026-05-04T11:00:00.000Z|e1:open:Em QA@2026-05-04T11:00:00.000Z"
  );
}

// Caso 3: evento some do snapshot → fecha linha aberta
{
  const snaps: SnapshotEntry[] = [
    { snapshotId: "s1", capturedAt: new Date("2026-05-04T10:00:00Z"), teamConfigId: "t1", members: [
      { userId: "u1", userName: "X", avatarUrl: null, eventId: "e1", eventTitle: "T", priority: null, currentStage: "Em Execução", teamName: null, projectName: null, stageEnteredAt: null, businessMinutesInStage: null },
    ]},
    { snapshotId: "s2", capturedAt: new Date("2026-05-04T11:00:00Z"), teamConfigId: "t1", members: [] },
  ];
  const transitions = detectTransitions(snaps, new Map());
  check(
    "event disappeared",
    fmt(transitions),
    "e1:open:Em Execução@2026-05-04T10:00:00.000Z|e1:close:Em Execução@2026-05-04T11:00:00.000Z"
  );
}

// Caso 4: novo evento aparece no segundo snapshot
{
  const snaps: SnapshotEntry[] = [
    { snapshotId: "s1", capturedAt: new Date("2026-05-04T10:00:00Z"), teamConfigId: "t1", members: [] },
    { snapshotId: "s2", capturedAt: new Date("2026-05-04T11:00:00Z"), teamConfigId: "t1", members: [
      { userId: "u1", userName: "X", avatarUrl: null, eventId: "e1", eventTitle: "T", priority: null, currentStage: "Em Execução", teamName: null, projectName: null, stageEnteredAt: null, businessMinutesInStage: null },
    ]},
  ];
  const transitions = detectTransitions(snaps, new Map());
  check("new event appeared", fmt(transitions), "e1:open:Em Execução@2026-05-04T11:00:00.000Z");
}

// Caso 5: eventId null (sem evento) é ignorado
{
  const snaps: SnapshotEntry[] = [
    { snapshotId: "s1", capturedAt: new Date("2026-05-04T10:00:00Z"), teamConfigId: "t1", members: [
      { userId: "u1", userName: "X", avatarUrl: null, eventId: null, eventTitle: null, priority: null, currentStage: null, teamName: null, projectName: null, stageEnteredAt: null, businessMinutesInStage: null },
    ]},
  ];
  const transitions = detectTransitions(snaps, new Map());
  check("null eventId ignored", fmt(transitions), "");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
