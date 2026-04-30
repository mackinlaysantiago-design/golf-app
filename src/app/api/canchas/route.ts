import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const HoleSchema = z.object({
  number: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  hcpHoyo: z.number().int().min(1).max(18),
  yards: z.number().int().nullable().optional(),
});

const CourseSchema = z.object({
  name: z.string().min(1),
  holes: z.array(HoleSchema).length(18),
});

export async function GET() {
  const courses = await prisma.course.findMany({
    include: { holes: { orderBy: { number: "asc" } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CourseSchema.parse(body);

  const course = await prisma.course.create({
    data: {
      name: parsed.name,
      holes: { create: parsed.holes },
    },
    include: { holes: true },
  });
  return NextResponse.json(course, { status: 201 });
}
