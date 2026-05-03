import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const TeeSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("CAB"),
  slopeRating: z.number().int().min(50).max(170),
  courseRating: z.number().min(50).max(85),
  parTotal: z.number().int().min(54).max(80),
  slopeIda: z.number().int().nullable().optional(),
  courseRatingIda: z.number().nullable().optional(),
  parIda: z.number().int().nullable().optional(),
  slopeVuelta: z.number().int().nullable().optional(),
  courseRatingVuelta: z.number().nullable().optional(),
  parVuelta: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tees = await prisma.courseTee.findMany({
    where: { courseId: id },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(tees);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = TeeSchema.parse(body);

  // Upsert por (courseId, name, category)
  const tee = await prisma.courseTee.upsert({
    where: {
      courseId_name_category: {
        courseId: id,
        name: parsed.name,
        category: parsed.category,
      },
    },
    create: {
      courseId: id,
      name: parsed.name,
      category: parsed.category,
      slopeRating: parsed.slopeRating,
      courseRating: parsed.courseRating,
      parTotal: parsed.parTotal,
      slopeIda: parsed.slopeIda ?? null,
      courseRatingIda: parsed.courseRatingIda ?? null,
      parIda: parsed.parIda ?? null,
      slopeVuelta: parsed.slopeVuelta ?? null,
      courseRatingVuelta: parsed.courseRatingVuelta ?? null,
      parVuelta: parsed.parVuelta ?? null,
      notes: parsed.notes ?? null,
    },
    update: {
      slopeRating: parsed.slopeRating,
      courseRating: parsed.courseRating,
      parTotal: parsed.parTotal,
      slopeIda: parsed.slopeIda ?? null,
      courseRatingIda: parsed.courseRatingIda ?? null,
      parIda: parsed.parIda ?? null,
      slopeVuelta: parsed.slopeVuelta ?? null,
      courseRatingVuelta: parsed.courseRatingVuelta ?? null,
      parVuelta: parsed.parVuelta ?? null,
      notes: parsed.notes ?? null,
    },
  });
  return NextResponse.json(tee, { status: 201 });
}
