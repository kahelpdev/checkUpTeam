"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, BarChart2, ShieldCheck, Users } from "lucide-react";

const FEATURES = [
  { icon: BarChart2,   text: "KPIs da equipe em tempo real" },
  { icon: ShieldCheck, text: "Monitoramento de qualidade QA" },
  { icon: Users,       text: "Visibilidade completa de membros" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(from);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Credenciais inválidas. Tente novamente.");
      setPassword("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      fontFamily: "var(--font-sans), system-ui, sans-serif",
    }}>

      {/* ── Left — Brand panel ── */}
      <div style={{
        flex: "0 0 52%", position: "relative",
        background: "#0F172A",
        backgroundImage: "radial-gradient(rgba(0,102,255,0.18) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        display: "flex", flexDirection: "column",
        padding: "48px 56px",
        overflow: "hidden",
      }}>
        {/* Glow blob */}
        <div style={{
          position: "absolute", top: -120, left: -80,
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,102,255,0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -60, right: -60,
          width: 320, height: 320, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "auto" }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: "#0066FF",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,102,255,0.45)",
          }}>
            <Zap size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>
            CheckUp Team
          </span>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: "auto", paddingTop: "20vh" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(0,102,255,0.18)", border: "1px solid rgba(0,102,255,0.3)",
            borderRadius: 20, padding: "4px 12px", marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "0.3px" }}>
              Plataforma de liderança
            </span>
          </div>

          <h1 style={{
            fontSize: 38, fontWeight: 800, color: "#fff",
            letterSpacing: "-1.2px", lineHeight: 1.15, marginBottom: 20,
          }}>
            Visibilidade total<br />
            <span style={{ color: "#0066FF" }}>da sua equipe</span>
          </h1>

          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 380, marginBottom: 40 }}>
            Monitore cards, SLA, reprova QA e desempenho individual em tempo real, em um painel unificado.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "rgba(0,102,255,0.15)", border: "1px solid rgba(0,102,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={15} color="#4D9EFF" strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom label */}
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 48 }}>
          CheckUp Team — Acesso restrito à liderança
        </p>
      </div>

      {/* ── Right — Form panel ── */}
      <div style={{
        flex: 1, background: "#F5F6FA",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px 40px",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>

          {/* Form header */}
          <div style={{ marginBottom: 36 }}>
            <h2 style={{
              fontSize: 26, fontWeight: 800, color: "#0F172A",
              letterSpacing: "-0.7px", marginBottom: 8,
            }}>
              Entrar na plataforma
            </h2>
            <p style={{ fontSize: 14, color: "#64748B" }}>
              Use seu e-mail e senha para continuar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            <div>
              <label style={{
                display: "block", fontSize: 13, fontWeight: 600,
                color: "#334155", marginBottom: 7,
              }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoFocus required
                style={{
                  width: "100%", boxSizing: "border-box",
                  border: "1.5px solid #E2E8F0",
                  borderRadius: 10, padding: "11px 14px",
                  fontSize: 14, outline: "none",
                  background: "#fff", color: "#0F172A",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0066FF"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
              />
            </div>

            <div>
              <label style={{
                display: "block", fontSize: 13, fontWeight: 600,
                color: "#334155", marginBottom: 7,
              }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%", boxSizing: "border-box",
                  border: `1.5px solid ${error ? "#EF4444" : "#E2E8F0"}`,
                  borderRadius: 10, padding: "11px 14px",
                  fontSize: 14, outline: "none",
                  background: "#fff", color: "#0F172A",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = error ? "#EF4444" : "#0066FF"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = error ? "#EF4444" : "#E2E8F0"; }}
              />
              {error && (
                <p style={{ fontSize: 12, color: "#EF4444", marginTop: 6, fontWeight: 500 }}>
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: "100%", marginTop: 4,
                background: loading || !email || !password ? "#94A3B8" : "#0066FF",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "12px 0", fontSize: 14, fontWeight: 700,
                cursor: loading || !email || !password ? "not-allowed" : "pointer",
                transition: "background 0.15s, transform 0.1s",
                boxShadow: loading || !email || !password ? "none" : "0 4px 14px rgba(0,102,255,0.35)",
                letterSpacing: "0.1px",
              }}
            >
              {loading ? "Verificando..." : "Entrar"}
            </button>
          </form>

          {/* Footer */}
          <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 32 }}>
            Problemas de acesso? Fale com o administrador.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
