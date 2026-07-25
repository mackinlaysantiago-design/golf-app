// Marcar/actualizar dónde cayó un tiro en el mapa (por roundHoleId + shotNumber,
// así no hace falta el id del RoundShot en el cliente).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { roundHoleId, shotNumber, lat, lng } = (await req.json()) as {
      roundHoleId?: string;
      shotNumber?: number;
      lat?: number;
      lng?: number;
    };
    if (
      !roundHoleId ||
      typeof shotNumber !== "number" ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return NextResponse.json({ error: "faltan roundHoleId/shotNumber/lat/lng" }, { status: 400 });
    }
    const r = await prisma.roundShot.updateMany({
      where: { roundHoleId, shotNumber },
      data: { fromLat: lat, fromLng: lng },
    });
    return NextResponse.json({ updated: r.count });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
