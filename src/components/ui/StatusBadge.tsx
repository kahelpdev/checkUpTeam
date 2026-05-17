interface StatusDef { bg: string; color: string; border: string; dot: string; label: string; }

const STATUS_MAP: Record<string, StatusDef> = {
  "Alta Qualidade":  { bg: "#F0FAF6", color: "#1A6B47", border: "rgba(26,107,71,0.2)",  dot: "#1A6B47", label: "Alta Qualidade" },
  "Regular":         { bg: "#FFFBF0", color: "#8A5000", border: "rgba(138,80,0,0.2)",   dot: "#E8A020", label: "Regular" },
  "Alerta Comport.": { bg: "#FFF5F5", color: "#B01020", border: "rgba(176,16,32,0.25)", dot: "#DC3545", label: "⚠ Alerta" },
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const s = STATUS_MAP[status] ?? { bg: "#F1F5F9", color: "#64748B", border: "rgba(100,116,139,0.2)", dot: "#94A3B8", label: status };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 700, padding: "3px 8px",
      borderRadius: 20, background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, display: "inline-block", flexShrink: 0 }} />
      {s.label}
    </span>
  );
}
