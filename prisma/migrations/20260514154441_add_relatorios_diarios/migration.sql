-- CreateTable
CREATE TABLE "relatorios_diarios" (
    "id" TEXT NOT NULL,
    "tipo_usuario" TEXT NOT NULL,
    "id_colaborador" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "equipe" TEXT NOT NULL,
    "data_dia" DATE NOT NULL,
    "como_se_sentiu" TEXT NOT NULL,
    "atividades_realizadas" TEXT NOT NULL,
    "impedimentos" TEXT NOT NULL,
    "demandas_pendente_colaborador" TEXT NOT NULL,
    "demandas_pendente_lideranca" TEXT NOT NULL,
    "entregas_planejadas" TEXT NOT NULL,
    "motivo_nao_entrega" TEXT,
    "hora_extra" TEXT NOT NULL,
    "motivo_hora_extra" TEXT,
    "tempo_hora_extra" INTEGER,
    "hora_extra_aprovada" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorios_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relatorios_diarios_equipe_data_dia_idx" ON "relatorios_diarios"("equipe", "data_dia");

-- CreateIndex
CREATE INDEX "relatorios_diarios_id_colaborador_data_dia_idx" ON "relatorios_diarios"("id_colaborador", "data_dia");

-- CreateIndex
CREATE INDEX "relatorios_diarios_data_dia_idx" ON "relatorios_diarios"("data_dia");
