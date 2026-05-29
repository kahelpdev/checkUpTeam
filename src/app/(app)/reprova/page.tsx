"use client";
import { useEffect, useState, useCallback } from "react";
import { useFilters } from "@/hooks/useFilters";
import { FilterBar } from "@/components/ui/FilterBar";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AlertTriangle, Download, Users, TrendingDown, CheckCircle } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";

interface Member {
  userId: string;
  userName: string;
  reprovacoes: number;
  entregas: number;
  taxaReprovaPct: number | null;
  diasComReprova: number;
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

interface ReprovaMeta {
  devReprova:       TrustEntry;
  alertComport:     TrustEntry;
  qaRejectionsWeek: TrustEntry;
}

interface ApiResponse {
  members: Member[];
  teamKpi: TeamKpi;
  dailyBreakdown: ChartPoint[];
  monthlyTrend: MonthPoint[];
  dataSource: "db";
  reprovaMeta?: ReprovaMeta;
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

export default function ReprovaPage() {
  const {
    selectedTeam, teams, selectTeam, selectedId,
    startDate, endDate, setStartDate, setEndDate, setToday,
    loading: teamLoading,
  } = useFilters();

  const [data, setData]     = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("reprovacoes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = [...(data?.members ?? [])].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const dailyBreakdown = data?.dailyBreakdown ?? [];
  const monthlyTrend   = data?.monthlyTrend   ?? [];
  const meta = data?.reprovaMeta;

  // Nomes de devs presentes nos dados diários/mensais (para gráficos)
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

      {/* Tabela por dev */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(36,40,115,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", margin: 0 }}>Por Desenvolvedor</p>
            {!loading && meta?.devReprova && (
              <TrustDot status={meta.devReprova.status} incidentId={meta.devReprova.incidentId} />
            )}
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
            Fonte: banco CardsFlow — stage DevRep — somente leitura
          </p>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg)" }}>
              <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Carregando...</td></tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Sem reprovas no período.</td></tr>
            )}
            {sorted.map((m) => (
              <tr key={m.userId} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--navy)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {m.userName.charAt(0)}
                    </div>
                    <span style={{ fontWeight: 600, color: "var(--navy)" }}>{m.userName}</span>
                  </div>
                </td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: m.reprovacoes > 0 ? "var(--danger)" : "var(--muted)" }}>
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
            ))}
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
