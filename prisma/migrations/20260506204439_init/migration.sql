-- CreateTable
CREATE TABLE "teams_config" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_registry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "params" JSONB,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_checked" TIMESTAMP(3),
    "last_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_snapshots" (
    "id" TEXT NOT NULL,
    "api_registry_id" TEXT NOT NULL,
    "team_config_id" TEXT,
    "payload" JSONB NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reprova_history" (
    "id" TEXT NOT NULL,
    "team_config_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "qa_submissions" INTEGER NOT NULL DEFAULT 0,
    "qa_approvals" INTEGER NOT NULL DEFAULT 0,
    "qa_rejections" INTEGER NOT NULL DEFAULT 0,
    "qa_hit_rate" DOUBLE PRECISION,
    "qa_status" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reprova_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_config_team_id_key" ON "teams_config"("team_id");

-- CreateIndex
CREATE INDEX "api_snapshots_api_registry_id_captured_at_idx" ON "api_snapshots"("api_registry_id", "captured_at");

-- CreateIndex
CREATE INDEX "api_snapshots_team_config_id_captured_at_idx" ON "api_snapshots"("team_config_id", "captured_at");

-- CreateIndex
CREATE INDEX "reprova_history_team_config_id_recorded_at_idx" ON "reprova_history"("team_config_id", "recorded_at");

-- CreateIndex
CREATE INDEX "reprova_history_user_id_recorded_at_idx" ON "reprova_history"("user_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "api_snapshots" ADD CONSTRAINT "api_snapshots_api_registry_id_fkey" FOREIGN KEY ("api_registry_id") REFERENCES "api_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_snapshots" ADD CONSTRAINT "api_snapshots_team_config_id_fkey" FOREIGN KEY ("team_config_id") REFERENCES "teams_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reprova_history" ADD CONSTRAINT "reprova_history_team_config_id_fkey" FOREIGN KEY ("team_config_id") REFERENCES "teams_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
