import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const email = process.env.ADMIN_EMAIL || "admin@checkupteam.com";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD environment variable is required for seed");
  }
  const name = process.env.ADMIN_NAME || "Administrador";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin já existe: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({ data: { email, passwordHash, name, role: "admin" } });
    console.log(`Admin criado: ${email}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
