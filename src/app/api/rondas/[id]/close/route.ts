import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const round = await prisma.round.update({
    where: { id },
    data: { closedAt: new Date() },
  });
  return NextResponse.json(round);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Reabrir ronda
  const { id } = await params;
  const round = await prisma.round.update({
    where: { id },
    data: { closedAt: null },
  });
  return NextResponse.json(round);
}
