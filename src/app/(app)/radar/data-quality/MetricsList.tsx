"use client";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle, XCircle, Circle, Plus, X } from "lucide-react";
import { MetricDetail } from "./MetricDetail";
import { AddMetricModal } from "./AddMetricModal";

type Status = "high" | "medium" | "review" | "no_data";

interface Def {
  key: string;
  name: string;
  category: string | null;
  confidence: string;
  sourceB: string | null;
}

interface MetricRow {
  key: string;
  name: string;
  category: string | null;
  confidence: string;
  sourceB: string | null;
  lastResult: {
    value: number | null;
    status: Status;
    deltaPct: number | null;
    asOf: string;
  } | null;
  openIncident: boolean;
}

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 4px rgba(36,40,115,0.05)",
};

function StatusIcon({ status }: { status: Status }) {
  if (status === "high") return <CheckCircle size={16} color="#16a34a" />;
  if (status === "medium") return <AlertCircle size={16} color="#eab308" />;
  if (status === "review") return <XCircle size={16} color="#dc2626" />;
  return <Circle size={16} color="#9ca3af" />;
}

function StatusLabel({ status }: { status: Status }) {
  const map = { high: "Validado", medium: "Fonte única", review: "Em revisão", no_data: "Sem dado" };
  return <span style={{ fontSize: 11, color: "var(--secondary)" }}>{map[status]}</span>;
}

function fmtRelative(iso: string): string {
  const dt = new Date(iso);
  const diffMin = Math.round((Date.now() - dt.getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffMin < 1440) return `há ${Math.round(diffMin / 60)}h`;
  return dt.toLocaleDateString("pt-BR");
}

export function MetricsList() {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filters, setFilters] = useState({ status: "all", category: "all", confidence: "all", q: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const defsRes = await fetch("/api/radar/metric-definitions");
      if (!defsRes.ok) throw new Error("Falha ao carregar definições");
      const defs = (await defsRes.json()).items as Def[];

      const out: MetricRow[] = [];
      for (const d of defs) {
        const histRes = await fetch(`/api/radar/metrics/${d.key}/history`);
        const hist = histRes.ok ? (await histRes.json()).history as Array<{ value: number | null; status: Status; deltaPct: number | null; calculatedAt: string }> : [];
        const lastResult = hist.length > 0 ? hist[hist.length - 1] : null;
        out.push({
          key: d.key,
          name: d.name,
          category: d.category,
          confidence: d.confidence,
          sourceB: d.sourceB,
          lastResult: lastResult ? { value: lastResult.value, status: lastResult.status, deltaPct: lastResult.deltaPct, asOf: lastResult.calculatedAt } : null,
          openIncident: false,
        });
      }

      // marca incidentes abertos
      const incRes = await fetch("/api/radar/incidents?status=open");
      if (incRes.ok) {
        const incs = (await incRes.json()).incidents as Array<{ metricKey: string }>;
        const openKeys = new Set(incs.map((i) => i.metricKey));
        for (const r of out) r.openIncident = openKeys.has(r.key);
      }

      setRows(out);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const runValidations = async () => {
    setRunning(true);
    const res = await fetch("/api/radar/jobs/run/runMetricValidations", { method: "POST" });
    setRunning(false);
    if (!res.ok) {
      setError("Falha ao rodar batimentos");
      return;
    }
    void load();
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filters.status !== "all") {
        const st = r.lastResult?.status ?? "no_data";
        if (st !== filters.status) return false;
      }
      if (filters.category !== "all" && r.category !== filters.category) return false;
      if (filters.confidence !== "all" && r.confidence !== filters.confidence) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        if (!r.key.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const counts = useMemo(() => ({
    high: filtered.filter((r) => r.lastResult?.status === "high").length,
    medium: filtered.filter((r) => r.lastResult?.status === "medium").length,
    review: filtered.filter((r) => r.lastResult?.status === "review").length,
    no_data: filtered.filter((r) => !r.lastResult || r.lastResult.status === "no_data").length,
  }), [filtered]);

  const hasFilters = filters.status !== "all" || filters.category !== "all" || filters.confidence !== "all" || filters.q !== "";

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Card summary — 2 linhas conforme Beatriz sugeriu */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 13, color: "var(--secondary)" }}>
              📊 {filtered.length} métricas │ ✅ {counts.high} │ 🟡 {counts.medium} │ 🔴 {counts.review} │ ⚫ {counts.no_data}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAdd(true)} style={btnSecondary}>
                <Plus size={14} /> Nova métrica
              </button>
              <button onClick={runValidations} disabled={running} style={{ ...btnSecondary, cursor: running ? "wait" : "pointer" }}>
                <RefreshCw size={14} className={running ? "spin" : ""} />
                {running ? "Rodando..." : "Rodar batimentos"}
              </button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ ...card, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={lbl}>Status
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={sel}>
              <option value="all">Todos</option>
              <option value="high">Validado (✅)</option>
              <option value="medium">Fonte única (🟡)</option>
              <option value="review">Em revisão (🔴)</option>
              <option value="no_data">Sem dado (⚫)</option>
            </select>
          </label>
          <label style={lbl}>Categoria
            <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} style={sel}>
              <option value="all">Todas</option>
              <option value="kpi">kpi</option><option value="tempo">tempo</option><option value="qa">qa</option>
              <option value="carga">carga</option><option value="meta">meta</option><option value="custo">custo</option>
            </select>
          </label>
          <label style={lbl}>Confidence
            <select value={filters.confidence} onChange={(e) => setFilters((f) => ({ ...f, confidence: e.target.value }))} style={sel}>
              <option value="all">Todas</option>
              <option value="draft">Draft</option>
              <option value="released">Released</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </label>
          <input
            placeholder="Buscar por key ou nome…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            style={{ flex: 1, minWidth: 200, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}
          />
          {hasFilters && (
            <button onClick={() => setFilters({ status: "all", category: "all", confidence: "all", q: "" })} style={btnIcon} title="Limpar filtros">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tabela */}
        <div style={card}>
          {loading ? (
            <div style={{ padding: 24, color: "var(--secondary)" }}>Carregando métricas…</div>
          ) : error ? (
            <div style={{ padding: 24, color: "#dc2626" }}>
              {error}
              <button onClick={() => void load()} style={{ marginLeft: 12, ...btnSecondary }}>Tentar novamente</button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--secondary)" }}>
              {hasFilters ? (
                <>Nenhum resultado para os filtros. <button onClick={() => setFilters({ status: "all", category: "all", confidence: "all", q: "" })} style={btnLink}>Limpar filtros</button></>
              ) : (
                <>Nenhuma métrica configurada. <button onClick={() => setShowAdd(true)} style={btnLink}>+ Nova métrica</button></>
              )}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 8px", width: 40 }}></th>
                  <th style={{ padding: "10px 8px" }}>Métrica</th>
                  <th style={{ padding: "10px 8px", width: 100 }}>Categoria</th>
                  <th style={{ padding: "10px 8px", textAlign: "right", width: 100 }}>Valor</th>
                  <th style={{ padding: "10px 8px", textAlign: "right", width: 80 }}>Delta</th>
                  <th style={{ padding: "10px 8px", width: 130 }}>Atualizado</th>
                  <th style={{ padding: "10px 8px", width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isSelected = selected === r.key;
                  return (
                    <tr
                      key={r.key}
                      onClick={() => setSelected(r.key)}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                        background: isSelected ? "var(--primary-dim)" : "transparent",
                        borderLeft: `3px solid ${isSelected ? "var(--primary)" : "transparent"}`,
                      }}
                    >
                      <td style={{ padding: "10px 8px", textAlign: "center", position: "relative" }}>
                        <StatusIcon status={r.lastResult?.status ?? "no_data"} />
                        {r.openIncident && (
                          <span
                            className="pulse"
                            style={{ position: "absolute", top: 6, right: 4, width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }}
                            title="Incidente aberto"
                          />
                        )}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          {r.name}
                          {r.confidence === "draft" && <span style={betaBadge}>BETA</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--secondary)", fontFamily: "monospace" }}>{r.key}</div>
                      </td>
                      <td style={{ padding: "10px 8px", color: "var(--secondary)" }}>{r.category ?? "—"}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {r.lastResult?.value !== null && r.lastResult?.value !== undefined ? r.lastResult.value.toLocaleString("pt-BR") : "—"}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {r.lastResult?.deltaPct != null ? `${r.lastResult.deltaPct.toFixed(2)}%` : "—"}
                      </td>
                      <td style={{ padding: "10px 8px", color: "var(--secondary)", fontSize: 12 }}>
                        {r.lastResult?.asOf ? fmtRelative(r.lastResult.asOf) : "—"}
                        <div><StatusLabel status={r.lastResult?.status ?? "no_data"} /></div>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <button onClick={(e) => { e.stopPropagation(); setSelected(r.key); }} style={btnSmall}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <div style={{ width: 460, flexShrink: 0 }}>
          <MetricDetail metricKey={selected} onClose={() => setSelected(null)} onUpdated={() => void load()} />
        </div>
      )}

      {showAdd && <AddMetricModal onClose={() => setShowAdd(false)} onCreated={() => void load()} />}

      <style jsx global>{`
        .spin { animation: spin 1s linear infinite; }
        .pulse { animation: pulse 1.5s ease-in-out infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  cursor: "pointer",
  fontSize: 13,
};

const btnSmall: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  cursor: "pointer",
};

const btnIcon: React.CSSProperties = {
  padding: 6,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  cursor: "pointer",
};

const btnLink: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#1d4ed8",
  textDecoration: "underline",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
};

const lbl: React.CSSProperties = {
  fontSize: 12,
  color: "var(--secondary)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const sel: React.CSSProperties = {
  padding: "4px 6px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  background: "var(--surface)",
};

const betaBadge: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  background: "#9ca3af",
  color: "#fff",
  padding: "1px 5px",
  borderRadius: 4,
};
