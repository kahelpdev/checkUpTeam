import { NextResponse } from "next/server";
import { runIngestion } from "@/jobs/ingestion";

// Chamado pelo Coolify/cron externo ou pelo n8n a cada 5 minutos
export async function POST() {
  try {
    await runIngestion();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/ingest]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
