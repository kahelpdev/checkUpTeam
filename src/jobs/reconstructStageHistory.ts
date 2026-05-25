import { prisma } from "@/lib/prisma";
import { businessMinutesBetween } from "@/lib/business-minutes";

export interface SnapshotMember {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  eventId: string | null;
  eventTitle: string | null;
  priority: string | null;
  currentStage: string | null;
  teamName: string | null;
  projectName: string | null;
  stageEnteredAt: string | null;
  businessMinutesInStage: number | null;
}

export interface SnapshotEntry {
  snapshotId: string;
  capturedAt: Date;
  teamConfigId: string;
  members: SnapshotMember[];
}

export interface StageTransition {
  eventId: string;
  action: "open" | "close";
  stage: string;
  at: Date;
  snapshotId: string;
  teamConfigId: string;
  enteredAtReportedBySource?: Date | null;
}

interface OpenRow {
  eventId: string;
  stage: string;
  enteredAt: Date;
}

/**
 * Função pura — testável.
 * Dado uma lista cronológica de snapshots + estado inicial (mapa eventId→linha aberta),
 * retorna a lista de transições (open/close) ordenadas no tempo.
 */
export function detectTransitions(
  snapshots: SnapshotEntry[],
  initialOpen: Map<string, OpenRow>
): StageTransition[] {
  const open = new Map(initialOpen);
  const transitions: StageTransition[] = [];

  for (const snap of snapshots) {
    const seenEventIds = new Set<string>();

    for (const m of snap.members) {
      if (!m.eventId || !m.currentStage) continue;
      seenEventIds.add(m.eventId);

      const reportedDate = m.stageEnteredAt ? new Date(m.stageEnteredAt) : null;
      const cur = open.get(m.eventId);
      if (!cur) {
        transitions.push({
          eventId: m.eventId,
          action: "open",
          stage: m.currentStage,
          at: snap.capturedAt,
          snapshotId: snap.snapshotId,
          teamConfigId: snap.teamConfigId,
          enteredAtReportedBySource: reportedDate,
        });
        open.set(m.eventId, { eventId: m.eventId, stage: m.currentStage, enteredAt: snap.capturedAt });
      } else if (cur.stage !== m.currentStage) {
        transitions.push({
          eventId: m.eventId,
          action: "close",
          stage: cur.stage,
          at: snap.capturedAt,
          snapshotId: snap.snapshotId,
          teamConfigId: snap.teamConfigId,
        });
        transitions.push({
          eventId: m.eventId,
          action: "open",
          stage: m.currentStage,
          at: snap.capturedAt,
          snapshotId: snap.snapshotId,
          teamConfigId: snap.teamConfigId,
          enteredAtReportedBySource: reportedDate,
        });
        open.set(m.eventId, { eventId: m.eventId, stage: m.currentStage, enteredAt: snap.capturedAt });
      }
    }

    // Eventos que estavam abertos e sumiram do snapshot → fecha
    for (const [eventId, row] of open) {
      if (!seenEventIds.has(eventId)) {
        transitions.push({
          eventId,
          action: "close",
          stage: row.stage,
          at: snap.capturedAt,
          snapshotId: snap.snapshotId,
          teamConfigId: snap.teamConfigId,
        });
        open.delete(eventId);
      }
    }
  }

  return transitions;
}

/**
 * Job A — incremental e idempotente.
 * Lê snapshots de /devbi/current-tasks desde o último captured_at já processado,
 * aplica detectTransitions e grava em fact_event_stage_history.
 */
export async function runReconstructStageHistory(): Promise<{ processedSnapshots: number; openedRows: number; closedRows: number }> {
  const registry = await prisma.apiRegistry.findFirst({ where: { path: "/devbi/current-tasks" } });
  if (!registry) return { processedSnapshots: 0, openedRows: 0, closedRows: 0 };

  // Estado inicial: linhas abertas no fact
  const openRowsDb = await prisma.factEventStageHistory.findMany({ where: { exitedAt: null } });
  const initialOpen = new Map<string, OpenRow>();
  for (const row of openRowsDb) {
    initialOpen.set(row.eventId, { eventId: row.eventId, stage: row.stage, enteredAt: row.enteredAt });
  }

  // Pega timestamp da última reconstrução
  const lastRecon = await prisma.factEventStageHistory.aggregate({ _max: { reconstructedAt: true } });
  const since = lastRecon._max.reconstructedAt ?? new Date(0);

  const snapsRaw = await prisma.apiSnapshot.findMany({
    where: { apiRegistryId: registry.id, capturedAt: { gt: since } },
    orderBy: { capturedAt: "asc" },
    select: { id: true, capturedAt: true, teamConfigId: true, payload: true },
  });

  if (snapsRaw.length === 0) return { processedSnapshots: 0, openedRows: 0, closedRows: 0 };

  // Agrupa por team
  const byTeam = new Map<string, SnapshotEntry[]>();
  for (const s of snapsRaw) {
    const teamId = s.teamConfigId ?? "_global";
    const members = Array.isArray(s.payload) ? (s.payload as unknown as SnapshotMember[]) : [];
    const entry: SnapshotEntry = {
      snapshotId: s.id,
      capturedAt: s.capturedAt,
      teamConfigId: teamId,
      members,
    };
    if (!byTeam.has(teamId)) byTeam.set(teamId, []);
    byTeam.get(teamId)!.push(entry);
  }

  let opened = 0;
  let closed = 0;

  for (const [, snaps] of byTeam) {
    const transitions = detectTransitions(snaps, initialOpen);

    for (const t of transitions) {
      if (t.action === "open") {
        await prisma.factEventStageHistory.create({
          data: {
            eventId: t.eventId,
            teamConfigId: t.teamConfigId,
            stage: t.stage,
            enteredAt: t.at,
            enteredAtReportedBySource: t.enteredAtReportedBySource ?? null,
            sourceSnapshotId: t.snapshotId,
          },
        });
        opened++;
      } else {
        const row = await prisma.factEventStageHistory.findFirst({
          where: { eventId: t.eventId, stage: t.stage, exitedAt: null },
          orderBy: { enteredAt: "desc" },
        });
        if (row) {
          const durationMin = Math.max(0, Math.round((t.at.getTime() - row.enteredAt.getTime()) / 60000));
          const businessMin = businessMinutesBetween(row.enteredAt, t.at);
          await prisma.factEventStageHistory.update({
            where: { id: row.id },
            data: { exitedAt: t.at, durationMinutes: durationMin, durationBusinessMinutes: businessMin },
          });
          closed++;
        }
      }
    }
  }

  return { processedSnapshots: snapsRaw.length, openedRows: opened, closedRows: closed };
}
