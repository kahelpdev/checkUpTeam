"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { RelatorioFilters } from "@/types/relatorio";

interface Message {
  role: "user" | "ai";
  content: string;
}

interface ModelOption {
  name: string;
  displayName: string;
  description?: string;
}

interface Props {
  filters: RelatorioFilters;
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const MODEL_STORAGE_KEY = "checkupteam.aiModel";

export function AiQueryPanel({ filters }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(MODEL_STORAGE_KEY) : null;
    if (saved) setModel(saved);

    fetch("/api/relatorios/models")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.models)) setModels(data.models);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleModelChange(value: string) {
    setModel(value);
    if (typeof window !== "undefined") localStorage.setItem(MODEL_STORAGE_KEY, value);
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const res = await fetch("/api/relatorios/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          model,
          equipe: filters.equipe || undefined,
          nome: filters.nome || undefined,
          dataInicio: filters.dataInicio || undefined,
          dataFim: filters.dataFim || undefined,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.answer || data.error || "Sem resposta." },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "Erro ao conectar com a IA." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 16, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
    }}>
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "var(--primary-dim)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Bot size={14} color="var(--primary)" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Assistente IA</p>
          <p style={{ fontSize: 11, color: "var(--muted)" }}>
            Pergunte sobre os relatórios
            {filters.equipe && ` da equipe ${filters.equipe}`}
            {filters.dataInicio && ` a partir de ${filters.dataInicio}`}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)" }}>Modelo</label>
          <select
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: 8,
              border: "1px solid var(--border)", fontSize: 11,
              background: "var(--surface-2)", color: "var(--text)",
              outline: "none", cursor: "pointer", minWidth: 200,
            }}
          >
            {models.length === 0 ? (
              <option value={model}>{model}</option>
            ) : (
              models.map((m) => (
                <option key={m.name} value={m.name} title={m.description}>
                  {m.displayName} ({m.name})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div style={{ height: 280, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", marginTop: 80 }}>
            Ex: &quot;Quais impedimentos o Flávio teve no dia 10?&quot; · &quot;Quem fez hora extra essa semana?&quot;
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "ai" && (
              <div style={{
                width: 24, height: 24, borderRadius: 6, background: "var(--primary-dim)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
              }}>
                <Bot size={12} color="var(--primary)" />
              </div>
            )}
            <div style={{
              maxWidth: "80%", padding: "8px 12px", borderRadius: 10,
              background: m.role === "user" ? "var(--primary)" : "var(--surface-2)",
              border: m.role === "ai" ? "1px solid var(--border)" : "none",
              fontSize: 12, color: m.role === "user" ? "#fff" : "var(--text)",
              lineHeight: 1.6, whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
            {m.role === "user" && (
              <div style={{
                width: 24, height: 24, borderRadius: 6, background: "var(--primary)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
              }}>
                <User size={12} color="#fff" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, background: "var(--primary-dim)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Bot size={12} color="var(--primary)" />
            </div>
            <div style={{
              padding: "8px 12px", borderRadius: 10,
              background: "var(--surface-2)", border: "1px solid var(--border)",
              fontSize: 12, color: "var(--muted)",
            }}>
              Analisando relatórios...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Faça uma pergunta sobre os relatórios..."
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 8,
            border: "1px solid var(--border)", fontSize: 12,
            background: "var(--surface-2)", color: "var(--text)", outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            padding: "8px 14px", borderRadius: 8,
            background: input.trim() && !loading ? "var(--primary)" : "var(--border)",
            border: "none",
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", transition: "all 0.15s",
          }}
        >
          <Send size={13} color={input.trim() && !loading ? "#fff" : "var(--muted)"} />
        </button>
      </div>
    </div>
  );
}
