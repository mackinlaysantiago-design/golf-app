import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  COMBINE_INTRO,
  COMBINE_LESSON_URL,
  COMBINE_TEST_ORDER,
  DRIVER_YARDS_DEFAULT,
  driverIntro,
  totalScore,
  type CombineTestType,
  type DriverData,
} from "@/lib/combine";

// GET → detalle de una sesión (score card): los 5 tests con los datos crudos de
// cada intento (forma distinta por testType, ver lib/combine.ts) + el copy exacto
// de CombineIntro, resuelto con los valores reales de esta sesión (shot10/carry).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.combineSession.findUnique({
    where: { id },
    include: { results: true, player: true },
  });
  if (!session) return NextResponse.json({ error: "no encontrado" }, { status: 404 });

  const scores = Object.fromEntries(session.results.map((r) => [r.testType, r.score])) as Record<
    CombineTestType,
    number
  >;

  const tests = COMBINE_TEST_ORDER.map((type) => {
    const result = session.results.find((r) => r.testType === type);
    const data = result?.attemptsJson ?? null;
    const intro =
      type === "DRIVER"
        ? driverIntro((data as DriverData | null)?.carryYds ?? DRIVER_YARDS_DEFAULT)
        : COMBINE_INTRO[type];
    return {
      type,
      intro,
      lessonUrl: COMBINE_LESSON_URL[type],
      data,
      score: result?.score ?? 0,
    };
  });

  return NextResponse.json({
    id: session.id,
    date: session.date.toISOString(),
    notes: session.notes,
    player: { id: session.player.id, name: session.player.name },
    tests,
    totalScore: totalScore(scores),
  });
}
