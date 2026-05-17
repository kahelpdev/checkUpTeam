// Cliente autenticado da API cardsFlow (NSSCardFlow) — read-only
import { prisma } from "@/lib/prisma";

const EMAIL = process.env.FLOW_API_EMAIL || "";
const PASSWORD = process.env.FLOW_API_PASSWORD || "";

export type CardflowParams = Record<string, string | number | undefined>;

export interface KpisResponse {
  cardsAbertos: number;
  eventosPendentes: number;
  slaEmRisco: number;
  resolvidosHoje: number;
}

export interface CurrentTaskMember {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  eventId: string | null;
  eventTitle: string | null;
  priority: string | null;
  currentStage: string | null;
  teamName: string | null;
  projectName: string | null;
  stageEnteredAt: string | null;
  businessMinutesInStage: number | null;
}

export interface RankingEntry {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  kanbanScore: number;
  qaSubmissions: number;
  qaApprovals: number;
  qaRejections: number;
  qaHitRate: number | null;
  qaStatus: string;
  slaScore: number;
  slaPct: number | null;
  slaProfile: string;
  eventsResolved: number;
  fastTrackCount: number;
  onTimeCount: number;
  breachedCount: number;
}

export interface WorkloadEntry {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  activeEvents: number;
  resolvedEvents: number;
  totalEvents: number;
}

export interface DemandChartEntry {
  date: string;
  total: number;
  resolved: number;
}

// Cache da URL base — permite atualização pelo painel sem restart do container
let cachedBaseUrl: string | null = null;
let baseUrlFetchedAt = 0;
const BASE_URL_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function getFlowBaseUrl(): Promise<string> {
  if (cachedBaseUrl && Date.now() - baseUrlFetchedAt < BASE_URL_CACHE_TTL) {
    return cachedBaseUrl;
  }
  try {
    const config = await prisma.appConfig.findUnique({ where: { key: "flow_api_base_url" } });
    if (config?.value) {
      cachedBaseUrl = config.value;
      baseUrlFetchedAt = Date.now();
      return cachedBaseUrl;
    }
  } catch {
    // DB indisponível — usa env var
  }
  cachedBaseUrl = process.env.FLOW_API_BASE_URL || "";
  baseUrlFetchedAt = Date.now();
  return cachedBaseUrl;
}

export function invalidateBaseUrlCache() {
  cachedBaseUrl = null;
  baseUrlFetchedAt = 0;
}

// Cache de token em memória — renovado automaticamente
let cachedToken: string | null = null;
let tokenFetchedAt: number = 0;
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutos

const FETCH_TIMEOUT_MS = 5000;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  const BASE_URL = await getFlowBaseUrl();
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`cardsFlow login falhou: ${res.status}`);

  const data = (await res.json()) as Array<{ token: string }>;
  cachedToken = data[0].token;
  tokenFetchedAt = Date.now();
  return cachedToken;
}

export async function callCardflowEndpoint<T = unknown>(
  path: string,
  params: CardflowParams = {}
): Promise<T> {
  const BASE_URL = await getFlowBaseUrl();
  const token = await getToken();
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`cardsFlow API error: ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json() as Promise<T>;
}

export const CardflowService = {
  getKpis: (teamId = "", startDate: string, endDate: string) =>
    callCardflowEndpoint<KpisResponse[]>("/devbi/kpis", { teamId, startDate, endDate }),

  getCurrentTasks: (teamId: string, startDate = "", endDate = "") =>
    callCardflowEndpoint<CurrentTaskMember[]>("/devbi/current-tasks", { teamId, startDate, endDate }),

  getRankings: (teamId = "", startDate: string, endDate: string, projectId = "") =>
    callCardflowEndpoint<RankingEntry[]>("/devbi/rankings", { teamId, startDate, endDate, projectId }),

  getWorkload: (teamId = "", startDate: string, endDate: string) =>
    callCardflowEndpoint<WorkloadEntry[]>("/devbi/workload", { teamId, startDate, endDate }),

  getDemandChart: (teamId = "", startDate: string, endDate: string) =>
    callCardflowEndpoint<DemandChartEntry[]>("/devbi/demand-chart", { teamId, startDate, endDate }),
};
