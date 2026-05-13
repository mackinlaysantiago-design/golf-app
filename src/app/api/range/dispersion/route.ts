/**
 * POST /api/range/dispersion
 *   Body: { csv: string } — pega el CSV de dispersión (output de tu chat de FlightScope).
 *   Parsea y upserta cada palo en ClubDispersion (1 row por palo).
 *
 * GET /api/range/dispersion
 *   Devuelve la lista actual de dispersiones, ordenadas por distancia desc.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDispersionCsv } from "@/lib/club-dispersion";

export async function GET() {
  const rows = await prisma.clubDispersion.findMany({
    orderBy: { carryAvgYds: "desc" },
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
      create: {
        club: row.club,
        carryAvgYds: row.carryAvgYds,
        carryDevYds: row.carryDevYds,
        lateralDevYds: row.lateralDevYds,
        lateralBiasYds: row.lateralBiasYds,
        lateralBiasDir: row.lateralBiasDir,
        ellipseLengthYds: row.ellipseLengthYds,
        ellipseWidthYds: row.ellipseWidthYds,
        sessionsCount: row.sessionsCount,
        lastUpdated: row.lastUpdated,
      },
      update: {
        carryAvgYds: row.carryAvgYds,
        carryDevYds: row.carryDevYds,
        lateralDevYds: row.lateralDevYds,
        lateralBiasYds: row.lateralBiasYds,
        lateralBiasDir: row.lateralBiasDir,
        ellipseLengthYds: row.ellipseLengthYds,
        ellipseWidthYds: row.ellipseWidthYds,
        sessionsCount: row.sessionsCount,
        lastUpdated: row.lastUpdated,
      },
    });
    upserted++;
  }

  return NextResponse.json({ ok: true, upserted });
}
