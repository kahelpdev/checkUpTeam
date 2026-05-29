"use client";
import { useEffect, useState, useCallback } from "react";
import { useFilters } from "@/hooks/useFilters";
import { FilterBar } from "@/components/ui/FilterBar";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  AlertTriangle, Download, Users, TrendingDown, CheckCircle,
  ChevronRight, Info, X, FileText, Database, Clock, Filter,
} from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";

interface Member {
  userId: string;
  userName: string;
  reprovacoes: number;
  entregas: number;
  taxaReprovaPct: number | null;
  diasComReprova: number;
}

interface ReprovaEvent {
  eventId: string;
  eventTitle: string;
  reproducedAt: string;
  userId: string;
  userName: string;
  fromStage: string | null;
  toStage: string;
}

interface TeamKpi {
  totalReprovacoes: number;
  totalEntregas: number;
  taxaMedia: number | null;
  devsComReprova: number;
}

interface ChartPoint {
  date: string;
  [userName: string]: string | number;
}

interface MonthPoint {
  month: string;
  [userName: string]: string | number;
}

interface TrustEntry {
  status: "high" | "medium" | "review" | "no_data";
  incidentId: string | null;
}

interface DataLineage {
  source: string;
  host: string;
  database: string;
  table: string;
  filter: string;
  timezone: string;
  cache: string;
  query: string;
}

interface ApiResponse {
  members: Member[];
  teamKpi: TeamKpi;
  dailyBreakdown: ChartPoint[];
  monthlyTrend: MonthPoint[];
  events: ReprovaEvent[];
  dataLineage: DataLineage;
  dataSource: "db";
  reprovaMeta?: {
    devReprova:       TrustEntry;
    alertComport:     TrustEntry;
    qaRejectionsWeek: TrustEntry;
  };
}

type SortKey = "reprovacoes" | "entregas" | "taxaReprovaPct" | "diasComReprova";

const COLORS = ["#242873", "#DC3545", "#E8A020", "#78BFA5", "#8A8FAF", "#7C3AED", "#F2DFBB"];

function exportCsv(members: Member[]) {
  const header = ["Nome", "Reprovas", "Entregas", "Taxa Reprova (%)", "Dias com Reprova"];
  const rows = members.map((m) => [
    m.userName, m.reprovacoes, m.entregas,
    m.taxaReprovaPct !== null ? m.taxaReprovaPct : "",
    m.diasComReprova,
  ]);
  const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reprova_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TrustDot({ status, incidentId }: { status: TrustEntry["status"]; incidentId?: string | null }) {
  const colorMap = { high: "#16a34a", medium: "#eab308", review: "#dc2626", no_data: "#9ca3af" };
  const titleMap = {
    high:    "Dado auditado e validado (alta confiança)",
    medium:  "Dado de fonte única (não auditado)",
    review:  "Divergência detectada — sob revisão",
    no_data: "Sem dados de auditoria",
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "help" }} title={titleMap[status]}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: colorMap[status] ?? "#9ca3af", display: "inline-block",
        boxShadow: status === "review" ? "0 0 6px #dc2626" : "none",
      }} />
      {incidentId && (
        <span style={{ fontSize: 8, fontWeight: 800, background: "#dc2626", color: "#fff", padding: "1px 4px", borderRadius: 4 }}>
          INCIDENTE
        </span>
      )}
    </span>
  );
}

function DataLineageModal({ lineage, onClose }: { lineage: DataLineage; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)", borderRadius: 14, width: "100%", maxWidth: 600,
          boxShadow: "0 8px 40px rgba(36,40,115,0.18)", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Info size={16} color="var(--navy)" />
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--navy)" }}>
              Como os dados são calculados
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: <Database size={13} />, label: "Fonte", value: lineage.source },
              { icon: <Database size={13} />, label: "Host", value: lineage.host },
              { icon: <FileText size={13} />, label: "Banco", value: lineage.database },
              { icon: <FileText size={13} />, label: "Tabela principal", value: lineage.table },
              { icon: <Filter size={13} />, label: "Filtros aplicados", value: lineage.filter },
              { icon: <Clock size={13} />, label: "Fuso horário", value: lineage.timezone },
              { icon: <Clock size={13} />, label: "Cache", value: lineage.cache },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "var(--muted)", marginTop: 1, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0, minWidth: 140, fontWeight: 600 }}>
                  {label}
                </span>
                <span style={{ fontSize: 12, color: "var(--navy)" }}>{value}</span>
              </div>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
              Query utilizada (simplificada)
            </p>
            <pre style={{
              background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
              padding: "12px 14px", fontSize: 11, color: "var(--navy)",
              overflowX: "auto", lineHeight: 1.6, margin: 0,
              fontFamily: "ui-monospace, 'Cascadia Code', monospace",
            }}>
              {lineage.query}
            </pre>
          </div>

          <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
            Acesso read-only — nenhuma alteração é feita no banco CardsFlow.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReprovaPage() {
  const {
    selectedTeam, teams, selectTeam, selectedId,
    startDate, endDate, setStartDate, setEndDate, setToday,
    loading: teamLoading,
  } = useFilters();

  const [data, setData]       = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("reprovacoes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedDevs, setExpandedDevs] = useState<Set<string>>(new Set());
  const [showLineage, setShowLineage]   = useState(false);

  const fetchData = useCallback(() => {
    if (!selectedTeam) return;
    setLoading(true);
    const params = new URLSearchParams({ teamConfigId: selectedTeam.id, startDate, endDate });
    fetch(`/api/reprova?${params}`)
      .then((r) => r.json())
      .then((res) => setData(res as ApiResponse))
      .finally(() => setLoading(false));
  }, [selectedTeam, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fecha expansão ao mudar filtros
  useEffect(() => { setExpandedDevs(new Set()); }, [selectedTeam, startDate, endDate]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const toggleDev = (userId: string) => {
    setExpandedDevs((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const sorted = [...(data?.members ?? [])].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const dailyBreakdown = data?.dailyBreakdown ?? [];
  const monthlyTrend   = data?.monthlyTrend   ?? [];
  const meta = data?.reprovaMeta;

  // Agrupar eventos por userId para as linhas expandíveis
  const eventsByDev = new Map<string, ReprovaEvent[]>();
  for (const ev of data?.events ?? []) {
    if (!eventsByDev.has(ev.userId)) eventsByDev.set(ev.userId, []);
    eventsByDev.get(ev.userId)!.push(ev);
  }

  const dailyDevs = dailyBreakdown.length > 0
    ? Object.keys(dailyBreakdown[0]).filter((k) => k !== "date")
    : (data?.members ?? []).map((m) => m.userName);
  const monthlyDevs = monthlyTrend.length > 0
    ? Object.keys(monthlyTrend[0]).filter((k) => k !== "month")
    : (data?.members ?? []).map((m) => m.userName);

  if (teamLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "var(--muted)" }}>
      Carregando...
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {showLineage && data?.dataLineage && (
        <DataLineageModal lineage={data.dataLineage} onClose={() => setShowLineage(false)} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <FilterBar
          teams={teams}
          selectedId={selectedId}
          onTeamChange={selectTeam}
          startDate={startDate}
          endDate={endDate}
          onStartDate={setStartDate}
          onEndDate={setEndDate}
          onToday={setToday}
          onRefresh={fetchData}
          loading={loading}
        />
        <button
          onClick={() => data && exportCsv(data.members)}
          style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12,
            padding: "6px 14px", background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 8,
            color: "var(--navy)", fontWeight: 600, cursor: "pointer",
          }}
        >
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      {data?.teamKpi && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <KpiCard
              label="Total Reprovas"
              value={data.teamKpi.totalReprovacoes}
              icon={<AlertTriangle size={16} color="#DC3545" />}
              accent="danger"
            />
            {!loading && meta?.devReprova && (
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <TrustDot status={meta.devReprova.status} incidentId={meta.devReprova.incidentId} />
              </div>
            )}
          </div>

          <KpiCard
            label="Total Entregas"
            value={data.teamKpi.totalEntregas}
            icon={<CheckCircle size={16} color="#16a34a" />}
            accent="navy"
          />

          <div style={{ position: "relative" }}>
            <KpiCard
              label="Taxa Média Reprova"
              value={data.teamKpi.taxaMedia !== null ? `${data.teamKpi.taxaMedia}%` : "—"}
              icon={<TrendingDown size={16} color="#DC3545" />}
              accent="danger"
              delta={data.teamKpi.taxaMedia !== null && data.teamKpi.taxaMedia > 15 ? "atenção" : "ok"}
              deltaType={data.teamKpi.taxaMedia !== null && data.teamKpi.taxaMedia > 15 ? "down" : "up"}
            />
            {!loading && meta?.qaRejectionsWeek && (
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <TrustDot status={meta.qaRejectionsWeek.status} incidentId={meta.qaRejectionsWeek.incidentId} />
              </div>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <KpiCard
              label="Devs com Reprova"
              value={data.teamKpi.devsComReprova}
              icon={<Users size={16} color="#DC3545" />}
              accent="danger"
            />
            {!loading && meta?.alertComport && (
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <TrustDot status={meta.alertComport.status} incidentId={meta.alertComport.incidentId} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabela por dev — com linhas expandíveis */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(36,40,115,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", margin: 0 }}>Por Desenvolvedor</p>
            {!loading && meta?.devReprova && (
              <TrustDot status={meta.devReprova.status} incidentId={meta.devReprova.incidentId} />
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
              Clique em uma linha para ver os eventos
            </p>
            <button
              onClick={() => setShowLineage(true)}
              title="Como os dados são calculados"
              style={{
                display: "flex", alignItems: "center", gap: 4, background: "none",
                border: "1px solid var(--border)", borderRadius: 6,
                padding: "4px 8px", cursor: "pointer", color: "var(--muted)",
                fontSize: 11, fontWeight: 600, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--navy)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--navy)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
            >
              <Info size={12} /> Como é calculado
            </button>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg)" }}>
              <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", width: 32 }} />
              <th style={{ padding: "10px 8px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Desenvolvedor
              </th>
              {(["reprovacoes", "entregas", "taxaReprovaPct", "diasComReprova"] as SortKey[]).map((k) => (
                <th
                  key={k}
                  onClick={() => handleSort(k)}
                  style={{
                    padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 700,
                    color: sortKey === k ? "var(--navy)" : "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer",
                  }}
                >
                  {{ reprovacoes: "Reprovas", entregas: "Entregas", taxaReprovaPct: "Taxa %", diasComReprova: "Dias" }[k]}
                  {sortKey === k && (sortDir === "desc" ? " ↓" : " ↑")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Carregando...</td></tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Sem reprovas no período.</td></tr>
            )}
            {sorted.map((m) => {
              const isExpanded = expandedDevs.has(m.userId);
              const devEvents  = eventsByDev.get(m.userId) ?? [];
              return (
                <>
                  <tr
                    key={m.userId}
                    onClick={() => toggleDev(m.userId)}
                    style={{
                      borderTop: "1px solid var(--border)", cursor: "pointer",
                      background: isExpanded ? "var(--bg)" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg)"; }}
                    onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "10px 20px", width: 32 }}>
                      <ChevronRight
                        size={14}
                        color="var(--muted)"
                        style={{
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                          display: "block",
                        }}
                      />
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--navy)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {m.userName.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 600, color: "var(--navy)" }}>{m.userName}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "var(--danger)" }}>
                      {m.reprovacoes}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--muted)" }}>
                      {m.entregas}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      {m.taxaReprovaPct !== null ? (
                        <span style={{
                          fontWeight: 700,
                          color: m.taxaReprovaPct > 20 ? "var(--danger)" : m.taxaReprovaPct > 10 ? "#E8A020" : "#16a34a",
                        }}>
                          {m.taxaReprovaPct}%
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--muted)" }}>
                      {m.diasComReprova}
                    </td>
                  </tr>

                  {/* Linha expandida — eventos do dev */}
                  {isExpanded && (
                    <tr key={`${m.userId}-events`} style={{ background: "#F8F9FF" }}>
                      <td colSpan={6} style={{ padding: "0 0 0 52px", borderTop: "none" }}>
                        <div style={{ padding: "12px 20px 12px 0" }}>
                          {devEvents.length === 0 ? (
                            <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>Sem detalhes disponíveis.</p>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                              <thead>
                                <tr>
                                  <th style={{ padding: "6px 12px 6px 0", textAlign: "left", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: 10 }}>Evento</th>
                                  <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: 10 }}>Título</th>
                                  <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: 10 }}>Data/Hora</th>
                                  <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", fontSize: 10 }}>De → Para</th>
                                </tr>
                              </thead>
                              <tbody>
                                {devEvents.map((ev) => {
                                  const dt = new Date(ev.reproducedAt);
                                  const dateStr = dt.toLocaleDateString("pt-BR");
                                  const timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                                  return (
                                    <tr key={`${ev.eventId}-${ev.reproducedAt}`} style={{ borderTop: "1px solid #E8EAF6" }}>
                                      <td style={{ padding: "7px 12px 7px 0", fontFamily: "ui-monospace,monospace", fontSize: 10, color: "var(--muted)" }}>
                                        #{ev.eventId.slice(0, 8)}
                                      </td>
                                      <td style={{ padding: "7px 12px", fontWeight: 600, color: "var(--navy)", maxWidth: 260 }}>
                                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ev.eventTitle}>
                                          {ev.eventTitle}
                                        </span>
                                      </td>
                                      <td style={{ padding: "7px 12px", color: "var(--secondary)", whiteSpace: "nowrap" }}>
                                        {dateStr} {timeStr}
                                      </td>
                                      <td style={{ padding: "7px 12px" }}>
                                        <span style={{ fontSize: 10, color: "var(--muted)" }}>
                                          {ev.fromStage ?? "—"}
                                        </span>
                                        {" → "}
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--danger)" }}>
                                          {ev.toStage}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "8px 20px", borderTop: "1px solid var(--border)", background: "var(--bg)", fontSize: 10, color: "var(--muted)", display: "flex", gap: 20 }}>
          <span><strong>Taxa %</strong> = reprovas ÷ entregas no período</span>
          <span><strong style={{ color: "#DC3545" }}>&gt;20%</strong> atenção · <strong style={{ color: "#E8A020" }}>10–20%</strong> cuidado · <strong style={{ color: "#16a34a" }}>&lt;10%</strong> ok</span>
        </div>
      </div>

      {/* Gráfico diário — BarChart */}
      {dailyBreakdown.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(36,40,115,0.05)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Reprovas por Dia</p>
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>Contagem exata de movimentações para o estágio de reprova no período selecionado</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyBreakdown} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE8DE" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#C8C4B8" }} tickFormatter={(v) => String(v).slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#C8C4B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip labelFormatter={(l) => `Data: ${l}`} contentStyle={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {dailyDevs.map((name, i) => (
                <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tendência mensal — últimos 6 meses */}
      {monthlyTrend.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(36,40,115,0.05)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Tendência Mensal — últimos 6 meses</p>
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>Reprovas por dev em cada mês (janela fixa, independente do filtro de período)</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE8DE" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#C8C4B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#C8C4B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip labelFormatter={(l) => `Mês: ${l}`} contentStyle={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {monthlyDevs.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Breakdown diário — tabela */}
      {dailyBreakdown.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(36,40,115,0.05)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", margin: 0 }}>Reprovas por Dia — Detalhe</p>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Reprovas registradas em cada dia do período por desenvolvedor</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg)" }}>
                  <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Data</th>
                  {dailyDevs.map((name) => (
                    <th key={name} style={{ padding: "10px 16px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                      {name.split(" ")[0]}
                    </th>
                  ))}
                  <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {dailyBreakdown.map((row) => {
                  const dayTotal = dailyDevs.reduce((s, n) => s + (Number(row[n]) || 0), 0);
                  return (
                    <tr key={String(row.date)} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 20px", fontWeight: 600, color: "var(--secondary)", whiteSpace: "nowrap" }}>
                        {String(row.date).slice(5).replace("-", "/")}
                      </td>
                      {dailyDevs.map((name) => {
                        const val = Number(row[name]) || 0;
                        return (
                          <td key={name} style={{ padding: "9px 16px", textAlign: "center", fontWeight: val > 0 ? 700 : 400, color: val > 0 ? "var(--danger)" : "var(--muted)" }}>
                            {val > 0 ? val : "—"}
                          </td>
                        );
                      })}
                      <td style={{ padding: "9px 16px", textAlign: "center", fontWeight: dayTotal > 0 ? 700 : 400, color: dayTotal > 0 ? "var(--navy)" : "var(--muted)" }}>
                        {dayTotal > 0 ? dayTotal : "—"}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "2px solid var(--border)", background: "var(--bg)" }}>
                  <td style={{ padding: "10px 20px", fontWeight: 700, color: "var(--navy)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Total período</td>
                  {dailyDevs.map((name) => {
                    const colTotal = dailyBreakdown.reduce((s, row) => s + (Number(row[name]) || 0), 0);
                    return (
                      <td key={name} style={{ padding: "10px 16px", textAlign: "center", fontWeight: 700, color: colTotal > 0 ? "var(--danger)" : "var(--muted)" }}>
                        {colTotal > 0 ? colTotal : "—"}
                      </td>
                    );
                  })}
                  <td style={{ padding: "10px 16px", textAlign: "center", fontWeight: 700, color: "var(--navy)" }}>
                    {dailyBreakdown.reduce((s, row) => s + dailyDevs.reduce((rs, n) => rs + (Number(row[n]) || 0), 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
