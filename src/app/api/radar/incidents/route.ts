import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/radar-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const metricKey = url.searchParams.get("metricKey");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (metricKey) where.metricKey = metricKey;

  const incidents = await prisma.dataIncident.findMany({
    where,
    orderBy: { detectedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ incidents });
}
