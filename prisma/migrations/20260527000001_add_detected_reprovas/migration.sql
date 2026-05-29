-- Reprovas detectadas por movimentação de estágio (QA → Dev)
CREATE TABLE "detected_reprovas" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_title" TEXT,
    "team_config_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "from_stage" TEXT NOT NULL,
    "to_stage" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_snapshot_id" TEXT NOT NULL,

    CONSTRAINT "detected_reprovas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "detected_reprovas_event_id_source_snapshot_id_key" ON "detected_reprovas"("event_id", "source_snapshot_id");
CREATE INDEX "detected_reprovas_team_config_id_detected_at_idx" ON "detected_reprovas"("team_config_id", "detected_at");
CREATE INDEX "detected_reprovas_user_id_detected_at_idx" ON "detected_reprovas"("user_id", "detected_at");
CREATE INDEX "detected_reprovas_event_id_idx" ON "detected_reprovas"("event_id");

ALTER TABLE "detected_reprovas" ADD CONSTRAINT "detected_reprovas_team_config_id_fkey"
    FOREIGN KEY ("team_config_id") REFERENCES "teams_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
