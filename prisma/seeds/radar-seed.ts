import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma";

interface MetricSeed {
  key: string;
  name: string;
  description: string;
  formula: string;
  sourceA: string;
  sourceB: string | null;
  tolerancePct: number | null;
  periodicity: string;
  category: string;
  confidence: "draft" | "released";
}

const METRICS: MetricSeed[] = [
  {
    key: "total_cards_abertos",
    name: "Total de cards abertos",
    description: "Contagem de cards atualmente abertos em todos os stages",
    formula: "kpis.cardsAbertos | count(distinct eventId em current-tasks)",
    sourceA: "cardflow:/devbi/kpis:cardsAbertos",
    sourceB: "internal:current-tasks:count_distinct_eventId",
    tolerancePct: 2,
    periodicity: "daily",
    category: "kpi",
    confidence: "released",
  },
  {
    key: "resolvidos_hoje",
    name: "Resolvidos hoje",
    description: "Cards resolvidos no dia corrente",
    formula: "kpis.resolvidosHoje | sum(demand-chart.resolved WHERE date=today)",
    sourceA: "cardflow:/devbi/kpis:resolvidosHoje",
    sourceB: "internal:demand-chart:sum_resolved_today",
    tolerancePct: 0,
    periodicity: "daily",
    category: "kpi",
    confidence: "released",
  },
  {
    key: "eventos_pendentes",
    name: "Eventos pendentes",
    description: "Cards com eventId não-nulo (em algum stage operacional)",
    formula: "kpis.eventosPendentes | count(distinct eventId em current-tasks WHERE eventId NOT NULL)",
    sourceA: "cardflow:/devbi/kpis:eventosPendentes",
    sourceB: "internal:current-tasks:count_distinct_eventId",
    tolerancePct: 3,
    periodicity: "daily",
    category: "kpi",
    confidence: "released",
  },
  {
    key: "sla_em_risco",
    name: "SLA em risco",
    description: "Cards com tempo em etapa acima do limite configurável",
    formula: "kpis.slaEmRisco | count(fact_event_stage_history WHERE durationBusinessMinutes > RADAR_SLA_THRESHOLD_MIN AND exited_at IS NULL)",
    sourceA: "cardflow:/devbi/kpis:slaEmRisco",
    sourceB: "internal:fact_event_stage_history:over_threshold_open",
    tolerancePct: 5,
    periodicity: "daily",
    category: "kpi",
    confidence: "released",
  },
  {
    key: "tempo_medio_em_execucao",
    name: 'Tempo médio em "Em Execução"',
    description: "Média de business minutes no stage Em Execução",
    formula: 'avg(current-tasks.businessMinutesInStage WHERE stage="Em Execução") | avg(fact_event_stage_history.durationBusinessMinutes WHERE stage="Em Execução")',
    sourceA: "cardflow:/devbi/current-tasks:avg_business_minutes_em_execucao",
    sourceB: "internal:fact_event_stage_history:avg_business_minutes_em_execucao",
    tolerancePct: 5,
    periodicity: "daily",
    category: "tempo",
    confidence: "released",
  },
  {
    key: "demanda_diaria_serie",
    name: "Série diária de demanda",
    description: "Pontos (date, total, resolved) por dia — fonte única CardsFlow",
    formula: "demand-chart raw",
    sourceA: "cardflow:/devbi/demand-chart",
    sourceB: null,
    tolerancePct: null,
    periodicity: "daily",
    category: "carga",
    confidence: "released",
  },
  {
    key: "current_tasks_by_member",
    name: "Tarefas atuais por membro",
    description: "Snapshot atual de quem está em qual stage — fonte única",
    formula: "current-tasks raw",
    sourceA: "cardflow:/devbi/current-tasks",
    sourceB: null,
    tolerancePct: null,
    periodicity: "hourly",
    category: "carga",
    confidence: "released",
  },
  {
    key: "dev_reprova_summary",
    name: "Resumo QA por dev",
    description: "Submissions/Approvals/Rejections/HitRate por dev — rankings — fonte única",
    formula: "rankings raw",
    sourceA: "cardflow:/devbi/rankings",
    sourceB: null,
    tolerancePct: null,
    periodicity: "daily",
    category: "qa",
    confidence: "released",
  },
  {
    key: "dev_alerta_comportamental",
    name: "Devs em alerta comportamental",
    description: "Contagem de devs com qaStatus = 'Alerta Comport.'",
    formula: "count(rankings WHERE qaStatus='Alerta Comport.')",
    sourceA: "cardflow:/devbi/rankings:count_alerta",
    sourceB: null,
    tolerancePct: null,
    periodicity: "daily",
    category: "qa",
    confidence: "released",
  },
  {
    key: "qa_rejections_semana",
    name: "Rejeições QA na semana",
    description: "Soma de qaRejections do ranking vs reprova_history",
    formula: "sum(rankings.qaRejections) | sum(reprova_history.qaRejections WHERE periodo=semana)",
    sourceA: "cardflow:/devbi/rankings:sum_rejections",
    sourceB: "internal:reprova_history:sum_rejections_week",
    tolerancePct: 0,
    periodicity: "weekly",
    category: "qa",
    confidence: "released",
  },
  {
    key: "workload_total_team",
    name: "Workload total do time",
    description: "Total de eventos no team (workload)",
    formula: "sum(workload.totalEvents)",
    sourceA: "cardflow:/devbi/workload:sum_total",
    sourceB: null,
    tolerancePct: null,
    periodicity: "daily",
    category: "carga",
    confidence: "released",
  },
  {
    key: "idade_media_card_aberto",
    name: "Idade média dos cards abertos",
    description: "Média de business minutes desde a primeira entrada em qualquer stage até hoje",
    formula: "avg(now - menor(entered_at) por eventId WHERE exited_at IS NULL)",
    sourceA: "internal:fact_event_stage_history:avg_age_open",
    sourceB: null,
    tolerancePct: null,
    periodicity: "daily",
    category: "tempo",
    confidence: "draft",
  },
];

interface ValidationSeed {
  metricKey: string;
  description: string;
  query: string;
  tolerancePct: number;
}

const VALIDATIONS: ValidationSeed[] = [
  {
    metricKey: "total_cards_abertos",
    description: "kpis.cardsAbertos vs count(distinct current-tasks.eventId)",
    tolerancePct: 2,
    query: `
      WITH kpi AS (
        SELECT (payload->0->>'cardsAbertos')::numeric AS v
        FROM api_snapshots s JOIN api_registry r ON r.id = s.api_registry_id
        WHERE r.path = '/devbi/kpis'
        ORDER BY s.captured_at DESC LIMIT 1
      ),
      tasks AS (
        SELECT COUNT(DISTINCT (m->>'eventId'))::numeric AS v
        FROM api_snapshots s JOIN api_registry r ON r.id = s.api_registry_id,
             LATERAL jsonb_array_elements(s.payload) AS m
        WHERE r.path = '/devbi/current-tasks' AND m->>'eventId' IS NOT NULL
              AND s.captured_at = (SELECT MAX(captured_at) FROM api_snapshots s2 WHERE s2.api_registry_id = s.api_registry_id)
      )
      SELECT (SELECT v FROM kpi) AS value_a, (SELECT v FROM tasks) AS value_b
    `,
  },
  {
    metricKey: "resolvidos_hoje",
    description: "kpis.resolvidosHoje vs sum(demand-chart.resolved WHERE date=today)",
    tolerancePct: 0,
    query: `
      WITH kpi AS (
        SELECT (payload->0->>'resolvidosHoje')::numeric AS v
        FROM api_snapshots s JOIN api_registry r ON r.id = s.api_registry_id
        WHERE r.path = '/devbi/kpis' ORDER BY s.captured_at DESC LIMIT 1
      ),
      d AS (
        SELECT COALESCE(SUM((m->>'resolved')::numeric), 0) AS v
        FROM api_snapshots s JOIN api_registry r ON r.id = s.api_registry_id,
             LATERAL jsonb_array_elements(s.payload) AS m
        WHERE r.path = '/devbi/demand-chart'
              AND m->>'date' = to_char(CURRENT_DATE, 'YYYY-MM-DD')
              AND s.captured_at = (SELECT MAX(captured_at) FROM api_snapshots s2 WHERE s2.api_registry_id = s.api_registry_id)
      )
      SELECT (SELECT v FROM kpi) AS value_a, (SELECT v FROM d) AS value_b
    `,
  },
  {
    metricKey: "eventos_pendentes",
    description: "kpis.eventosPendentes vs count(distinct current-tasks WHERE eventId NOT NULL)",
    tolerancePct: 3,
    query: `
      WITH kpi AS (
        SELECT (payload->0->>'eventosPendentes')::numeric AS v
        FROM api_snapshots s JOIN api_registry r ON r.id = s.api_registry_id
        WHERE r.path = '/devbi/kpis' ORDER BY s.captured_at DESC LIMIT 1
      ),
      tasks AS (
        SELECT COUNT(DISTINCT (m->>'eventId'))::numeric AS v
        FROM api_snapshots s JOIN api_registry r ON r.id = s.api_registry_id,
             LATERAL jsonb_array_elements(s.payload) AS m
        WHERE r.path = '/devbi/current-tasks' AND m->>'eventId' IS NOT NULL
              AND s.captured_at = (SELECT MAX(captured_at) FROM api_snapshots s2 WHERE s2.api_registry_id = s.api_registry_id)
      )
      SELECT (SELECT v FROM kpi) AS value_a, (SELECT v FROM tasks) AS value_b
    `,
  },
  {
    metricKey: "sla_em_risco",
    description: "kpis.slaEmRisco vs count(fact_event_stage_history WHERE durationBusinessMinutes > threshold AND exited_at IS NULL)",
    tolerancePct: 5,
    query: `
      WITH kpi AS (
        SELECT (payload->0->>'slaEmRisco')::numeric AS v
        FROM api_snapshots s JOIN api_registry r ON r.id = s.api_registry_id
        WHERE r.path = '/devbi/kpis' ORDER BY s.captured_at DESC LIMIT 1
      ),
      f AS (
        SELECT COUNT(*)::numeric AS v
        FROM fact_event_stage_history
        WHERE exited_at IS NULL AND duration_business_minutes > 480
      )
      SELECT (SELECT v FROM kpi) AS value_a, (SELECT v FROM f) AS value_b
    `,
  },
  {
    metricKey: "tempo_medio_em_execucao",
    description: "avg current-tasks.businessMinutesInStage(Em Execução) vs avg fact_event_stage_history.durationBusinessMinutes(Em Execução)",
    tolerancePct: 5,
    query: `
      WITH a AS (
        SELECT AVG((m->>'businessMinutesInStage')::numeric) AS v
        FROM api_snapshots s JOIN api_registry r ON r.id = s.api_registry_id,
             LATERAL jsonb_array_elements(s.payload) AS m
        WHERE r.path = '/devbi/current-tasks'
              AND m->>'currentStage' = 'Em Execução'
              AND m->>'businessMinutesInStage' IS NOT NULL
              AND s.captured_at = (SELECT MAX(captured_at) FROM api_snapshots s2 WHERE s2.api_registry_id = s.api_registry_id)
      ),
      b AS (
        SELECT AVG(duration_business_minutes)::numeric AS v
        FROM fact_event_stage_history
        WHERE stage = 'Em Execução' AND duration_business_minutes IS NOT NULL
              AND entered_at > NOW() - INTERVAL '14 days'
      )
      SELECT (SELECT v FROM a) AS value_a, (SELECT v FROM b) AS value_b
    `,
  },
  {
    metricKey: "qa_rejections_semana",
    description: "sum(rankings.qaRejections) vs sum(reprova_history.qaRejections WHERE recordedAt na semana)",
    tolerancePct: 0,
    query: `
      WITH a AS (
        SELECT COALESCE(SUM((m->>'qaRejections')::numeric), 0) AS v
        FROM api_snapshots s JOIN api_registry r ON r.id = s.api_registry_id,
             LATERAL jsonb_array_elements(s.payload) AS m
        WHERE r.path = '/devbi/rankings'
              AND s.captured_at = (SELECT MAX(captured_at) FROM api_snapshots s2 WHERE s2.api_registry_id = s.api_registry_id)
      ),
      b AS (
        SELECT COALESCE(SUM(qa_rejections), 0)::numeric AS v
        FROM reprova_history
        WHERE recorded_at > NOW() - INTERVAL '7 days'
      )
      SELECT (SELECT v FROM a) AS value_a, (SELECT v FROM b) AS value_b
    `,
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  for (const m of METRICS) {
    await prisma.metricDefinition.upsert({
      where: { key: m.key },
      update: {
        name: m.name, description: m.description, formula: m.formula,
        sourceA: m.sourceA, sourceB: m.sourceB, tolerancePct: m.tolerancePct,
        periodicity: m.periodicity, category: m.category, confidence: m.confidence,
      },
      create: m,
    });
    console.log(`  metric: ${m.key} (${m.confidence})`);
  }

  for (const v of VALIDATIONS) {
    const existing = await prisma.metricValidationCheck.findFirst({
      where: { metricKey: v.metricKey, description: v.description },
    });
    if (existing) {
      await prisma.metricValidationCheck.update({
        where: { id: existing.id },
        data: { query: v.query, tolerancePct: v.tolerancePct, isActive: true },
      });
    } else {
      await prisma.metricValidationCheck.create({ data: v });
    }
    console.log(`  validation: ${v.metricKey}`);
  }

  console.log(`\n${METRICS.length} metrics + ${VALIDATIONS.length} validations seeded.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
