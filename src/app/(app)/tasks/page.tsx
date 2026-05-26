"use client";
import { useEffect, useState, useCallback } from "react";
import { useSelectedTeam } from "@/hooks/useTeam";
import { Clock, RefreshCw, Plus } from "lucide-react";

interface CurrentTask {
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

interface WorkloadEntry {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  activeEvents: number;
  resolvedEvents: number;
  totalEvents: number;
}

interface TempoMeta {
  status: "high" | "medium" | "review" | "no_data";
  incidentId: string | null;
}

function formatMinutes(min: number | null) {
  if (min === null) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function Avatar({ name, url, size = 28 }: { name: string; url: string | null; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid #fff" }} />;
  const initials = name.charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, var(--primary), #4D9EFF)",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "2px solid #fff",
    }}>
      {initials}
    </div>
  );
}

function ReliabilityIndicator({
  status,
  incidentId,
}: {
  status: "high" | "medium" | "review" | "no_data";
  incidentId?: string | null;
}) {
  const colorMap = { high: "#16a34a", medium: "#eab308", review: "#dc2626", no_data: "#9ca3af" };
  const titleMap = {
    high:    "Dado auditado e validado (alta confiança)",
    medium:  "Dado de fonte única (não auditado)",
    review:  "Divergência detectada! Sob revisão",
    no_data: "Sem dados de auditoria",
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "help" }} title={titleMap[status]}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: colorMap[status] || "#9ca3af", display: "inline-block",
        boxShadow: status === "review" ? "0 0 6px #dc2626" : "none",
      }} />
      {incidentId && (
        <span style={{
          fontSize: 8, fontWeight: 800, background: "#dc2626", color: "#fff",
          padding: "1px 4px", borderRadius: 4, letterSpacing: "0.2px",
        }}>
          INCIDENTE
        </span>
      )}
    </div>
  );
}

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const s = stage.toLowerCase();
  let bg = "var(--primary-dim)", color = "var(--primary)";
  if (s.includes("análise") || s.includes("analise")) { bg = "var(--warning-dim)"; color = "var(--warning-text)"; }
  if (s.includes("dev") || s.includes("implem"))       { bg = "var(--success-dim)"; color = "var(--success-text)"; }
  if (s.includes("review") || s.includes("revisão"))   { bg = "var(--danger-dim)";  color = "var(--danger-text)"; }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: bg, color }}>{stage}</span>
  );
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const map: Record<string, { bg: string; color: string; label: string }> = {
    "Alta":  { bg: "rgba(239,68,68,0.12)",  color: "#B91C1C", label: "Critical" },
    "Média": { bg: "rgba(0,102,255,0.10)",  color: "#0047B3", label: "Feature"  },
    "Baixa": { bg: "rgba(16,185,129,0.10)", color: "#065F46", label: "Chore"    },
  };
  const s = map[priority] ?? { bg: "var(--primary-dim)", color: "var(--primary)", label: priority };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

const PRIORITY_ORDER = ["Alta", "Média", "Baixa", null];
const PRIORITY_LABELS: Record<string, { label: string; dotColor: string }> = {
  "Alta":  { label: "ALTA PRIORIDADE",  dotColor: "var(--danger)" },
  "Média": { label: "MÉDIA PRIORIDADE", dotColor: "var(--muted)" },
  "Baixa": { label: "BAIXA PRIORIDADE", dotColor: "#CBD5E1" },
  "null":  { label: "SEM PRIORIDADE",   dotColor: "#CBD5E1" },
};

export default function TasksPage() {
  const { selectedTeam, loading: teamLoading } = useSelectedTeam();
  const [tasks, setTasks] = useState<CurrentTask[]>([]);
  const [tempoMeta, setTempoMeta] = useState<TempoMeta | null>(null);
  const [workload, setWorkload] = useState<WorkloadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    if (!selectedTeam) return;
    setLoading(true);
    setApiUnavailable(false);
    setCachedAt(null);
    Promise.all([
      fetch(`/api/current-tasks?teamConfigId=${selectedTeam.id}`).then(async (r) => {
        const source = r.headers.get("X-Data-Source");
        const cached = r.headers.get("X-Cached-At");
        const json = await r.json();
        const taskList = Array.isArray(json) ? json : (json?.tasks ?? []);
        const meta = json?.tempoEmEtapaMeta ?? null;
        return { taskList, meta, source, cached };
      }).catch(() => ({ taskList: [], meta: null, source: "unavailable", cached: null })),
      fetch(`/api/workload?teamConfigId=${selectedTeam.id}`).then(async (r) => {
        const source = r.headers.get("X-Data-Source");
        const data = await r.json();
        return { data, source };
      }).catch(() => ({ data: [], source: "unavailable" })),
    ]).then(([tasksResult, workloadResult]) => {
      setTasks(Array.isArray(tasksResult.taskList) ? tasksResult.taskList : []);
      setTempoMeta(tasksResult.meta);
      setWorkload(Array.isArray(workloadResult.data) ? workloadResult.data : []);
      setLastUpdated(new Date());
      const isStale = tasksResult.source === "cache" || tasksResult.source === "unavailable"
        || workloadResult.source === "cache" || workloadResult.source === "unavailable";
      setApiUnavailable(isStale);
      setCachedAt(tasksResult.cached ?? null);
    }).finally(() => setLoading(false));
  }, [selectedTeam]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeTasks = tasks.filter((t) => t.eventId);
  const totalResolved = workload.reduce((s, w) => s + Number(w.resolvedEvents), 0);
  const totalActive   = workload.reduce((s, w) => s + Number(w.activeEvents),   0);
  const totalAll      = totalResolved + totalActive;
  const progressPct   = totalAll > 0 ? Math.round((totalResolved / totalAll) * 100) : 0;

  const tasksByPriority = PRIORITY_ORDER.reduce<Record<string, CurrentTask[]>>((acc, p) => {
    const key = p ?? "null";
    acc[key] = activeTasks.filter((t) => (t.priority ?? null) === p);
    return acc;
  }, {});

  const kanbanCols = ["Alta", "Média", "Baixa"].filter((p) =>
    tasksByPriority[p]?.length > 0 || tasksByPriority["null"]?.length > 0
  );
  if (tasksByPriority["Alta"]?.length === 0 && tasksByPriority["Média"]?.length === 0 && tasksByPriority["Baixa"]?.length === 0) {
    kanbanCols.push(...["Alta", "Média", "Baixa"]);
  }
  const uniqueCols = [...new Set(kanbanCols.length ? kanbanCols : ["Alta", "Média", "Baixa"])];

  if (teamLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "var(--muted)" }}>
      Carregando...
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.8px", lineHeight: 1.1, marginBottom: 8 }}>
            Central de Tarefas
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--secondary)",
              background: "var(--surface-2)", border: "1px solid var(--border)",
              padding: "3px 10px", borderRadius: 20,
            }}>
              {selectedTeam?.teamName ?? "—"}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>· Tarefas em andamento</span>
            {tempoMeta && !loading && (
              <ReliabilityIndicator status={tempoMeta.status} incidentId={tempoMeta.incidentId} />
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Atualizado às {lastUpdated.toLocaleTimeString("pt-BR")}
            </span>
          )}
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 8,
              background: "var(--surface)", border: "1px solid var(--border)",
              fontSize: 12, fontWeight: 600, color: "var(--secondary)",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            Atualizar
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            background: "var(--primary)", border: "none",
            fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,102,255,0.28)",
          }}>
            <Plus size={14} /> Nova Tarefa
          </button>
        </div>
      </div>

      {/* API indisponível banner */}
      {apiUnavailable && (
        <div style={{
          background: "var(--warning-dim)", border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 10, padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Clock size={14} color="var(--warning)" />
          <p style={{ fontSize: 12, color: "var(--warning-text)", margin: 0 }}>
            <strong>API cardsFlow indisponível.</strong>{" "}
            {cachedAt
              ? `Exibindo dados salvos em ${new Date(cachedAt).toLocaleString("pt-BR")}.`
              : "Nenhum dado em cache disponível."}
          </p>
        </div>
      )}

      {/* ── Sprint Progress ── */}
      {totalAll > 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: 24,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Progresso da Equipe</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {totalActive} tarefa{totalActive !== 1 ? "s" : ""} restante{totalActive !== 1 ? "s" : ""} no ciclo atual
              </p>
            </div>
            <p style={{
              fontSize: 44, fontWeight: 800, color: "var(--primary)",
              letterSpacing: "-2px", lineHeight: 1,
              fontFamily: "var(--font-mono)",
            }}>
              {progressPct}%
              <span style={{ fontSize: 16, fontWeight: 600, color: "var(--muted)", marginLeft: 4 }}>Concluído</span>
            </p>
          </div>
          <div style={{ height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
            <div style={{
              height: "100%", width: `${progressPct}%`,
              background: "var(--primary)", borderRadius: 99,
              transition: "width 0.8s ease",
            }} />
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--secondary)" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", display: "inline-block" }} />
              {totalResolved} Resolvidos (30d)
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--border)", display: "inline-block" }} />
              {totalActive} Pendentes
            </span>
          </div>
        </div>
      )}

      {/* ── Priority Kanban ── */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${uniqueCols.length}, 1fr)`, gap: 16, alignItems: "start" }}>
        {uniqueCols.map((priority) => {
          const cols = tasksByPriority[priority] ?? [];
          const meta = PRIORITY_LABELS[priority];
          return (
            <div key={priority} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dotColor, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--secondary)", letterSpacing: "0.8px" }}>{meta.label}</span>
                <span style={{
                  marginLeft: "auto", fontSize: 10, fontWeight: 700,
                  color: "var(--muted)", background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  padding: "1px 7px", borderRadius: 5,
                }}>
                  {cols.length}
                </span>
              </div>

              {loading ? (
                [1, 2].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />
                ))
              ) : cols.length === 0 ? (
                <div style={{
                  border: "1.5px dashed var(--border)", borderRadius: 12,
                  padding: "28px 16px", textAlign: "center",
                  color: "var(--muted)", fontSize: 12,
                }}>
                  Nenhuma tarefa
                </div>
              ) : (
                cols.map((task) => (
                  <TaskCard key={task.userId} task={task} tempoMeta={tempoMeta} />
                ))
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

function TaskCard({ task, tempoMeta }: { task: CurrentTask; tempoMeta: TempoMeta | null }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "16px",
      boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <PriorityBadge priority={task.priority} />
        {task.currentStage && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
            background: "var(--surface-2)", color: "var(--secondary)",
            border: "1px solid var(--border)",
          }}>
            {task.currentStage}
          </span>
        )}
      </div>

      <p style={{
        fontSize: 14, fontWeight: 700, color: "var(--text)",
        lineHeight: 1.35, letterSpacing: "-0.2px",
      }}>
        {task.eventTitle ?? "Tarefa sem título"}
      </p>

      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
        {task.projectName
          ? `Projeto: ${task.projectName}`
          : task.teamName ?? ""}
        {task.businessMinutesInStage !== null && ` · ${formatMinutes(task.businessMinutesInStage)} nesta etapa`}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid var(--border)" }}>
        <Avatar name={task.userName} url={task.avatarUrl} size={26} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {tempoMeta && task.businessMinutesInStage !== null && (
            <ReliabilityIndicator status={tempoMeta.status} incidentId={tempoMeta.incidentId} />
          )}
          {task.businessMinutesInStage !== null && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)" }}>
              <Clock size={11} />
              {formatMinutes(task.businessMinutesInStage)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
