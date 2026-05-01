import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  DRILLS,
  DRILL_BY_TYPE,
  GO_TO_CLUB_LADDER,
  bestHistoricalScore,
  type DrillType,
} from "@/lib/pp-drills";

// Devuelve para cada drill:
//  - currentLevel: distancia actual (PCT_HITS_PERFECT con distance) o palo actual (Go-To)
//  - nextLevel: la próxima distancia/palo si supera el target en la próxima sesión
//  - bestScore: mejor marca histórica (en el current level)
//  - lastDate: fecha última sesión de este drill
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
    lastDate: string | null;
    sessionsAtCurrent: number;
    achievementsCount: number; // veces que cumplió en este drill
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
          attempts: (d.attemptsJson as number[]) ?? [],
          leveledUp: d.leveledUp,
        })),
    );

    const lastDate = drillSessions.length > 0
      ? drillSessions[drillSessions.length - 1].date.toISOString()
      : null;
    const achievementsCount = drillSessions.filter((s) => s.leveledUp).length;

    if (drill.type === "GO_TO_CLUB") {
      // Current Go-To Club = el palo más alto donde lograste 9/9 alguna vez
      let bestRank = -1;
      for (const s of drillSessions) {
        if (!s.club) continue;
        const score = s.attempts.length > 0 ? Math.max(...s.attempts) : 0;
        if (score === drill.scoreOf) {
          const rank = GO_TO_CLUB_LADDER.indexOf(s.club);
          if (rank > bestRank) bestRank = rank;
        }
      }
      const currentClub = bestRank === -1 ? GO_TO_CLUB_LADDER[0] : GO_TO_CLUB_LADDER[Math.min(bestRank + 1, GO_TO_CLUB_LADDER.length - 1)];
      const nextClub = bestRank === -1
        ? null
        : bestRank + 1 < GO_TO_CLUB_LADDER.length - 1
        ? GO_TO_CLUB_LADDER[bestRank + 2]
        : null;
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

    if (drill.scoring === "PCT_HITS_PERFECT" && drill.distanceStep) {
      // 1-Putt y 2-Putt: nivel actual = max distance donde logró perfect run + step
      let bestDistance = -Infinity;
      for (const s of drillSessions) {
        if (s.distance == null) continue;
        const score = s.attempts.length > 0 ? Math.max(...s.attempts) : 0;
        if (score === drill.scoreOf && s.distance > bestDistance) {
          bestDistance = s.distance;
        }
      }
      const currentDistance = bestDistance === -Infinity
        ? drill.defaultDistance
        : bestDistance + drill.distanceStep;
      // Mejor marca AT current distance
      const atCurrent = drillSessions.filter((s) => s.distance === currentDistance);
      const bestAtCurrent = bestHistoricalScore(
        DRILL_BY_TYPE[drill.type],
        atCurrent.map((s) => s.attempts),
      );
      result[drill.type] = {
        drillType: drill.type,
        label: drill.label,
        currentDistance,
        nextDistance: currentDistance + drill.distanceStep,
        bestAtCurrent,
        bestEver: bestHistoricalScore(drill, drillSessions.map((s) => s.attempts)),
        lastDate,
        sessionsAtCurrent: atCurrent.length,
        achievementsCount,
      };
      continue;
    }

    // Wedges + Chipping: distancia fija. Best mark = best ever en esa distancia
    const allAttempts = drillSessions.map((s) => s.attempts);
    result[drill.type] = {
      drillType: drill.type,
      label: drill.label,
      currentDistance: drill.defaultDistance,
      bestAtCurrent: bestHistoricalScore(drill, allAttempts),
      bestEver: bestHistoricalScore(drill, allAttempts),
      lastDate,
      sessionsAtCurrent: drillSessions.length,
      achievementsCount,
    };
  }

  return NextResponse.json(result);
}
