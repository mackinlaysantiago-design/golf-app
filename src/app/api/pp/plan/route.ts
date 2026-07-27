import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeRoundKPIs, computePPPlan, type HoleData } from "@/lib/scoring-method";
import { PP_CODE_TO_DRILLS } from "@/lib/pp-drills";

export const dynamic = "force-dynamic";

// GET /api/pp/plan
// Devuelve para cada drill la cantidad de veces a lograr el target,
// derivada del PP plan de la última ronda.
export async function GET() {
  const me = await prisma.player.findFirst({ where: { isMe: true } });
  if (!me) {
    return NextResponse.json({ ppPlan: [], drillTargets: {} });
  }

  const lastRound = await prisma.round.findFirst({
    where: { players: { some: { playerId: me.id } } },
    orderBy: { date: "desc" },
    include: {
      course: { include: { holes: { orderBy: { number: "asc" } } } },
      players: { where: { playerId: me.id }, include: { holes: true } },
    },
  });

  if (!lastRound || !lastRound.players[0]) {
    return NextResponse.json({ ppPlan: [], drillTargets: {} });
  }

  const meRP = lastRound.players[0];
  const parByNumber = new Map(lastRound.course.holes.map((h) => [h.number, h.par]));
  const holes: HoleData[] = meRP.holes.map((h) => ({
    holeNumber: h.holeNumber,
    par: parByNumber.get(h.holeNumber) ?? 4,
    strokesToEnterSz: h.strokesToEnterSz,
    distanceInRegYds: h.distanceInRegYds,
    strokesInsideSz: h.strokesInsideSz,
    putts: h.putts,
    firstPuttDistanceFt: h.firstPuttDistanceFt,
    puttMadeDistanceFt: h.puttMadeDistanceFt,
    puttsInside1PuttCircle: h.puttsInside1PuttCircle,
    score: h.score,
  }));
  const config = {
    enterSzYds: lastRound.enterSzYds,
    downInSzStrokes: lastRound.downInSzStrokes,
    onePuttCircleFt: lastRound.onePuttCircleFt,
    twoPuttCircleYds: lastRound.twoPuttCircleYds,
  };
  const kpis = computeRoundKPIs(holes, config);
  const ppPlan = computePPPlan(holes, config, kpis).filter((p) => p.count > 0);

  // Drills targets: cuántas veces hay que lograr el target en cada drill
  // Para PP code B (que ataca varios drills), repartir el count entre los drills
  // Simple: cada drill atacante recibe el count completo (el usuario elige cuál hacer)
  const drillTargets: Record<string, { timesToAchieve: number; ppCode: string }> = {};
  for (const item of ppPlan) {
    const drills = PP_CODE_TO_DRILLS[item.code] ?? [];
    for (const d of drills) {
      // si ya existe, mantener el max
      const existing = drillTargets[d];
      if (!existing || existing.timesToAchieve < item.count) {
        drillTargets[d] = { timesToAchieve: item.count, ppCode: item.code };
      }
    }
  }

  // Plan TSM (áreas con errores → drill → test) — misma fuente que resumen y /range/pp
  const { computeTsmPlan } = await import("@/lib/tsm-plan");
  const tsmPlan = computeTsmPlan(holes, config, kpis);

  return NextResponse.json({
    ppPlan,
    tsmPlan,
    drillTargets,
    lastRoundDate: lastRound.date.toISOString(),
    lastRoundCourse: lastRound.course.name,
  });
}
