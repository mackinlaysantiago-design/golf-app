import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const RoundSchema = z.object({
  courseId: z.string().min(1),
  date: z.string(), // ISO
  mode: z.enum(["SOLO", "TWO_P", "THREE_P", "FOUR_P"]),
  modality: z.string().default("MEDAL"),
  tee: z.string().default("BLANCO"),
  holesPlayed: z.union([z.literal(9), z.literal(18)]).default(18),
  nineWhich: z.enum(["IDA", "VUELTA"]).nullable().optional(),
  enterSzYds: z.number().int().min(0).max(300),
  downInSzStrokes: z.number().int().min(1).max(10),
  onePuttCircleFt: z.number().int().min(1).max(30),
  twoPuttCircleYds: z.number().int().min(1).max(50),
  pairs: z.array(z.array(z.string())).optional(),
  notes: z.string().nullable().optional(),
  bets: z
    .array(
      z.object({
        modality: z.string(),
        amount: z.number().nonnegative(),
        currency: z.string().default("ARS"),
      }),
    )
    .optional(),
  players: z
    .array(
      z.object({
        playerId: z.string(),
        hcpIndex: z.number().nullable().optional(),
        courseHcp: z.number().int().nullable().optional(),
        position: z.number().int().min(1).max(4),
      }),
    )
    .min(1)
    .max(4),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RoundSchema.parse(body);

  // Lookup CH por modalidad para cada jugador (Medal Total, Stableford, Ida/Vuelta, etc)
  const MODALITIES = ["MEDAL", "STABLEFORD", "MEDAL_IDA", "MEDAL_VUELTA", "STABLEFORD_IDA", "STABLEFORD_VUELTA", "MATCH", "MATCH_IDA", "MATCH_VUELTA"];
  const playersWithChs = await Promise.all(
    parsed.players.map(async (p) => {
      if (p.hcpIndex == null) return { ...p, modalityHcps: null };
      const chs: Record<string, number> = {};
      for (const mod of MODALITIES) {
        const range = await prisma.courseHcpRange.findFirst({
          where: {
            courseId: parsed.courseId,
            modality: mod,
            tee: parsed.tee,
            indexFrom: { lte: p.hcpIndex },
            indexTo: { gte: p.hcpIndex },
          },
        });
        if (range) chs[mod] = range.courseHcp;
      }
      return { ...p, modalityHcps: Object.keys(chs).length > 0 ? chs : null };
    }),
  );

  const round = await prisma.round.create({
    data: {
      courseId: parsed.courseId,
      date: new Date(parsed.date),
      mode: parsed.mode,
      modality: parsed.modality,
      tee: parsed.tee,
      holesPlayed: parsed.holesPlayed,
      nineWhich: parsed.holesPlayed === 9 ? (parsed.nineWhich ?? "IDA") : null,
      enterSzYds: parsed.enterSzYds,
      downInSzStrokes: parsed.downInSzStrokes,
      onePuttCircleFt: parsed.onePuttCircleFt,
      twoPuttCircleYds: parsed.twoPuttCircleYds,
      pairs: parsed.pairs ? JSON.stringify(parsed.pairs) : null,
      notes: parsed.notes ?? null,
      players: {
        create: playersWithChs.map((p) => ({
          playerId: p.playerId,
          hcpIndex: p.hcpIndex ?? null,
          courseHcp: p.courseHcp ?? null,
          modalityHcps: p.modalityHcps ?? undefined,
          position: p.position,
        })),
      },
      bets: parsed.bets && parsed.bets.length > 0
        ? {
            create: parsed.bets.map((b) => ({
              modality: b.modality,
              amount: b.amount,
              currency: b.currency ?? "ARS",
            })),
          }
        : undefined,
    },
    include: { players: true, bets: true },
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
