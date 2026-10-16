import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { COMBINE_TESTS, playerTargets, totalScore, type CombineTestType } from "@/lib/combine";

// GET → detalle de una sesión (score card): los 5 tests con su criterio de éxito
// resuelto contra los targets del Player en ese momento.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await prisma.combineSession.findUnique({
    where: { id: params.id },
    include: { results: true, player: true },
  });
  if (!session) return NextResponse.json({ error: "no encontrado" }, { status: 404 });

  const targets = playerTargets(session.player);
  const scores = Object.fromEntries(session.results.map((r) => [r.testType, r.score])) as Record<
    CombineTestType,
    number
  >;

  const tests = COMBINE_TESTS.map((def) => {
    const result = session.results.find((r) => r.testType === def.type);
    return {
      type: def.type,
      label: def.label,
      icon: def.icon,
      protocol: def.protocol,
      successCriteria: def.successCriteria(targets),
      attempts: (result?.attemptsJson as boolean[] | undefined) ?? [],
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
