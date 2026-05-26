import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const teamConfigId = searchParams.get("teamConfigId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!teamConfigId) {
    return NextResponse.json({ error: "teamConfigId obrigatório" }, { status: 400 });
  }

  const where: Record<string, unknown> = { teamConfigId };
  if (startDate) where.recordedAt = { gte: new Date(startDate) };
  if (endDate) {
    const existingDate = (where.recordedAt as Record<string, unknown>) || {};
    where.recordedAt = { ...existingDate, lte: new Date(endDate) };
  }

  const latest = await prisma.reprovaHistory.findMany({
    where,
    orderBy: { recordedAt: "desc" },
  });

  const byUser = new Map<string, (typeof latest)[0]>();
  for (const record of latest) {
    if (!byUser.has(record.userId)) byUser.set(record.userId, record);
  }

  const all = Array.from(byUser.values());
  const totalSubmissions = all.reduce((s, r) => s + r.qaSubmissions, 0);
  const totalRejections = all.reduce((s, r) => s + r.qaRejections, 0);
  const teamHitRate =
    totalSubmissions > 0
      ? Math.round(((totalSubmissions - totalRejections) / totalSubmissions) * 1000) / 10
      : null;

  // Gráfico histórico: lê api_snapshots de rankings para ter série temporal completa
  const rankingsRegistry = await prisma.apiRegistry.findFirst({
    where: { path: "/devbi/rankings", isActive: true },
    select: { id: true },
  });

  type ChartPoint = Record<string, string | number>;
  let chartData: ChartPoint[] = [];

  if (rankingsRegistry) {
    const snapshotWhere: Record<string, unknown> = {
      teamConfigId,
      apiRegistryId: rankingsRegistry.id,
    };
    if (startDate) snapshotWhere.capturedAt = { gte: new Date(startDate) };
    if (endDate) {
      const existing = (snapshotWhere.capturedAt as Record<string, unknown>) || {};
      snapshotWhere.capturedAt = { ...existing, lte: new Date(endDate) };
    }

    const snapshots = await prisma.apiSnapshot.findMany({
      where: snapshotWhere,
      orderBy: { capturedAt: "asc" },
      select: { payload: true, capturedAt: true },
    });

    const byDate = new Map<string, Record<string, number>>();
    for (const snap of snapshots) {
      const date = snap.capturedAt.toISOString().slice(0, 10);
      const users: Record<string, number> = {};
      if (Array.isArray(snap.payload)) {
        for (const u of snap.payload as Array<Record<string, unknown>>) {
          const name = String(u.userName ?? "");
          if (name) users[name] = parseInt(String(u.qaRejections)) || 0;
        }
      }
      byDate.set(date, users);
    }

    chartData = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, users]) => ({ date, ...users }));
  }

  // ── Trust Layer E5 Integration ──
  const metricKeys = ["dev_reprova_summary", "dev_alerta_comportamental", "qa_rejections_semana"];
  const period = format(new Date(), "yyyy-MM-dd");

  const [metricResults, activeIncidents] = await Promise.all([
    prisma.metricResult.findMany({
      where: { metricKey: { in: metricKeys }, period },
    }),
    prisma.dataIncident.findMany({
      where: { metricKey: { in: metricKeys }, status: { in: ["open", "investigating"] } },
    }),
  ]);

  const resMap = new Map(metricResults.map((r) => [r.metricKey, r]));
  const incMap = new Map(activeIncidents.map((i) => [i.metricKey, i.id]));

  const trustMeta = (key: string) => ({
    status: (resMap.get(key)?.status ?? "no_data") as "high" | "medium" | "review" | "no_data",
    incidentId: incMap.get(key) ?? null,
  });

  return NextResponse.json({
    members: all,
    teamKpi: {
      totalSubmissions,
      totalRejections,
      teamHitRate,
      alertCount: all.filter((r) => r.qaStatus === "Alerta Comport.").length,
    },
    history: latest,
    chartData,
    reprovaMeta: {
      devReprova:        trustMeta("dev_reprova_summary"),
      alertComport:      trustMeta("dev_alerta_comportamental"),
      qaRejectionsWeek:  trustMeta("qa_rejections_semana"),
    },
  });
}
