/**
 * POST /api/rondas/[id]/assessment
 *   Upsert los campos editables del Round Assessment Card.
 *   Body: campos del card (booleans pre-prep, textos, % sliders).
 *
 * Los campos numéricos derivables (counts, breakdowns, stats) NO se guardan
 * — se computan on-demand desde RoundHole en `computeAssessmentFromRound`.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type AssessmentPatch = {
  practiceRound?: boolean;
  yardageBook?: boolean;
  writtenPlan?: boolean;
  personalParDefined?: boolean;
  warmUp?: string | null;
  mentalFocus?: string | null;
  bestPartOfRound?: string | null;
  mentalStrengthPct?: number | null;
  positiveSelfTalkPct?: number | null;
  fortitudePct?: number | null;
  shotSelectionPct?: number | null;
  shotExecutionPct?: number | null;
  skillUnder10Putts?: string | null;
  skillLagPutts?: string | null;
  skillChippingProx?: string | null;
  skillWedgesProx?: string | null;
  skillBallStriking?: string | null;
  skillGoToClub?: string | null;
  lessonsLearned?: string | null;
};

const TEXT_FIELDS = [
  "warmUp",
  "mentalFocus",
  "bestPartOfRound",
  "skillUnder10Putts",
  "skillLagPutts",
  "skillChippingProx",
  "skillWedgesProx",
  "skillBallStriking",
  "skillGoToClub",
  "lessonsLearned",
] as const;

const PCT_FIELDS = [
  "mentalStrengthPct",
  "positiveSelfTalkPct",
  "fortitudePct",
  "shotSelectionPct",
  "shotExecutionPct",
] as const;

const BOOL_FIELDS = [
  "practiceRound",
  "yardageBook",
  "writtenPlan",
  "personalParDefined",
] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: roundId } = await params;
  const body = (await req.json()) as AssessmentPatch;

  // Sanitize: solo aceptar campos conocidos
  const data: Record<string, unknown> = {};
  for (const f of BOOL_FIELDS) {
    if (typeof body[f] === "boolean") data[f] = body[f];
  }
  for (const f of TEXT_FIELDS) {
    if (f in body) {
      const v = body[f];
      data[f] = v === "" ? null : (v ?? null);
    }
  }
  for (const f of PCT_FIELDS) {
    if (f in body) {
      const v = body[f];
      // Clamp 0-100 si es number, sino null
      data[f] = typeof v === "number" ? Math.max(0, Math.min(100, Math.round(v))) : null;
    }
  }

  // Verificar que la ronda existe (defensa)
  const round = await prisma.round.findUnique({ where: { id: roundId }, select: { id: true } });
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const card = await prisma.roundAssessmentCard.upsert({
    where: { roundId },
    create: { roundId, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true, card });
}
