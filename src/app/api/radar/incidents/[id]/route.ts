import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/radar-auth";

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status) {
    if (!["open", "investigating", "resolved", "known_limitation"].includes(String(body.status))) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }
    data.status = body.status;
    if (body.status === "resolved" || body.status === "known_limitation") data.resolvedAt = new Date();
  }
  if ("hypothesis" in body) data.hypothesis = body.hypothesis;
  if ("resolution" in body) data.resolution = body.resolution;

  const updated = await prisma.dataIncident.update({ where: { id }, data });
  return NextResponse.json(updated);
}
