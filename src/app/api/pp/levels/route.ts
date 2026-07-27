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

// Pega a la DB → no prerenderizar en build (si no, falla el deploy).
export const dynamic = "force-dynamic";

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
      // Registro por palo: FW/izq/der acumulados. Go-To = mejor % de FW (mín. 9 tiros).
      const byClub: Record<string, { fw: number; left: number; right: number; shots: number }> = {};
      for (const s of drillSessions) {
        const data = parseAttempts(s.attemptsJson, "GO_TO_DIR");
        if (data.type === "GO_TO_DIR") {
          for (const a of data.attempts) {
            const club = a.club ?? s.club ?? GO_TO_CLUB_LADDER[0];
            const acc = (byClub[club] ??= { fw: 0, left: 0, right: 0, shots: 0 });
            acc.fw += a.fw;
            acc.left += a.left;
            acc.right += a.right;
            acc.shots += a.fw + a.left + a.right;
          }
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && s.club) {
          const acc = (byClub[s.club] ??= { fw: 0, left: 0, right: 0, shots: 0 });
          for (const a of data.attempts) {
            acc.fw += a;
            acc.shots += 9;
          }
        }
      }
      let currentClub: string | undefined;
      let goToPct = -1;
      for (const [club, v] of Object.entries(byClub)) {
        if (v.shots < 9) continue;
        const pct = v.fw / v.shots;
        if (pct > goToPct) {
          goToPct = pct;
          currentClub = club;
        }
      }
      const nextClub = null;
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

      // Nivel actual = la próxima distancia después de la última pasada con 10/10
      const passedDistance = bestLevelUpDist === -Infinity ? null : bestLevelUpDist;
      const currentDistance = passedDistance != null && drill.distanceStep
        ? passedDistance + drill.distanceStep
        : (passedDistance ?? drill.defaultDistance);
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
        if (data.type === "RATIO_LOWER_BY_DIST") {
          const sessionMap = ratioLowerByDistance(data.attempts);
          for (const [dStr, agg] of Object.entries(sessionMap)) {
            const d = Number(dStr);
            const cur = bestByDist[d];
            if (!cur || agg.ratio < cur.ratio) bestByDist[d] = agg;
          }
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && data.attempts.length > 0 && s.distance != null) {
          // Chipping legacy: cada valor = golpes para meter una pelota
          const strokes = data.attempts.reduce((a, b) => a + b, 0);
          const balls = data.attempts.length;
          const ratio = strokes / balls;
          const cur = bestByDist[s.distance];
          if (!cur || ratio < cur.ratio) bestByDist[s.distance] = { strokes, balls, ratio };
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
        if (data.type === "RATIO_HIGHER") {
          const total = ratioHigherTotal(data.attempts);
          if (total && (!best || total.ratio > best.ratio)) best = total;
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && data.attempts.length > 0) {
          // Wedges legacy: cada attempt fue 9 wedges, valor = cuántos quedaron en 2PC
          const inTarget = data.attempts.reduce((a, b) => a + b, 0);
          const balls = data.attempts.length * 9;
          const ratio = inTarget / balls;
          if (!best || ratio > best.ratio) best = { inTarget, balls, ratio };
        }
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
