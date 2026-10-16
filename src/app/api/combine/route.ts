import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { COMBINE_ATTEMPTS, COMBINE_TESTS, scoreAttempts, totalScore, type CombineTestType } from "@/lib/combine";

const TEST_TYPES = COMBINE_TESTS.map((t) => t.type) as [CombineTestType, ...CombineTestType[]];

async function getMe() {
  const me = await prisma.player.findFirst({ where: { isMe: true } });
  if (!me) throw new Error("no hay player isMe=true");
  return me;
}

// GET → historial de sesiones (resumen: score total + score por test)
export async function GET() {
  const me = await getMe();
  const sessions = await prisma.combineSession.findMany({
    where: { playerId: me.id },
    orderBy: { date: "desc" },
    include: { results: true },
  });

  return NextResponse.json({
    player: { id: me.id, name: me.name },
    sessions: sessions.map((s) => {
      const scores = Object.fromEntries(s.results.map((r) => [r.testType, r.score])) as Record<
        CombineTestType,
        number
      >;
      return {
        id: s.id,
        date: s.date.toISOString(),
        notes: s.notes,
        scores,
        totalScore: totalScore(scores),
      };
    }),
  });
}

const ResultSchema = z.object({
  testType: z.enum(TEST_TYPES),
  attempts: z.array(z.boolean()).length(COMBINE_ATTEMPTS),
});

const CreateSchema = z.object({
  date: z.string().optional(), // ISO; default ahora
  notes: z.string().nullable().optional(),
  results: z.array(ResultSchema).length(COMBINE_TESTS.length),
});

// POST → crea una sesión del Combine completa (los 5 tests juntos)
export async function POST(req: NextRequest) {
  const me = await getMe();
  const body = CreateSchema.parse(await req.json());

  const seenTypes = new Set(body.results.map((r) => r.testType));
  if (seenTypes.size !== COMBINE_TESTS.length) {
    return NextResponse.json(
      { error: "Faltan tests — el Combine son los 5 juntos (short putts, lag putts, chipping, wedges, driver)" },
      { status: 400 },
    );
  }

  const session = await prisma.combineSession.create({
    data: {
      playerId: me.id,
      date: body.date ? new Date(body.date) : new Date(),
      notes: body.notes ?? null,
      results: {
        create: body.results.map((r) => ({
          testType: r.testType,
          attemptsJson: r.attempts,
          score: scoreAttempts(r.attempts),
        })),
      },
    },
    include: { results: true },
  });

  return NextResponse.json({ session }, { status: 201 });
}
