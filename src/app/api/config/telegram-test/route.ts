import { NextResponse } from "next/server";

export async function POST() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID não configurados" },
      { status: 400 }
    );
  }

  const text =
    `✅ <b>CheckUp Team</b> — Telegram configurado com sucesso!\n\n` +
    `Você receberá alertas aqui quando algum dev entrar em <b>Alerta Comport.</b> no QA.`;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: "Telegram rejeitou a mensagem", detail: err }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: "Mensagem de teste enviada!" });
}
