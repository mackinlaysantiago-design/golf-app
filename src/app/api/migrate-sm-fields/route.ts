import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Migration idempotente para los campos de The Scoring Method Level 2.
export async function POST() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RoundHole" ADD COLUMN IF NOT EXISTS "penaltyStrokes" INTEGER;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RoundHole" ADD COLUMN IF NOT EXISTS "keysBroken" JSONB;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "bestParts" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "bestShot" TEXT;`,
  );
  return NextResponse.json({ ok: true });
}
