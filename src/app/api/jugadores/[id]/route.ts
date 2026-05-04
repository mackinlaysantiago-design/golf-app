import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(player);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  if (body.isMe === true) {
    await prisma.player.updateMany({ where: { isMe: true }, data: { isMe: false } });
  }
  const player = await prisma.player.update({ where: { id }, data: body });
  return NextResponse.json(player);
}

// DELETE: si el jugador tiene rondas, devuelve 409 a menos que se mande ?force=true,
// en cuyo caso hace cascade manual (borra RoundPlayers + sus RoundHoles).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";

  const rpCount = await prisma.roundPlayer.count({ where: { playerId: id } });

  if (rpCount > 0 && !force) {
    return NextResponse.json(
      {
        error: "El jugador tiene rondas asociadas",
        roundsCount: rpCount,
        canForce: true,
      },
      { status: 409 },
    );
  }

  if (rpCount > 0 && force) {
    // Cascade manual: RoundHoles via RoundPlayer (onDelete: Cascade ya configurado)
    await prisma.roundPlayer.deleteMany({ where: { playerId: id } });
  }

  await prisma.player.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
