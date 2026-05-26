import { MetricsList } from "./MetricsList";

export const dynamic = "force-dynamic";

export default function RadarDataQualityPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Qualidade de Dados — Radar</h1>
        <p style={{ fontSize: 13, color: "var(--secondary)", margin: "4px 0 0 0" }}>
          Auditoria das métricas que alimentam o Radar Diretoria
        </p>
      </header>
      <MetricsList />
    </div>
  );
}
