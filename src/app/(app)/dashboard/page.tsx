"use client";
import { useEffect, useState } from "react";
import { useFilters } from "@/hooks/useFilters";
import { FilterBar } from "@/components/ui/FilterBar";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, AlertCircle, AlertTriangle, Activity, Clock,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface MetricMeta {
  value: number;
  status: "high" | "medium" | "review" | "no_data";
  incidentId?: string;
  asOf: string;
}

interface DashboardKpis {
  cardsAbertos: MetricMeta;
  eventosPendentes: MetricMeta;
  slaEmRisco: MetricMeta;
  resolvidosHoje: MetricMeta;
}

const defaultMeta = (val = 0): MetricMeta => ({
  value: val,
  status: "no_data",
  asOf: new Date().toISOString()
});

interface Member {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  eventTitle: string | null;
  currentStage: string | null;
  businessMinutesInStage: number | null;
}

interface DemandPoint { date: string; total: number; resolved: number; }

interface ReprovaPreview {
  userId: string;
  userName: string;
  qaRejections: number;
  qaStatus: string | null;
}

function minutesToLabel(m: number | null) {
  if (m === null) return null;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h === 0 ? `${min}min` : `${h}h ${min}min`;
}

function Avatar({ name, url, size = 26 }: { name: string; url: string | null; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #fff" }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, var(--primary), #4D9EFF)",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "2px solid #fff",
    }}>
      {initials}
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ height: 6, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
    </div>
  );
}

function stageColor(stage: string | null): string {
  if (!stage) return "var(--muted)";
  const s = stage.toLowerCase();
  if (s.includes("análise") || s.includes("analise")) return "var(--warning)";
  if (s.includes("dev") || s.includes("implem"))       return "var(--success)";
  if (s.includes("review") || s.includes("revisão"))   return "var(--danger)";
  return "var(--primary)";
}

function ReliabilityIndicator({
  status,
  incidentId,
}: {
  status: "high" | "medium" | "review" | "no_data";
  incidentId?: string;
}) {
  const colorMap = {
    high: "#16a34a",
    medium: "#eab308",
    review: "#dc2626",
    no_data: "#9ca3af",
  };
  const titleMap = {
    high: "Dado auditado e validado (alta confiança)",
    medium: "Dado de fonte única (não auditado)",
    review: "Divergência detectada! Sob revisão",
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
          padding: "1px 4px", borderRadius: 4, letterSpacing: "0.2px"
        }}>
          INCIDENTE
        </span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { selectedTeam, teams, selectTeam, selectedId, startDate, endDate, setStartDate, setEndDate, setToday, loading: teamLoading } = useFilters();
  const [kpis, setKpis] = useState<DashboardKpis>({
    cardsAbertos: defaultMeta(0),
    eventosPendentes: defaultMeta(0),
    slaEmRisco: defaultMeta(0),
    resolvidosHoje: defaultMeta(0),
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [demand, setDemand] = useState<DemandPoint[]>([]);
  const [reprova, setReprova] = useState<ReprovaPreview[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataSource, setDataSource] = useState<"live" | "cache" | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [demandaMeta, setDemandaMeta] = useState<{ status: MetricMeta["status"]; incidentId?: string } | null>(null);
  const [tasksMeta, setTasksMeta] = useState<{ status: MetricMeta["status"]; incidentId?: string } | null>(null);

  useEffect(() => {
    if (!selectedTeam) return;
    setDataLoading(true);
    setDataSource(null);
    setCachedAt(null);

    const keys = "total_cards_abertos,eventos_pendentes,sla_em_risco,resolvidos_hoje,demanda_diaria_serie,current_tasks_by_member";
    const qMetrics = `?keys=${keys}&teamId=${selectedTeam.id}`;
    const q = `?teamConfigId=${selectedTeam.id}&startDate=${startDate}&endDate=${endDate}`;
    // Reprova no dashboard é widget de alerta — usa janela fixa de 30 dias (não o filtro de data)
    const today30 = new Date().toISOString().slice(0, 10);
    const start30 = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const qReprova = `?teamConfigId=${selectedTeam.id}&startDate=${start30}&endDate=${today30}`;
    const safe = (url: string) => fetch(url).then((r) => r.json()).catch(() => null);

    Promise.all([
      safe(`/api/radar/metrics${qMetrics}`),
      safe(`/api/current-tasks${q}`),
      safe(`/api/demand-chart${q}`),
      safe(`/api/reprova${qReprova}`),
    ]).then(([metricsRes, tasksRes, demandRes, reprovaRes]) => {
      if (metricsRes?.metrics) {
        const list = metricsRes.metrics as any[];
        const findMetric = (key: string, fallbackVal = 0): MetricMeta => {
          const m = list.find((x) => x.key === key);
          if (!m) return defaultMeta(fallbackVal);
          return {
            value: typeof m.value === "number" ? m.value : fallbackVal,
            status: m.status ?? "no_data",
            incidentId: m.incidentId,
            asOf: m.asOf || new Date().toISOString()
          };
        };

        setKpis({
          cardsAbertos: findMetric("total_cards_abertos", 0),
          eventosPendentes: findMetric("eventos_pendentes", 0),
          slaEmRisco: findMetric("sla_em_risco", 0),
          resolvidosHoje: findMetric("resolvidos_hoje", 0),
        });

        const demandaM = list.find((x: any) => x.key === "demanda_diaria_serie");
        if (demandaM) setDemandaMeta({ status: demandaM.status ?? "no_data", incidentId: demandaM.incidentId });

        const tasksM = list.find((x: any) => x.key === "current_tasks_by_member");
        if (tasksM) setTasksMeta({ status: tasksM.status ?? "no_data", incidentId: tasksM.incidentId });
      }

      // E4: /api/current-tasks agora retorna { tasks, tempoEmEtapaMeta }
      const taskList = Array.isArray(tasksRes) ? tasksRes : (tasksRes?.tasks ?? []);
      setMembers(taskList);
      if (demandRes?.data)  setDemand(demandRes.data);
      if (reprovaRes?.members) {
        const sorted = [...reprovaRes.members]
          .sort((a: ReprovaPreview, b: ReprovaPreview) => b.qaRejections - a.qaRejections)
          .slice(0, 5);
        setReprova(sorted);
      }

      setDataSource(demandRes?.dataSource ?? null);
      setCachedAt(demandRes?.capturedAt ?? null);
    }).finally(() => setDataLoading(false));
  }, [selectedTeam, startDate, endDate]);

  const alertCount  = reprova.filter((r) => r.qaStatus === "Alerta Comport.").length;
  const slaRisk     = kpis.slaEmRisco.value;
  const totalAlerts = alertCount + (slaRisk > 0 ? 1 : 0);
  const totalCards  = kpis.cardsAbertos.value + kpis.resolvidosHoje.value;

  if (teamLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "var(--muted)" }}>
      Carregando equipes...
    </div>
  );

  if (!selectedTeam) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "var(--muted)" }}>
      Nenhuma equipe configurada. Acesse as Configurações e ative uma equipe.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, color: "var(--primary)",
            textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 6,
          }}>
            {selectedTeam.teamName}
          </p>
          <h1 style={{
            fontSize: 30, fontWeight: 800, color: "var(--text)",
            letterSpacing: "-0.8px", lineHeight: 1.1,
          }}>
            Dashboard de Liderança
          </h1>
        </div>
        <FilterBar
          teams={teams}
          selectedId={selectedId}
          onTeamChange={selectTeam}
          startDate={startDate}
          endDate={endDate}
          onStartDate={setStartDate}
          onEndDate={setEndDate}
          onToday={setToday}
          loading={dataLoading}
        />
      </div>

      {/* ── Cache notice ── */}
      {dataSource === "cache" && (
        <div style={{
          background: "#FFFBEB", border: "1px solid #FDE68A",
          borderRadius: 10, padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 12, color: "#92400E",
        }}>
          <Clock size={13} />
          <span>
            <strong>Dados do banco local</strong> — API cardsFlow indisponível (timeout de 5s).
            {cachedAt && ` Última captura: ${new Date(cachedAt).toLocaleString("pt-BR")}.`}
            {" "}Os dados são atualizados automaticamente a cada 30 minutos.
          </span>
        </div>
      )}

      {/* ── Row 1: Velocity Metrics + Bottleneck Alerts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>

        {/* Velocity / Flow Metrics */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: 24,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Métricas de Fluxo</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Momento atual da equipe</p>
            </div>
            <TrendingUp size={18} color="var(--primary)" strokeWidth={2} />
          </div>

          {/* Big number */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <p style={{
              fontSize: 56, fontWeight: 800, color: "var(--primary)",
              letterSpacing: "-2.5px", lineHeight: 1, marginBottom: 4,
              fontFamily: "var(--font-mono)",
            }}>
              {dataLoading ? "—" : kpis.cardsAbertos.value}
            </p>
            {!dataLoading && (
              <ReliabilityIndicator status={kpis.cardsAbertos.status} incidentId={kpis.cardsAbertos.incidentId} />
            )}
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>Cards Ativos</p>

          {/* Capacity bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--secondary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  Resolvidos hoje ({kpis.resolvidosHoje.value})
                  {!dataLoading && (
                    <ReliabilityIndicator status={kpis.resolvidosHoje.status} incidentId={kpis.resolvidosHoje.incidentId} />
                  )}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>
                  {totalCards > 0 ? Math.round((kpis.resolvidosHoje.value / totalCards) * 100) : 0}%
                </span>
              </div>
              <ProgressBar value={kpis.resolvidosHoje.value} max={totalCards || 1} color="var(--primary)" />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--secondary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  Eventos pendentes ({kpis.eventosPendentes.value})
                  {!dataLoading && (
                    <ReliabilityIndicator status={kpis.eventosPendentes.status} incidentId={kpis.eventosPendentes.incidentId} />
                  )}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: slaRisk > 0 ? "var(--danger)" : "var(--success)" }}>
                  {slaRisk > 0 ? `${slaRisk} em risco` : "OK"}
                </span>
              </div>
              <ProgressBar value={kpis.eventosPendentes.value} max={50} color={slaRisk > 0 ? "var(--danger)" : "var(--success)"} />
            </div>
          </div>
        </div>

        {/* Bottleneck Alerts */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: 24,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Alertas de Gargalo</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Bloqueios que requerem atenção</p>
            </div>
            {totalAlerts > 0 && (
              <span style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 700,
                color: "var(--danger-text)", background: "var(--danger-dim)",
                padding: "4px 10px", borderRadius: 6,
              }}>
                <AlertCircle size={12} /> {totalAlerts} {totalAlerts === 1 ? "Ativo" : "Ativos"}
              </span>
            )}
          </div>

          {totalAlerts === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--success-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Activity size={22} color="var(--success)" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Tudo em ordem</p>
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Nenhum gargalo identificado no momento</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {slaRisk > 0 && (
                <BottleneckCard
                  icon={<AlertCircle size={18} color="var(--danger)" />}
                  title="SLA em Risco"
                  desc={`${slaRisk} card${slaRisk > 1 ? "s" : ""} próximo${slaRisk > 1 ? "s" : ""} ao prazo limite na fila`}
                  status="AT RISK"
                  statusColor="var(--danger)"
                  action="Verificar tarefas"
                  href="/tasks"
                  reliabilityStatus={kpis.slaEmRisco.status}
                  incidentId={kpis.slaEmRisco.incidentId}
                />
              )}
              {alertCount > 0 && (
                <BottleneckCard
                  icon={<AlertTriangle size={18} color="var(--warning)" />}
                  title="Reprova QA"
                  desc={`${alertCount} desenvolvedor${alertCount > 1 ? "es" : ""} com taxa de reprova acima do limite`}
                  status="CRÍTICO"
                  statusColor="var(--warning-text)"
                  action="Ver relatório"
                  href="/reprova"
                />
              )}
              {/* Fill grid if only 1 alert */}
              {totalAlerts === 1 && (
                <div style={{
                  border: "1.5px dashed var(--border)", borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--muted)", fontSize: 12, minHeight: 120,
                }}>
                  Sem outros alertas
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Burndown chart + Recent Activity ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>

        {/* Burndown / Demand chart */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{
            padding: "18px 24px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Tendência de Demanda — 30 dias</p>
              {!dataLoading && demandaMeta && (
                <ReliabilityIndicator status={demandaMeta.status} incidentId={demandaMeta.incidentId} />
              )}
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {[["#94A3B8", "Ideal"], ["var(--primary)", "Criados"], ["var(--success)", "Resolvidos"]].map(([color, label]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ padding: 24 }}>
            {dataLoading ? (
              <div className="skeleton" style={{ height: 200 }} />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={demand} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    tickFormatter={(v) => v.slice(5)}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: 8 }}
                    labelFormatter={(l) => `Data: ${l}`}
                    formatter={(v, n) => [v, n === "total" ? "Criados" : "Resolvidos"]}
                  />
                  <Line type="monotone" dataKey="total"    stroke="#0066FF" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{
            padding: "18px 20px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Atividade Recente</p>
              {!dataLoading && tasksMeta && (
                <ReliabilityIndicator status={tasksMeta.status} incidentId={tasksMeta.incidentId} />
              )}
            </div>
            <a href="/tasks" style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
              Ver todos
            </a>
          </div>
          <div style={{ padding: "8px 0" }}>
            {dataLoading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} style={{ padding: "12px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div className="skeleton" style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 12, width: "70%", marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: "90%" }} />
                  </div>
                </div>
              ))
            ) : members.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                Nenhuma atividade recente
              </div>
            ) : (
              members.slice(0, 6).map((m, i) => {
                const dotColor = stageColor(m.currentStage);
                const timeLabel = m.businessMinutesInStage !== null ? minutesToLabel(m.businessMinutesInStage) : null;
                return (
                  <div key={m.userId} style={{
                    padding: "11px 20px",
                    borderBottom: i < Math.min(members.length, 6) - 1 ? "1px solid var(--border)" : "none",
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: dotColor, flexShrink: 0, marginTop: 5,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.eventTitle ?? "Sem tarefa ativa"}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.userName}
                        {m.currentStage && ` · ${m.currentStage}`}
                      </p>
                      {timeLabel && (
                        <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{timeLabel} nesta etapa</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Reprova highlights at bottom */}
            {reprova.filter(r => r.qaStatus === "Alerta Comport.").slice(0, 2).map((r) => (
              <div key={r.userId} style={{
                padding: "11px 20px",
                borderTop: "1px solid var(--border)",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "var(--danger)", flexShrink: 0, marginTop: 5,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Alerta de Qualidade</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <p style={{ fontSize: 11, color: "var(--secondary)" }}>{r.userName} · {r.qaRejections} reprovas</p>
                    <StatusBadge status={r.qaStatus} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

/* ── Bottleneck card sub-component ── */
function BottleneckCard({
  icon, title, desc, status, statusColor, action, href, reliabilityStatus, incidentId
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  status: string;
  statusColor: string;
  action: string;
  href: string;
  reliabilityStatus?: "high" | "medium" | "review" | "no_data";
  incidentId?: string;
}) {
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 12,
      padding: "16px", background: "var(--surface-2)",
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative",
    }}>
      {reliabilityStatus && (
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <ReliabilityIndicator status={reliabilityStatus} incidentId={incidentId} />
        </div>
      )}
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: "var(--surface)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{title}</p>
      <p style={{ fontSize: 12, color: "var(--secondary)", lineHeight: 1.4 }}>{desc}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: statusColor, letterSpacing: "0.5px" }}>
          {status}
        </span>
        <span style={{ fontSize: 10, color: "var(--muted)" }}>·</span>
        <a href={href} style={{ fontSize: 10, color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>{action}</a>
      </div>
    </div>
  );
}
