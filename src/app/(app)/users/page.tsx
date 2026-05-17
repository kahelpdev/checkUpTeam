"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Shield } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "lider" | "viewer";
  isActive: boolean;
  createdAt: string;
}

const ROLES = [
  { value: "admin", label: "Admin", color: "var(--danger)" },
  { value: "lider", label: "Líder", color: "var(--sage)" },
  { value: "viewer", label: "Viewer", color: "var(--muted)" },
];

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 4px rgba(36,40,115,0.05)",
};

function RoleBadge({ role }: { role: string }) {
  const r = ROLES.find((x) => x.value === role);
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
      background: `${r?.color}22`, color: r?.color, border: `1px solid ${r?.color}44`,
    }}>
      {r?.label ?? role}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "viewer" });
  const [editForm, setEditForm] = useState({ name: "", role: "viewer", isActive: true, password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    setError("");
    setSaving(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ email: "", name: "", password: "", role: "viewer" });
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Erro ao criar usuário");
    }
  }

  async function updateUser(id: string) {
    setSaving(true);
    const payload: Record<string, unknown> = { name: editForm.name, role: editForm.role, isActive: editForm.isActive };
    if (editForm.password) payload.password = editForm.password;
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) { setEditId(null); load(); }
  }

  async function deleteUser(id: string) {
    if (!confirm("Excluir este usuário?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  }

  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--navy)", marginBottom: 4 } as const;
  const inputStyle = {
    width: "100%", border: "1px solid var(--border)", borderRadius: 8,
    padding: "8px 12px", fontSize: 13, background: "var(--surface)", color: "var(--text)",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={20} color="var(--navy)" />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--navy)" }}>Gerenciar Usuários</h1>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>Controle de acesso à plataforma</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--navy)", color: "#fff", border: "none",
            borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Plus size={14} /> Novo usuário
        </button>
      </div>

      {/* Form novo usuário */}
      {showForm && (
        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Criar usuário</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Nome</label>
              <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" />
            </div>
            <div>
              <label style={labelStyle}>Senha inicial</label>
              <input type="password" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Senha" />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={createUser} disabled={saving || !form.email || !form.name || !form.password}
              style={{ background: "var(--navy)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando..." : "Criar"}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={card}>
        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Carregando...</p>
        ) : users.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Nenhum usuário cadastrado.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Nome", "E-mail", "Role", "Status", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  {editId === u.id ? (
                    <>
                      <td style={{ padding: "10px 12px" }}>
                        <input style={{ ...inputStyle, padding: "6px 10px" }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 13 }}>{u.email}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <select style={{ ...inputStyle, padding: "6px 10px" }} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <select style={{ ...inputStyle, padding: "6px 10px" }} value={editForm.isActive ? "1" : "0"} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "1" })}>
                          <option value="1">Ativo</option>
                          <option value="0">Inativo</option>
                        </select>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => updateUser(u.id)} style={{ background: "var(--sage)", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer" }}>
                            <Check size={14} color="var(--navy)" />
                          </button>
                          <button onClick={() => setEditId(null)} style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer" }}>
                            <X size={14} color="var(--muted)" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{u.name}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>{u.email}</td>
                      <td style={{ padding: "10px 12px" }}><RoleBadge role={u.role} /></td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: u.isActive ? "var(--sage)" : "var(--muted)" }}>
                          {u.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { setEditId(u.id); setEditForm({ name: u.name, role: u.role, isActive: u.isActive, password: "" }); }}
                            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", cursor: "pointer" }}>
                            <Edit2 size={13} color="var(--navy)" />
                          </button>
                          <button onClick={() => deleteUser(u.id)}
                            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", cursor: "pointer" }}>
                            <Trash2 size={13} color="var(--danger)" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
