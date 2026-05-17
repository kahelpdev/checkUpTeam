import { type ReactNode } from "react";

type DeltaType = "up" | "down" | "warn" | "neutral";
type AccentColor = "navy" | "sage" | "warn" | "danger";

interface SparkBar { height: string; color: string; }

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent: AccentColor;
  delta?: string;
  deltaType?: DeltaType;
  sparkline?: SparkBar[];
}

const ACCENT_COLOR: Record<AccentColor, string> = {
  navy:   "#0066FF",
  sage:   "#10B981",
  warn:   "#F59E0B",
  danger: "#EF4444",
};

const ICON_BG: Record<AccentColor, string> = {
  navy:   "rgba(0, 102, 255, 0.08)",
  sage:   "rgba(16, 185, 129, 0.10)",
  warn:   "rgba(245, 158, 11, 0.10)",
  danger: "rgba(239, 68, 68, 0.10)",
};

const DELTA_STYLE: Record<DeltaType, { bg: string; color: string }> = {
  up:      { bg: "rgba(16, 185, 129, 0.10)",  color: "#065F46" },
  down:    { bg: "rgba(239, 68, 68, 0.10)",   color: "#B91C1C" },
  warn:    { bg: "rgba(245, 158, 11, 0.10)",  color: "#92400E" },
  neutral: { bg: "rgba(100, 116, 139, 0.10)", color: "#64748B" },
};

export function KpiCard({
  label, value, icon, accent,
  delta, deltaType = "neutral", sparkline = [],
}: KpiCardProps) {
  const ds = DELTA_STYLE[deltaType];
  const accentColor = ACCENT_COLOR[accent];

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "18px 20px",
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
    }}>
      {/* accent top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: accentColor,
        borderRadius: "14px 14px 0 0",
      }} />

      {/* icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: ICON_BG[accent],
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 14,
      }}>
        {icon}
      </div>

      {/* label */}
      <p style={{
        fontSize: 11, fontWeight: 600, color: "var(--muted)",
        textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6,
      }}>
        {label}
      </p>

      {/* value */}
      <p style={{
        fontSize: 30, fontWeight: 800, color: "var(--text)",
        letterSpacing: "-1.5px", lineHeight: 1,
        fontFamily: "var(--font-mono, monospace)",
      }}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>

      {/* delta */}
      {delta && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          marginTop: 10, fontSize: 11, fontWeight: 600,
          padding: "2px 8px", borderRadius: 5,
          background: ds.bg, color: ds.color,
        }}>
          {delta}
        </span>
      )}

      {/* sparkline */}
      {sparkline.length > 0 && (
        <div style={{
          position: "absolute", bottom: 16, right: 16,
          display: "flex", alignItems: "flex-end", gap: 2, height: 28,
        }}>
          {sparkline.map((bar, i) => (
            <div key={i} style={{
              width: 4, borderRadius: 2,
              height: bar.height, background: bar.color,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
