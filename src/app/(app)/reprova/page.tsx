"use client";
import { useEffect, useState, useCallback } from "react";
import { useSelectedTeam } from "@/hooks/useTeam";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AlertTriangle, Download, Users, CheckCircle } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Member {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  qaSubmissions: number;
  qaApprovals: number;
  qaRejections: number;
  qaHitRate: number | null;
  qaStatus: string | null;
  recordedAt: string;
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

interface ApiResponse {
  members: Member[];
  teamKpi: TeamKpi;
  history: Member[];
  chartData: ChartPoint[];
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

export default function ReprovaPage() {
  const { selectedTeam, loading: teamLoading } = useSelectedTeam();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("qaRejections");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const fetchData = useCallback(() => {
    if (!selectedTeam) return;
    setLoading(true);
    fetch(`/api/reprova?teamConfigId=${selectedTeam.id}`)
      .then((r) => r.json())
      .then((res) => setData(res as ApiResponse))
      .finally(() => setLoading(false));
  }, [selectedTeam]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sorted = [...(data?.members ?? [])].filter(
    (m) => !onlyAlerts || m.qaStatus === "Alerta Comport."
  ).sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(String(bv)) : String(bv).localeCompare(av);
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const chartData = data?.chartData ?? [];
  const historyUsers = chartData.length > 0
    ? Object.keys(chartData[0]).filter((k) => k !== "date")
    : [...new Set((data?.history ?? []).map((h) => h.userName))];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  if (teamLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "var(--muted)" }}>
      Carregando...
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div />
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
          <KpiCard label="Total Submissões" value={data.teamKpi.totalSubmissions}
            icon={<Users size={16} color="#242873" />} accent="navy" />
          <KpiCard label="Total Reprovas" value={data.teamKpi.totalRejections}
            icon={<AlertTriangle size={16} color="#DC3545" />} accent="danger" />
          <KpiCard
            label="Taxa de Aprovação"
            value={data.teamKpi.teamHitRate !== null ? `${data.teamKpi.teamHitRate}%` : "—"}
            icon={<CheckCircle size={16} color="#78BFA5" />} accent="sage"
          />
          <KpiCard label="Alertas Ativos" value={data.teamKpi.alertCount}
            icon={<AlertTriangle size={16} color="#DC3545" />} accent="danger"
            delta={data.teamKpi.alertCount > 0 ? "atenção" : "ok"}
            deltaType={data.teamKpi.alertCount > 0 ? "down" : "up"} />
        </div>
      )}

      {/* Tabela */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(36,40,115,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>Por Desenvolvedor</p>
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
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Evolução de Reprovas por Desenvolvedor</p>
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
    </div>
  );
}
