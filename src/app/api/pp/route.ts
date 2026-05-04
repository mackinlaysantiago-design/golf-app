import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  DRILL_BY_TYPE,
  bestHistoricalScore,
  meetsTarget,
  type DrillType,
} from "@/lib/pp-drills";

const DrillSchema = z.object({
  drillType: z.string(),
  distance: z.number().int().nullable().optional(),
  club: z.string().nullable().optional(),
  ppCode: z.string().nullable().optional(),
  timesToAchieve: z.number().int().nullable().optional(),
  attempts: z.array(z.number()).default([]),
  notes: z.string().nullable().optional(),
});

const CreateSessionSchema = z.object({
  date: z.string(),
  notes: z.string().nullable().optional(),
  drills: z.array(DrillSchema),
});

export async function GET() {
  const sessions = await prisma.practiceSession.findMany({
    orderBy: { date: "desc" },
    include: { drills: true },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSessionSchema.parse(body);

  // Para cada drill, computar si "subió de nivel" comparando con marca anterior
  const pastSessions = await prisma.practiceSession.findMany({
    include: { drills: true },
  });

  const drillsToCreate = parsed.drills.map((d) => {
    const def = DRILL_BY_TYPE[d.drillType as DrillType];
    if (!def) {
      return {
        drillType: d.drillType,
        distance: d.distance ?? null,
        club: d.club ?? null,
        ppCode: d.ppCode ?? null,
        target: null,
        timesToAchieve: d.timesToAchieve ?? null,
        timesAchieved: 0,
        attemptsJson: d.attempts ?? [],
        leveledUp: false,
        notes: d.notes ?? null,
      };
    }

    // Past attempts AT same distance/club
    const past = pastSessions.flatMap((s) =>
      s.drills
        .filter((dr) => {
          if (dr.drillType !== d.drillType) return false;
          if (def.type === "GO_TO_CLUB") return dr.club === d.club;
          if (def.distanceStep) return dr.distance === d.distance;
          return true;
        })
        .map((dr) => (dr.attemptsJson as number[]) ?? []),
    );
    const bestPrevious = bestHistoricalScore(def, past);

    // timesAchieved: cuántos attempts cumplen target (cada intento es un set; el set "cumple" según meetsTarget)
    // Para PCT_HITS_PERFECT: cada attempt cumple si === scoreOf
    // Para BEAT_BEST_HIGHER: cada attempt cumple si > bestPrevious
    // Para BEAT_BEST_LOWER_BY_1 (chipping): el SET completo es 1 intento; suma <= bestPrevious - 1
    let timesAchieved = 0;
    if (def.scoring === "PCT_HITS_PERFECT") {
      timesAchieved = d.attempts.filter((a) => a === def.scoreOf).length;
    } else if (def.scoring === "BEAT_BEST_HIGHER") {
      const threshold = bestPrevious ?? 0;
      timesAchieved = d.attempts.filter((a) => a > threshold).length;
    } else if (def.scoring === "BEAT_BEST_LOWER_BY_1") {
      // chipping: 1 set entero = 1 intento. d.attempts es la suma de los 9 hoyos.
      // si la suma <= best - 1, cumple
      if (d.attempts.length > 0 && bestPrevious != null) {
        const sum = d.attempts.reduce((a, b) => a + b, 0);
        if (sum <= bestPrevious - 1) timesAchieved = 1;
      }
    }

    const timesToAchieve = d.timesToAchieve ?? null;
    const leveledUp = timesToAchieve != null
      ? timesAchieved >= timesToAchieve
      : meetsTarget(def, d.attempts, bestPrevious);

    return {
      drillType: d.drillType,
      distance: d.distance ?? null,
      club: d.club ?? null,
      ppCode: d.ppCode ?? null,
      target: bestPrevious,
      timesToAchieve,
      timesAchieved,
      attemptsJson: d.attempts ?? [],
      leveledUp,
      notes: d.notes ?? null,
    };
  });

  const session = await prisma.practiceSession.create({
    data: {
      date: new Date(parsed.date),
      notes: parsed.notes ?? null,
      drills: { create: drillsToCreate },
    },
    include: { drills: true },
  });

  // Aplicar progreso a las PracticeTasks pendientes
  const { applyPracticeProgress } = await import("@/lib/practice-tasks");
  await applyPracticeProgress(
    drillsToCreate.map((d) => ({ ppCode: d.ppCode, leveledUp: d.leveledUp })),
  );

  return NextResponse.json(session, { status: 201 });
}
