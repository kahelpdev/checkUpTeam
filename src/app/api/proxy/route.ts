import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callCardflowEndpoint, CardflowParams } from "@/services/cardflow";

// POST /api/proxy — proxy dinâmico via api_registry
// Body: { endpointId: string, params?: Record<string, string | number> }
export async function POST(req: NextRequest) {
  let body: { endpointId?: string; params?: CardflowParams };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const { endpointId, params = {} } = body;
  if (!endpointId) {
    return NextResponse.json({ error: "endpointId obrigatório" }, { status: 400 });
  }

  const endpoint = await prisma.apiRegistry.findUnique({ where: { id: endpointId } });
  if (!endpoint || !endpoint.isActive) {
    return NextResponse.json({ error: "Endpoint não encontrado ou inativo" }, { status: 404 });
  }

  try {
    const data = await callCardflowEndpoint(endpoint.path, params);
    return NextResponse.json({ data, fetchedAt: new Date().toISOString(), endpointId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao chamar cardsFlow";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
