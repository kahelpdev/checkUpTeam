"use client";
import { useState } from "react";
import { X, FileText, Copy, RefreshCw } from "lucide-react";

interface Props {
  filters: { equipe: string; dataInicio: string; dataFim: string };
  onClose: () => void;
}

export function SummaryModal({ filters, onClose }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ period: string; totalReports: number } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters.equipe) params.set("equipe", filters.equipe);
    if (filters.dataInicio) params.set("dataInicio", filters.dataInicio);
    if (filters.dataFim) params.set("dataFim", filters.dataFim);

    try {
      const res = await fetch(`/api/relatorios/summary?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar resumo");
      setSummary(data.summary);
      setMeta({ period: data.period, totalReports: data.totalReports });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 680,
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(15,23,42,0.2)",
      }}>
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "var(--primary-dim)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FileText size={16} color="var(--primary)" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Resumo para Diretoria</p>
              {meta && (
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                  {meta.totalReports} relatórios · {meta.period}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {summary && (
              <>
                <button
                  onClick={generate}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "transparent",
                    fontSize: 12, color: "var(--secondary)", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  <RefreshCw size={12} /> Regenerar
                </button>
                <button
                  onClick={handleCopy}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "transparent",
                    fontSize: 12, color: copied ? "var(--success)" : "var(--secondary)",
                    cursor: "pointer", fontWeight: 600,
                  }}
                >
                  <Copy size={12} /> {copied ? "Copiado!" : "Copiar"}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6 }}
            >
              <X size={18} color="var(--muted)" />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {!summary && !loading && !error && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, background: "var(--primary-dim)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
              }}>
                <FileText size={28} color="var(--primary)" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                Gerar Resumo Executivo
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 380, margin: "0 auto 24px" }}>
                A IA vai analisar os relatórios do período selecionado e gerar um resumo estruturado para o CEO.
                {!filters.dataInicio && " Nenhuma data selecionada — serão usados todos os relatórios."}
              </p>
              <button
                onClick={generate}
                style={{
                  padding: "10px 28px", borderRadius: 10,
                  background: "var(--primary)", border: "none",
                  fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,102,255,0.28)",
                }}
              >
                Gerar Resumo
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "64px 0", color: "var(--muted)", fontSize: 13 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "3px solid var(--primary-dim)", borderTopColor: "var(--primary)",
                animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
              }} />
              Analisando {filters.equipe ? `equipe ${filters.equipe}` : "todas as equipes"} com IA...
            </div>
          )}

          {error && (
            <div style={{
              color: "#B91C1C", background: "var(--danger-dim)",
              padding: "12px 16px", borderRadius: 10, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {summary && (
            <div style={{
              fontSize: 13, color: "var(--text)", lineHeight: 1.9,
              whiteSpace: "pre-wrap",
            }}>
              {summary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
