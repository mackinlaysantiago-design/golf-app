import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Agrega RangeShot.club y lo popula desde RangeSession.club para los existentes.
export async function POST() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RangeShot" ADD COLUMN IF NOT EXISTS "club" TEXT;`,
  );
  // Popular shots que no tienen club seteado, copiando de la sesión
  await prisma.$executeRawUnsafe(`
    UPDATE "RangeShot" rs
    SET "club" = rsess."club"
    FROM "RangeSession" rsess
    WHERE rs."sessionId" = rsess."id" AND rs."club" IS NULL;
  `);
  return NextResponse.json({ ok: true });
}
