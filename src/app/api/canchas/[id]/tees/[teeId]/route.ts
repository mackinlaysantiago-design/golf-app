import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; teeId: string }> },
) {
  const { id, teeId } = await params;
  const tee = await prisma.courseTee.findUnique({ where: { id: teeId } });
  if (!tee || tee.courseId !== id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.courseTee.delete({ where: { id: teeId } });
  return NextResponse.json({ ok: true });
}
