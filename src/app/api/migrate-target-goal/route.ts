import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Migration idempotente: agrega RoundHole.targetGoal
export async function POST() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RoundHole" ADD COLUMN IF NOT EXISTS "targetGoal" TEXT;`,
  );
  return NextResponse.json({ ok: true });
}
