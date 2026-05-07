import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Migration idempotente: agrega los 4 campos DECADE a RoundHole
export async function POST() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RoundHole" ADD COLUMN IF NOT EXISTS "pinColor" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RoundHole" ADD COLUMN IF NOT EXISTS "dangerSide" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RoundHole" ADD COLUMN IF NOT EXISTS "aimedAtCenter" BOOLEAN;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RoundHole" ADD COLUMN IF NOT EXISTS "recoveryMode" BOOLEAN;`,
  );
  return NextResponse.json({ ok: true });
}
