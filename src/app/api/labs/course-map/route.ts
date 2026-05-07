import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/labs/course-map?courseId=X — lista puntos de un curso
export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "missing courseId" }, { status: 400 });
  }
  const points = await prisma.courseMapPoint.findMany({
    where: { courseId },
    orderBy: { holeNumber: "asc" },
  });
  return NextResponse.json(points);
}
