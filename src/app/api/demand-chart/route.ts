import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";
import { format, subDays } from "date-fns";

function parseDemandChart(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((e) => ({
    date:     String(e.date),
    total:    parseInt(String(e.total))    || 0,
    resolved: parseInt(String(e.resolved)) || 0,
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const teamConfigId = searchParams.get("teamConfigId") || undefined;
  const endDate   = searchParams.get("endDate")   ?? format(new Date(), "yyyy-MM-dd");
  const startDate = searchParams.get("startDate") ?? format(subDays(new Date(), 29), "yyyy-MM-dd");

  // ── 1. Tenta chamada ao vivo (timeout de 5 s via AbortSignal em cardflow.ts) ──
  if (teamConfigId) {
    try {
      const teamConfig = await prisma.teamsConfig.findUnique({ where: { id: teamConfigId } });
      if (teamConfig) {
        const raw = await CardflowService.getDemandChart(teamConfig.teamId, startDate, endDate);
        return NextResponse.json({ data: parseDemandChart(raw), capturedAt: null, dataSource: "live" });
      }
    } catch {
      // API indisponível ou timeout — cai no cache
    }
  }

  // ── 2. Fallback: último snapshot salvo no banco ──
  const snapshot = await prisma.apiSnapshot.findFirst({
    where: { teamConfigId, apiRegistry: { path: "/devbi/demand-chart" } },
    orderBy: { capturedAt: "desc" },
    select: { payload: true, capturedAt: true },
  });

  if (!snapshot) {
    return NextResponse.json(
      { error: "Sem dados. Aguarde o próximo ciclo de ingestion." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: parseDemandChart(snapshot.payload),
    capturedAt: snapshot.capturedAt,
    dataSource: "cache",
  });
}
