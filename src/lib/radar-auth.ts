import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME, JwtPayload } from "@/lib/jwt";

export type RadarAuthResult =
  | { ok: true; user: JwtPayload }
  | { ok: false; response: NextResponse };

async function getUser(req: NextRequest): Promise<JwtPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
}

export async function requireAdmin(req: NextRequest): Promise<RadarAuthResult> {
  const user = await getUser(req);
  if (!user) return { ok: false, response: unauthorized() };
  if (user.role !== "admin") return { ok: false, response: forbidden() };
  return { ok: true, user };
}

export async function requireLider(req: NextRequest): Promise<RadarAuthResult> {
  const user = await getUser(req);
  if (!user) return { ok: false, response: unauthorized() };
  if (user.role !== "admin" && user.role !== "lider") return { ok: false, response: forbidden() };
  return { ok: true, user };
}
