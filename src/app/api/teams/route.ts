import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Todas as equipes conhecidas do cardsFlow
const ALL_CARDFLOW_TEAMS = [
  { teamId: "f9851672-1ca9-4a73-bab2-35b67768dfb1", teamName: "005 - Desenvolvimento" },
  { teamId: "85d08f8e-113b-4754-8a36-933e51ed9bc0", teamName: "006 - Teste/QA" },
  { teamId: "5c8dcec3-b120-4690-8635-05608260a9b5", teamName: "007 - Desenvolvimento - MERGE -> Produção" },
  { teamId: "4c34fa14-886f-4052-b088-41d929d222e9", teamName: "001 - Suporte" },
  { teamId: "2babfa59-b262-41ab-b371-45a84082d146", teamName: "002 - Analise" },
  { teamId: "fa2cadba-c8de-4bca-8ad9-79140c54dedb", teamName: "003 - DBA" },
  { teamId: "5a869dab-c3d0-4c6f-866f-add3543905fe", teamName: "004 - Infra" },
  { teamId: "3eb51618-6cea-41f6-94f7-25163d8d490e", teamName: "008 - Atualização" },
  { teamId: "a9f88c28-6053-47e6-b641-3dc32d3b13e2", teamName: "009 - Fiscal" },
  { teamId: "5739d15b-7d1c-4ddb-a013-75698d7443b4", teamName: "010 - Implantação" },
  { teamId: "87e3baca-b999-4755-9a43-4215b6f74853", teamName: "011 - Treinamento" },
  { teamId: "8d868d9b-7dbd-4488-9b54-7a9057cd16c1", teamName: "012 - Documentação" },
  { teamId: "ff6670eb-fce7-4188-ae35-d278859e5bb4", teamName: "013 - Financeiro/Comercial" },
];

export async function GET() {
  // Garante que todas as equipes existem no banco (seed automático)
  for (const t of ALL_CARDFLOW_TEAMS) {
    await prisma.teamsConfig.upsert({
      where: { teamId: t.teamId },
      update: { teamName: t.teamName },
      create: { teamId: t.teamId, teamName: t.teamName, isActive: false },
    });
  }

  const teams = await prisma.teamsConfig.findMany({
    orderBy: { teamName: "asc" },
    select: { id: true, teamId: true, teamName: true, isActive: true },
  });
  return NextResponse.json(teams);
}

export async function POST(req: Request) {
  const body = await req.json();
  const team = await prisma.teamsConfig.create({
    data: { teamId: body.teamId, teamName: body.teamName },
  });
  return NextResponse.json(team, { status: 201 });
}

// PATCH /api/teams — toggle isActive de uma equipe
export async function PATCH(req: NextRequest) {
  const { id, isActive } = await req.json();
  if (!id || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "id e isActive são obrigatórios" }, { status: 400 });
  }
  const team = await prisma.teamsConfig.update({
    where: { id },
    data: { isActive },
  });
  return NextResponse.json(team);
}
