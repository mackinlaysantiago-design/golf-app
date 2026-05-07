import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Migration idempotente: tabla CourseMapPoint para coords GPS de greens
export async function POST() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CourseMapPoint" (
      "id" TEXT NOT NULL,
      "courseId" TEXT NOT NULL,
      "holeNumber" INTEGER NOT NULL,
      "frontLat" DOUBLE PRECISION,
      "frontLng" DOUBLE PRECISION,
      "centerLat" DOUBLE PRECISION,
      "centerLng" DOUBLE PRECISION,
      "backLat" DOUBLE PRECISION,
      "backLng" DOUBLE PRECISION,
      "notes" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CourseMapPoint_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CourseMapPoint_courseId_holeNumber_key"
      ON "CourseMapPoint"("courseId", "holeNumber");
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "CourseMapPoint" ADD CONSTRAINT "CourseMapPoint_courseId_fkey"
        FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  return NextResponse.json({ ok: true });
}
