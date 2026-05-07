import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Body = z.object({
  playerId: z.string(),
  roundId: z.string().nullable().optional(),
  score: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Body.parse(body);
  const session = await prisma.visualizationSession.create({
    data: {
      playerId: parsed.playerId,
      roundId: parsed.roundId ?? null,
      score: parsed.score ?? null,
      notes: parsed.notes ?? null,
    },
  });
  return NextResponse.json(session, { status: 201 });
}

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");
  const where = playerId ? { playerId } : {};
  const sessions = await prisma.visualizationSession.findMany({
    where,
    orderBy: { date: "desc" },
    take: 20,
  });
  return NextResponse.json(sessions);
}
