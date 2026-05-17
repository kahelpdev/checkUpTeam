import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateBaseUrlCache } from "@/services/cardflow";

const CONFIG_KEY = "flow_api_base_url";

export async function GET() {
  const config = await prisma.appConfig.findUnique({ where: { key: CONFIG_KEY } });
  const url = config?.value || process.env.FLOW_API_BASE_URL || "";
  const source = config?.value ? "database" : "env";
  return NextResponse.json({ url, source, updatedAt: config?.updatedAt ?? null });
}

export async function PUT(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url é obrigatória" }, { status: 400 });
  }

  const config = await prisma.appConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value: url.trim() },
    create: { key: CONFIG_KEY, value: url.trim() },
  });

  invalidateBaseUrlCache();

  return NextResponse.json({ ok: true, url: config.value, updatedAt: config.updatedAt });
}
