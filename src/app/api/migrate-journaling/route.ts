import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Migration idempotente Sprint 5: Journaling estructurado
export async function POST() {
  // Round
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "problemArea" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "emotionalStateBefore" JSONB;`,
  );
  // RoundHole
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RoundHole" ADD COLUMN IF NOT EXISTS "puttAnalysis" TEXT;`,
  );
  return NextResponse.json({ ok: true });
}
