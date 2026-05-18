-- ============================================================================
-- Migration: add_pgvector_relatorios
-- Data: 2026-05-18 12:00:00 UTC
-- Autor: Patrícia Lemos (DBA — squad rag-pgvector-migration · run v2)
-- ----------------------------------------------------------------------------
-- Objetivo:
--   Habilitar a extensão pgvector no banco `checkupteam` e adicionar 3 colunas
--   em `relatorios_diarios`:
--     - embedding              vector(768)   → vetor Gemini (gemini-embedding-001)
--     - embedding_updated_at   timestamp     → permite job "linhas com modelo antigo"
--     - embedding_model        varchar(64)   → versionamento de modelo
--   E criar 2 índices:
--     - HNSW (cosine)          → busca por similaridade na query
--     - Parcial WHERE embedding IS NULL → acelera scanner do backfill
--
-- Decisões fixas (ver _memory/memories.md):
--   - 1 vetor por linha (não chunkar, não tabela separada).
--   - Modelo: gemini-embedding-001 (768 dim).
--   - Operador: cosine. Gemini embeddings vêm normalizados, mas cosine é
--     robusto a mudanças no normalizer.
--   - HNSW > IVFFlat: melhor recall para datasets < 1M linhas e não exige
--     pré-treino (IVFFlat exige amostra mínima). Defaults conservadores
--     do upstream pgvector >= 0.5: m=16, ef_construction=64.
--
-- Custo de espaço:
--   768 dim × 4 bytes = ~3 KB/linha. Índice HNSW ~2-3× sobre os dados.
--   10k linhas: ~30 MB dados + ~90 MB índice = ~120 MB.
--
-- PRÉ-REQUISITO — permissão de superuser:
--   `CREATE EXTENSION vector` exige superuser. O user `coolify` da VPS
--   NÃO é superuser. Se este DDL falhar no primeiro bloco, executar
--   manualmente como `postgres`:
--
--     docker exec lynfcxughmyp0kusdy4t7dcw psql -U postgres -d checkupteam \
--       -c "CREATE EXTENSION IF NOT EXISTS vector;"
--
--   E depois reaplicar este arquivo a partir do segundo bloco (ALTER TABLE).
--
-- ROLLBACK (executar em ordem reversa):
--   DROP INDEX IF EXISTS relatorios_diarios_embedding_null_idx;
--   DROP INDEX IF EXISTS relatorios_diarios_embedding_hnsw_idx;
--   ALTER TABLE relatorios_diarios DROP COLUMN IF EXISTS embedding_model;
--   ALTER TABLE relatorios_diarios DROP COLUMN IF EXISTS embedding_updated_at;
--   ALTER TABLE relatorios_diarios DROP COLUMN IF EXISTS embedding;
--   -- DROP EXTENSION vector;  -- só se nenhuma outra tabela depender dela
--
-- Verificações pós-aplicação:
--   SELECT extname, extversion FROM pg_extension WHERE extname='vector';
--   \d relatorios_diarios
--   SELECT pg_size_pretty(pg_relation_size('relatorios_diarios_embedding_hnsw_idx'));
-- ============================================================================

-- 1) Extensão pgvector (requer superuser na primeira execução)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Colunas de embedding + metadados de versionamento
ALTER TABLE "relatorios_diarios"
    ADD COLUMN IF NOT EXISTS "embedding"            vector(768),
    ADD COLUMN IF NOT EXISTS "embedding_updated_at" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "embedding_model"      VARCHAR(64);

-- 3) Índice HNSW para busca por similaridade cosseno
--    Operador: vector_cosine_ops (compatível com `<=>` na query).
--    Tunar ef_search no run-time da query se recall@k for baixo:
--      SET LOCAL hnsw.ef_search = 100;
CREATE INDEX IF NOT EXISTS "relatorios_diarios_embedding_hnsw_idx"
    ON "relatorios_diarios"
    USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 4) Índice parcial auxiliar para o backfill scanner
--    O backfill faz `WHERE embedding IS NULL` repetidamente; índice parcial
--    barateia a varredura sem custar nada quando todas as linhas têm embedding.
CREATE INDEX IF NOT EXISTS "relatorios_diarios_embedding_null_idx"
    ON "relatorios_diarios" ("created_at")
    WHERE "embedding" IS NULL;
