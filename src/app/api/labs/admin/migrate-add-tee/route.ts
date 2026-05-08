import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// One-shot migration endpoint: agrega columnas teeLat/teeLng a CourseMapPoint.
// Idempotente (IF NOT EXISTS) — call multiple times sin riesgo. Eliminar
// este archivo una vez aplicado en prod.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CourseMapPoint" ADD COLUMN IF NOT EXISTS "teeLat" DOUBLE PRECISION`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CourseMapPoint" ADD COLUMN IF NOT EXISTS "teeLng" DOUBLE PRECISION`,
    );
    // Verificar columnas resultantes
    const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'CourseMapPoint' AND column_name IN ('teeLat', 'teeLng')`,
    );
    return NextResponse.json({
      ok: true,
      columnsAdded: cols.map((c) => c.column_name),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
