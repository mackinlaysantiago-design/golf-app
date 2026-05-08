import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Debug: lista CourseMapPoint con todas las coords cargadas por hoyo.
export const dynamic = "force-dynamic";

export async function GET() {
  const courses = await prisma.course.findMany({
    include: {
      mapPoints: { orderBy: { holeNumber: "asc" } },
    },
  });
  const out = courses.map((c) => ({
    courseId: c.id,
    name: c.name,
    holes: c.mapPoints.map((p) => ({
      n: p.holeNumber,
      tee: p.teeLat != null && p.teeLng != null
        ? [p.teeLat, p.teeLng]
        : null,
      front: p.frontLat != null && p.frontLng != null
        ? [p.frontLat, p.frontLng]
        : null,
      center: p.centerLat != null && p.centerLng != null
        ? [p.centerLat, p.centerLng]
        : null,
      back: p.backLat != null && p.backLng != null
        ? [p.backLat, p.backLng]
        : null,
    })),
  }));
  return NextResponse.json(out);
}
