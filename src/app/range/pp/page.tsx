import { prisma } from "@/lib/db";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import { DRILL_BY_TYPE, DRILLS, CLUB_LABEL, type DrillType } from "@/lib/pp-drills";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getLevels() {
  // Mismo cálculo que /api/pp/levels — replicado server-side
  const sessions = await prisma.practiceSession.findMany({
    orderBy: { date: "asc" },
    include: { drills: true },
  });
  const { GO_TO_CLUB_LADDER, bestHistoricalScore } = await import("@/lib/pp-drills");

  type LvlInfo = {
    currentDistance?: number;
    currentClub?: string;
    bestAtCurrent: number | null;
    achievementsCount: number;
    sessionsAtCurrent: number;
  };
  const result: Record<string, LvlInfo> = {};

  for (const drill of DRILLS) {
    const drillSessions = sessions.flatMap((s) =>
      s.drills
        .filter((d) => d.drillType === drill.type)
        .map((d) => ({
          distance: d.distance,
          club: d.club,
          attempts: (d.attemptsJson as number[]) ?? [],
          leveledUp: d.leveledUp,
        })),
    );
    const achievementsCount = drillSessions.filter((s) => s.leveledUp).length;

    if (drill.type === "GO_TO_CLUB") {
      let bestRank = -1;
      for (const s of drillSessions) {
        if (!s.club) continue;
        const score = s.attempts.length > 0 ? Math.max(...s.attempts) : 0;
        if (score === drill.scoreOf) {
          const rank = GO_TO_CLUB_LADDER.indexOf(s.club);
          if (rank > bestRank) bestRank = rank;
        }
      }
      // Nivel actual = el último palo donde completaste 9/9 (no el siguiente)
      const currentClub = bestRank === -1
        ? GO_TO_CLUB_LADDER[0]
        : GO_TO_CLUB_LADDER[bestRank];
      result[drill.type] = {
        currentClub,
        bestAtCurrent: null,
        achievementsCount,
        sessionsAtCurrent: drillSessions.filter((s) => s.club === currentClub).length,
      };
      continue;
    }
    if (drill.scoring === "PCT_HITS_PERFECT" && drill.distanceStep) {
      let bestDistance = -Infinity;
      for (const s of drillSessions) {
        if (s.distance == null) continue;
        const score = s.attempts.length > 0 ? Math.max(...s.attempts) : 0;
        if (score === drill.scoreOf && s.distance > bestDistance) bestDistance = s.distance;
      }
      // Nivel actual = la última distancia donde completaste el target (no la siguiente)
      const currentDistance = bestDistance === -Infinity
        ? drill.defaultDistance
        : bestDistance;
      const atCurrent = drillSessions.filter((s) => s.distance === currentDistance);
      result[drill.type] = {
        currentDistance,
        bestAtCurrent: bestHistoricalScore(drill, atCurrent.map((s) => s.attempts)),
        achievementsCount,
        sessionsAtCurrent: atCurrent.length,
      };
      continue;
    }
    result[drill.type] = {
      currentDistance: drill.defaultDistance,
      bestAtCurrent: bestHistoricalScore(drill, drillSessions.map((s) => s.attempts)),
      achievementsCount,
      sessionsAtCurrent: drillSessions.length,
    };
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
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm">{d.shortLabel}</div>
                  <div className="text-[10px] text-[var(--muted)] gf-mono">
                    PP {d.ppCode} · {lvl.sessionsAtCurrent} sesion{lvl.sessionsAtCurrent === 1 ? "" : "es"}
                  </div>
                </div>
                <div className="text-right">
                  {d.type === "GO_TO_CLUB" ? (
                    <span className="gf-display text-xl text-[var(--fairway)]">
                      {lvl.currentClub ? CLUB_LABEL[lvl.currentClub] : "—"}
                    </span>
                  ) : (
                    <div>
                      <span className="gf-display text-xl text-[var(--fairway)]">
                        {lvl.currentDistance ?? "—"}
                        <span className="text-xs ml-0.5">{d.distanceUnit}</span>
                      </span>
                      {lvl.bestAtCurrent != null && (
                        <div className="text-[10px] text-[var(--muted)] gf-mono">
                          mejor: {lvl.bestAtCurrent}
                          {d.scoring !== "BEAT_BEST_LOWER_BY_1" && `/${d.scoreOf}`}
                        </div>
                      )}
                    </div>
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
                  const attempts = (d.attemptsJson as number[] | null) ?? [];
                  const score = attempts.length === 0
                    ? "—"
                    : def.scoring === "BEAT_BEST_LOWER_BY_1"
                    ? attempts.reduce((a, b) => a + b, 0)
                    : Math.max(...attempts);
                  return (
                    <span
                      key={d.id}
                      className="text-[10px] gf-pill"
                      style={d.leveledUp ? { background: "#d4f4dd", color: "var(--green)" } : undefined}
                    >
                      {def.shortLabel}{d.club ? ` ${CLUB_LABEL[d.club] ?? d.club}` : d.distance ? ` ${d.distance}${def.distanceUnit}` : ""}: {score}
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
