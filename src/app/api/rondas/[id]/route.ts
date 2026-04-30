import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      course: { include: { holes: { orderBy: { number: "asc" } } } },
      players: {
        orderBy: { position: "asc" },
        include: { player: true, holes: true },
      },
    },
  });
  if (!round) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(round);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.round.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
