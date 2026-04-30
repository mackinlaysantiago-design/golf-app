import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const PlayerSchema = z.object({
  name: z.string().min(1),
  hcpIndex: z.number().nullable().optional(),
  isMe: z.boolean().optional(),
});

export async function GET() {
  const players = await prisma.player.findMany({
    orderBy: [{ isMe: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(players);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = PlayerSchema.parse(body);

  // si isMe=true, des-marcar otros
  if (parsed.isMe) {
    await prisma.player.updateMany({ where: { isMe: true }, data: { isMe: false } });
  }

  const player = await prisma.player.create({ data: parsed });
  return NextResponse.json(player, { status: 201 });
}
