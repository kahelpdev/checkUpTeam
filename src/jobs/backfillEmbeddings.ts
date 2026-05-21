// Backfill de embeddings para relatorios_diarios.
// Lógica reutilizada por:
//   - CLI:  scripts/backfill-embeddings.ts        (operador roda manualmente)
//   - HTTP: POST /api/embeddings/backfill          (Coolify scheduled task a cada 5min)
//
// Idempotente: só processa linhas com `embedding IS NULL` (a menos de --force).
// Pode ser interrompido com signal.aborted=true sem perda — retoma do ponto.

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { buildDocumento, embedDocument, persistEmbedding, EMBEDDING_MODEL } from "@/lib/embeddings";

export interface BackfillOptions {
  batchSize?: number;        // default 50
  concurrency?: number;      // default 5
  limit?: number | null;     // máximo de linhas a processar nesta execução
  dryRun?: boolean;
  force?: boolean;           // ignora `embedding IS NULL` e reprocessa tudo
  signal?: { aborted: boolean };
  onLog?: (line: string) => void;
}

export interface BackfillResult {
  processed: number;
  failed: number;
  initialNull: number;
  remainingNull: number;
  durationMs: number;
  failedIds: Array<{ id: string; reason: string }>;
  interrupted: boolean;
  modelo: string;
}

interface RelatorioRow {
  id: string;
  equipe: string;
  nome: string;
  comoSeSentiu: string;
  atividadesRealizadas: string;
  impedimentos: string;
  demandasPendenteColaborador: string;
  demandasPendenteLideranca: string;
  entregasPlanejadas: string;
  motivoNaoEntrega: string | null;
  motivoHoraExtra: string | null;
}

async function processOne(
  row: RelatorioRow,
  dryRun: boolean
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const doc = buildDocumento(row);
  if (!doc) return { ok: false, reason: "documento vazio" };
  if (dryRun) return { ok: true };

  const maxAttempts = 5;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const values = await embedDocument(doc);
      await persistEmbedding(row.id, values);
      return { ok: true };
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number; statusCode?: number })?.status
        ?? (err as { statusCode?: number })?.statusCode;
      const isRateLimit = status === 429;
      const isServerErr = typeof status === "number" && status >= 500;
      if (!isRateLimit && !isServerErr) break;
      const wait = Math.min(30_000, 1000 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return { ok: false, reason: String(lastErr) };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function runBackfill(opts: BackfillOptions = {}): Promise<BackfillResult> {
  const batchSize = opts.batchSize && opts.batchSize > 0 ? opts.batchSize : 50;
  const concurrency = opts.concurrency && opts.concurrency > 0 ? opts.concurrency : 5;
  const limit = opts.limit ?? null;
  const dryRun = !!opts.dryRun;
  const force = !!opts.force;
  const log = opts.onLog ?? (() => {});

  const startedAt = Date.now();
  log(`[backfill] modelo=${EMBEDDING_MODEL} batch=${batchSize} concurrency=${concurrency}`
    + ` limit=${limit ?? "∞"} dryRun=${dryRun} force=${force}`);

  const filterSql = force ? Prisma.sql`TRUE` : Prisma.sql`embedding IS NULL`;
  const totalRow = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count FROM relatorios_diarios WHERE ${filterSql}
  `);
  const initialNull = totalRow[0]?.count !== undefined ? Number(totalRow[0].count) : 0;
  log(`[backfill] linhas alvo: ${initialNull}`);

  let processed = 0;
  let failed = 0;
  const failedIds: Array<{ id: string; reason: string }> = [];
  let remaining = limit ?? initialNull;
  let interrupted = false;

  while (remaining > 0) {
    if (opts.signal?.aborted) { interrupted = true; break; }
    const take = Math.min(batchSize, remaining);
    const rows = await prisma.$queryRaw<RelatorioRow[]>(Prisma.sql`
      SELECT id,
             equipe,
             nome,
             como_se_sentiu                AS "comoSeSentiu",
             atividades_realizadas         AS "atividadesRealizadas",
             impedimentos,
             demandas_pendente_colaborador AS "demandasPendenteColaborador",
             demandas_pendente_lideranca   AS "demandasPendenteLideranca",
             entregas_planejadas           AS "entregasPlanejadas",
             motivo_nao_entrega            AS "motivoNaoEntrega",
             motivo_hora_extra             AS "motivoHoraExtra"
        FROM relatorios_diarios
        WHERE ${filterSql}
        ORDER BY data_dia DESC, created_at DESC
        LIMIT ${take}
    `);
    if (rows.length === 0) break;

    const t0 = Date.now();
    const results = await runWithConcurrency(rows, concurrency, (row) => processOne(row, dryRun));
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.ok) processed++;
      else { failed++; failedIds.push({ id: rows[i].id, reason: r.reason }); }
    }
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const totalDt = ((Date.now() - startedAt) / 1000).toFixed(0);
    log(`[backfill] +${rows.length} (ok=${processed}, fail=${failed}) em ${dt}s — total ${totalDt}s`);
    remaining -= rows.length;
  }

  const remainingRow = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count FROM relatorios_diarios WHERE embedding IS NULL
  `);
  const remainingNull = remainingRow[0]?.count !== undefined ? Number(remainingRow[0].count) : 0;

  return {
    processed,
    failed,
    initialNull,
    remainingNull,
    durationMs: Date.now() - startedAt,
    failedIds,
    interrupted,
    modelo: EMBEDDING_MODEL,
  };
}
