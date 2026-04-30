import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import seedData from "@/lib/seed-data.json";

type SeedCourse = {
  name: string;
  holes: { number: number; par: number; hcpHoyo: number }[];
  incomplete?: boolean;
};

type SeedRange = {
  courseName: string;
  modality: string;
  tee: string;
  category: string;
  indexFrom: number;
  indexTo: number;
  courseHcp: number;
};

export async function POST() {
  const data = seedData as { courses: SeedCourse[]; hcpRanges: SeedRange[] };
  const result = { coursesCreated: 0, coursesSkipped: 0, hcpRangesCreated: 0 };

  for (const course of data.courses) {
    const existing = await prisma.course.findUnique({ where: { name: course.name } });
    if (existing) {
      result.coursesSkipped++;
      continue;
    }
    await prisma.course.create({
      data: {
        name: course.name,
        holes: { create: course.holes },
      },
    });
    result.coursesCreated++;
  }

  // HCP ranges (idempotent: borra existentes para esa cancha y reinsertar)
  const courseNames = Array.from(new Set(data.hcpRanges.map((r) => r.courseName)));
  for (const cn of courseNames) {
    const c = await prisma.course.findUnique({ where: { name: cn } });
    if (!c) continue;
    await prisma.courseHcpRange.deleteMany({ where: { courseId: c.id } });
    const rangesForCourse = data.hcpRanges.filter((r) => r.courseName === cn);
    await prisma.courseHcpRange.createMany({
      data: rangesForCourse.map((r) => ({
        courseId: c.id,
        modality: r.modality,
        tee: r.tee,
        category: r.category,
        indexFrom: r.indexFrom,
        indexTo: r.indexTo,
        courseHcp: r.courseHcp,
      })),
    });
    result.hcpRangesCreated += rangesForCourse.length;
  }

  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({
    info: "POST a este endpoint para cargar las 6 canchas + tabla HCP de La Lucila",
    available: {
      courses: (seedData as { courses: SeedCourse[] }).courses.map((c) => c.name),
      hcpRangesCount: (seedData as { hcpRanges: SeedRange[] }).hcpRanges.length,
    },
  });
}
