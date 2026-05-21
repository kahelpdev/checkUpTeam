/**
 * Backfill de embeddings para relatorios_diarios.
 *
 * Uso:
 *   npm run backfill:embeddings              # processa tudo
 *   npm run backfill:embeddings:dry          # dry-run com limite 10
 *   npx tsx scripts/backfill-embeddings.ts --batch-size=100 --concurrency=8
 *   npx tsx scripts/backfill-embeddings.ts --limit=500
 *   npx tsx scripts/backfill-embeddings.ts --force    # reprocessa tudo (cuidado!)
 *
 * Idempotente: só processa linhas com `embedding IS NULL` (a menos de --force).
 * Pode ser interrompido com Ctrl+C — retoma do ponto na próxima execução.
 *
 * Custo: gratuito no free tier Gemini (1500 RPM em embeddings) para até
 * ~10k linhas/dia. Linhas falhas vão para `failed-ids.log`.
 */

import { runBackfill } from "@/jobs/backfillEmbeddings";
import { prisma } from "@/lib/prisma";
import { writeFile } from "node:fs/promises";

interface CliArgs {
  batchSize?: number;
  concurrency?: number;
  limit?: number | null;
  dryRun: boolean;
  force: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { dryRun: false, force: false };
  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--force") out.force = true;
    else if (arg.startsWith("--batch-size=")) out.batchSize = Number(arg.split("=")[1]);
    else if (arg.startsWith("--concurrency=")) out.concurrency = Number(arg.split("=")[1]);
    else if (arg.startsWith("--limit=")) out.limit = Number(arg.split("=")[1]);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Default dry-run: limit=10 se nenhum limit foi passado
  if (args.dryRun && args.limit === undefined) args.limit = 10;

  const abortController = { aborted: false };
  const onSig = () => {
    if (abortController.aborted) {
      console.log("\n[backfill] segundo Ctrl+C — saindo abrupto.");
      process.exit(130);
    }
    console.log("\n[backfill] Ctrl+C recebido — encerrando após batch atual...");
    abortController.aborted = true;
  };
  process.on("SIGINT", onSig);
  process.on("SIGTERM", onSig);

  const result = await runBackfill({
    batchSize: args.batchSize,
    concurrency: args.concurrency,
    limit: args.limit ?? null,
    dryRun: args.dryRun,
    force: args.force,
    signal: abortController,
    onLog: (line) => console.log(line),
  });

  console.log("\n=== BACKFILL RESULT ===");
  console.log(JSON.stringify({
    processed: result.processed,
    failed: result.failed,
    initialNull: result.initialNull,
    remainingNull: result.remainingNull,
    durationSec: Math.round(result.durationMs / 1000),
    interrupted: result.interrupted,
    modelo: result.modelo,
  }, null, 2));

  if (result.failedIds.length > 0) {
    const path = `failed-ids-${Date.now()}.log`;
    await writeFile(path, result.failedIds.map((f) => `${f.id}\t${f.reason}`).join("\n"));
    console.error(`\n[backfill] ${result.failedIds.length} linhas falharam → ${path}`);
  }

  await prisma.$disconnect();
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("[backfill] erro fatal:", err);
  await prisma.$disconnect();
  process.exit(2);
});
