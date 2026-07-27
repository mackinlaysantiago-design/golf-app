import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  DRILL_BY_TYPE,
  parseAttempts,
  leveledUpInSession,
  bestHistoricalScore,
  type DrillType,
  type AttemptsData,
} from "@/lib/pp-drills";

// Acepta tanto el shape viejo (number[]) como los nuevos shapes
const StreakAttemptSchema = z.object({
  distance: z.number(),
  streak: z.number().int().min(0),
});
const RatioLowerAttemptSchema = z.object({
  distance: z.number(),
  strokes: z.number().int().min(0),
  balls: z.number().int().min(1),
});
const RatioHigherAttemptSchema = z.object({
  inTarget: z.number().int().min(0),
  balls: z.number().int().min(1),
});
const GoToDirAttemptSchema = z.object({
  club: z.string().optional(),
  fw: z.number().int().min(0),
  left: z.number().int().min(0),
  right: z.number().int().min(0),
});
const AttemptsDataSchema = z.union([
  z.object({ type: z.literal("STREAK_BY_DIST"), attempts: z.array(StreakAttemptSchema) }),
  z.object({ type: z.literal("RATIO_LOWER_BY_DIST"), attempts: z.array(RatioLowerAttemptSchema) }),
  z.object({ type: z.literal("RATIO_HIGHER"), attempts: z.array(RatioHigherAttemptSchema) }),
  z.object({ type: z.literal("GO_TO_DIR"), attempts: z.array(GoToDirAttemptSchema) }),
  z.object({ type: z.literal("LEGACY_NUMBER_ARRAY"), attempts: z.array(z.number()) }),
  z.array(z.number()),
]);

const DrillSchema = z.object({
  drillType: z.string(),
  distance: z.number().int().nullable().optional(),
  club: z.string().nullable().optional(),
  ppCode: z.string().nullable().optional(),
  timesToAchieve: z.number().int().nullable().optional(),
  attempts: AttemptsDataSchema,
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

// Cuenta cuántos targets cumplió el drill en esta sesión (para feedback de plan)
function countTargetsAchieved(
  drill: { format: string; hasLevelUp: boolean; levelUpStreak?: number; scoreOf: number },
  data: AttemptsData,
): number {
  if (data.type === "STREAK_BY_DIST") {
    const target = drill.levelUpStreak ?? 10;
    return data.attempts.filter((a) => a.streak >= target).length;
  }
  if (data.type === "GO_TO_DIR") {
    return data.attempts.filter((a) => a.fw >= drill.scoreOf).length;
  }
  if (data.type === "LEGACY_NUMBER_ARRAY") {
    return data.attempts.filter((a) => a >= drill.scoreOf).length;
  }
  // Chipping/wedges: el drill "cumple" si superó el mejor previo (1 logro por sesión)
  return 0;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSessionSchema.parse(body);

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
        attemptsJson: Array.isArray(d.attempts) ? d.attempts : (d.attempts as object),
        leveledUp: false,
        notes: d.notes ?? null,
      };
    }

    // Normalizar attempts al shape correcto del drill
    const attemptsRaw = d.attempts;
    const data: AttemptsData = Array.isArray(attemptsRaw)
      ? parseAttempts(attemptsRaw, def.format)
      : (attemptsRaw as AttemptsData);

    // Compute leveledUp + targets achieved
    const { leveledUp: lu } = leveledUpInSession(def, data);
    const timesAchieved = countTargetsAchieved(def, data);
    const timesToAchieve = d.timesToAchieve ?? null;
    const leveledUp = timesToAchieve != null
      ? timesAchieved >= timesToAchieve
      : lu;

    // target: para legacy/Go-To, mejor histórico; para nuevos formatos, dejamos null y se calcula on-the-fly
    let target: number | null = null;
    if (def.format === "LEGACY_NUMBER_ARRAY") {
      const past = pastSessions.flatMap((s) =>
        s.drills
          .filter((dr) => dr.drillType === def.type && (def.type !== "GO_TO_CLUB" || dr.club === d.club))
          .map((dr) => (dr.attemptsJson as number[]) ?? []),
      );
      target = bestHistoricalScore(def, past);
    }

    // Persistimos el shape nuevo como objeto (Prisma Json)
    const attemptsJson = data;

    return {
      drillType: d.drillType,
      distance: d.distance ?? null,
      club: d.club ?? null,
      ppCode: d.ppCode ?? null,
      target,
      timesToAchieve,
      timesAchieved,
      attemptsJson: attemptsJson as object,
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
