"use client";
import { X, Clock } from "lucide-react";
import { RelatorioDiario } from "@/types/relatorio";
import { sentimentColor, sentimentBg } from "./ReportCard";

function Section({ title, content }: { title: string; content: string | null }) {
  if (!content?.trim()) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: "var(--muted)",
        textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8,
      }}>
        {title}
      </p>
      <p style={{ fontSize: 13, color: "var(--secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {content}
      </p>
    </div>
  );
}

interface Props {
  report: RelatorioDiario;
  onClose: () => void;
}

export function ReportDetail({ report, onClose }: Props) {
  const date = new Date(report.dataDia).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div style={{
      background: "var(--surface)",
      padding: "24px 20px",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{report.nome}</p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{report.equipe}</p>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, textTransform: "capitalize" }}>{date}</p>
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6 }}
        >
          <X size={16} color="var(--muted)" />
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
          Como se sentiu
        </p>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: sentimentColor(report.comoSeSentiu),
          background: sentimentBg(report.comoSeSentiu),
          padding: "4px 12px", borderRadius: 8, display: "inline-block",
        }}>
          {report.comoSeSentiu}
        </span>
      </div>

      <Section title="Atividades Realizadas" content={report.atividadesRealizadas} />
      <Section title="Impedimentos" content={report.impedimentos} />
      <Section title="Demandas Pendentes (Colaborador)" content={report.demandasPendenteColaborador} />
      <Section title="Demandas Pendentes (Liderança)" content={report.demandasPendenteLideranca} />
      <Section title="Entregas Planejadas" content={report.entregasPlanejadas} />
      <Section title="Motivo de Não Entrega" content={report.motivoNaoEntrega} />

      {report.horaExtra === "Sim" && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
            Hora Extra
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: report.motivoHoraExtra ? 10 : 0 }}>
            <Clock size={14} color="#DC2626" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#B91C1C" }}>
              {report.tempoHoraExtra
                ? `${Math.floor(report.tempoHoraExtra / 60)}h ${report.tempoHoraExtra % 60}min`
                : "Tempo não informado"}
            </span>
            {report.horaExtraAprovada && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: report.horaExtraAprovada === "Sim" ? "var(--success)" : "#92400E",
                background: report.horaExtraAprovada === "Sim" ? "var(--success-dim)" : "#FFF7ED",
                padding: "2px 6px", borderRadius: 4,
              }}>
                {report.horaExtraAprovada === "Sim" ? "Aprovada" : "Pendente"}
              </span>
            )}
          </div>
          {report.motivoHoraExtra && (
            <p style={{ fontSize: 12, color: "var(--secondary)", lineHeight: 1.5 }}>
              {report.motivoHoraExtra}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
