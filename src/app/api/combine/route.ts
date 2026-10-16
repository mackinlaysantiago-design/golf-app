import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  COMBINE_ATTEMPTS,
  COMBINE_TEST_ORDER,
  scoreForTest,
  totalScore,
  type CombineTestType,
} from "@/lib/combine";

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

// Payload por testType — matchea las formas de CombineAttemptsByType en lib/combine.ts.
const ResultSchema = z.discriminatedUnion("testType", [
  z.object({
    testType: z.literal("SHORT_PUTTS"),
    data: z.object({ hits: z.array(z.boolean()).length(COMBINE_ATTEMPTS) }),
  }),
  z.object({
    testType: z.literal("LAG_PUTTS"),
    data: z.object({
      outcomes: z.array(z.enum(["HOLED", "CIRCLE", "OUT"])).length(COMBINE_ATTEMPTS),
    }),
  }),
  z.object({
    testType: z.literal("CHIPPING"),
    data: z.object({
      strokes: z.array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])).length(
        COMBINE_ATTEMPTS,
      ),
    }),
  }),
  z.object({
    testType: z.literal("WEDGES"),
    data: z.object({
      hits: z.array(z.boolean()).length(COMBINE_ATTEMPTS),
      customDistanceYds: z.number().positive(),
    }),
  }),
  z.object({
    testType: z.literal("DRIVER"),
    data: z.object({
      hits: z.array(z.boolean()).length(COMBINE_ATTEMPTS),
      carryYds: z.number().positive(),
    }),
  }),
]);

const CreateSchema = z.object({
  date: z.string().optional(), // ISO; default ahora
  notes: z.string().nullable().optional(),
  results: z.array(ResultSchema).length(COMBINE_TEST_ORDER.length),
});

type Result = z.infer<typeof ResultSchema>;

// switch (no cast) — el discriminant narrowea `r.data` a la forma que scoreForTest espera.
function scoreForResult(r: Result): number {
  switch (r.testType) {
    case "SHORT_PUTTS":
      return scoreForTest("SHORT_PUTTS", r.data);
    case "LAG_PUTTS":
      return scoreForTest("LAG_PUTTS", r.data);
    case "CHIPPING":
      return scoreForTest("CHIPPING", r.data);
    case "WEDGES":
      return scoreForTest("WEDGES", r.data);
    case "DRIVER":
      return scoreForTest("DRIVER", r.data);
  }
}

// POST → crea una sesión del Combine completa (los 5 tests juntos)
export async function POST(req: NextRequest) {
  const me = await getMe();
  const body = CreateSchema.parse(await req.json());

  const seenTypes = new Set(body.results.map((r) => r.testType));
  if (seenTypes.size !== COMBINE_TEST_ORDER.length) {
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
          attemptsJson: r.data,
          score: scoreForResult(r),
        })),
      },
    },
    include: { results: true },
  });

  return NextResponse.json({ session }, { status: 201 });
}
