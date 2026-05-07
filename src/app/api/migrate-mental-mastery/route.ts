import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Migration idempotente Sprint 4: Mental Mastery completa
export async function POST() {
  // Player — Identidad + Rutinas
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "limitingBelief" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "empoweringBelief" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "admiredGolfer" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "beDoHave" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "preShotRoutine" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "postShotRoutine" TEXT;`,
  );

  // Round — compromiso + emoción
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "commitmentScore" INTEGER;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "emotionPlayed" TEXT;`,
  );

  // MentalNote table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MentalNote" (
      "id" TEXT NOT NULL,
      "playerId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "context" TEXT,
      "contextId" TEXT,
      "content" TEXT NOT NULL,
      "positive" BOOLEAN,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MentalNote_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "MentalNote_playerId_idx" ON "MentalNote"("playerId");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "MentalNote_type_idx" ON "MentalNote"("type");`,
  );
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "MentalNote" ADD CONSTRAINT "MentalNote_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  return NextResponse.json({ ok: true });
}
