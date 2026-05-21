// POST /api/embeddings/backfill
//
// Endpoint idempotente para o Coolify scheduled task (a cada 5min) vetorizar
// relatórios novos inseridos pelo n8n direto no banco (que não passam pelo
// hook `upsertRelatorio`).
//
// Auth: header `X-Backfill-Secret: $AUTH_SECRET`.
// Limite default: 200 linhas/chamada → resposta < 30s (cobre ~40 inserts/min de pico).
//
// Mesma função `runBackfill` é usada pelo CLI (scripts/backfill-embeddings.ts).

import { NextRequest, NextResponse } from "next/server";
import { runBackfill } from "@/jobs/backfillEmbeddings";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export async function POST(req: NextRequest) {
  // Auth: reusa AUTH_SECRET já existente no container (não cria env nova)
  const provided = req.headers.get("x-backfill-secret");
  const expected = process.env.AUTH_SECRET;
  if (!expected) {
    console.error("[backfill-route] AUTH_SECRET não configurado");
    return NextResponse.json({ ok: false, error: "server misconfigured" }, { status: 500 });
  }
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Body opcional (todos os campos são opcionais)
  let body: { limit?: number; batchSize?: number; concurrency?: number; force?: boolean } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "body inválido" }, { status: 400 });
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, typeof body.limit === "number" ? body.limit : DEFAULT_LIMIT)
  );

  try {
    const result = await runBackfill({
      limit,
      batchSize: body.batchSize,
      concurrency: body.concurrency,
      force: body.force,
      onLog: (line) => console.log(line),
    });

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      failed: result.failed,
      initialNull: result.initialNull,
      remainingNull: result.remainingNull,
      durationMs: result.durationMs,
      modelo: result.modelo,
      failedSample: result.failedIds.slice(0, 5),
    });
  } catch (err) {
    console.error("[backfill-route] erro fatal:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "erro inesperado" },
      { status: 500 }
    );
  }
}
