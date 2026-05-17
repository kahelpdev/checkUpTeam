import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const equipe = searchParams.get("equipe") || undefined;
  const nome = searchParams.get("nome") || undefined;
  const dataInicio = searchParams.get("dataInicio");
  const dataFim = searchParams.get("dataFim");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
  const skip = (page - 1) * limit;

  const where = {
    ...(equipe && { equipe }),
    ...(nome && { nome: { contains: nome, mode: "insensitive" as const } }),
    ...(dataInicio && dataFim && {
      dataDia: {
        gte: new Date(dataInicio),
        lte: new Date(`${dataFim}T23:59:59`),
      },
    }),
  };

  const [reports, total] = await Promise.all([
    prisma.relatorioDiario.findMany({
      where,
      orderBy: { dataDia: "desc" },
      skip,
      take: limit,
    }),
    prisma.relatorioDiario.count({ where }),
  ]);

  return NextResponse.json({ reports, total, page, limit });
}
