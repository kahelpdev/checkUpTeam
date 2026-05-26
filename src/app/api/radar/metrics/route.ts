import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLider } from "@/lib/radar-auth";
import { MetricResultDTO } from "@/types/radar";

// GET /api/radar/metrics?keys=k1,k2&teamId=X&period=2026-05-25
export async function GET(req: NextRequest) {
  const auth = await requireLider(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const keysParam = url.searchParams.get("keys");
  const teamId = url.searchParams.get("teamId");
  const period = url.searchParams.get("period");

  if (!keysParam) return NextResponse.json({ error: "keys obrigatório" }, { status: 400 });
  const keys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);

  const isAdmin = auth.user.role === "admin";
  const definitions = await prisma.metricDefinition.findMany({ where: { key: { in: keys } } });
  const visibleKeys = definitions
    .filter((d) => isAdmin || d.confidence === "released")
    .map((d) => d.key);

  const results = await prisma.metricResult.findMany({
    where: {
      metricKey: { in: visibleKeys },
      ...(teamId ? { teamConfigId: teamId } : {}),
      ...(period ? { period } : {}),
    },
    orderBy: { calculatedAt: "desc" },
  });

  // dedupe: para cada metricKey × teamConfigId fica a row mais recente
  const seen = new Set<string>();
  const dedup = results.filter((r) => {
    const k = `${r.metricKey}|${r.teamConfigId ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const incidents = await prisma.dataIncident.findMany({
    where: { metricKey: { in: visibleKeys }, status: { in: ["open", "investigating"] } },
  });
  const incidentByKey = new Map(incidents.map((i) => [i.metricKey, i.id]));

  const dto: MetricResultDTO[] = dedup.map((r) => ({
    key: r.metricKey,
    value: r.value,
    status: r.status as MetricResultDTO["status"],
    valueSourceA: isAdmin ? r.valueSourceA : null,
    valueSourceB: isAdmin ? r.valueSourceB : null,
    deltaPct: isAdmin ? r.deltaPct : null,
    incidentId: incidentByKey.get(r.metricKey),
    asOf: r.calculatedAt.toISOString(),
  }));

  return NextResponse.json({ metrics: dto });
}
