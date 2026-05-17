import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/jwt";

async function getRole(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.role ?? null;
}

export async function GET(req: NextRequest) {
  if ((await getRole(req)) !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if ((await getRole(req)) !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { email, password, name, role } = await req.json();
  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "Campos obrigatórios: email, password, name, role" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase().trim(), passwordHash, name, role },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
