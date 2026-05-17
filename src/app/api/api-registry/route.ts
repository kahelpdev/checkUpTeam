import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callCardflowEndpoint } from "@/services/cardflow";

export async function GET() {
  const apis = await prisma.apiRegistry.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(apis);
}

export async function POST(req: Request) {
  const body = await req.json();
  const api = await prisma.apiRegistry.create({
    data: {
      name: body.name,
      path: body.path,
      method: body.method || "GET",
      params: body.params || null,
      description: body.description || null,
    },
  });
  return NextResponse.json(api, { status: 201 });
}

// PATCH /:id — atualiza status via ping
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id } = body;

  const api = await prisma.apiRegistry.findUnique({ where: { id } });
  if (!api) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  let status = "unhealthy";
  try {
    await callCardflowEndpoint(api.path, {});
    status = "healthy";
  } catch {
    status = "unhealthy";
  }

  const updated = await prisma.apiRegistry.update({
    where: { id },
    data: { lastChecked: new Date(), lastStatus: status },
  });

  return NextResponse.json(updated);
}
