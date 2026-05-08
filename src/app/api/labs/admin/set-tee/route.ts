import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Admin: setea tee de un hoyo (debug rápido).
// Body: { courseId, hole, teeLat, teeLng }
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { courseId, hole, teeLat, teeLng } = body as {
    courseId: string;
    hole: number;
    teeLat: number;
    teeLng: number;
  };
  const updated = await prisma.courseMapPoint.update({
    where: { courseId_holeNumber: { courseId, holeNumber: hole } },
    data: { teeLat, teeLng },
  });
  return NextResponse.json(updated);
}
