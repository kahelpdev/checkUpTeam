"use client";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, AlertTriangle, Settings,
  ChevronDown, Zap, Check, Shield, LogOut, BarChart2, FileText, Activity,
} from "lucide-react";
import { useSelectedTeam } from "@/hooks/useTeam";

type Role = "admin" | "lider" | "viewer";

interface CurrentUser {
  name: string;
  email: string;
  role: Role;
}

const NAV_MAIN = [
  { href: "/dashboard",   label: "Dashboard",      icon: LayoutDashboard, roles: ["admin", "lider", "viewer"] },
  { href: "/devbi",       label: "DevBI",          icon: BarChart2,       roles: ["admin", "lider"] },
  { href: "/tasks",       label: "Tarefas Atuais", icon: ClipboardList,   roles: ["admin", "lider", "viewer"] },
  { href: "/reprova",     label: "Reprova QA",     icon: AlertTriangle,   roles: ["admin", "lider"], badge: true },
  { href: "/relatorios",  label: "Relatórios",     icon: FileText,        roles: ["admin", "lider"] },
];

const NAV_SYSTEM = [
  { href: "/radar/data-quality", label: "Qualidade de Dados", icon: Activity, roles: ["admin"] },
  { href: "/api-manager",        label: "Configurações",      icon: Settings, roles: ["admin", "lider"] },
  { href: "/users",              label: "Usuários",           icon: Shield,   roles: ["admin"] },
];

function NavLink({ href, label, icon: Icon, active, badge }: { href: string; label: string; icon: React.ElementType; active: boolean; badge?: boolean }) {
  return (
    <Link
      href={href}
      className={`nav-item${active ? " active" : ""}`}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", borderRadius: 8,
        fontSize: 13, fontWeight: active ? 600 : 500,
        color: active ? "var(--primary)" : "var(--secondary)",
        marginBottom: 2, textDecoration: "none",
        background: active ? "var(--primary-dim)" : "transparent",
        borderLeft: `2px solid ${active ? "var(--primary)" : "transparent"}`,
      }}
    >
      <Icon size={15} strokeWidth={active ? 2.5 : 2} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          background: "var(--danger)", color: "#fff",
          fontSize: 9, fontWeight: 700, borderRadius: 4,
          padding: "1px 5px", letterSpacing: "0.3px",
        }}>
          QA
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { teams, selectedId, selectTeam, loading } = useSelectedTeam();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const selectedTeamName = teams.find((t) => t.id === selectedId)?.teamName ?? "Selecionar equipe";

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((u) => u && setCurrentUser(u));
  }, []);

  const handleTriggerClick = () => {
    if (!dropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    setDropdownOpen((v) => !v);
  };

  const handleSelect = (id: string) => { selectTeam(id); setDropdownOpen(false); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setDropdownOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const role = currentUser?.role ?? "viewer";
  const navMain = NAV_MAIN.filter((n) => n.roles.includes(role));
  const navSystem = NAV_SYSTEM.filter((n) => n.roles.includes(role));

  const initials = currentUser?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  const roleLabel = role === "admin" ? "Administrador" : role === "lider" ? "Líder" : "Visualizador";

  return (
    <>
      <div style={{
        width: 240, height: "100vh", flexShrink: 0,
        background: "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        boxShadow: "1px 0 12px rgba(15, 23, 42, 0.06)",
        zIndex: 10, position: "relative",
      }}>
        {/* ── Logo + App name ── */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 3px 10px rgba(0, 102, 255, 0.32)", flexShrink: 0,
            }}>
              <Zap size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px", lineHeight: 1.2 }}>
                CheckUp Team
              </p>
              <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>Gestão de Equipes</p>
            </div>
          </div>

          {loading ? (
            <div style={{ height: 36, background: "var(--border)", borderRadius: 8, animation: "pulse-soft 1.4s infinite" }} />
          ) : (
            <div
              ref={triggerRef}
              onClick={handleTriggerClick}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: dropdownOpen ? "var(--primary-dim)" : "var(--surface-2)",
                border: `1px solid ${dropdownOpen ? "var(--primary)" : "var(--border)"}`,
                borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                transition: "all 0.15s ease", userSelect: "none",
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: "var(--primary-dim)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "var(--primary)" }}>T</span>
              </div>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedTeamName}
              </span>
              <ChevronDown size={12} color="var(--muted)" style={{ transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav style={{ padding: "12px 10px", flex: 1, overflowY: "auto" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", padding: "4px 8px 8px" }}>
            Principal
          </p>
          {navMain.map(({ href, label, icon, badge }) => (
            <NavLink key={href} href={href} label={label} icon={icon} active={pathname === href} badge={badge} />
          ))}

          {navSystem.length > 0 && (
            <>
              <div style={{ height: 1, background: "var(--border)", margin: "12px 4px" }} />
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", padding: "4px 8px 8px" }}>
                Sistema
              </p>
              {navSystem.map(({ href, label, icon }) => (
                <NavLink key={href} href={href} label={label} icon={icon} active={pathname === href} />
              ))}
            </>
          )}
        </nav>

        {/* ── Footer ── */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), #4D9EFF)",
              color: "#fff", fontSize: 13, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(0, 102, 255, 0.25)",
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser?.name ?? "..."}
              </p>
              <p style={{ fontSize: 10, color: "var(--muted)" }}>{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}
            >
              <LogOut size={14} color="var(--muted)" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Team dropdown portal ── */}
      {dropdownOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setDropdownOpen(false)} />
          <div style={{
            position: "fixed", top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width,
            zIndex: 999, background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.14)", overflow: "hidden", maxHeight: 280, overflowY: "auto",
          }}>
            {teams.map((t) => {
              const isSelected = t.id === selectedId;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 12px", cursor: "pointer",
                    background: isSelected ? "var(--primary-dim)" : "transparent",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ flex: 1, fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? "var(--primary)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.teamName}
                  </span>
                  {isSelected && <Check size={13} color="var(--primary)" strokeWidth={2.5} />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
