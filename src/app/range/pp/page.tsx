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
  distToUi,
  uiUnit,
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
        const data = parseAttempts(s.attemptsJson, "GO_TO_DIR");
        // Máximo de FW por tanda: shape nuevo {fw,left,right} o legacy number[]
        let max = 0;
        if (data.type === "GO_TO_DIR" && data.attempts.length > 0) {
          max = Math.max(...data.attempts.map((a) => a.fw));
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && data.attempts.length > 0) {
          max = Math.max(...data.attempts);
        }
        if (max >= drill.scoreOf) {
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
      const passedDistance = bestLevelUpDist === -Infinity ? null : bestLevelUpDist;
      const currentDistance = passedDistance != null && drill.distanceStep
        ? passedDistance + drill.distanceStep
        : (passedDistance ?? drill.defaultDistance);
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

  // Plan TSM sugerido de la última ronda (misma lógica que el resumen: computeTsmPlan)
  const me = await prisma.player.findFirst({ where: { isMe: true } });
  let tsmPending: import("@/lib/tsm-plan").TsmPlanArea[] = [];
  let tsmDrillsParam = "";
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
      const { computeRoundKPIs } = await import("@/lib/scoring-method");
      const { computeTsmPlan, tsmPlanDrillTypes } = await import("@/lib/tsm-plan");
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
      const full = computeTsmPlan(holesData, config, kpis);
      tsmPending = full.filter((p) => p.errors > 0);
      tsmDrillsParam = tsmPlanDrillTypes(full).join(",");
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

      {tsmPending.length > 0 && (
        <>
          <SectionHeader>Sugerido (de tu última ronda) · área → drill → test</SectionHeader>
          <div className="space-y-2">
            {tsmPending.map((p) => (
              <Card key={p.area} className="!p-3" style={{ borderLeft: "4px solid var(--accent)" }}>
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-sm">{p.label}</span>
                  <span className="gf-display text-2xl text-[var(--accent)]">{p.errors}</span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{p.evidence}</div>
                <div className="text-xs mt-1 gf-mono">
                  Drill:{" "}
                  <strong>
                    {p.wedgeMatrixDrill
                      ? "Wedge Matrix"
                      : p.drill
                        ? DRILL_BY_TYPE[p.drill].shortLabel
                        : "al range"}
                  </strong>
                  {p.test && <> → Test: <strong>{DRILL_BY_TYPE[p.test].shortLabel}</strong></>}
                </div>
              </Card>
            ))}
            <Link
              href={`/range/pp/nueva${tsmDrillsParam ? `?drills=${tsmDrillsParam}` : ""}`}
              className="gf-btn w-full !py-2"
            >
              🎯 Practicar este plan
            </Link>
          </div>
        </>
      )}

      {/* Solo drills con historia — los nunca practicados no suman nada acá
          (el catálogo completo vive en la sesión, colapsado en "Agregar otro drill") */}
      <SectionHeader>Tu nivel actual por drill</SectionHeader>
      <div className="space-y-2">
        {DRILLS.filter(
          (d) =>
            (levels[d.type]?.sessionsAtCurrent ?? 0) > 0 ||
            (levels[d.type]?.achievementsCount ?? 0) > 0,
        ).length === 0 && (
          <p className="text-sm text-[var(--muted)] italic px-1">
            Todavía no hay sesiones registradas — arrancá con tu plan de arriba.
          </p>
        )}
        {DRILLS.map((d) => {
          const lvl = levels[d.type];
          if (!lvl) return null;
          if ((lvl.sessionsAtCurrent ?? 0) === 0 && (lvl.achievementsCount ?? 0) === 0)
            return null;
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
                        .map(([k, v]) => `${distToUi(d, k)} ${uiUnit(d)}: ${v}`)
                        .join(" · ")}
                    </div>
                  )}
                  {d.format === "RATIO_LOWER_BY_DIST" && lvl.bestRatioByDist && Object.keys(lvl.bestRatioByDist).length > 0 && (
                    <div className="text-[10px] text-[var(--muted)] gf-mono mt-1">
                      Mejor por dist: {Object.entries(lvl.bestRatioByDist)
                        .map(([k, v]) => [Number(k), v] as const)
                        .sort((a, b) => a[0] - b[0])
                        .map(([k, v]) => `${distToUi(d, k)} ${uiUnit(d)}: ${v.ratio.toFixed(2)}`)
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
                      {lvl.currentDistance != null ? distToUi(d, lvl.currentDistance) : "—"}
                      <span className="text-xs ml-0.5">{uiUnit(d)}</span>
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

      {/* Un solo botón de practicar: si hay plan ya está "Practicar este plan" arriba;
          este aparece solo cuando NO hay plan. Challenges queda aparte, explicado. */}
      {tsmPending.length === 0 && (
        <Link href="/range/pp/nueva" className="gf-btn w-full">
          🎯 Practicar (armá tu sesión)
        </Link>
      )}
      <Link href="/range/pp/challenges" className="gf-btn gf-btn-secondary w-full">
        📅 Challenges · mini-programas guiados de 7 días
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
