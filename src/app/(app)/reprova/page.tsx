"use client";
import { useEffect, useState, useCallback } from "react";
import { useFilters } from "@/hooks/useFilters";
import { FilterBar } from "@/components/ui/FilterBar";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AlertTriangle, Download, Users, CheckCircle, Clock } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Member {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  qaSubmissions: number;
  qaApprovals: number;
  qaRejections: number;
  qaHitRate: number | null;
  qaStatus: string | null;
}

interface TeamKpi {
  totalSubmissions: number;
  totalRejections: number;
  teamHitRate: number | null;
  alertCount: number;
}

interface ChartPoint {
  date: string;
  [userName: string]: string | number;
}

interface TrustEntry {
  status: "high" | "medium" | "review" | "no_data";
  incidentId: string | null;
}

interface ReprovaMeta {
  devReprova:       TrustEntry;
  alertComport:     TrustEntry;
  qaRejectionsWeek: TrustEntry;
}

interface ApiResponse {
  members: Member[];
  teamKpi: TeamKpi;
  chartData: ChartPoint[];
  dailyBreakdown: ChartPoint[];
  dataSource: "live" | "cache" | "snapshots";
  cachedAt?: string;
  reprovaMeta?: ReprovaMeta;
}

type SortKey = "qaRejections" | "qaSubmissions" | "qaHitRate" | "qaStatus";

const COLORS = ["#242873", "#78BFA5", "#E8A020", "#DC3545", "#8A8FAF", "#F2DFBB"];

function exportCsv(members: Member[]) {
  const header = ["Nome", "Submissões", "Aprovações", "Reprovas", "Taxa Aprovação (%)", "Status"];
  const rows = members.map((m) => [
    m.userName, m.qaSubmissions, m.qaApprovals, m.qaRejections, m.qaHitRate ?? "", m.qaStatus ?? "",
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

export default function ReprovaPage() {
  const { selectedTeam, teams, selectTeam, selectedId, startDate, endDate, setStartDate, setEndDate, setToday, loading: teamLoading } = useFilters();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("qaRejections");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [onlyAlerts, setOnlyAlerts] = useState(false);

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

  const sorted = [...(data?.members ?? [])].filter(
    (m) => !onlyAlerts || m.qaStatus === "Alerta Comport."
  ).sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(String(bv)) : String(bv).localeCompare(av);
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const chartData      = data?.chartData      ?? [];
  const dailyBreakdown = data?.dailyBreakdown ?? [];
  const historyUsers   = chartData.length > 0
    ? Object.keys(chartData[0]).filter((k) => k !== "date")
    : (data?.members ?? []).map((m) => m.userName);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const meta = data?.reprovaMeta;

  if (teamLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "var(--muted)" }}>
      Carregando...
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header row */}
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

      {/* Aviso de cache */}
      {data?.dataSource === "cache" && (
        <div style={{
          background: "#FFFBEB", border: "1px solid #FDE68A",
          borderRadius: 10, padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 12, color: "#92400E",
        }}>
          <Clock size={13} />
          <span>
            <strong>Dados do cache</strong> — API CardsFlow indisponível.
            {data.cachedAt && ` Última captura: ${new Date(data.cachedAt).toLocaleString("pt-BR")}.`}
            {" "}Os números podem não refletir o período exato selecionado.
          </span>
        </div>
      )}

      {data?.dataSource === "snapshots" && (
        <div style={{
          background: "#EFF6FF", border: "1px solid #BFDBFE",
          borderRadius: 10, padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 12, color: "#1E40AF",
        }}>
          <Clock size={13} />
          <span>
            <strong>Dados do histórico local</strong> — Calculados com base em capturas periódicas do CardsFlow.
            {data.cachedAt && ` Última captura do período: ${new Date(data.cachedAt).toLocaleString("pt-BR")}.`}
          </span>
        </div>
      )}

      {/* KPIs */}
      {data?.teamKpi && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <KpiCard label="Total Submissões" value={data.teamKpi.totalSubmissions}
              icon={<Users size={16} color="#242873" />} accent="navy" />
            {!loading && meta?.devReprova && (
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <ReliabilityIndicator status={meta.devReprova.status} incidentId={meta.devReprova.incidentId} />
              </div>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <KpiCard label="Total Reprovas" value={data.teamKpi.totalRejections}
              icon={<AlertTriangle size={16} color="#DC3545" />} accent="danger" />
            {!loading && meta?.qaRejectionsWeek && (
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <ReliabilityIndicator status={meta.qaRejectionsWeek.status} incidentId={meta.qaRejectionsWeek.incidentId} />
              </div>
            )}
          </div>

          <KpiCard
            label="Taxa de Aprovação"
            value={data.teamKpi.teamHitRate !== null ? `${data.teamKpi.teamHitRate}%` : "—"}
            icon={<CheckCircle size={16} color="#78BFA5" />} accent="sage"
          />

          <div style={{ position: "relative" }}>
            <KpiCard label="Alertas Ativos" value={data.teamKpi.alertCount}
              icon={<AlertTriangle size={16} color="#DC3545" />} accent="danger"
              delta={data.teamKpi.alertCount > 0 ? "atenção" : "ok"}
              deltaType={data.teamKpi.alertCount > 0 ? "down" : "up"} />
            {!loading && meta?.alertComport && (
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <ReliabilityIndicator status={meta.alertComport.status} incidentId={meta.alertComport.incidentId} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(36,40,115,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", margin: 0 }}>Por Desenvolvedor</p>
            {!loading && meta?.devReprova && (
              <ReliabilityIndicator status={meta.devReprova.status} incidentId={meta.devReprova.incidentId} />
            )}
          </div>
          <button
            onClick={() => setOnlyAlerts((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12, fontWeight: 600,
              color: onlyAlerts ? "var(--danger)" : "var(--muted)",
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            <div style={{
              width: 32, height: 18, borderRadius: 9,
              background: onlyAlerts ? "var(--danger)" : "var(--border)",
              position: "relative", transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute", top: 2, left: onlyAlerts ? 14 : 2,
                width: 14, height: 14, borderRadius: "50%",
                background: "#fff", transition: "left 0.2s",
              }} />
            </div>
            Apenas alertas
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg)" }}>
              <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Desenvolvedor</th>
              {(["qaRejections", "qaSubmissions", "qaHitRate", "qaStatus"] as SortKey[]).map((k) => (
                <th
                  key={k}
                  onClick={() => handleSort(k)}
                  style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: sortKey === k ? "var(--navy)" : "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer" }}
                >
                  {{ qaRejections: "Reprovas", qaSubmissions: "Submissões", qaHitRate: "Aprovação %", qaStatus: "Status" }[k]}
                  {sortKey === k && (sortDir === "desc" ? " ↓" : " ↑")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>Carregando...</td></tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={5} style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>Sem dados no período.</td></tr>
            )}
            {sorted.map((m) => (
              <tr key={m.userId} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {m.avatarUrl
                      ? <img src={m.avatarUrl} alt={m.userName} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                      : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--navy)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{m.userName.charAt(0)}</div>
                    }
                    <span style={{ fontWeight: 600, color: "var(--navy)" }}>{m.userName}</span>
                  </div>
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "var(--danger)" }}>{m.qaRejections}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--muted)" }}>{m.qaSubmissions}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--muted)" }}>{m.qaHitRate !== null ? `${m.qaHitRate}%` : "—"}</td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                  <StatusBadge status={m.qaStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gráfico histórico */}
      {chartData.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(36,40,115,0.05)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Evolução de Reprovas por Desenvolvedor</p>
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>Acumulado no período (90 dias de janela)</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE8DE" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#C8C4B8" }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#C8C4B8" }} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(l) => `Data: ${l}`} contentStyle={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {historyUsers.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Breakdown por dia */}
      {dailyBreakdown.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(36,40,115,0.05)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", margin: 0 }}>Reprovas por Dia</p>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Reprovas novas registradas em cada dia do período</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg)" }}>
                  <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                    Data
                  </th>
                  {historyUsers.map((name) => (
                    <th key={name} style={{ padding: "10px 16px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                      {name.split(" ")[0]}
                    </th>
                  ))}
                  <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyBreakdown.map((row) => {
                  const dayTotal = historyUsers.reduce((s, n) => s + (Number(row[n]) || 0), 0);
                  return (
                    <tr key={String(row.date)} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 20px", fontWeight: 600, color: "var(--secondary)", whiteSpace: "nowrap" }}>
                        {String(row.date).slice(5).replace("-", "/")}
                      </td>
                      {historyUsers.map((name) => {
                        const val = Number(row[name]) || 0;
                        return (
                          <td key={name} style={{
                            padding: "9px 16px", textAlign: "center",
                            fontWeight: val > 0 ? 700 : 400,
                            color: val > 0 ? "var(--danger)" : "var(--muted)",
                          }}>
                            {val > 0 ? val : "—"}
                          </td>
                        );
                      })}
                      <td style={{
                        padding: "9px 16px", textAlign: "center",
                        fontWeight: dayTotal > 0 ? 700 : 400,
                        color: dayTotal > 0 ? "var(--navy)" : "var(--muted)",
                      }}>
                        {dayTotal > 0 ? dayTotal : "—"}
                      </td>
                    </tr>
                  );
                })}
                {/* Linha de totais */}
                <tr style={{ borderTop: "2px solid var(--border)", background: "var(--bg)" }}>
                  <td style={{ padding: "10px 20px", fontWeight: 700, color: "var(--navy)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Total período
                  </td>
                  {historyUsers.map((name) => {
                    const colTotal = dailyBreakdown.reduce((s, row) => s + (Number(row[name]) || 0), 0);
                    return (
                      <td key={name} style={{ padding: "10px 16px", textAlign: "center", fontWeight: 700, color: colTotal > 0 ? "var(--danger)" : "var(--muted)" }}>
                        {colTotal > 0 ? colTotal : "—"}
                      </td>
                    );
                  })}
                  <td style={{ padding: "10px 16px", textAlign: "center", fontWeight: 700, color: "var(--navy)" }}>
                    {dailyBreakdown.reduce((s, row) => s + historyUsers.reduce((rs, n) => rs + (Number(row[n]) || 0), 0), 0)}
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
