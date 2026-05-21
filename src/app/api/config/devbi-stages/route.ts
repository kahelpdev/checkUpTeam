import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getDevbiExecutionStages,
  setDevbiExecutionStages,
  getDevbiExecutionStagesKey,
  getDevbiExecutionStagesDefault,
} from "@/lib/devbi-config";

export async function GET() {
  const key = getDevbiExecutionStagesKey();
  const config = await prisma.appConfig.findUnique({ where: { key } });
  const stages = await getDevbiExecutionStages();
  const source = config?.value ? "database" : "default";
  return NextResponse.json({
    stages,
    source,
    default: getDevbiExecutionStagesDefault(),
    updatedAt: config?.updatedAt ?? null,
  });
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const raw = (body as { stages?: unknown })?.stages;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "stages deve ser um array de strings" }, { status: 400 });
  }

  try {
    const stages = await setDevbiExecutionStages(raw as string[]);
    const config = await prisma.appConfig.findUnique({
      where: { key: getDevbiExecutionStagesKey() },
    });
    return NextResponse.json({
      ok: true,
      stages,
      updatedAt: config?.updatedAt ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar stages";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
