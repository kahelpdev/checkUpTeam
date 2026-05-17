import Link from "next/link";

interface AlertBannerProps {
  message: string;
  href?: string;
  linkLabel?: string;
}

export function AlertBanner({ message, href, linkLabel = "Ver detalhes →" }: AlertBannerProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "rgba(239, 68, 68, 0.06)",
      border: "1px solid rgba(239, 68, 68, 0.20)",
      borderLeft: "3px solid var(--danger)",
      borderRadius: 10, padding: "12px 18px",
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: "var(--danger)", flexShrink: 0,
        boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.18)",
        animation: "pulse-soft 2s ease-in-out infinite",
      }} />
      <p style={{ fontSize: 12, color: "var(--danger-text)", fontWeight: 500 }}
        dangerouslySetInnerHTML={{ __html: message }}
      />
      {href && (
        <Link href={href} style={{
          marginLeft: "auto", fontSize: 11,
          color: "var(--danger-text)", fontWeight: 700, whiteSpace: "nowrap",
          textDecoration: "none", padding: "3px 8px",
          background: "var(--danger-dim)", borderRadius: 6,
        }}>
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
