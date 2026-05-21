// Service layer para relatorios_diarios.
// Encapsula INSERT + dispara embedding fire-and-forget.
//
// IMPORTANTE — o fluxo de produção atual (n8n -> banco direto) NÃO passa por
// aqui. Para esses relatórios, a vetorização vem pelo:
//   - CLI:  `npm run backfill:embeddings`  (operador, sob demanda)
//   - HTTP: POST /api/embeddings/backfill   (Coolify scheduled task a cada 5min)
//
// Use `upsertRelatorio()` quando o servidor Next.js for a origem da escrita.

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { embedAndStore } from "@/lib/embeddings";

export async function upsertRelatorio(data: Prisma.RelatorioDiarioCreateInput) {
  const created = await prisma.relatorioDiario.create({ data });
  // Fire-and-forget: NUNCA usar await aqui. Erros são logados em embedAndStore.
  void embedAndStore(created.id);
  return created;
}
