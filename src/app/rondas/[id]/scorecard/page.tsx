/**
 * TSM Advanced Scorecard Level 2 — vista de una ronda real.
 * URL: /rondas/[id]/scorecard
 *
 * Auto-fill desde RoundHole. Read-only del lado de la data del scorecard
 * (todo deriva de lo cargado en el RondaTracker).
 * Editable solo: best parts + best shot (que ya están en el modelo Round).
 */

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import ScorecardClient from "./ScorecardClient";
import { computeScorecardFromRound } from "@/lib/scorecard-compute";

export const dynamic = "force-dynamic";

export default async function ScorecardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      course: { include: { tees: true, holes: true } },
      players: {
        orderBy: { position: "asc" },
        include: { player: true, holes: true },
      },
    },
  });

  if (!round) return notFound();

  const me = round.players.find((rp) => rp.player.isMe) ?? round.players[0];
  if (!me) return notFound();

  const teeData = round.course.tees.find((t) => t.name === round.tee);
  const par = teeData?.parTotal ?? round.course.holes.reduce((s, h) => s + h.par, 0);
  const yardage: number | null = null; // no hay yardage en CourseTee, lo dejamos null por ahora

  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const holes = me.holes.map((h) => ({
    holeNumber: h.holeNumber,
    par: parByHole.get(h.holeNumber) ?? 4,
    score: h.score,
    putts: h.putts,
    firstPuttDistanceFt: h.firstPuttDistanceFt,
    distanceInRegYds: h.distanceInRegYds,
    strokesInsideSz: h.strokesInsideSz,
    penaltyStrokes: h.penaltyStrokes,
    keysBroken: h.keysBroken,
  }));

  const data = computeScorecardFromRound({
    round: {
      id: round.id,
      date: round.date,
      enterSzYds: round.enterSzYds,
      downInSzStrokes: round.downInSzStrokes,
      onePuttCircleFt: round.onePuttCircleFt,
      bestParts: round.bestParts,
      bestShot: round.bestShot,
      course: { name: round.course.name },
    },
    playerName: me.player.name,
    yardage,
    par,
    holes,
  });

  return <ScorecardClient roundId={id} initialData={data} />;
}
