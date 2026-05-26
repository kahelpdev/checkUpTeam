import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/radar-auth";

interface Params { params: Promise<{ key: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { key } = await params;
  const body = await req.json();

  const allowed = ["name", "description", "formula", "sourceA", "sourceB", "tolerancePct", "periodicity", "confidence", "displayMode", "category"];
  const data: Record<string, unknown> = {};
  for (const f of allowed) if (f in body) data[f] = body[f];

  if (data.confidence && !["draft", "released", "deprecated"].includes(String(data.confidence))) {
    return NextResponse.json({ error: "confidence inválido" }, { status: 400 });
  }
  if (data.displayMode && !["mirror", "revised"].includes(String(data.displayMode))) {
    return NextResponse.json({ error: "displayMode inválido" }, { status: 400 });
  }

  const updated = await prisma.metricDefinition.update({ where: { key }, data });
  return NextResponse.json(updated);
}
