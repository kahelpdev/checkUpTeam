import { prisma } from "@/lib/prisma";
import { CardflowService } from "@/services/cardflow";

const DEVBI_EXECUTION_STAGES_KEY = "devbi_execution_stages";
const DEFAULT_STAGES: readonly string[] = ["Em Execução"];

let cached: { stages: string[]; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

let cachedAvailable: { stages: string[]; at: number } | null = null;
const AVAILABLE_TTL_MS = 5 * 60 * 1000;

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

export async function getDevbiAvailableStages(): Promise<string[]> {
  if (cachedAvailable && Date.now() - cachedAvailable.at < AVAILABLE_TTL_MS) {
    return cachedAvailable.stages;
  }
  const teams = await prisma.teamsConfig.findMany({ where: { isActive: true } });
  const all = new Set<string>();
  await Promise.all(
    teams.map(async (t) => {
      try {
        const tasks = await CardflowService.getCurrentTasks(t.teamId);
        for (const task of tasks) {
          if (task && typeof task.currentStage === "string" && task.currentStage.trim().length > 0) {
            all.add(task.currentStage);
          }
        }
      } catch {
        // Ignora falha por team — segue mapeando os outros
      }
    })
  );
  const sorted = [...all].sort((a, b) => a.localeCompare(b, "pt-BR"));
  cachedAvailable = { stages: sorted, at: Date.now() };
  return sorted;
}

export function invalidateDevbiAvailableStagesCache(): void {
  cachedAvailable = null;
}

export function getDevbiExecutionStagesKey(): string {
  return DEVBI_EXECUTION_STAGES_KEY;
}

export function getDevbiExecutionStagesDefault(): readonly string[] {
  return DEFAULT_STAGES;
}
