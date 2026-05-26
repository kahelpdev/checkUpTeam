import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";
import { businessMinutesBetween } from "@/lib/business-minutes";
import { format } from "date-fns";

interface RawTask {
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

function parseTask(t: Record<string, unknown>): RawTask {
  return {
    userId:                 String(t.userId ?? ""),
    userName:               String(t.userName ?? ""),
    avatarUrl:              t.avatarUrl  ? String(t.avatarUrl)  : null,
    eventId:                t.eventId   ? String(t.eventId)   : null,
    eventTitle:             t.eventTitle? String(t.eventTitle): null,
    priority:               t.priority  ? String(t.priority)  : null,
    currentStage:           t.currentStage ? String(t.currentStage) : null,
    teamName:               t.teamName  ? String(t.teamName)  : null,
    projectName:            t.projectName ? String(t.projectName) : null,
    stageEnteredAt:         t.stageEnteredAt ? String(t.stageEnteredAt) : null,
    businessMinutesInStage: t.businessMinutesInStage != null ? Number(t.businessMinutesInStage) : null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const teamConfigId = searchParams.get("teamConfigId");

  if (!teamConfigId) {
    return NextResponse.json({ error: "teamConfigId obrigatório" }, { status: 400 });
  }

  const teamConfig = await prisma.teamsConfig.findUnique({ where: { id: teamConfigId } });
  if (!teamConfig) {
    return NextResponse.json({ error: "Equipe não encontrada" }, { status: 404 });
  }

  let rawTasks: RawTask[] = [];
  let dataSource: "live" | "cache" | "unavailable" = "live";
  let cachedAt: string | null = null;

  try {
    const live = await CardflowService.getCurrentTasks(teamConfig.teamId);
    rawTasks = (Array.isArray(live) ? live : []) as RawTask[];
  } catch {
    const registry = await prisma.apiRegistry.findFirst({
      where: { path: "/devbi/current-tasks", isActive: true },
    });
    if (registry) {
      const snapshot = await prisma.apiSnapshot.findFirst({
        where: { apiRegistryId: registry.id, teamConfigId },
        orderBy: { capturedAt: "desc" },
      });
      if (snapshot) {
        const payload = Array.isArray(snapshot.payload) ? snapshot.payload : [];
        rawTasks = (payload as Record<string, unknown>[]).map(parseTask);
        dataSource = "cache";
        cachedAt = snapshot.capturedAt.toISOString();
      } else {
        dataSource = "unavailable";
      }
    } else {
      dataSource = "unavailable";
    }
  }

  // ── Trust Layer E4 Integration ──
  const tempoDef = await prisma.metricDefinition.findUnique({
    where: { key: "tempo_em_etapa_por_pessoa" },
  });
  const useRevisedTempo = tempoDef?.displayMode === "revised";

  let tasks = rawTasks;
  if (useRevisedTempo) {
    const activeEventIds = rawTasks.map((t) => t.eventId).filter((id): id is string => id !== null);
    if (activeEventIds.length > 0) {
      const activeStages = await prisma.factEventStageHistory.findMany({
        where: {
          eventId: { in: activeEventIds },
          teamConfigId: teamConfig.id,
          exitedAt: null,
        },
      });
      const stageEntryMap = new Map<string, Date>();
      for (const s of activeStages) {
        stageEntryMap.set(`${s.eventId}|${s.stage}`, s.enteredAt);
      }
      const now = new Date();
      tasks = rawTasks.map((t) => {
        if (!t.eventId || !t.currentStage) return t;
        const enteredAt = stageEntryMap.get(`${t.eventId}|${t.currentStage}`);
        if (enteredAt) {
          return { ...t, businessMinutesInStage: businessMinutesBetween(enteredAt, now) };
        }
        return t;
      });
    }
  }

  const period = format(new Date(), "yyyy-MM-dd");
  const tempoResult = await prisma.metricResult.findFirst({
    where: { metricKey: "tempo_em_etapa_por_pessoa", teamConfigId: teamConfig.id, period },
  });
  const tempoIncident = await prisma.dataIncident.findFirst({
    where: { metricKey: "tempo_em_etapa_por_pessoa", status: { in: ["open", "investigating"] } },
  });

  const tempoEmEtapaMeta = {
    status: (tempoResult?.status ?? "no_data") as "high" | "medium" | "review" | "no_data",
    incidentId: tempoIncident?.id ?? null,
  };

  const headers: Record<string, string> = { "X-Data-Source": dataSource };
  if (cachedAt) headers["X-Cached-At"] = cachedAt;

  return NextResponse.json({ tasks, tempoEmEtapaMeta }, { headers });
}
