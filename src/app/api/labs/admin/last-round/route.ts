import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = await prisma.round.findFirst({
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      mode: true,
      holesPlayed: true,
      nineWhich: true,
      bets: { select: { modality: true, amount: true } },
      players: { select: { player: { select: { name: true } } } },
    },
  });
  return NextResponse.json(r);
}
