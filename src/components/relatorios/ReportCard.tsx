import { RelatorioDiario } from "@/types/relatorio";

export function sentimentColor(s: string): string {
  switch (s.toLowerCase()) {
    case "produtivo": return "var(--success)";
    case "normal": return "var(--primary)";
    case "frustrado": return "#EA580C";
    case "sobrecarregado": return "var(--danger)";
    default: return "var(--muted)";
  }
}

export function sentimentBg(s: string): string {
  switch (s.toLowerCase()) {
    case "produtivo": return "var(--success-dim)";
    case "normal": return "var(--primary-dim)";
    case "frustrado": return "#FFF7ED";
    case "sobrecarregado": return "var(--danger-dim)";
    default: return "var(--surface-2)";
  }
}

interface Props {
  report: RelatorioDiario;
  selected: boolean;
  onClick: () => void;
}

export function ReportCard({ report, selected, onClick }: Props) {
  const date = new Date(report.dataDia);
  const dateLabel = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 16px", borderRadius: 12,
        border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
        background: selected ? "var(--primary-dim)" : "var(--surface)",
        cursor: "pointer", transition: "all 0.15s ease",
        boxShadow: selected
          ? "0 0 0 3px rgba(0,102,255,0.1)"
          : "0 1px 3px rgba(15,23,42,0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
            {report.nome}
          </p>
          <p style={{ fontSize: 11, color: "var(--muted)" }}>{report.equipe}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{dateLabel}</p>
          {report.horaExtra === "Sim" && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#B91C1C",
              background: "var(--danger-dim)", padding: "2px 6px", borderRadius: 4,
            }}>
              HE{report.tempoHoraExtra ? ` ${Math.round(report.tempoHoraExtra / 60)}h` : ""}
            </span>
          )}
        </div>
      </div>

      <span style={{
        display: "inline-block",
        fontSize: 10, fontWeight: 700,
        color: sentimentColor(report.comoSeSentiu),
        background: sentimentBg(report.comoSeSentiu),
        padding: "2px 8px", borderRadius: 6, marginBottom: 8,
      }}>
        {report.comoSeSentiu}
      </span>

      <p style={{
        fontSize: 11, color: "var(--secondary)", lineHeight: 1.5,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      }}>
        {report.atividadesRealizadas}
      </p>
    </div>
  );
}
