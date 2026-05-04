import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Migration idempotente: tabla PracticeTask
export async function POST() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PracticeTask" (
      "id" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      "roundId" TEXT,
      "rangeSessionId" TEXT,
      "code" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "description" TEXT,
      "timesToAchieve" INTEGER NOT NULL,
      "timesCompleted" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "doneAt" TIMESTAMP(3),
      CONSTRAINT "PracticeTask_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PracticeTask_status_idx" ON "PracticeTask"("status");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PracticeTask_roundId_idx" ON "PracticeTask"("roundId");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PracticeTask_rangeSessionId_idx" ON "PracticeTask"("rangeSessionId");`,
  );
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "PracticeTask" ADD CONSTRAINT "PracticeTask_roundId_fkey"
        FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "PracticeTask" ADD CONSTRAINT "PracticeTask_rangeSessionId_fkey"
        FOREIGN KEY ("rangeSessionId") REFERENCES "RangeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  return NextResponse.json({ ok: true });
}
