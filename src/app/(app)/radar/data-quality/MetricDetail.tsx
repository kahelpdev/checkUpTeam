"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceArea } from "recharts";
import { SnapshotViewer } from "./SnapshotViewer";

interface Props { metricKey: string; onClose: () => void; onUpdated?: () => void }

interface Def {
  key: string; name: string; description: string | null; formula: string;
  sourceA: string; sourceB: string | null; tolerancePct: number | null;
  periodicity: string; confidence: string; displayMode: string;
}

interface HistPoint { period: string; value: number; valueSourceA: number | null; valueSourceB: number | null; deltaPct: number | null; status: string }

interface Incident {
  id: string; metricKey: string; detectedAt: string; delta: number | null;
  hypothesis: string | null; status: string; resolvedAt: string | null; resolution: string | null;
}

const card = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
  padding: 20, boxShadow: "0 1px 4px rgba(36,40,115,0.05)",
};

export function MetricDetail({ metricKey, onClose, onUpdated }: Props) {
  const [def, setDef] = useState<Def | null>(null);
  const [history, setHistory] = useState<HistPoint[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingHyp, setEditingHyp] = useState<string | null>(null);
  const [hypValue, setHypValue] = useState("");
  const [showConfirmPromote, setShowConfirmPromote] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<string | null>(null);
  const [latestSnapshotId, setLatestSnapshotId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [defs, hist, inc] = await Promise.all([
        fetch(`/api/radar/metric-definitions`).then((r) => r.json()),
        fetch(`/api/radar/metrics/${metricKey}/history`).then((r) => r.json()),
        fetch(`/api/radar/incidents?metricKey=${metricKey}`).then((r) => r.json()),
      ]);
      const d = (defs.items as Def[]).find((x) => x.key === metricKey) ?? null;
      setDef(d);
      setHistory((hist.history ?? []) as HistPoint[]);
      setIncidents((inc.incidents ?? []) as Incident[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [metricKey]);

  const saveHypothesis = async (id: string) => {
    await fetch(`/api/radar/incidents/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hypothesis: hypValue }),
    });
    setEditingHyp(null);
    void load();
  };

  const resolveIncident = async (id: string, status: "resolved" | "known_limitation") => {
    await fetch(`/api/radar/incidents/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void load();
    onUpdated?.();
  };

  const promoteToRevised = async () => {
    await fetch(`/api/radar/metric-definitions/${metricKey}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayMode: "revised" }),
    });
    setShowConfirmPromote(false);
    void load();
    onUpdated?.();
  };

  const findLatestSnapshot = async (): Promise<string | null> => {
    // Pega o último snapshot ApiSnapshot do path /devbi/current-tasks (proxy para o evento)
    // Na ausência de associação direta entre incidente e snapshot, abre o snapshot
    // mais recente do path da source A da métrica. UX: ajuda investigação.
    if (latestSnapshotId) return latestSnapshotId;
    // Heurística: para tempo_medio_em_execucao usa /devbi/current-tasks, etc.
    // Para esta versão, busca via novo endpoint /api/radar/snapshots/latest?metricKey=X (não implementado)
    // — fallback: abre o snapshotId do incidente se houver, ou retorna null.
    return null;
  };

  const viewSnapshot = async () => {
    const id = await findLatestSnapshot();
    if (id) setViewingSnapshot(id);
  };

  if (loading || !def) return <div style={card}>Carregando detalhe…</div>;

  // Banner se draft
  const isDraft = def.confidence === "draft";

  // Cor das séries
  const colorA = "#3b82f6";
  const colorB = "#ef4444";

  // Banda de tolerância: usa última valueSourceA ± tolerancePct% como referência
  const lastA = history.length > 0 ? history[history.length - 1].valueSourceA : null;
  const tolBand = lastA != null && def.tolerancePct != null
    ? { lower: lastA * (1 - def.tolerancePct / 100), upper: lastA * (1 + def.tolerancePct / 100) }
    : null;

  return (
    <div style={card}>
      {isDraft && (
        <div style={{ background: "#fef3c7", color: "#92400e", padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          ⚠ Métrica em modo <strong>BETA</strong>. Não é exibida para usuários não-admin.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{def.name}</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--secondary)" }}>{def.key}</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20, color: "var(--secondary)" }} aria-label="Fechar">×</button>
      </div>

      {def.description && <p style={{ fontSize: 12, color: "var(--secondary)", margin: "8px 0" }}>{def.description}</p>}

      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 12, fontSize: 12, margin: "12px 0" }}>
        <dt style={{ color: "var(--secondary)" }}>Fórmula</dt><dd style={{ fontFamily: "monospace", margin: 0, wordBreak: "break-all" }}>{def.formula}</dd>
        <dt style={{ color: "var(--secondary)" }}>Source A</dt><dd style={{ fontFamily: "monospace", margin: 0, wordBreak: "break-all" }}>{def.sourceA}</dd>
        <dt style={{ color: "var(--secondary)" }}>Source B</dt><dd style={{ fontFamily: "monospace", margin: 0, wordBreak: "break-all" }}>{def.sourceB ?? "—"}</dd>
        <dt style={{ color: "var(--secondary)" }}>Tolerância</dt><dd style={{ margin: 0 }}>{def.tolerancePct != null ? `${def.tolerancePct}%` : "—"}</dd>
        <dt style={{ color: "var(--secondary)" }}>Confidence</dt><dd style={{ margin: 0 }}>{def.confidence}</dd>
        <dt style={{ color: "var(--secondary)" }}>Display</dt><dd style={{ margin: 0 }}>{def.displayMode}</dd>
      </dl>

      {history.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--secondary)", padding: "12px 0" }}>
          Aguardando primeiro cálculo. Próximo ciclo: ~5 min.
        </div>
      ) : (
        <div style={{ height: 200, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history.slice(-30)} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {tolBand && (
                <ReferenceArea y1={tolBand.lower} y2={tolBand.upper} fill="#94a3b8" fillOpacity={0.08} />
              )}
              <Line type="monotone" dataKey="valueSourceA" name="Source A (CardsFlow)" stroke={colorA} dot={false} />
              {def.sourceB && <Line type="monotone" dataKey="valueSourceB" name="Source B (recálculo)" stroke={colorB} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!def.sourceB && (
        <div style={{ fontSize: 11, color: "var(--secondary)", marginTop: 4, fontStyle: "italic" }}>
          Métrica de fonte única — sem batimento cruzado configurado.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Incidentes ({incidents.length})</div>
        {incidents.length === 0 && <div style={{ fontSize: 12, color: "var(--secondary)" }}>Nenhum incidente registrado.</div>}
        {incidents.map((i) => {
          const editable = i.status === "open" || i.status === "investigating";
          const dotColor = i.status === "open" ? "#dc2626" : i.status === "investigating" ? "#f59e0b" : i.status === "resolved" ? "#16a34a" : "#9ca3af";
          return (
            <div key={i.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0", fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: dotColor }}>{i.status.toUpperCase()}</span>
                <span style={{ color: "var(--secondary)" }}>{new Date(i.detectedAt).toLocaleString("pt-BR")}</span>
              </div>
              {i.delta != null && <div style={{ marginTop: 2 }}>Delta: <strong>{i.delta.toFixed(2)}%</strong></div>}
              {editingHyp === i.id ? (
                <div style={{ marginTop: 6 }}>
                  <textarea value={hypValue} onChange={(e) => setHypValue(e.target.value)} rows={2} style={{ width: "100%", fontSize: 12, padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
                  <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                    <button onClick={() => saveHypothesis(i.id)} style={btnPrimary}>Salvar</button>
                    <button onClick={() => setEditingHyp(null)} style={btnSecondary}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 4 }}>
                  Hipótese: {i.hypothesis ?? <em style={{ color: "var(--secondary)" }}>(nenhuma)</em>}
                  {editable && (
                    <button onClick={() => { setEditingHyp(i.id); setHypValue(i.hypothesis ?? ""); }} style={{ ...btnLink, marginLeft: 8 }}>
                      editar
                    </button>
                  )}
                </div>
              )}
              {editable && (
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => resolveIncident(i.id, "resolved")} style={btnSmall}>Marcar resolvido</button>
                  <button onClick={() => resolveIncident(i.id, "known_limitation")} style={btnSmall}>Limite conhecido</button>
                  <button onClick={viewSnapshot} style={btnSmall}>Ver snapshot</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {def.displayMode === "mirror" && def.sourceB && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <button onClick={() => setShowConfirmPromote(true)} style={btnPrimary}>
            Promover para "Revisado" (Source B)
          </button>
        </div>
      )}

      {showConfirmPromote && (
        <div style={overlay}>
          <div style={{ ...card, width: 400 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Confirmar promoção</div>
            <p style={{ fontSize: 12, color: "var(--secondary)", lineHeight: 1.5 }}>
              A UI passará a exibir <strong>Source B</strong> (recálculo interno) no lugar de Source A (CardsFlow).
              Esta ação é reversível via API. Confirma?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowConfirmPromote(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={promoteToRevised} style={btnPrimary}>Promover</button>
            </div>
          </div>
        </div>
      )}

      {viewingSnapshot && <SnapshotViewer snapshotId={viewingSnapshot} onClose={() => setViewingSnapshot(null)} />}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  fontSize: 12, padding: "6px 12px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  fontSize: 12, padding: "6px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
};

const btnSmall: React.CSSProperties = {
  fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer",
};

const btnLink: React.CSSProperties = {
  background: "none", border: "none", color: "#1d4ed8", textDecoration: "underline",
  cursor: "pointer", fontSize: 11, padding: 0,
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
