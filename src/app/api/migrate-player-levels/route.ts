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
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "onePuttCircleFt" INTEGER NOT NULL DEFAULT 6;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "twoPuttCircleYds" INTEGER NOT NULL DEFAULT 20;`,
  );

  return NextResponse.json({ ok: true });
}
