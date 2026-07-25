// Lista los tiros de un hoyo (para pintarlos en el mapa).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const roundHoleId = req.nextUrl.searchParams.get("roundHoleId");
  if (!roundHoleId) {
    return NextResponse.json({ error: "falta roundHoleId" }, { status: 400 });
  }
  const shots = await prisma.roundShot.findMany({
    where: { roundHoleId },
    orderBy: { shotNumber: "asc" },
    select: {
      id: true,
      shotNumber: true,
      fromLat: true,
      fromLng: true,
      club: true,
      result: true,
      distanceToTargetYds: true,
    },
  });
  return NextResponse.json({ shots });
}

// Crear un tiro "solo posición" tocando el mapa (sin voz). shotNumber = siguiente del hoyo.
export async function POST(req: NextRequest) {
  try {
    const { roundHoleId, lat, lng } = (await req.json()) as {
      roundHoleId?: string;
      lat?: number;
      lng?: number;
    };
    if (!roundHoleId || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "faltan roundHoleId/lat/lng" }, { status: 400 });
    }
    const last = await prisma.roundShot.aggregate({
      where: { roundHoleId },
      _max: { shotNumber: true },
    });
    const shotNumber = (last._max.shotNumber ?? 0) + 1;
    const shot = await prisma.roundShot.create({
      data: { roundHoleId, shotNumber, fromLat: lat, fromLng: lng },
      select: {
        id: true,
        shotNumber: true,
        fromLat: true,
        fromLng: true,
        club: true,
        result: true,
        distanceToTargetYds: true,
      },
    });
    return NextResponse.json({ shot });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
