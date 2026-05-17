"use client";
import { useEffect, useState, useCallback } from "react";
import { Search, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { RelatorioDiario, RelatorioFilters } from "@/types/relatorio";
import { ReportCard } from "@/components/relatorios/ReportCard";
import { ReportDetail } from "@/components/relatorios/ReportDetail";
import { AiQueryPanel } from "@/components/relatorios/AiQueryPanel";
import { SummaryModal } from "@/components/relatorios/SummaryModal";

const LIMIT = 20;

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8,
  border: "1px solid var(--border)", fontSize: 12,
  background: "var(--surface-2)", color: "var(--text)",
  outline: "none",
};

export default function RelatoriosPage() {
  const [reports, setReports] = useState<RelatorioDiario[]>([]);
  const [selected, setSelected] = useState<RelatorioDiario | null>(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showSummary, setShowSummary] = useState(false);

  const [equipes, setEquipes] = useState<string[]>([]);
  const [colaboradores, setColaboradores] = useState<{ nome: string; id: number }[]>([]);

  const emptyFilters: RelatorioFilters = { equipe: "", nome: "", dataInicio: "", dataFim: "" };
  const [filters, setFilters] = useState<RelatorioFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<RelatorioFilters>(emptyFilters);

  useEffect(() => {
    fetch("/api/relatorios/options")
      .then((r) => r.json())
      .then((data) => {
        setEquipes(data.equipes || []);
        setColaboradores(data.colaboradores || []);
      })
      .catch(() => null);
  }, []);

  const fetchReports = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (appliedFilters.equipe) params.set("equipe", appliedFilters.equipe);
    if (appliedFilters.nome) params.set("nome", appliedFilters.nome);
    if (appliedFilters.dataInicio) params.set("dataInicio", appliedFilters.dataInicio);
    if (appliedFilters.dataFim) params.set("dataFim", appliedFilters.dataFim);

    fetch(`/api/relatorios?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setReports(data.reports || []);
        setTotal(data.total || 0);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [appliedFilters, page]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  function applyFilters() {
    setAppliedFilters({ ...filters });
    setPage(1);
    setSelected(null);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
    setSelected(null);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, color: "var(--primary)",
            textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 6,
          }}>
            Gestão de Equipes
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.8px", lineHeight: 1.1 }}>
            Relatórios Diários
          </h1>
        </div>
        <button
          onClick={() => setShowSummary(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: 8,
            background: "var(--primary)", border: "none",
            fontSize: 12, fontWeight: 600, color: "#fff",
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,102,255,0.28)", marginTop: 6,
          }}
        >
          <FileText size={13} /> Resumo Diretoria
        </button>
      </div>

      {/* ── Filtros ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "16px 20px",
        display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Equipe</label>
          <select
            value={filters.equipe}
            onChange={(e) => setFilters((f) => ({ ...f, equipe: e.target.value, nome: "" }))}
            style={{ ...inputStyle, minWidth: 150, cursor: "pointer" }}
          >
            <option value="">Todas as equipes</option>
            {equipes.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Colaborador</label>
          <select
            value={filters.nome}
            onChange={(e) => setFilters((f) => ({ ...f, nome: e.target.value }))}
            style={{ ...inputStyle, minWidth: 160, cursor: "pointer" }}
          >
            <option value="">Todos</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Data início</label>
          <input
            type="date"
            value={filters.dataInicio}
            onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Data fim</label>
          <input
            type="date"
            value={filters.dataFim}
            onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={applyFilters}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: "var(--primary)", border: "none",
              fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer",
            }}
          >
            <Search size={13} /> Filtrar
          </button>
          <button
            onClick={clearFilters}
            style={{
              padding: "8px 12px", borderRadius: 8,
              background: "transparent", border: "1px solid var(--border)",
              fontSize: 12, color: "var(--muted)", cursor: "pointer",
            }}
          >
            Limpar
          </button>
        </div>

        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
          {!loading && `${total} relatório${total !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* ── Conteúdo principal ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: selected ? "340px 1fr" : "minmax(0, 480px)",
        gap: 16,
        minHeight: 480,
        alignItems: "start",
      }}>
        {/* Lista */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {loading ? (
            [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />
            ))
          ) : reports.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "64px 0", color: "var(--muted)", gap: 12,
              border: "1.5px dashed var(--border)", borderRadius: 12,
            }}>
              <FileText size={32} strokeWidth={1.5} />
              <p style={{ fontSize: 13 }}>Nenhum relatório encontrado</p>
              <p style={{ fontSize: 11 }}>Ajuste os filtros ou aguarde os colaboradores enviarem relatórios</p>
            </div>
          ) : (
            reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                selected={selected?.id === r.id}
                onClick={() => setSelected(selected?.id === r.id ? null : r)}
              />
            ))
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: "6px 10px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "transparent",
                  cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={14} color="var(--secondary)" />
              </button>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: "6px 10px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "transparent",
                  cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1,
                }}
              >
                <ChevronRight size={14} color="var(--secondary)" />
              </button>
            </div>
          )}
        </div>

        {/* Detalhe */}
        {selected && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16,
          }}>
            <ReportDetail report={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>

      {/* ── Painel IA ── */}
      <AiQueryPanel filters={appliedFilters} />

      {/* ── Modal resumo ── */}
      {showSummary && (
        <SummaryModal
          filters={{
            equipe: appliedFilters.equipe,
            dataInicio: appliedFilters.dataInicio,
            dataFim: appliedFilters.dataFim,
          }}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}
