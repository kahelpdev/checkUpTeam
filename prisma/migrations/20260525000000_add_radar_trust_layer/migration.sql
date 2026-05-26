-- ============================================================================
-- Radar Trust Layer (E1) — 16 tabelas novas
-- ============================================================================

-- ============================================================================
-- Trust Layer
-- ============================================================================

CREATE TABLE "fact_event_stage_history" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "team_config_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL,
    "entered_at_reported_by_source" TIMESTAMP(3),
    "exited_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "duration_business_minutes" INTEGER,
    "source_snapshot_id" TEXT NOT NULL,
    "reconstructed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fact_event_stage_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fact_event_stage_history_event_id_entered_at_idx" ON "fact_event_stage_history"("event_id", "entered_at");
CREATE INDEX "fact_event_stage_history_team_config_id_stage_entered_at_idx" ON "fact_event_stage_history"("team_config_id", "stage", "entered_at");

CREATE TABLE "metric_definitions" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT NOT NULL,
    "source_a" TEXT NOT NULL,
    "source_b" TEXT,
    "tolerance_pct" DOUBLE PRECISION,
    "periodicity" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'draft',
    "display_mode" TEXT NOT NULL DEFAULT 'mirror',
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "metric_validation_checks" (
    "id" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "tolerance_pct" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_delta" DOUBLE PRECISION,
    "last_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_validation_checks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "metric_validation_checks" ADD CONSTRAINT "metric_validation_checks_metric_key_fkey" FOREIGN KEY ("metric_key") REFERENCES "metric_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "metric_results" (
    "id" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "team_config_id" TEXT,
    "period" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "value_source_a" DOUBLE PRECISION,
    "value_source_b" DOUBLE PRECISION,
    "delta_pct" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metric_results_metric_key_team_config_id_period_key" ON "metric_results"("metric_key", "team_config_id", "period");
CREATE INDEX "metric_results_metric_key_calculated_at_idx" ON "metric_results"("metric_key", "calculated_at");

ALTER TABLE "metric_results" ADD CONSTRAINT "metric_results_metric_key_fkey" FOREIGN KEY ("metric_key") REFERENCES "metric_definitions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "data_incidents" (
    "id" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delta" DOUBLE PRECISION,
    "hypothesis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "data_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_incidents_metric_key_detected_at_idx" ON "data_incidents"("metric_key", "detected_at");

-- ============================================================================
-- Cadastros do Radar (vazios até E6)
-- ============================================================================

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "squads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lead_id" TEXT,

    CONSTRAINT "squads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "product_id" TEXT,
    "squad_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "external_key" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "projects" ADD CONSTRAINT "projects_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "product_id" TEXT,
    "target_value" DOUBLE PRECISION,
    "target_unit" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "owner_user_id" TEXT,
    "selection_mode" TEXT NOT NULL DEFAULT 'manual',
    "filter_def" JSONB,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "goals" ADD CONSTRAINT "goals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "goal_items" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "event_id" TEXT,
    "description" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "goal_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goal_items_event_id_idx" ON "goal_items"("event_id");
ALTER TABLE "goal_items" ADD CONSTRAINT "goal_items_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "classifications" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "classifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "classifications_key_key" ON "classifications"("key");

CREATE TABLE "classification_rules" (
    "id" TEXT NOT NULL,
    "classification_key" TEXT NOT NULL,
    "match_type" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "classification_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_classifications" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "classification_key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "classified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_classifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_classifications_event_id_classification_key_key" ON "event_classifications"("event_id", "classification_key");
CREATE INDEX "event_classifications_event_id_idx" ON "event_classifications"("event_id");

CREATE TABLE "person_costs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "cost_hour" DOUBLE PRECISION NOT NULL,
    "capacity_hours_month" DOUBLE PRECISION NOT NULL,
    "squad_id" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "person_costs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "person_costs_user_id_effective_from_idx" ON "person_costs"("user_id", "effective_from");

CREATE TABLE "tools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_cost" DOUBLE PRECISION NOT NULL,
    "cost_center" TEXT,
    "license_count" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fact_goal_progress" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "items_done" INTEGER NOT NULL,
    "items_total" INTEGER NOT NULL,
    "progress_pct" DOUBLE PRECISION NOT NULL,
    "days_left" INTEGER,
    "risk_score" DOUBLE PRECISION,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fact_goal_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fact_goal_progress_goal_id_period_key" ON "fact_goal_progress"("goal_id", "period");

ALTER TABLE "fact_goal_progress" ADD CONSTRAINT "fact_goal_progress_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "fact_cost" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "squad_id" TEXT,
    "product_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "detail" JSONB,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fact_cost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fact_cost_period_category_idx" ON "fact_cost"("period", "category");

CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "table" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_log_table_record_id_idx" ON "audit_log"("table", "record_id");
CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log"("user_id", "created_at");
