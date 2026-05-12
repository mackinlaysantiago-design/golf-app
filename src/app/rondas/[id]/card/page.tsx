/**
 * Round Assessment Card con data real de una ronda.
 *
 * Auto-fills desde RoundHole. Si existe `RoundAssessmentCard` guardado,
 * usa esos valores para los campos texto/%. Si no, quedan vacíos.
 *
 * URL: /rondas/[id]/card
 *
 * TODO (próximas iteraciones):
 *   - Edit inline (sliders, textareas)
 *   - Botón "Descargar PNG" con html2canvas
 *   - Link de vuelta a /rondas/[id]/resumen
 */

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import CardClient from "./CardClient";
import { computeAssessmentFromRound, mergeAssessmentData } from "@/lib/round-assessment-compute";
import type { AssessmentCardData } from "@/lib/round-assessment";

export const dynamic = "force-dynamic";

export default async function CardPage({
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
      assessmentCard: true,
    },
  });

  if (!round) return notFound();

  const me = round.players.find((rp) => rp.player.isMe) ?? round.players[0];
  if (!me) return notFound();

  // Yardage + par desde el tee del round
  const teeData = round.course.tees.find((t) => t.name === round.tee);
  const yardage: number | null = null; // course.tees no tiene yardage, course.holes sí lo tendría sumado
  const par = teeData?.parTotal ?? round.course.holes.reduce((s, h) => s + h.par, 0);

  // Holes del jugador, joined con su par desde course.holes
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const holes = me.holes.map((h) => ({
    holeNumber: h.holeNumber,
    par: parByHole.get(h.holeNumber) ?? 4,
    score: h.score,
    putts: h.putts,
    strokesToEnterSz: h.strokesToEnterSz,
    distanceInRegYds: h.distanceInRegYds,
    strokesInsideSz: h.strokesInsideSz,
    firstPuttDistanceFt: h.firstPuttDistanceFt,
    puttsInside1PuttCircle: h.puttsInside1PuttCircle,
    penaltyStrokes: h.penaltyStrokes,
    bunkerShots: h.bunkerShots,
    bunkerUpAndDown: h.bunkerUpAndDown,
  }));

  const computed = computeAssessmentFromRound({
    round: {
      id: round.id,
      date: round.date,
      holesPlayed: round.holesPlayed,
      nineWhich: round.nineWhich,
      enterSzYds: round.enterSzYds,
      downInSzStrokes: round.downInSzStrokes,
      firstThreeStrokes: round.firstThreeStrokes,
      lastThreeStrokes: round.lastThreeStrokes,
      front9Strokes: round.front9Strokes,
      back9Strokes: round.back9Strokes,
      course: { name: round.course.name },
    },
    playerName: me.player.name,
    yardage,
    par,
    holes,
  });

  // Saved data del assessment card (si existe)
  const saved: Partial<AssessmentCardData> | null = round.assessmentCard
    ? {
        practiceRound: round.assessmentCard.practiceRound,
        yardageBook: round.assessmentCard.yardageBook,
        writtenPlan: round.assessmentCard.writtenPlan,
        personalParDefined: round.assessmentCard.personalParDefined,
        warmUp: round.assessmentCard.warmUp ?? "",
        mentalFocus: round.assessmentCard.mentalFocus ?? "",
        bestPartOfRound: round.assessmentCard.bestPartOfRound ?? "",
        mentalStrengthPct: round.assessmentCard.mentalStrengthPct,
        positiveSelfTalkPct: round.assessmentCard.positiveSelfTalkPct,
        fortitudePct: round.assessmentCard.fortitudePct,
        shotSelectionPct: round.assessmentCard.shotSelectionPct,
        shotExecutionPct: round.assessmentCard.shotExecutionPct,
        skillUnder10Putts: round.assessmentCard.skillUnder10Putts ?? "",
        skillLagPutts: round.assessmentCard.skillLagPutts ?? "",
        skillChippingProx: round.assessmentCard.skillChippingProx ?? "",
        skillWedgesProx: round.assessmentCard.skillWedgesProx ?? "",
        skillBallStriking: round.assessmentCard.skillBallStriking ?? "",
        skillGoToClub: round.assessmentCard.skillGoToClub ?? "",
        lessonsLearned: round.assessmentCard.lessonsLearned ?? "",
      }
    : null;

  const data = mergeAssessmentData(computed, saved);

  return <CardClient roundId={id} initialData={data} />;
}
