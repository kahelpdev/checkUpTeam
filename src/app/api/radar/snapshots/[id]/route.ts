import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/radar-auth";

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const snap = await prisma.apiSnapshot.findUnique({
    where: { id },
    include: { apiRegistry: { select: { name: true, path: true } } },
  });
  if (!snap) return NextResponse.json({ error: "snapshot não encontrado" }, { status: 404 });

  return NextResponse.json({
    id: snap.id,
    capturedAt: snap.capturedAt,
    source: `${snap.apiRegistry.name} (${snap.apiRegistry.path})`,
    teamConfigId: snap.teamConfigId,
    payload: snap.payload,
  });
}
