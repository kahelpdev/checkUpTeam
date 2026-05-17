// Ingestion job: salva snapshots periódicos do cardsFlow no banco local
import { prisma } from "@/lib/prisma";
import { CardflowService, callCardflowEndpoint } from "@/services/cardflow";
import { format, subDays } from "date-fns";

function todayRange() {
  const now = new Date();
  const start = format(subDays(now, 90), "yyyy-MM-dd");
  const end = format(now, "yyyy-MM-dd");
  return { start, end, now };
}

// ── Telegram alerts ───────────────────────────────────────────────────────────

async function sendTelegramAlert(devs: string[], teamName: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const names = devs.map((n) => `• ${n}`).join("\n");
  const text =
    `🚨 <b>Alerta de Reprova QA — ${teamName}</b>\n\n` +
    `Os seguintes devs estão em <b>Alerta Comport.</b>:\n${names}\n\n` +
    `📊 Acesse o dashboard para ver os detalhes.`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[ingestion] Telegram alert falhou:", res.status, err);
    }
  } catch (e) {
    console.error("[ingestion] Telegram alert erro:", e);
  }
}

async function checkAndAlertReprovas(
  rankings: Array<{ userId: string; userName: string; qaStatus: string }>,
  teamName: string
) {
  const alertUsers = rankings
    .filter((r) => r.qaStatus === "Alerta Comport.")
    .map((r) => r.userId);

  if (alertUsers.length === 0) return;

  // Lê quem já foi alertado para evitar spam
  const configKey = `last_alerted_${teamName.replace(/\s/g, "_")}`;
  const prev = await prisma.appConfig.findUnique({ where: { key: configKey } });
  const prevIds: string[] = prev ? JSON.parse(prev.value) : [];

  // Alerta só para usuários NOVOS em alerta (não estava antes)
  const newAlerts = alertUsers.filter((id) => !prevIds.includes(id));
  if (newAlerts.length > 0) {
    const names = rankings
      .filter((r) => newAlerts.includes(r.userId))
      .map((r) => r.userName);
    await sendTelegramAlert(names, teamName);
  }

  // Atualiza lista dos usuários em alerta
  await prisma.appConfig.upsert({
    where: { key: configKey },
    update: { value: JSON.stringify(alertUsers) },
    create: { key: configKey, value: JSON.stringify(alertUsers) },
  });
}

// ── Ingestion por equipe ──────────────────────────────────────────────────────

async function ingestTeam(
  teamConfigId: string,
  teamName: string,
  cardflowTeamId: string,
  kpisRegistryId: string,
  rankingsRegistryId: string,
  demandRegistryId: string,
  currentTasksRegistryId: string,
  workloadRegistryId: string
) {
  const { start, end, now } = todayRange();

  // KPIs
  try {
    const kpis = await CardflowService.getKpis(cardflowTeamId, start, end);
    await prisma.apiSnapshot.create({
      data: { apiRegistryId: kpisRegistryId, teamConfigId, payload: kpis as object },
    });
  } catch (e) {
    console.error(`[ingestion] KPIs falhou para time ${cardflowTeamId}:`, e);
  }

  // Rankings + reprova history + alerta Slack
  try {
    const rankings = await CardflowService.getRankings(cardflowTeamId, start, end);
    await prisma.apiSnapshot.create({
      data: { apiRegistryId: rankingsRegistryId, teamConfigId, payload: rankings as object },
    });

    const periodStart = new Date(`${start}T00:00:00`);
    const periodEnd = new Date(`${end}T23:59:59`);
    await prisma.reprovaHistory.createMany({
      data: rankings.map((r) => ({
        teamConfigId,
        userId: r.userId,
        userName: r.userName,
        avatarUrl: r.avatarUrl ?? null,
        qaSubmissions: parseInt(String(r.qaSubmissions)) || 0,
        qaApprovals: parseInt(String(r.qaApprovals)) || 0,
        qaRejections: parseInt(String(r.qaRejections)) || 0,
        qaHitRate: r.qaHitRate != null ? parseFloat(String(r.qaHitRate)) : null,
        qaStatus: r.qaStatus ?? null,
        recordedAt: now,
        periodStart,
        periodEnd,
      })),
    });

    // Verificar e alertar via Telegram
    await checkAndAlertReprovas(rankings, teamName);
  } catch (e) {
    console.error(`[ingestion] Rankings falhou para time ${cardflowTeamId}:`, e);
  }

  // Demand chart
  try {
    const demand = await CardflowService.getDemandChart(cardflowTeamId, start, end);
    await prisma.apiSnapshot.create({
      data: { apiRegistryId: demandRegistryId, teamConfigId, payload: demand as object },
    });
  } catch (e) {
    console.error(`[ingestion] DemandChart falhou para time ${cardflowTeamId}:`, e);
  }

  // Current tasks (snapshot para fallback quando API cair)
  try {
    const currentTasks = await CardflowService.getCurrentTasks(cardflowTeamId);
    await prisma.apiSnapshot.create({
      data: { apiRegistryId: currentTasksRegistryId, teamConfigId, payload: currentTasks as object },
    });
  } catch (e) {
    console.error(`[ingestion] CurrentTasks falhou para time ${cardflowTeamId}:`, e);
  }

  // Workload (snapshot para fallback quando API cair)
  try {
    const workload = await CardflowService.getWorkload(cardflowTeamId, start, end);
    await prisma.apiSnapshot.create({
      data: { apiRegistryId: workloadRegistryId, teamConfigId, payload: workload as object },
    });
  } catch (e) {
    console.error(`[ingestion] Workload falhou para time ${cardflowTeamId}:`, e);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function runIngestion() {
  console.log("[ingestion] Iniciando ciclo de coleta...");

  const [teams, registries] = await Promise.all([
    prisma.teamsConfig.findMany({ where: { isActive: true } }),
    prisma.apiRegistry.findMany({ where: { isActive: true } }),
  ]);

  const reg = (path: string) => registries.find((r) => r.path === path)?.id;
  const kpisId = reg("/devbi/kpis");
  const rankingsId = reg("/devbi/rankings");
  const demandId = reg("/devbi/demand-chart");

  if (!kpisId || !rankingsId || !demandId) {
    console.warn("[ingestion] Registries incompletos — configure via API Manager.");
    return;
  }

  // Garante registros de current-tasks e workload para fallback de cache
  const ensureRegistry = async (path: string, name: string) => {
    const existing = registries.find((r) => r.path === path);
    if (existing) return existing.id;
    const created = await prisma.apiRegistry.create({
      data: { name, path, method: "GET", isActive: true },
    });
    return created.id;
  };

  const currentTasksId = await ensureRegistry("/devbi/current-tasks", "Tarefas Atuais");
  const workloadId = await ensureRegistry("/devbi/workload", "Workload");

  for (const team of teams) {
    await ingestTeam(team.id, team.teamName, team.teamId, kpisId, rankingsId, demandId, currentTasksId, workloadId);
  }

  // Atualiza status dos endpoints
  const today = format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
  const refTeamId = teams[0]?.teamId ?? "";
  await Promise.all(
    registries.map(async (api) => {
      let status = "unhealthy";
      try {
        await callCardflowEndpoint(api.path, { startDate: weekAgo, endDate: today, teamId: refTeamId });
        status = "healthy";
      } catch {
        status = "unhealthy";
      }
      await prisma.apiRegistry.update({
        where: { id: api.id },
        data: { lastChecked: new Date(), lastStatus: status },
      });
    })
  );

  console.log("[ingestion] Ciclo concluído.");
}
