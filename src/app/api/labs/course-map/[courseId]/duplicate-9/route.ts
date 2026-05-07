import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/labs/course-map/[courseId]/duplicate-9
// Copia las coords de los hoyos 1-9 a los hoyos 10-18 (caso Lucila:
// misma calle/green, distinta salida).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const ida = await prisma.courseMapPoint.findMany({
    where: { courseId, holeNumber: { gte: 1, lte: 9 } },
  });
  if (ida.length === 0) {
    return NextResponse.json(
      { error: "no hay coords cargadas en hoyos 1-9" },
      { status: 400 },
    );
  }

  let copied = 0;
  for (const src of ida) {
    const targetHole = src.holeNumber + 9;
    await prisma.courseMapPoint.upsert({
      where: {
        courseId_holeNumber: { courseId, holeNumber: targetHole },
      },
      create: {
        courseId,
        holeNumber: targetHole,
        frontLat: src.frontLat,
        frontLng: src.frontLng,
        centerLat: src.centerLat,
        centerLng: src.centerLng,
        backLat: src.backLat,
        backLng: src.backLng,
        notes: src.notes,
      },
      update: {
        frontLat: src.frontLat,
        frontLng: src.frontLng,
        centerLat: src.centerLat,
        centerLng: src.centerLng,
        backLat: src.backLat,
        backLng: src.backLng,
        notes: src.notes,
      },
    });
    copied++;
  }
  return NextResponse.json({ ok: true, copied });
}
