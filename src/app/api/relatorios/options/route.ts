import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [equipes, colaboradores] = await Promise.all([
    prisma.relatorioDiario.findMany({
      distinct: ["equipe"],
      select: { equipe: true },
      orderBy: { equipe: "asc" },
    }),
    prisma.relatorioDiario.findMany({
      distinct: ["nome"],
      select: { nome: true, idColaborador: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return NextResponse.json({
    equipes: equipes.map((e) => e.equipe),
    colaboradores: colaboradores.map((c) => ({ nome: c.nome, id: c.idColaborador })),
  });
}
