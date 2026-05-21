import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/jwt";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

// Endpoints chamados por cron/n8n externos que usam autenticação própria
// (header X-Backfill-Secret, etc.) ou são intencionalmente abertos.
const API_PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/embeddings/backfill",
  "/api/ingest",
];

const ADMIN_ONLY_PATHS = ["/users"];
const LIDER_ONLY_PATHS = ["/api-manager", "/reprova"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (API_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { role } = payload;

  if (ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p)) && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (LIDER_ONLY_PATHS.some((p) => pathname.startsWith(p)) && role === "viewer") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
