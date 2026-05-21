import { prisma } from "@/lib/prisma";

const DEVBI_EXECUTION_STAGES_KEY = "devbi_execution_stages";
const DEFAULT_STAGES: readonly string[] = ["Em Execução"];

let cached: { stages: string[]; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

function parseStages(raw: string | undefined | null): string[] {
  if (!raw) return [...DEFAULT_STAGES];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const clean = parsed
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0);
      return clean.length > 0 ? clean : [...DEFAULT_STAGES];
    }
  } catch {
    // fallthrough to default
  }
  return [...DEFAULT_STAGES];
}

export async function getDevbiExecutionStages(): Promise<string[]> {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.stages;
  }
  try {
    const config = await prisma.appConfig.findUnique({
      where: { key: DEVBI_EXECUTION_STAGES_KEY },
    });
    const stages = parseStages(config?.value);
    cached = { stages, at: Date.now() };
    return stages;
  } catch {
    return [...DEFAULT_STAGES];
  }
}

export async function setDevbiExecutionStages(stages: string[]): Promise<string[]> {
  const clean = stages
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0);
  if (clean.length === 0) {
    throw new Error("Pelo menos 1 stage é obrigatória");
  }
  const value = JSON.stringify(clean);
  await prisma.appConfig.upsert({
    where: { key: DEVBI_EXECUTION_STAGES_KEY },
    update: { value },
    create: { key: DEVBI_EXECUTION_STAGES_KEY, value },
  });
  cached = { stages: clean, at: Date.now() };
  return clean;
}

export function invalidateDevbiExecutionStagesCache(): void {
  cached = null;
}

export function getDevbiExecutionStagesKey(): string {
  return DEVBI_EXECUTION_STAGES_KEY;
}

export function getDevbiExecutionStagesDefault(): readonly string[] {
  return DEFAULT_STAGES;
}
