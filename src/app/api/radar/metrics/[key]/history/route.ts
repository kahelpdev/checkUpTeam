import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/radar-auth";

interface Params { params: Promise<{ key: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { key } = await params;
  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Record<string, unknown> = { metricKey: key };
  if (teamId) where.teamConfigId = teamId;
  if (from || to) {
    where.period = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const history = await prisma.metricResult.findMany({
    where,
    orderBy: { period: "asc" },
    take: 365,
    select: { period: true, value: true, valueSourceA: true, valueSourceB: true, deltaPct: true, status: true, calculatedAt: true },
  });

  return NextResponse.json({ history });
}
