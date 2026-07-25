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
