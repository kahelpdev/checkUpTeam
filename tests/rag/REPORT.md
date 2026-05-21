# RAG Eval Report

> Este arquivo é **sobrescrito** a cada execução de `npm run test:rag`.
> Esta versão (estática) é o template inicial entregue pelo Henrique Vasconcelos
> no step-06 da squad `rag-pgvector-migration` (run v2). Ainda não foi executado
> contra dados reais — rodar pós-deploy + backfill.

**Status:** ⏳ AGUARDANDO EXECUÇÃO contra ambiente com `embedding` populado.

## Como gerar este relatório com dados reais

```bash
cd checkupteam

# 1. Garantir que a migration foi aplicada e o backfill rodou
# 2. Preencher tests/rag/eval-set.local.json com UUIDs reais (copiar de eval-set.local.example.json)

# 3. Rodar
DATABASE_URL="postgresql://coolify:password123@147.93.9.236:5432/checkupteam" \
GEMINI_API_KEY="$GEMINI_API_KEY" \
BASE_URL="https://checkupteam.online" \
  npm run test:rag
```

## Critérios de aprovação (Henrique)

| Métrica | Critério | Bloqueante? |
|---|---|---|
| recall@5 | ≥ 70% | ✅ Sim |
| latência p95 (retrieval) | ≤ 500 ms | ✅ Sim |
| adv-01 (sem match) | status 200 com resposta de fallback | ✅ Sim |
| adv-02 (inglês) | status 200 | ⚠️ Soft (embedding deve ser multilíngue) |
| adv-03 (whitespace) | status 400 | ✅ Sim |
| `/ai-query` regressão | mantém 200 + header `X-Deprecated` | ✅ Sim |

## Veredito condicional do Henrique (sem execução real ainda)

✅ **CÓDIGO APROVADO** — runner standalone, eval set cobre 5 categorias, métricas claras, fallback adversarial coberto.

⏳ **VEREDITO FINAL DE QUALIDADE** depende de:
1. Aplicar migration na VPS.
2. Rodar `npm run backfill:embeddings` (full) na base de produção.
3. Preencher `tests/rag/eval-set.local.json` com UUIDs reais (mínimo 10 das 17 não-adversariais).
4. Executar `npm run test:rag` apontando para `BASE_URL=https://checkupteam.online`.
5. Esta seção de REPORT.md é regerada automaticamente com o veredito final.

## Anti-patterns evitados

- ❌ Aprovar sem rodar contra dados reais → veredito é **condicional**, não premiado em vão.
- ❌ Eval set genérico → as 17 queries não-adversariais têm `notes` explicando o campo-alvo.
- ❌ Esconder métricas ruins → o runner escreve recall e latência mesmo se < critério.
- ❌ Testar só o "feliz" → 3 adversariais (sem match, inglês, vazio) cobrem fallback.
- ❌ Misturar latência retrieval com síntese → o runner mede só o retrieval (`embedQuery` + `$queryRaw`), sem Gemini de síntese.
