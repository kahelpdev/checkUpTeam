import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/radar-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const items = await prisma.metricDefinition.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const body = await req.json();
  if (!body.key || !body.name || !body.formula || !body.sourceA || !body.periodicity) {
    return NextResponse.json({ error: "campos obrigatórios: key, name, formula, sourceA, periodicity" }, { status: 400 });
  }
  const created = await prisma.metricDefinition.create({
    data: {
      key: String(body.key),
      name: String(body.name),
      description: body.description ?? null,
      formula: String(body.formula),
      sourceA: String(body.sourceA),
      sourceB: body.sourceB ?? null,
      tolerancePct: body.tolerancePct ?? null,
      periodicity: String(body.periodicity),
      confidence: "draft",
      displayMode: body.displayMode ?? "mirror",
      category: body.category ?? null,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
