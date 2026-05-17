import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";
import { format, subDays } from "date-fns";

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

  const now = new Date();
  const startDate = format(subDays(now, 30), "yyyy-MM-dd");
  const endDate = format(now, "yyyy-MM-dd");

  try {
    const data = await CardflowService.getWorkload(teamConfig.teamId, startDate, endDate);
    return NextResponse.json(data);
  } catch {
    // API indisponível — tenta retornar último snapshot salvo
    const registry = await prisma.apiRegistry.findFirst({
      where: { path: "/devbi/workload", isActive: true },
    });
    if (registry) {
      const snapshot = await prisma.apiSnapshot.findFirst({
        where: { apiRegistryId: registry.id, teamConfigId },
        orderBy: { capturedAt: "desc" },
      });
      if (snapshot) {
        const payload = Array.isArray(snapshot.payload) ? snapshot.payload : [];
        return NextResponse.json(payload, {
          headers: {
            "X-Data-Source": "cache",
            "X-Cached-At": snapshot.capturedAt.toISOString(),
          },
        });
      }
    }
    return NextResponse.json([], {
      headers: { "X-Data-Source": "unavailable" },
    });
  }
}
