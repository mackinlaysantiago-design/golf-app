import { prisma } from "@/lib/db";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import {
  DRILL_BY_TYPE,
  DRILLS,
  CLUB_LABEL,
  GO_TO_CLUB_LADDER,
  parseAttempts,
  maxStreakByDistance,
  ratioLowerByDistance,
  ratioHigherTotal,
  type DrillType,
} from "@/lib/pp-drills";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LvlInfo = {
  currentDistance?: number;
  currentClub?: string;
  bestStreakByDist?: Record<number, number>;
  bestRatioByDist?: Record<number, { strokes: number; balls: number; ratio: number }>;
  bestRatio?: { inTarget: number; balls: number; ratio: number } | null;
  achievementsCount: number;
  sessionsAtCurrent: number;
};

async function getLevels(): Promise<Record<string, LvlInfo>> {
  const sessions = await prisma.practiceSession.findMany({
    orderBy: { date: "asc" },
    include: { drills: true },
  });
  const result: Record<string, LvlInfo> = {};

  for (const drill of DRILLS) {
    const drillSessions = sessions.flatMap((s) =>
      s.drills
        .filter((d) => d.drillType === drill.type)
        .map((d) => ({
          distance: d.distance,
          club: d.club,
          attemptsJson: d.attemptsJson,
          leveledUp: d.leveledUp,
        })),
    );
    const achievementsCount = drillSessions.filter((s) => s.leveledUp).length;

    if (drill.type === "GO_TO_CLUB") {
      let bestRank = -1;
      for (const s of drillSessions) {
        if (!s.club) continue;
        const data = parseAttempts(s.attemptsJson, "LEGACY_NUMBER_ARRAY");
        if (data.type !== "LEGACY_NUMBER_ARRAY") continue;
        const max = data.attempts.length > 0 ? Math.max(...data.attempts) : 0;
        if (max === drill.scoreOf) {
          const rank = GO_TO_CLUB_LADDER.indexOf(s.club);
          if (rank > bestRank) bestRank = rank;
        }
      }
      const currentClub = bestRank === -1 ? GO_TO_CLUB_LADDER[0] : GO_TO_CLUB_LADDER[bestRank];
      result[drill.type] = {
        currentClub,
        achievementsCount,
        sessionsAtCurrent: drillSessions.filter((s) => s.club === currentClub).length,
      };
      continue;
    }

    if (drill.format === "STREAK_BY_DIST") {
      const allByDist: Record<number, number> = {};
      let bestLevelUpDist = -Infinity;
      const target = drill.levelUpStreak ?? 10;
      for (const s of drillSessions) {
        const data = parseAttempts(s.attemptsJson, "STREAK_BY_DIST");
        if (data.type === "STREAK_BY_DIST") {
          const m = maxStreakByDistance(data.attempts);
          for (const [k, v] of Object.entries(m)) {
            const d = Number(k);
            allByDist[d] = Math.max(allByDist[d] ?? 0, v);
            if (v >= target && d > bestLevelUpDist) bestLevelUpDist = d;
          }
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && s.distance != null) {
          const max = data.attempts.length > 0 ? Math.max(...data.attempts) : 0;
          allByDist[s.distance] = Math.max(allByDist[s.distance] ?? 0, max);
          if (max >= target && s.distance > bestLevelUpDist) bestLevelUpDist = s.distance;
        }
      }
      const currentDistance = bestLevelUpDist === -Infinity ? drill.defaultDistance : bestLevelUpDist;
      result[drill.type] = {
        currentDistance,
        bestStreakByDist: allByDist,
        achievementsCount,
        sessionsAtCurrent: drillSessions.length,
      };
      continue;
    }

    if (drill.format === "RATIO_LOWER_BY_DIST") {
      const bestByDist: Record<number, { strokes: number; balls: number; ratio: number }> = {};
      for (const s of drillSessions) {
        const data = parseAttempts(s.attemptsJson, "RATIO_LOWER_BY_DIST");
        if (data.type === "RATIO_LOWER_BY_DIST") {
          const m = ratioLowerByDistance(data.attempts);
          for (const [k, v] of Object.entries(m)) {
            const d = Number(k);
            const cur = bestByDist[d];
            if (!cur || v.ratio < cur.ratio) bestByDist[d] = v;
          }
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && data.attempts.length > 0 && s.distance != null) {
          const strokes = data.attempts.reduce((a, b) => a + b, 0);
          const balls = data.attempts.length;
          const ratio = strokes / balls;
          const cur = bestByDist[s.distance];
          if (!cur || ratio < cur.ratio) bestByDist[s.distance] = { strokes, balls, ratio };
        }
      }
      result[drill.type] = {
        currentDistance: drill.defaultDistance,
        bestRatioByDist: bestByDist,
        achievementsCount,
        sessionsAtCurrent: drillSessions.length,
      };
      continue;
    }

    if (drill.format === "RATIO_HIGHER") {
      let best: { inTarget: number; balls: number; ratio: number } | null = null;
      for (const s of drillSessions) {
        const data = parseAttempts(s.attemptsJson, "RATIO_HIGHER");
        if (data.type === "RATIO_HIGHER") {
          const t = ratioHigherTotal(data.attempts);
          if (t && (!best || t.ratio > best.ratio)) best = t;
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && data.attempts.length > 0) {
          const inTarget = data.attempts.reduce((a, b) => a + b, 0);
          const balls = data.attempts.length * 9;
          const ratio = inTarget / balls;
          if (!best || ratio > best.ratio) best = { inTarget, balls, ratio };
        }
      }
      result[drill.type] = {
        currentDistance: drill.defaultDistance,
        bestRatio: best,
        achievementsCount,
        sessionsAtCurrent: drillSessions.length,
      };
      continue;
    }
  }
  return result;
}

export default async function PPListPage() {
  const [sessions, levels] = await Promise.all([
    prisma.practiceSession.findMany({
      orderBy: { date: "desc" },
      include: { drills: true },
    }),
    getLevels(),
  ]);

  // PP sugerido de la última ronda
  const me = await prisma.player.findFirst({ where: { isMe: true } });
  let pendingPP: { code: string; label: string; count: number; reason: string }[] = [];
  if (me) {
    const lastRound = await prisma.round.findFirst({
      where: { players: { some: { playerId: me.id } } },
      orderBy: { date: "desc" },
      include: {
        course: { include: { holes: { orderBy: { number: "asc" } } } },
        players: { where: { playerId: me.id }, include: { holes: true } },
      },
    });
    if (lastRound && lastRound.players[0]) {
      const { computeRoundKPIs, computePPPlan } = await import("@/lib/scoring-method");
      const meRP = lastRound.players[0];
      const parByNumber = new Map(lastRound.course.holes.map((h) => [h.number, h.par]));
      const holesData = meRP.holes.map((h) => ({
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
      const kpis = computeRoundKPIs(holesData, config);
      pendingPP = computePPPlan(holesData, config, kpis).filter((p) => p.count > 0);
    }
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/range" className="text-xs text-[var(--muted)]">
          ‹ Volver a Range
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          Purposeful Practice
        </h1>
      </header>

      {pendingPP.length > 0 && (
        <>
          <SectionHeader>Sugerido (de tu última ronda)</SectionHeader>
          <div className="space-y-2">
            {pendingPP.map((p) => (
              <Card key={p.code} className="!p-3" style={{ borderLeft: "4px solid var(--accent)" }}>
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-sm">{p.label}</span>
                  <span className="gf-display text-2xl text-[var(--accent)]">{p.count}</span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">{p.reason}</div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionHeader>Tu nivel actual por drill</SectionHeader>
      <div className="space-y-2">
        {DRILLS.map((d) => {
          const lvl = levels[d.type];
          if (!lvl) return null;
          return (
            <Card key={d.type} className="!p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{d.shortLabel}</div>
                  <div className="text-[10px] text-[var(--muted)] gf-mono">
                    PP {d.ppCode} · {lvl.sessionsAtCurrent} sesion{lvl.sessionsAtCurrent === 1 ? "" : "es"}
                  </div>
                  {d.format === "STREAK_BY_DIST" && lvl.bestStreakByDist && Object.keys(lvl.bestStreakByDist).length > 0 && (
                    <div className="text-[10px] text-[var(--muted)] gf-mono mt-1">
                      Récords: {Object.entries(lvl.bestStreakByDist)
                        .map(([k, v]) => [Number(k), v] as const)
                        .sort((a, b) => a[0] - b[0])
                        .map(([k, v]) => `${k}${d.distanceUnit}: ${v}`)
                        .join(" · ")}
                    </div>
                  )}
                  {d.format === "RATIO_LOWER_BY_DIST" && lvl.bestRatioByDist && Object.keys(lvl.bestRatioByDist).length > 0 && (
                    <div className="text-[10px] text-[var(--muted)] gf-mono mt-1">
                      Mejor por dist: {Object.entries(lvl.bestRatioByDist)
                        .map(([k, v]) => [Number(k), v] as const)
                        .sort((a, b) => a[0] - b[0])
                        .map(([k, v]) => `${k}${d.distanceUnit}: ${v.ratio.toFixed(2)}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {d.type === "GO_TO_CLUB" ? (
                    <span className="gf-display text-xl text-[var(--fairway)]">
                      {lvl.currentClub ? CLUB_LABEL[lvl.currentClub] : "—"}
                    </span>
                  ) : d.format === "STREAK_BY_DIST" ? (
                    <span className="gf-display text-xl text-[var(--fairway)]">
                      {lvl.currentDistance ?? "—"}
                      <span className="text-xs ml-0.5">{d.distanceUnit}</span>
                    </span>
                  ) : d.format === "RATIO_HIGHER" && lvl.bestRatio ? (
                    <div>
                      <span className="gf-display text-xl text-[var(--fairway)]">
                        {(lvl.bestRatio.ratio * 100).toFixed(0)}%
                      </span>
                      <div className="text-[10px] text-[var(--muted)] gf-mono">
                        {lvl.bestRatio.inTarget}/{lvl.bestRatio.balls}
                      </div>
                    </div>
                  ) : (
                    <span className="gf-display text-xl text-[var(--fairway)]">—</span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Link href="/range/pp/nueva" className="gf-btn w-full">
        + Nueva sesión PP
      </Link>

      <SectionHeader>Sesiones</SectionHeader>
      {sessions.length === 0 && (
        <Card className="text-center text-sm text-[var(--muted)]">
          Sin sesiones todavía
        </Card>
      )}
      <div className="space-y-2">
        {sessions.map((s) => (
          <Link key={s.id} href={`/range/pp/${s.id}`}>
            <Card className="!p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold gf-mono text-sm">
                  {new Date(s.date).toLocaleDateString("es-AR")}
                </span>
                <Pill>{s.drills.length} drills</Pill>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.drills.map((d) => {
                  const def = DRILL_BY_TYPE[d.drillType as DrillType];
                  if (!def) return null;
                  const data = parseAttempts(d.attemptsJson, def.format);
                  let score: string = "—";
                  if (data.type === "STREAK_BY_DIST" && data.attempts.length > 0) {
                    const max = Math.max(...data.attempts.map((a) => a.streak));
                    score = `${max}`;
                  } else if (data.type === "RATIO_LOWER_BY_DIST" && data.attempts.length > 0) {
                    const totS = data.attempts.reduce((a, x) => a + x.strokes, 0);
                    const totB = data.attempts.reduce((a, x) => a + x.balls, 0);
                    score = totB > 0 ? (totS / totB).toFixed(2) : "—";
                  } else if (data.type === "RATIO_HIGHER" && data.attempts.length > 0) {
                    const totIn = data.attempts.reduce((a, x) => a + x.inTarget, 0);
                    const totB = data.attempts.reduce((a, x) => a + x.balls, 0);
                    score = totB > 0 ? `${((totIn / totB) * 100).toFixed(0)}%` : "—";
                  } else if (data.type === "LEGACY_NUMBER_ARRAY" && data.attempts.length > 0) {
                    score = def.scoring === "BEAT_BEST_LOWER_BY_1"
                      ? String(data.attempts.reduce((a, b) => a + b, 0))
                      : String(Math.max(...data.attempts));
                  }
                  return (
                    <span
                      key={d.id}
                      className="text-[10px] gf-pill"
                      style={d.leveledUp ? { background: "#d4f4dd", color: "var(--green)" } : undefined}
                    >
                      {def.shortLabel}{d.club ? ` ${CLUB_LABEL[d.club] ?? d.club}` : ""}: {score}
                      {d.leveledUp && " 🎯"}
                    </span>
                  );
                })}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
