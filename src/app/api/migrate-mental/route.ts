import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Migration idempotente: thermostat en Player + tabla VisualizationSession
export async function POST() {
  // Player thermostat fields
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "scoreThermostatMin" INTEGER;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "scoreThermostatMax" INTEGER;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "scoreDesired" INTEGER;`,
  );

  // VisualizationSession table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VisualizationSession" (
      "id" TEXT NOT NULL,
      "playerId" TEXT NOT NULL,
      "roundId" TEXT,
      "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "score" INTEGER,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VisualizationSession_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "VisualizationSession_playerId_idx" ON "VisualizationSession"("playerId");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "VisualizationSession_roundId_idx" ON "VisualizationSession"("roundId");`,
  );
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "VisualizationSession" ADD CONSTRAINT "VisualizationSession_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  return NextResponse.json({ ok: true });
}
