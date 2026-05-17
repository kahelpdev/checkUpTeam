import { NextResponse } from "next/server";

interface GoogleModel {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não configurada" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Google API ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { models?: GoogleModel[] };
    const models = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({
        name: m.name.replace(/^models\//, ""),
        displayName: m.displayName || m.name.replace(/^models\//, ""),
        description: m.description || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ models });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar modelos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
