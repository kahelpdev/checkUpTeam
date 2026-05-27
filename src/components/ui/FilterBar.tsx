"use client";
import { RefreshCw, CalendarDays } from "lucide-react";
import type { Team } from "@/hooks/useTeam";

interface FilterBarProps {
  teams: Team[];
  selectedId: string;
  onTeamChange: (id: string) => void;
  startDate: string;
  endDate: string;
  onStartDate: (d: string) => void;
  onEndDate: (d: string) => void;
  onToday: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  showDates?: boolean;
  autoRefresh?: boolean;
  onAutoRefreshChange?: (v: boolean) => void;
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 12,
  color: "var(--text)",
  background: "var(--surface)",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 12px",
  borderRadius: 8,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--secondary)",
  cursor: "pointer",
};

export function FilterBar({
  teams,
  selectedId,
  onTeamChange,
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  onToday,
  onRefresh,
  loading,
  showDates = true,
  autoRefresh,
  onAutoRefreshChange,
}: FilterBarProps) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = startDate === today && endDate === today;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {/* Seletor de equipe */}
      {teams.length > 0 && (
        <select
          value={selectedId}
          onChange={(e) => onTeamChange(e.target.value)}
          style={{ ...inputStyle, minWidth: 160, cursor: "pointer" }}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.teamName}
            </option>
          ))}
        </select>
      )}

      {/* Filtro de datas */}
      {showDates && (
        <>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDate(e.target.value)}
            style={inputStyle}
          />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDate(e.target.value)}
            style={inputStyle}
          />
          {!isToday && (
            <button onClick={onToday} style={btnStyle} title="Ir para o dia vigente">
              <CalendarDays size={12} /> Hoje
            </button>
          )}
        </>
      )}

      {/* Botão Atualizar */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{ ...btnStyle, opacity: loading ? 0.6 : 1 }}
        >
          <RefreshCw size={12} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      )}

      {/* Auto-refresh toggle */}
      {onAutoRefreshChange !== undefined && (
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoRefresh ?? false}
            onChange={(e) => onAutoRefreshChange(e.target.checked)}
            style={{ accentColor: "var(--primary)" }}
          />
          Auto 60s
        </label>
      )}
    </div>
  );
}
