import { prisma } from "@/lib/prisma";

interface CheckRow { value_a: number | null; value_b: number | null }

async function sendTelegramAlert(metricKey: string, delta: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const text = `📊 <b>Radar — divergência detectada</b>\nmétrica: <code>${metricKey}</code>\ndelta: ${delta.toFixed(2)}%\nAbra /radar/data-quality para investigar.`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[radar.runMetricValidations] telegram fail:", e);
  }
}

export async function runMetricValidations(): Promise<{ checksRun: number; passed: number; failed: number; warned: number; errored: number }> {
  const checks = await prisma.metricValidationCheck.findMany({ where: { isActive: true } });

  let passed = 0, failed = 0, warned = 0, errored = 0;

  for (const check of checks) {
    let status: "pass" | "warn" | "fail" | "error" = "pass";
    let delta: number | null = null;
    try {
      const rows = await prisma.$queryRawUnsafe<CheckRow[]>(check.query);
      const r = rows[0];
      if (!r || (r.value_a === null && r.value_b === null)) {
        status = "warn";
      } else if (r.value_a === null || r.value_b === null) {
        status = "warn";
      } else {
        const ref = Math.max(Math.abs(r.value_a), Math.abs(r.value_b));
        delta = ref === 0 ? 0 : Math.abs(r.value_a - r.value_b) / ref * 100;
        status = delta <= check.tolerancePct ? "pass" : "fail";
      }
    } catch (e) {
      console.error(`[radar.runMetricValidations] query error for ${check.metricKey}:`, e);
      status = "error";
    }

    await prisma.metricValidationCheck.update({
      where: { id: check.id },
      data: { lastRunAt: new Date(), lastDelta: delta, lastStatus: status },
    });

    if (status === "fail" && delta !== null) {
      const existing = await prisma.dataIncident.findFirst({
        where: { metricKey: check.metricKey, status: { in: ["open", "investigating"] } },
      });
      if (!existing) {
        await prisma.dataIncident.create({
          data: { metricKey: check.metricKey, delta, status: "open" },
        });
        await sendTelegramAlert(check.metricKey, delta);
      }
    }

    if (status === "pass") passed++;
    else if (status === "fail") failed++;
    else if (status === "warn") warned++;
    else errored++;
  }

  return { checksRun: checks.length, passed, failed, warned, errored };
}
