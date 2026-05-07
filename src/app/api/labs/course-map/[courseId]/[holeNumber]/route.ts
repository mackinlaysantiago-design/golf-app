import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Body = z.object({
  frontLat: z.number().nullable().optional(),
  frontLng: z.number().nullable().optional(),
  centerLat: z.number().nullable().optional(),
  centerLng: z.number().nullable().optional(),
  backLat: z.number().nullable().optional(),
  backLng: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; holeNumber: string }> },
) {
  const { courseId, holeNumber } = await params;
  const hole = parseInt(holeNumber);
  if (isNaN(hole) || hole < 1 || hole > 18) {
    return NextResponse.json({ error: "invalid hole" }, { status: 400 });
  }
  const body = await req.json();
  const parsed = Body.parse(body);

  const point = await prisma.courseMapPoint.upsert({
    where: { courseId_holeNumber: { courseId, holeNumber: hole } },
    create: {
      courseId,
      holeNumber: hole,
      frontLat: parsed.frontLat ?? null,
      frontLng: parsed.frontLng ?? null,
      centerLat: parsed.centerLat ?? null,
      centerLng: parsed.centerLng ?? null,
      backLat: parsed.backLat ?? null,
      backLng: parsed.backLng ?? null,
      notes: parsed.notes ?? null,
    },
    update: {
      frontLat: parsed.frontLat ?? null,
      frontLng: parsed.frontLng ?? null,
      centerLat: parsed.centerLat ?? null,
      centerLng: parsed.centerLng ?? null,
      backLat: parsed.backLat ?? null,
      backLng: parsed.backLng ?? null,
      notes: parsed.notes ?? null,
    },
  });
  return NextResponse.json(point);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; holeNumber: string }> },
) {
  const { courseId, holeNumber } = await params;
  const hole = parseInt(holeNumber);
  await prisma.courseMapPoint.deleteMany({
    where: { courseId, holeNumber: hole },
  });
  return NextResponse.json({ ok: true });
}
