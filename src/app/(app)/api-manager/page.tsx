"use client";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RefreshCw, Plus, Link, Save, Users } from "lucide-react";

interface ApiEntry {
  id: string;
  name: string;
  path: string;
  method: string;
  description: string | null;
  isActive: boolean;
  lastChecked: string | null;
  lastStatus: string | null;
}

const DEFAULT_ENDPOINTS: Omit<ApiEntry, "id" | "lastChecked" | "lastStatus">[] = [
  { name: "KPIs DevBI", path: "/devbi/kpis", method: "GET", description: "Cards abertos, SLA em risco, resolvidos hoje", isActive: true },
  { name: "Rankings DevBI", path: "/devbi/rankings", method: "GET", description: "Ranking de devs com scores Kanban, QA e SLA", isActive: true },
  { name: "Tarefas Atuais", path: "/devbi/current-tasks", method: "GET", description: "Tarefa atual de cada membro do time", isActive: true },
  { name: "Workload", path: "/devbi/workload", method: "GET", description: "Carga de trabalho ativa/resolvida por usuário", isActive: true },
  { name: "Gráfico de Demanda", path: "/devbi/demand-chart", method: "GET", description: "Série temporal criados vs resolvidos por dia", isActive: true },
];

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12, padding: 20,
  boxShadow: "0 1px 4px rgba(36,40,115,0.05)",
};

export default function ApiManagerPage() {
  const [apis, setApis] = useState<ApiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", path: "", description: "" });

  const [teams, setTeams] = useState<{ id: string; teamId: string; teamName: string; isActive: boolean }[]>([]);
  const [togglingTeam, setTogglingTeam] = useState<string | null>(null);

  const [flowUrl, setFlowUrl] = useState("");
  const [flowUrlSource, setFlowUrlSource] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlSaved, setUrlSaved] = useState(false);

  const fetchApis = () => {
    setLoading(true);
    fetch("/api/api-registry").then((r) => r.json()).then((data) => setApis(data as ApiEntry[])).finally(() => setLoading(false));
  };
  const fetchFlowUrl = () => {
    fetch("/api/config/flow-url").then((r) => r.json()).then((data: { url: string; source: string }) => { setFlowUrl(data.url); setFlowUrlSource(data.source); });
  };
  const saveFlowUrl = async () => {
    setSavingUrl(true);
    await fetch("/api/config/flow-url", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: flowUrl }) });
    setSavingUrl(false); setEditingUrl(false); setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 3000);
    fetchFlowUrl();
  };
  const fetchTeams = () => { fetch("/api/teams").then((r) => r.json()).then((data) => setTeams(data)); };
  const toggleTeam = async (id: string, isActive: boolean) => {
    setTogglingTeam(id);
    await fetch("/api/teams", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isActive }) });
    fetchTeams(); setTogglingTeam(null);
  };

  useEffect(() => { fetchApis(); fetchFlowUrl(); fetchTeams(); }, []);

  const pingApi = async (id: string) => {
    setPinging(id);
    await fetch("/api/api-registry", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchApis(); setPinging(null);
  };
  const addApi = async () => {
    if (!form.name || !form.path) return;
    await fetch("/api/api-registry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, path: form.path, description: form.description }) });
    setForm({ name: "", path: "", description: "" }); setShowForm(false); fetchApis();
  };
  const seedDefaults = async () => {
    for (const ep of DEFAULT_ENDPOINTS) {
      await fetch("/api/api-registry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ep) });
    }
    fetchApis();
  };

  const inputStyle = {
    border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px",
    fontSize: 13, outline: "none", background: "var(--surface)", color: "var(--text)", width: "100%", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* URL ngrok */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link size={14} color="var(--sage)" />
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>URL base do cardsFlow</p>
            {flowUrlSource && (
              <span style={{
                fontSize: 10, padding: "1px 8px", borderRadius: 5, fontWeight: 600,
                background: flowUrlSource === "database" ? "rgba(120,191,165,0.14)" : "rgba(138,143,175,0.12)",
                color: flowUrlSource === "database" ? "#2E8A6E" : "var(--muted)",
              }}>
                {flowUrlSource === "database" ? "configurado no painel" : "variável de ambiente"}
              </span>
            )}
            {urlSaved && <span style={{ fontSize: 11, color: "#2E8A6E", fontWeight: 600 }}>Salvo!</span>}
          </div>
          {!editingUrl && (
            <button onClick={() => setEditingUrl(true)} style={{
              fontSize: 12, padding: "4px 12px", border: "1px solid var(--border)",
              borderRadius: 7, background: "var(--bg)", color: "var(--navy)", fontWeight: 600, cursor: "pointer",
            }}>Editar</button>
          )}
        </div>
        {editingUrl ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={flowUrl} onChange={(e) => setFlowUrl(e.target.value)} placeholder="https://xxxx.ngrok-free.app/webhook/api/v1" style={{ ...inputStyle, fontFamily: "monospace", flex: 1 }} />
            <button onClick={() => setEditingUrl(false)} style={{ fontSize: 12, padding: "6px 12px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveFlowUrl} disabled={savingUrl} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 16px", background: "var(--navy)", color: "#fff", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600 }}>
              <Save size={13} /> {savingUrl ? "Salvando..." : "Salvar"}
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 12, fontFamily: "monospace", color: "var(--muted)", background: "var(--bg)", padding: "8px 12px", borderRadius: 8, wordBreak: "break-all" }}>
            {flowUrl || "—"}
          </p>
        )}
      </div>

      {/* Equipes monitoradas */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Users size={14} color="var(--sage)" />
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>Equipes monitoradas</p>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>({teams.filter((t) => t.isActive).length}/{teams.length} ativas)</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => toggleTeam(team.id, !team.isActive)}
              disabled={togglingTeam === team.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 8,
                border: `1px solid ${team.isActive ? "rgba(120,191,165,0.3)" : "var(--border)"}`,
                background: team.isActive ? "rgba(120,191,165,0.07)" : "var(--bg)",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{
                width: 32, height: 18, borderRadius: 9,
                background: team.isActive ? "var(--sage)" : "var(--border)",
                position: "relative", flexShrink: 0, transition: "background 0.2s",
              }}>
                <div style={{
                  position: "absolute", top: 2, left: team.isActive ? 14 : 2,
                  width: 14, height: 14, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: team.isActive ? 600 : 400, color: team.isActive ? "var(--navy)" : "var(--muted)" }}>
                {team.teamName}
              </span>
              {togglingTeam === team.id && <RefreshCw size={12} style={{ marginLeft: "auto", color: "var(--sage)", animation: "spin 1s linear infinite" }} />}
            </button>
          ))}
        </div>
        {teams.filter((t) => t.isActive).length === 0 && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>Nenhuma equipe ativa. Ative as equipes que deseja monitorar.</p>
        )}
      </div>

      {/* Actions row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {apis.length === 0 && !loading && (
          <button onClick={seedDefaults} style={{ fontSize: 12, padding: "6px 14px", background: "var(--navy)", color: "#fff", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>
            Importar endpoints padrão
          </button>
        )}
        <button onClick={() => setShowForm((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--navy)", fontWeight: 600, cursor: "pointer" }}>
          <Plus size={13} /> Adicionar endpoint
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>Novo endpoint</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input placeholder="Nome (ex: KPIs DevBI)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <input placeholder="Path (ex: /devbi/kpis)" value={form.path} onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))} style={inputStyle} />
            <input placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ fontSize: 12, padding: "6px 12px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>Cancelar</button>
            <button onClick={addApi} style={{ fontSize: 12, padding: "6px 16px", background: "var(--navy)", color: "#fff", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>Salvar</button>
          </div>
        </div>
      )}

      {/* Endpoints table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg)" }}>
              {["Endpoint", "Path", "Descrição", "Status", "Última verificação", "Ação"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: h === "Endpoint" || h === "Path" || h === "Descrição" ? "left" : "center", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Carregando...</td></tr>}
            {!loading && apis.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Nenhum endpoint cadastrado. Clique em &quot;Importar endpoints padrão&quot; para começar.</td></tr>
            )}
            {apis.map((api) => (
              <tr key={api.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", fontWeight: 600, color: "var(--navy)" }}>{api.name}</td>
                <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{api.path}</td>
                <td style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 11 }}>{api.description ?? "—"}</td>
                <td style={{ padding: "10px 16px", textAlign: "center" }}>
                  {api.lastStatus === "healthy" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "rgba(120,191,165,0.14)", color: "#2E8A6E" }}>Healthy</span>
                  ) : api.lastStatus === "unhealthy" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "rgba(220,53,69,0.10)", color: "#DC3545" }}>Unhealthy</span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "rgba(138,143,175,0.12)", color: "var(--muted)" }}>Pendente</span>
                  )}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "center", color: "var(--muted)", fontSize: 11 }}>
                  {api.lastChecked ? new Date(api.lastChecked).toLocaleString("pt-BR") : "—"}
                </td>
                <td style={{ padding: "10px 16px", textAlign: "center" }}>
                  <button
                    onClick={() => pingApi(api.id)}
                    disabled={pinging === api.id}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--bg)", color: "var(--navy)", fontWeight: 600, cursor: "pointer", opacity: pinging === api.id ? 0.6 : 1 }}
                  >
                    <RefreshCw size={11} style={pinging === api.id ? { animation: "spin 1s linear infinite" } : {}} />
                    Verificar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
