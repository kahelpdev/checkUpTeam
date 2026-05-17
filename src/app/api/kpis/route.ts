import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";
import { format, subDays } from "date-fns";

function parseKpis(raw: unknown) {
  const r = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
  if (!r) return null;
  return {
    cardsAbertos:     parseInt(String(r.cardsAbertos))     || 0,
    eventosPendentes: parseInt(String(r.eventosPendentes)) || 0,
    slaEmRisco:       parseInt(String(r.slaEmRisco))       || 0,
    resolvidosHoje:   parseInt(String(r.resolvidosHoje))   || 0,
  };
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
        const raw = await CardflowService.getKpis(teamConfig.teamId, startDate, endDate);
        return NextResponse.json({ data: parseKpis(raw), capturedAt: null, dataSource: "live" });
      }
    } catch {
      // API indisponível ou timeout — cai no cache
    }
  }

  // ── 2. Fallback: último snapshot salvo no banco ──
  const snapshot = await prisma.apiSnapshot.findFirst({
    where: { teamConfigId, apiRegistry: { path: "/devbi/kpis" } },
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
    data: parseKpis(snapshot.payload),
    capturedAt: snapshot.capturedAt,
    dataSource: "cache",
  });
}
