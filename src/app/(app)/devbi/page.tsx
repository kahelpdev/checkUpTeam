"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSelectedTeam } from "@/hooks/useTeam";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { RefreshCw, TrendingUp, TrendingDown, Trophy, Zap, AlertTriangle, Star, Clock, Users, FolderOpen, X } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ─────────────────────────────────────────────────────────────────
interface KpiData { cardsAbertos: number; eventosPendentes: number; slaEmRisco: number; resolvidosHoje: number; }
interface RankingEntry {
  userId: string; userName: string; avatarUrl: string | null;
  kanbanScore: number; qaSubmissions: number; qaApprovals: number; qaRejections: number;
  qaHitRate: number | null; qaStatus: string;
  slaScore: number; slaPct: number | null; slaProfile: string;
  eventsResolved: number; fastTrackCount: number; onTimeCount: number; breachedCount: number;
}
interface CurrentTask {
  userId: string; userName: string; avatarUrl: string | null;
  eventId: string | null; eventTitle: string | null; priority: string | null;
  currentStage: string | null; teamName: string | null; projectName: string | null;
  stageEnteredAt: string | null; businessMinutesInStage: number | null;
}
interface WorkloadEntry { userId: string; userName: string; activeEvents: number; resolvedEvents: number; }
interface DemandEntry { date: string; total: number; resolved: number; }

interface DevBIData {
  kpis: KpiData;
  rankings: RankingEntry[];
  currentTasks: CurrentTask[];
  workload: WorkloadEntry[];
  demandChart: DemandEntry[];
  weeklyChangePct: number;
  dataSource: "live" | "cache";
  cachedAt?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const card = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
};

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px",
  fontSize: 12, color: "var(--text)", background: "var(--surface)",
  outline: "none", cursor: "pointer", minWidth: 160,
};

function getProfileIcon(status: string) {
  if (status?.includes("Ouro"))    return <Star size={14} color="#F59E0B" fill="#F59E0B" />;
  if (status?.includes("Rápido"))  return <Zap size={14} color="#0066FF" />;
  if (status?.includes("Alerta"))  return <AlertTriangle size={14} color="var(--danger)" />;
  return null;
}

function priorityColor(p: string | null) {
  if (!p) return "var(--muted)";
  const l = p.toLowerCase();
  if (l.includes("alta") || l.includes("urgent")) return "var(--danger)";
  if (l.includes("média") || l.includes("media") || l.includes("normal")) return "#F59E0B";
  return "var(--success)";
}

function ElapsedTimer({ since }: { since: string | null }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!since) return;
    const update = () => {
      const ms = Date.now() - new Date(since).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [since]);
  return <span>{elapsed || "—"}</span>;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (url) return <img src={url} alt={name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      background: "var(--primary-dim)", color: "var(--primary)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: "-1px", lineHeight: 1 }}>{value ?? "—"}</p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function DevBIDashboard() {
  const { selectedId, teams, selectTeam } = useSelectedTeam();
  const [data, setData] = useState<DevBIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterUserId, setFilterUserId] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const lastFetch = useRef(0);

  const fetchData = useCallback(async () => {
    if (Date.now() - lastFetch.current < 500) return;
    lastFetch.current = Date.now();
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ teamConfigId: selectedId ?? "", startDate, endDate });
      const res = await fetch(`/api/devbi?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Erro ${res.status}`);
      } else {
        setData(await res.json());
        // reset filters when new data loads (different team/period)
        setFilterUserId("");
        setFilterProject("");
      }
    } catch {
      setError("Falha ao buscar dados.");
    }
    setLoading(false);
  }, [selectedId, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived filter options ───────────────────────────────────────────────
  const collaborators = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const list: { userId: string; userName: string }[] = [];
    [...data.rankings, ...data.workload].forEach((u) => {
      if (!seen.has(u.userId)) { seen.add(u.userId); list.push({ userId: u.userId, userName: u.userName }); }
    });
    return list.sort((a, b) => a.userName.localeCompare(b.userName));
  }, [data]);

  const projects = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.currentTasks.map((t) => t.projectName).filter(Boolean))] as string[];
  }, [data]);

  // ── Filtered data (client-side) ──────────────────────────────────────────
  const filteredRankings = useMemo(() => {
    if (!data) return [];
    return data.rankings.filter((r) => !filterUserId || r.userId === filterUserId);
  }, [data, filterUserId]);

  const filteredCurrentTasks = useMemo(() => {
    if (!data) return [];
    return data.currentTasks.filter((t) =>
      (!filterUserId || t.userId === filterUserId) &&
      (!filterProject || t.projectName === filterProject)
    );
  }, [data, filterUserId, filterProject]);

  const filteredWorkload = useMemo(() => {
    if (!data) return [];
    return data.workload.filter((w) => !filterUserId || w.userId === filterUserId);
  }, [data, filterUserId]);

  const hasActiveFilter = filterUserId || filterProject;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 4 }}>
            Analytics & Gamificação
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.8px", lineHeight: 1.15, marginBottom: 4 }}>
            DevBI
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Performance individual e qualidade da equipe no período</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "var(--text)", background: "var(--surface)", outline: "none" }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>até</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "var(--text)", background: "var(--surface)", outline: "none" }} />
          <button onClick={fetchData} disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--primary)", color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.65 : 1,
              boxShadow: loading ? "none" : "0 2px 8px rgba(0,102,255,0.28)",
            }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "12px 16px",
      }}>
        {/* Equipe */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Users size={13} color="var(--muted)" />
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>Equipe</span>
        </div>
        <select
          value={selectedId ?? ""}
          onChange={(e) => { selectTeam(e.target.value); }}
          style={selectStyle}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.teamName}</option>
          ))}
        </select>

        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />

        {/* Colaborador */}
        <select
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value)}
          style={selectStyle}
          disabled={!data}
        >
          <option value="">Todos os colaboradores</option>
          {collaborators.map((c) => (
            <option key={c.userId} value={c.userId}>{c.userName}</option>
          ))}
        </select>

        {/* Projeto */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          style={selectStyle}
          disabled={!data || projects.length === 0}
        >
          <option value="">Todos os projetos</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              <FolderOpen size={12} /> {p}
            </option>
          ))}
        </select>

        {/* Limpar filtros */}
        {hasActiveFilter && (
          <button
            onClick={() => { setFilterUserId(""); setFilterProject(""); }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600, color: "var(--primary)",
              background: "var(--primary-dim)", border: "1px solid var(--primary)",
              borderRadius: 6, padding: "6px 12px", cursor: "pointer",
            }}
          >
            <X size={11} /> Limpar filtros
          </button>
        )}

        {hasActiveFilter && (
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
            Filtrando resultados
          </span>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#DC2626" }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Cache notice ── */}
      {data?.dataSource === "cache" && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "#92400E", display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={13} />
          <span>
            <strong>Dados do banco local</strong> — API cardsFlow indisponível no momento.
            {data.cachedAt && ` Última captura: ${format(new Date(data.cachedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}.`}
            {" "}Os dados serão atualizados automaticamente quando a conexão for restabelecida.
          </span>
        </div>
      )}

      {/* ── KPIs ── */}
      {data?.kpis && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <KpiCard label="Cards Abertos"      value={data.kpis.cardsAbertos}    color="var(--primary)" />
          <KpiCard label="Eventos Pendentes"  value={data.kpis.eventosPendentes} color="#F59E0B" />
          <KpiCard label="SLA em Risco"       value={data.kpis.slaEmRisco}       color="var(--danger)" />
          <KpiCard label="Resolvidos Hoje"    value={data.kpis.resolvidosHoje}   color="var(--success)" />
        </div>
      )}

      {/* ── Demand Chart ── */}
      {data?.demandChart && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Entrada de Demandas</p>
              <p style={{ fontSize: 11, color: "var(--muted)" }}>Cards criados vs resolvidos por dia</p>
            </div>
            {data.weeklyChangePct !== undefined && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                background: data.weeklyChangePct >= 0 ? "#FEF3C7" : "#DCFCE7",
                border: `1px solid ${data.weeklyChangePct >= 0 ? "#FDE68A" : "#86EFAC"}`,
                borderRadius: 20, padding: "4px 12px",
              }}>
                {data.weeklyChangePct >= 0
                  ? <TrendingUp size={13} color="#D97706" />
                  : <TrendingDown size={13} color="#16A34A" />}
                <span style={{ fontSize: 12, fontWeight: 700, color: data.weeklyChangePct >= 0 ? "#D97706" : "#16A34A" }}>
                  {data.weeklyChangePct >= 0 ? "+" : ""}{data.weeklyChangePct}% vs semana anterior
                </span>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.demandChart} margin={{ top: 5, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickFormatter={(d) => format(parseISO(d), "dd/MM", { locale: ptBR })} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip
                formatter={(v, name) => [v, name === "total" ? "Criados" : "Resolvidos"]}
                labelFormatter={(d) => format(parseISO(d as string), "dd/MM/yyyy", { locale: ptBR })}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line type="monotone" dataKey="total"    stroke="#0066FF" strokeWidth={2} dot={false} name="total" />
              <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} dot={false} name="resolved" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 3, background: "#0066FF", borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Criados</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 3, background: "#10B981", borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Resolvidos</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Current Tasks ── */}
      {data?.currentTasks && filteredCurrentTasks.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
            Em Execução Agora — {filteredCurrentTasks.filter((t) => t.eventId).length} membros ativos
            {hasActiveFilter && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>(filtrado)</span>}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {filteredCurrentTasks.map((t) => (
              <div key={t.userId} style={{
                ...card, padding: 16,
                borderLeft: `3px solid ${t.eventId ? priorityColor(t.priority) : "var(--border)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Avatar name={t.userName} url={t.avatarUrl} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.userName}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--muted)" }}>{t.teamName ?? "—"}</p>
                  </div>
                  {t.priority && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: `${priorityColor(t.priority)}22`, color: priorityColor(t.priority),
                    }}>
                      {t.priority}
                    </span>
                  )}
                </div>
                {t.eventId ? (
                  <>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.eventTitle ?? "—"}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: "var(--muted)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 20, border: "1px solid var(--border)" }}>
                        {t.currentStage ?? "—"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--muted)" }}>
                        <Clock size={10} />
                        <ElapsedTimer since={t.stageEnteredAt} />
                      </div>
                    </div>
                    {t.projectName && (
                      <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📁 {t.projectName}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>Sem tarefa ativa no momento</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.currentTasks && filteredCurrentTasks.length === 0 && hasActiveFilter && (
        <div style={{ textAlign: "center", padding: "24px", color: "var(--muted)", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          Nenhuma tarefa encontrada para os filtros selecionados.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* ── Ranking Gamificado ── */}
        {data?.rankings && filteredRankings.length > 0 && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Trophy size={16} color="#F59E0B" fill="#F59E0B" />
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                Ranking de Performance
                {hasActiveFilter && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>(filtrado)</span>}
              </p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["#", "Dev", "Kanban", "QA Hit Rate", "SLA %", "Resolvidos", "Perfil"].map((h) => (
                      <th key={h} style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: h === "#" ? "center" : "left" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRankings
                    .sort((a, b) => b.kanbanScore - a.kanbanScore)
                    .map((r, i) => (
                      <tr key={r.userId} style={{ borderBottom: "1px solid var(--border)", background: i === 0 ? "rgba(245,158,11,0.05)" : "transparent" }}>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7C4A" : "var(--muted)" }}>
                            {i + 1}
                          </span>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Avatar name={r.userName} url={r.avatarUrl} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{r.userName}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: r.kanbanScore > 0 ? "var(--primary)" : "var(--danger)" }}>
                            {r.kanbanScore > 0 ? "+" : ""}{r.kanbanScore}
                          </span>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2, maxWidth: 60 }}>
                              <div style={{ width: `${Math.min(r.qaHitRate ?? 0, 100)}%`, height: "100%", background: (r.qaHitRate ?? 0) >= 80 ? "#10B981" : (r.qaHitRate ?? 0) >= 60 ? "#F59E0B" : "var(--danger)", borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>
                              {r.qaHitRate != null ? `${r.qaHitRate.toFixed(0)}%` : "—"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
                            {r.slaPct != null ? `${r.slaPct.toFixed(0)}%` : "—"}
                          </span>
                        </td>
                        <td style={{ padding: "10px", fontSize: 12, color: "var(--muted)" }}>{r.eventsResolved}</td>
                        <td style={{ padding: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {getProfileIcon(r.qaStatus)}
                            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)" }}>
                              {r.qaStatus?.replace("Alerta Comport.", "Alerta") ?? "—"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Workload Chart ── */}
        {data?.workload && filteredWorkload.length > 0 && (
          <div style={card}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
              Carga de Trabalho
              {hasActiveFilter && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>(filtrado)</span>}
            </p>
            <ResponsiveContainer width="100%" height={Math.max(filteredWorkload.length * 44, 120)}>
              <BarChart data={filteredWorkload} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <YAxis dataKey="userName" type="category" width={90} tick={{ fontSize: 10, fill: "var(--text)" }} />
                <Tooltip
                  formatter={(v, name) => [v, name === "activeEvents" ? "Ativos" : "Resolvidos"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="activeEvents" name="activeEvents" stackId="a" fill="#0066FF" radius={[0, 0, 0, 0]} />
                <Bar dataKey="resolvedEvents" name="resolvedEvents" stackId="a" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, background: "#0066FF", borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "var(--muted)" }}>Ativos</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, background: "#10B981", borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "var(--muted)" }}>Resolvidos</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SLA Detail Table ── */}
      {data?.rankings && filteredRankings.length > 0 && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
            Detalhamento SLA e Entregas
            {hasActiveFilter && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>(filtrado)</span>}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Dev", "Resolvidos", "Fast Track", "No Prazo", "Atrasados", "SLA %", "Perfil SLA"].map((h) => (
                    <th key={h} style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRankings.sort((a, b) => (b.slaPct ?? 0) - (a.slaPct ?? 0)).map((r) => (
                  <tr key={r.userId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={r.userName} url={r.avatarUrl} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{r.userName}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted)" }}>{r.eventsResolved}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0066FF" }}>{r.fastTrackCount}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#10B981" }}>{r.onTimeCount}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: r.breachedCount > 0 ? "var(--danger)" : "var(--muted)" }}>
                        {r.breachedCount}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: (r.slaPct ?? 0) >= 80 ? "#10B981" : (r.slaPct ?? 0) >= 60 ? "#F59E0B" : "var(--danger)",
                      }}>
                        {r.slaPct != null ? `${r.slaPct.toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.slaProfile ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
          <div style={{ fontSize: 13 }}>Carregando dados do cardsFlow...</div>
        </div>
      )}
    </div>
  );
}
