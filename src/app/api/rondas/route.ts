import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const RoundSchema = z.object({
  courseId: z.string().min(1),
  date: z.string(), // ISO
  mode: z.enum(["SOLO", "TWO_P", "THREE_P", "FOUR_P"]),
  enterSzYds: z.number().int().min(1).max(300),
  downInSzStrokes: z.number().int().min(1).max(10),
  onePuttCircleFt: z.number().int().min(1).max(30),
  twoPuttCircleYds: z.number().int().min(1).max(50),
  pairs: z.array(z.array(z.string())).optional(),
  notes: z.string().nullable().optional(),
  players: z
    .array(
      z.object({
        playerId: z.string(),
        hcpIndex: z.number().nullable().optional(),
        position: z.number().int().min(1).max(4),
      }),
    )
    .min(1)
    .max(4),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RoundSchema.parse(body);

  const round = await prisma.round.create({
    data: {
      courseId: parsed.courseId,
      date: new Date(parsed.date),
      mode: parsed.mode,
      enterSzYds: parsed.enterSzYds,
      downInSzStrokes: parsed.downInSzStrokes,
      onePuttCircleFt: parsed.onePuttCircleFt,
      twoPuttCircleYds: parsed.twoPuttCircleYds,
      pairs: parsed.pairs ? JSON.stringify(parsed.pairs) : null,
      notes: parsed.notes ?? null,
      players: {
        create: parsed.players.map((p) => ({
          playerId: p.playerId,
          hcpIndex: p.hcpIndex ?? null,
          position: p.position,
        })),
      },
    },
    include: { players: true },
  });

  return NextResponse.json(round, { status: 201 });
}

export async function GET() {
  const rounds = await prisma.round.findMany({
    orderBy: { date: "desc" },
    include: { course: true, players: { include: { player: true } } },
  });
  return NextResponse.json(rounds);
}
