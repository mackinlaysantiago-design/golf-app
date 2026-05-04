import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// One-shot migration: agrega los 4 campos de niveles SM al Player.
// Idempotente — usa IF NOT EXISTS.
export async function POST() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "enterSzYds" INTEGER NOT NULL DEFAULT 50;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "downInSzStrokes" INTEGER NOT NULL DEFAULT 3;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "onePuttCircleFt" INTEGER NOT NULL DEFAULT 3;`,
  );
  // Default cambiado de 6 a 3. Aplicar también a la columna si ya existía
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ALTER COLUMN "onePuttCircleFt" SET DEFAULT 3;`,
  );
  // Migrar Players que tenían el viejo default
  await prisma.$executeRawUnsafe(
    `UPDATE "Player" SET "onePuttCircleFt" = 3 WHERE "onePuttCircleFt" = 6;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "twoPuttCircleYds" INTEGER NOT NULL DEFAULT 20;`,
  );

  return NextResponse.json({ ok: true });
}
