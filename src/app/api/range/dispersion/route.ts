/**
 * POST /api/range/dispersion
 *   Body: { csv: string } — pega el CSV de dispersión (output de tu chat de FlightScope).
 *   Parsea y upserta cada palo en ClubDispersion (1 row por palo).
 *
 * GET /api/range/dispersion
 *   Devuelve la lista actual de dispersiones, ordenadas por carry desc.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDispersionCsv } from "@/lib/club-dispersion";

export async function GET() {
  const rows = await prisma.clubDispersion.findMany({
    orderBy: { carryP50: "desc" },
  });
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { csv?: string };
  if (!body.csv || typeof body.csv !== "string") {
    return NextResponse.json({ error: "Falta el campo 'csv'" }, { status: 400 });
  }

  const parsed = parseDispersionCsv(body.csv);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let upserted = 0;
  for (const row of parsed.rows) {
    await prisma.clubDispersion.upsert({
      where: { club: row.club },
      create: row,
      update: row,
    });
    upserted++;
  }

  return NextResponse.json({ ok: true, upserted });
}
