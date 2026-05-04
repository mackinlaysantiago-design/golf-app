import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const shot = await prisma.rangeShot.findUnique({ where: { id } });
  if (!shot) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.rangeShot.delete({ where: { id } });
  // Invalidar el AI analysis (los promedios cambian)
  await prisma.rangeSession.update({
    where: { id: shot.sessionId },
    data: { aiAnalysis: null },
  });
  return NextResponse.json({ ok: true });
}
