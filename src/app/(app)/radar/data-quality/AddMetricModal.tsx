"use client";
import { useState } from "react";

interface Props { onClose: () => void; onCreated: () => void }

export function AddMetricModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    key: "", name: "", description: "", formula: "",
    sourceA: "", sourceB: "", tolerancePct: "",
    periodicity: "daily", category: "kpi",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const keyValid = /^[a-z][a-z0-9_]*$/.test(form.key);
  const ready = form.key && keyValid && form.name && form.formula && form.sourceA;

  const submit = async () => {
    setErr("");
    if (!ready) {
      setErr(!keyValid && form.key ? "Key deve estar em snake_case (minúsculas, dígitos, underscore)." : "Preencha key, name, formula e sourceA.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/radar/metric-definitions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        sourceB: form.sourceB || null,
        tolerancePct: form.tolerancePct ? parseFloat(form.tolerancePct) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setErr((await res.json()).error ?? "Erro desconhecido");
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Nova métrica (modo draft)</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
          <label style={lbl}>Key (única, snake_case)
            <input value={form.key} onChange={set("key")} style={inp} placeholder="ex: total_cards_abertos" />
            {form.key && !keyValid && <small style={{ color: "#dc2626", fontSize: 11 }}>Deve estar em snake_case</small>}
          </label>
          <label style={lbl}>Nome
            <input value={form.name} onChange={set("name")} style={inp} />
          </label>
          <label style={lbl}>Descrição
            <textarea value={form.description} onChange={set("description")} rows={2} style={inp} />
          </label>
          <label style={lbl}>Fórmula (humana)
            <input value={form.formula} onChange={set("formula")} style={inp} />
          </label>
          <label style={lbl}>Source A
            <input value={form.sourceA} onChange={set("sourceA")} placeholder="cardflow:/devbi/X:campo" style={{ ...inp, fontFamily: "monospace" }} />
          </label>
          <label style={lbl}>Source B (opcional)
            <input value={form.sourceB} onChange={set("sourceB")} placeholder="internal:tabela:agregação" style={{ ...inp, fontFamily: "monospace" }} />
          </label>
          <label style={lbl}>Tolerância (%, opcional)
            <input value={form.tolerancePct} onChange={set("tolerancePct")} type="number" step="0.01" min="0" max="100" style={inp} />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ ...lbl, flex: 1 }}>Periodicidade
              <select value={form.periodicity} onChange={set("periodicity")} style={inp}>
                <option value="hourly">hourly</option><option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option>
              </select>
            </label>
            <label style={{ ...lbl, flex: 1 }}>Categoria
              <select value={form.category} onChange={set("category")} style={inp}>
                <option value="kpi">kpi</option><option value="tempo">tempo</option><option value="qa">qa</option><option value="carga">carga</option><option value="meta">meta</option><option value="custo">custo</option>
              </select>
            </label>
          </div>
          {err && <div style={{ color: "#dc2626", fontSize: 12 }}>{err}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={submit} disabled={saving || !ready} style={{ ...btnPrimary, opacity: ready && !saving ? 1 : 0.5, cursor: ready && !saving ? "pointer" : "not-allowed" }}>
            {saving ? "Criando…" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const modal: React.CSSProperties = {
  background: "var(--surface)", borderRadius: 12, padding: 24, width: 500, maxHeight: "90vh", overflowY: "auto",
};
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12 };
const inp: React.CSSProperties = {
  width: "100%", padding: 6, border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)",
};
const btnPrimary: React.CSSProperties = { padding: "8px 14px", fontSize: 13, background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6 };
const btnSecondary: React.CSSProperties = { padding: "8px 14px", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" };
