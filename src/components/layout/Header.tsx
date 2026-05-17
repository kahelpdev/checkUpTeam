"use client";
import { Bell, HelpCircle, Search } from "lucide-react";

export function Header() {
  return (
    <header style={{
      height: 60, background: "rgba(255, 255, 255, 0.92)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 24px 0 16px", flexShrink: 0, gap: 16,
    }}>
      {/* Search */}
      <div style={{
        flex: 1, maxWidth: 420,
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--surface-2)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "9px 14px",
      }}>
        <Search size={14} color="var(--muted)" strokeWidth={2} />
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          Buscar tarefas, membros, relatórios...
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right icons */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={{
          width: 34, height: 34, borderRadius: 8, border: "none",
          background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--muted)",
        }}>
          <Bell size={17} strokeWidth={1.8} />
        </button>
        <button style={{
          width: 34, height: 34, borderRadius: 8, border: "none",
          background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--muted)",
        }}>
          <HelpCircle size={17} strokeWidth={1.8} />
        </button>
        <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--primary) 0%, #4D9EFF 100%)",
          color: "#fff", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
        }}>
          K
        </div>
      </div>
    </header>
  );
}
