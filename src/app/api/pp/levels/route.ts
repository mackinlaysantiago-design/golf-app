import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  DRILLS,
  GO_TO_CLUB_LADDER,
  parseAttempts,
  maxStreakByDistance,
  ratioLowerByDistance,
  ratioHigherTotal,
  type DrillType,
} from "@/lib/pp-drills";

// Devuelve para cada drill:
//   STREAK (1-putt, 2-putt):
//     currentDistance: max distancia donde alguna vez logró streak >= levelUpStreak
//     bestStreakByDist: { [distance]: maxStreak }
//   RATIO_LOWER_BY_DIST (chipping):
//     bestRatioByDist: { [distance]: { strokes, balls, ratio } }  (mejor sesión por distancia)
//   RATIO_HIGHER (wedges):
//     bestRatio: { inTarget, balls, ratio }  (mejor sesión)
//   GO_TO_CLUB (legacy):
//     currentClub, nextClub, bestAtCurrent
export async function GET() {
  const sessions = await prisma.practiceSession.findMany({
    orderBy: { date: "asc" },
    include: { drills: true },
  });

  type LevelInfo = {
    drillType: DrillType;
    label: string;
    currentDistance?: number;
    currentClub?: string;
    nextDistance?: number;
    nextClub?: string;
    bestAtCurrent: number | null;
    bestEver: number | null;
    bestStreakByDist?: Record<number, number>;
    bestRatioByDist?: Record<number, { strokes: number; balls: number; ratio: number }>;
    bestRatio?: { inTarget: number; balls: number; ratio: number } | null;
    lastDate: string | null;
    sessionsAtCurrent: number;
    achievementsCount: number;
  };

  const result: Record<string, LevelInfo> = {};

  for (const drill of DRILLS) {
    const drillSessions = sessions.flatMap((s) =>
      s.drills
        .filter((d) => d.drillType === drill.type)
        .map((d) => ({
          date: s.date,
          distance: d.distance,
          club: d.club,
          attemptsJson: d.attemptsJson,
          leveledUp: d.leveledUp,
        })),
    );
    const lastDate = drillSessions.length > 0
      ? drillSessions[drillSessions.length - 1].date.toISOString()
      : null;
    const achievementsCount = drillSessions.filter((s) => s.leveledUp).length;

    if (drill.type === "GO_TO_CLUB") {
      let bestRank = -1;
      for (const s of drillSessions) {
        if (!s.club) continue;
        const data = parseAttempts(s.attemptsJson, "LEGACY_NUMBER_ARRAY");
        if (data.type !== "LEGACY_NUMBER_ARRAY") continue;
        const maxScore = data.attempts.length > 0 ? Math.max(...data.attempts) : 0;
        if (maxScore === drill.scoreOf) {
          const rank = GO_TO_CLUB_LADDER.indexOf(s.club);
          if (rank > bestRank) bestRank = rank;
        }
      }
      const currentClub = bestRank === -1 ? GO_TO_CLUB_LADDER[0] : GO_TO_CLUB_LADDER[bestRank];
      const nextClub = bestRank + 1 < GO_TO_CLUB_LADDER.length ? GO_TO_CLUB_LADDER[bestRank + 1] : null;
      result[drill.type] = {
        drillType: drill.type,
        label: drill.label,
        currentClub,
        nextClub: nextClub ?? undefined,
        bestAtCurrent: null,
        bestEver: null,
        lastDate,
        sessionsAtCurrent: drillSessions.filter((s) => s.club === currentClub).length,
        achievementsCount,
      };
      continue;
    }

    if (drill.format === "STREAK_BY_DIST") {
      // Best streak por distancia agregando todas las sesiones
      const allByDist: Record<number, number> = {};
      let bestLevelUpDist = -Infinity;
      const target = drill.levelUpStreak ?? 10;

      for (const s of drillSessions) {
        const data = parseAttempts(s.attemptsJson, "STREAK_BY_DIST");
        if (data.type === "STREAK_BY_DIST") {
          const map = maxStreakByDistance(data.attempts);
          for (const [dStr, streak] of Object.entries(map)) {
            const d = Number(dStr);
            allByDist[d] = Math.max(allByDist[d] ?? 0, streak);
            if (streak >= target && d > bestLevelUpDist) bestLevelUpDist = d;
          }
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && s.distance != null) {
          // Lectura legacy: cada attempt era N embocados de 10. Lo tomamos como streak con distancia única
          const maxScore = data.attempts.length > 0 ? Math.max(...data.attempts) : 0;
          allByDist[s.distance] = Math.max(allByDist[s.distance] ?? 0, maxScore);
          if (maxScore >= target && s.distance > bestLevelUpDist) bestLevelUpDist = s.distance;
        }
      }

      const currentDistance = bestLevelUpDist === -Infinity ? drill.defaultDistance : bestLevelUpDist;
      const bestAtCurrent = allByDist[currentDistance] ?? null;
      const bestEver = Object.values(allByDist).length > 0 ? Math.max(...Object.values(allByDist)) : null;

      result[drill.type] = {
        drillType: drill.type,
        label: drill.label,
        currentDistance,
        nextDistance: drill.distanceStep ? currentDistance + drill.distanceStep : undefined,
        bestAtCurrent,
        bestEver,
        bestStreakByDist: allByDist,
        lastDate,
        sessionsAtCurrent: drillSessions.length,
        achievementsCount,
      };
      continue;
    }

    if (drill.format === "RATIO_LOWER_BY_DIST") {
      // Mejor ratio por distancia (lower is better) — agregando POR SESIÓN (no global)
      const bestByDist: Record<number, { strokes: number; balls: number; ratio: number }> = {};
      for (const s of drillSessions) {
        const data = parseAttempts(s.attemptsJson, "RATIO_LOWER_BY_DIST");
        if (data.type !== "RATIO_LOWER_BY_DIST") continue;
        const sessionMap = ratioLowerByDistance(data.attempts);
        for (const [dStr, agg] of Object.entries(sessionMap)) {
          const d = Number(dStr);
          const cur = bestByDist[d];
          if (!cur || agg.ratio < cur.ratio) bestByDist[d] = agg;
        }
      }
      result[drill.type] = {
        drillType: drill.type,
        label: drill.label,
        currentDistance: drill.defaultDistance,
        bestAtCurrent: null,
        bestEver: null,
        bestRatioByDist: bestByDist,
        lastDate,
        sessionsAtCurrent: drillSessions.length,
        achievementsCount,
      };
      continue;
    }

    if (drill.format === "RATIO_HIGHER") {
      // Mejor ratio (higher is better) — por sesión
      let best: { inTarget: number; balls: number; ratio: number } | null = null;
      for (const s of drillSessions) {
        const data = parseAttempts(s.attemptsJson, "RATIO_HIGHER");
        if (data.type !== "RATIO_HIGHER") continue;
        const total = ratioHigherTotal(data.attempts);
        if (total && (!best || total.ratio > best.ratio)) best = total;
      }
      result[drill.type] = {
        drillType: drill.type,
        label: drill.label,
        currentDistance: drill.defaultDistance,
        bestAtCurrent: null,
        bestEver: null,
        bestRatio: best,
        lastDate,
        sessionsAtCurrent: drillSessions.length,
        achievementsCount,
      };
      continue;
    }
  }

  return NextResponse.json(result);
}
