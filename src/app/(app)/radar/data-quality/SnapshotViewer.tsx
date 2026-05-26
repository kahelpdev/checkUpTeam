"use client";
import { useEffect, useState } from "react";

interface Props { snapshotId: string; onClose: () => void }

interface SnapData {
  id: string;
  capturedAt: string;
  source: string;
  teamConfigId: string | null;
  payload: unknown;
}

export function SnapshotViewer({ snapshotId, onClose }: Props) {
  const [data, setData] = useState<SnapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/radar/snapshots/${snapshotId}`)
      .then(async (r) => {
        if (!r.ok) {
          setError("Snapshot não encontrado ou indisponível.");
          return null;
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [snapshotId]);

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data.payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <strong style={{ fontSize: 15 }}>Snapshot bruto</strong>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18 }} aria-label="Fechar">×</button>
        </div>

        {error ? (
          <div style={{ color: "#dc2626", padding: 12 }}>{error}</div>
        ) : !data ? (
          <div style={{ padding: 12 }}>Carregando snapshot…</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "var(--secondary)", marginBottom: 8 }}>
              {data.source} | capturado em {new Date(data.capturedAt).toLocaleString("pt-BR")}
              {data.teamConfigId ? ` | team=${data.teamConfigId}` : ""}
            </div>
            <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 6, fontSize: 11, overflow: "auto", maxHeight: "60vh", margin: 0 }}>
              {JSON.stringify(data.payload, null, 2)}
            </pre>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <button onClick={copy} style={btnSecondary}>{copied ? "✓ Copiado" : "Copiar JSON"}</button>
              <button onClick={onClose} style={btnPrimary}>Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const modal: React.CSSProperties = {
  background: "var(--surface)", borderRadius: 12, padding: 20, width: 700, maxHeight: "90vh", overflowY: "auto",
};
const btnPrimary: React.CSSProperties = { padding: "8px 14px", fontSize: 13, background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { padding: "8px 14px", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" };
