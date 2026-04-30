import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/canchas/:id/hcp?index=8.9&modality=MEDAL&tee=BLANCO&category=CAB
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const idxStr = sp.get("index");
  const modality = sp.get("modality") ?? "MEDAL";
  const tee = sp.get("tee") ?? "BLANCO";
  const category = sp.get("category") ?? "CAB";

  if (idxStr == null) {
    return NextResponse.json({ error: "missing index" }, { status: 400 });
  }
  const idx = parseFloat(idxStr);
  if (isNaN(idx)) return NextResponse.json({ error: "invalid index" }, { status: 400 });

  const range = await prisma.courseHcpRange.findFirst({
    where: {
      courseId: id,
      modality,
      tee,
      category,
      indexFrom: { lte: idx },
      indexTo: { gte: idx },
    },
  });

  if (!range) {
    return NextResponse.json({ courseHcp: null, found: false });
  }
  return NextResponse.json({ courseHcp: range.courseHcp, found: true, range });
}
