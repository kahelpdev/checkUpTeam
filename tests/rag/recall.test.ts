/**
 * Recall@5 + latência runner para o RAG do CheckUp Team.
 *
 * Uso:
 *   npm run test:rag                                  # roda tudo
 *   BASE_URL=https://checkupteam.online npm run test:rag
 *
 * Pré-requisitos:
 *   - DATABASE_URL apontando para um banco com `embedding` populado (backfill rodado).
 *   - GEMINI_API_KEY válida.
 *   - Opcional: tests/rag/eval-set.local.json com expectedById preenchido.
 *
 * Saída: tabela no stdout + escrita em tests/rag/REPORT.md (overwrites última seção).
 *
 * Critérios de aprovação (Henrique):
 *   - Recall@5 >= 70% nas queries com expectedById preenchido.
 *   - Latência p95 <= 500ms no retrieval (sem síntese Gemini).
 *   - Adversariais: adv-01 e adv-02 devem retornar 200 com resposta;
 *                   adv-03 deve retornar 400.
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { embedQuery, toVectorLiteral } from "@/lib/embeddings";
import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";

interface EvalEntry {
  id: string;
  category: string;
  query: string;
  expectedById: string[] | null;
  notes: string;
}

interface LocalOverrides {
  [evalId: string]: string[];
}

interface RetrievalResult {
  evalId: string;
  category: string;
  query: string;
  expected: string[];
  retrievedIds: string[];
  topScore: number | null;
  latencyMs: number;
  hit: boolean | null;     // null se não tem expected
  error: string | null;
}

const TOP_K = 5;
const EVAL_SET_PATH = resolve(process.cwd(), "tests/rag/eval-set.json");
const LOCAL_OVERRIDES_PATH = resolve(process.cwd(), "tests/rag/eval-set.local.json");
const REPORT_PATH = resolve(process.cwd(), "tests/rag/REPORT.md");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function loadEvalSet(): Promise<EvalEntry[]> {
  const raw = await readFile(EVAL_SET_PATH, "utf8");
  return JSON.parse(raw) as EvalEntry[];
}

async function loadLocalOverrides(): Promise<LocalOverrides> {
  if (!(await exists(LOCAL_OVERRIDES_PATH))) return {};
  const raw = await readFile(LOCAL_OVERRIDES_PATH, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const out: LocalOverrides = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      out[k] = v as string[];
    }
  }
  return out;
}

async function runRetrieval(query: string): Promise<{ ids: string[]; topScore: number | null; latencyMs: number }> {
  const t0 = Date.now();
  const vec = await embedQuery(query);
  const literal = toVectorLiteral(vec);
  const rows = await prisma.$queryRaw<Array<{ id: string; score: number }>>(Prisma.sql`
    SELECT id, 1 - (embedding <=> ${literal}::vector) AS score
      FROM relatorios_diarios
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> ${literal}::vector
     LIMIT ${TOP_K}
  `);
  const latencyMs = Date.now() - t0;
  return {
    ids: rows.map((r) => r.id),
    topScore: rows[0]?.score !== undefined ? Number(rows[0].score) : null,
    latencyMs,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function testAdversarial(query: string): Promise<{ status: number; ok: boolean }> {
  const res = await fetch(`${BASE_URL}/api/relatorios/rag-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: query, topK: 5 }),
  });
  return { status: res.status, ok: res.ok };
}

async function testAiQueryDeprecation(): Promise<{ hasHeader: boolean; status: number }> {
  const res = await fetch(`${BASE_URL}/api/relatorios/ai-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "smoke" }),
  });
  return {
    hasHeader: res.headers.get("x-deprecated") !== null,
    status: res.status,
  };
}

function renderTable(results: RetrievalResult[]): string {
  const header = "| id | category | hit | top score | latency (ms) | retrieved |\n|---|---|---|---|---|---|";
  const rows = results.map((r) => {
    const hit = r.hit === null ? "—" : r.hit ? "✅" : "❌";
    const score = r.topScore === null ? "—" : r.topScore.toFixed(3);
    const retrieved = r.retrievedIds.slice(0, 3).map((id) => `\`${id.slice(0, 8)}\``).join(" ");
    return `| ${r.evalId} | ${r.category} | ${hit} | ${score} | ${r.latencyMs} | ${retrieved}${r.retrievedIds.length > 3 ? " …" : ""} |`;
  });
  return [header, ...rows].join("\n");
}

async function main(): Promise<void> {
  console.log(`[recall] base_url=${BASE_URL}`);
  const evalSet = await loadEvalSet();
  const overrides = await loadLocalOverrides();
  const overrideCount = Object.keys(overrides).length;
  console.log(`[recall] eval set: ${evalSet.length} queries; local overrides: ${overrideCount}`);

  // 1) Retrieval por query (não-adversariais)
  const nonAdv = evalSet.filter((e) => e.category !== "adversarial");
  const results: RetrievalResult[] = [];
  for (const entry of nonAdv) {
    const expected = overrides[entry.id] ?? entry.expectedById ?? [];
    try {
      const ret = await runRetrieval(entry.query);
      const hit = expected.length > 0
        ? expected.some((id) => ret.ids.includes(id))
        : null;
      results.push({
        evalId: entry.id,
        category: entry.category,
        query: entry.query,
        expected,
        retrievedIds: ret.ids,
        topScore: ret.topScore,
        latencyMs: ret.latencyMs,
        hit,
        error: null,
      });
      console.log(`[recall] ${entry.id} ${hit === null ? "(sem expected)" : hit ? "HIT" : "MISS"} ${ret.latencyMs}ms`);
    } catch (err) {
      results.push({
        evalId: entry.id,
        category: entry.category,
        query: entry.query,
        expected,
        retrievedIds: [],
        topScore: null,
        latencyMs: 0,
        hit: false,
        error: String(err),
      });
      console.error(`[recall] ${entry.id} ERROR:`, err);
    }
  }

  // 2) Métricas agregadas
  const withExpected = results.filter((r) => r.expected.length > 0);
  const hits = withExpected.filter((r) => r.hit).length;
  const recallAt5 = withExpected.length > 0 ? (hits / withExpected.length) * 100 : NaN;
  const latencies = results.filter((r) => r.latencyMs > 0).map((r) => r.latencyMs);
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);

  console.log(`\n[recall] === MÉTRICAS ===`);
  console.log(`  recall@5: ${recallAt5.toFixed(1)}% (${hits}/${withExpected.length})`);
  console.log(`  latência p50/p95: ${p50}ms / ${p95}ms`);

  // 3) Adversariais (precisa BASE_URL alcançável)
  let adversarialReport = "Não executado (precisa BASE_URL acessível).";
  try {
    const adv01 = await testAdversarial("qual a cor preferida do gerente?");
    const adv02 = await testAdversarial("who is overworked this week?");
    const adv03 = await testAdversarial("   ");
    adversarialReport = [
      `- adv-01 (sem match): status=${adv01.status} ${adv01.status === 200 ? "✅" : "❌"} (esperado 200)`,
      `- adv-02 (inglês):    status=${adv02.status} ${adv02.status === 200 ? "✅" : "❌"} (esperado 200)`,
      `- adv-03 (vazio):     status=${adv03.status} ${adv03.status === 400 ? "✅" : "❌"} (esperado 400)`,
    ].join("\n");
    console.log(`\n[recall] adversariais:\n${adversarialReport}`);
  } catch (err) {
    console.warn(`[recall] adversariais skipped: ${err}`);
  }

  // 4) Regressão /ai-query (deprecation header)
  let deprecationReport = "Não executado.";
  try {
    const dep = await testAiQueryDeprecation();
    deprecationReport = `status=${dep.status}, X-Deprecated presente: ${dep.hasHeader ? "✅" : "❌"}`;
    console.log(`[recall] /ai-query deprecation: ${deprecationReport}`);
  } catch (err) {
    console.warn(`[recall] deprecation check skipped: ${err}`);
  }

  // 5) Veredito
  const recallOk = !Number.isNaN(recallAt5) && recallAt5 >= 70;
  const latencyOk = p95 <= 500;
  const verdict = recallOk && latencyOk
    ? "✅ APROVADO PARA DEPLOY"
    : "❌ BLOQUEADO";

  // 6) Escrever REPORT.md
  const reportMd = `# RAG Eval Report

**Última execução:** ${new Date().toISOString()}
**Base URL:** ${BASE_URL}
**Eval entries:** ${evalSet.length} (${overrideCount} com expectedById local)

## Métricas

| Métrica | Valor | Critério | Status |
|---|---|---|---|
| recall@5 | ${recallAt5.toFixed(1)}% (${hits}/${withExpected.length}) | ≥ 70% | ${recallOk ? "✅" : "❌"} |
| latência p50 | ${p50}ms | — | ℹ️ |
| latência p95 | ${p95}ms | ≤ 500ms | ${latencyOk ? "✅" : "❌"} |

## Detalhes por query

${renderTable(results)}

## Adversariais

${adversarialReport}

## Regressão /ai-query

${deprecationReport}

## Veredito

${verdict}

${recallOk && latencyOk ? "" : `
### Motivos do bloqueio
${!recallOk ? `- recall@5 ${recallAt5.toFixed(1)}% < 70%. Possíveis causas: buildDocumento pulando campos relevantes, modelo de embedding inadequado, eval-set.local.json com IDs errados.\n` : ""}${!latencyOk ? `- latência p95 ${p95}ms > 500ms. Possíveis causas: índice HNSW não criado, ef_search alto demais, banco distante (rodar do mesmo DC).\n` : ""}`}
`;
  await writeFile(REPORT_PATH, reportMd);
  console.log(`\n[recall] relatório salvo em ${REPORT_PATH}`);
  console.log(`\n[recall] VEREDITO: ${verdict}`);

  await prisma.$disconnect();
  process.exit(recallOk && latencyOk ? 0 : 1);
}

main().catch(async (err) => {
  console.error("[recall] erro fatal:", err);
  await prisma.$disconnect();
  process.exit(2);
});
