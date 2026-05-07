import { prisma } from "@/lib/db";
import { Card, KPI, SectionHeader } from "@/components/ui/Card";
import { computeRoundKPIs, type HoleData } from "@/lib/scoring-method";
import {
  DRILL_BY_TYPE,
  CLUB_LABEL as PP_CLUB_LABEL,
  GO_TO_CLUB_LADDER,
  parseAttempts,
  maxStreakByDistance,
  ratioLowerByDistance,
  ratioHigherTotal,
  type DrillType,
} from "@/lib/pp-drills";
import Link from "next/link";

export const dynamic = "force-dynamic";

const RANGE_CLUB_LABEL: Record<string, string> = {
  DRIVER: "Driver", WOOD_3: "Madera 3", WOOD_5: "Madera 5", HYBRID: "Híbrido",
  IRON_3: "Hierro 3", IRON_4: "Hierro 4", IRON_5: "Hierro 5", IRON_6: "Hierro 6",
  IRON_7: "Hierro 7", IRON_8: "Hierro 8", IRON_9: "Hierro 9",
  PW: "PW", GW: "GW", SW: "SW", LW: "LW",
};

const CLUB_ORDER = [
  "DRIVER", "WOOD_3", "WOOD_5", "HYBRID",
  "IRON_3", "IRON_4", "IRON_5", "IRON_6", "IRON_7", "IRON_8", "IRON_9",
  "PW", "GW", "SW", "LW",
];

export default async function StatsPage() {
  const me = await prisma.player.findFirst({ where: { isMe: true } });
  if (!me) {
    return (
      <div className="px-4 pt-6">
        <Card className="text-center">
          <p className="text-sm text-[var(--muted)] mb-3">
            Configurá tu perfil primero
          </p>
          <Link href="/jugadores" className="gf-btn inline-block">
            Ir a Setup
          </Link>
        </Card>
      </div>
    );
  }

  const [rounds, ppSessions, rangeSessions] = await Promise.all([
    prisma.round.findMany({
      where: { players: { some: { playerId: me.id } } },
      orderBy: { date: "desc" },
      take: 30,
      include: {
        course: { include: { holes: { orderBy: { number: "asc" } } } },
        players: { where: { playerId: me.id }, include: { holes: true } },
      },
    }),
    prisma.practiceSession.findMany({
      orderBy: { date: "desc" },
      include: { drills: true },
    }),
    prisma.rangeSession.findMany({
      orderBy: { date: "asc" },
      include: { shots: true },
    }),
  ]);

  // Round summaries
  const summaries = rounds
    .map((r) => {
      const rp = r.players[0];
      if (!rp) return null;
      const parByNumber = new Map(r.course.holes.map((h) => [h.number, h.par]));
      const holes: HoleData[] = rp.holes.map((h) => ({
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
      const kpis = computeRoundKPIs(holes, {
        enterSzYds: r.enterSzYds,
        downInSzStrokes: r.downInSzStrokes,
        onePuttCircleFt: r.onePuttCircleFt,
        twoPuttCircleYds: r.twoPuttCircleYds,
      });
      return { round: r, kpis };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.kpis.holesPlayed > 0);

  // Solo rondas completadas: holesPlayed cargados coincide con la planeada de la ronda
  function isComplete(s: typeof summaries[number]) {
    return s.kpis.holesPlayed >= s.round.holesPlayed;
  }
  const completed = summaries.filter(isComplete);
  const completed18 = completed.filter((s) => s.round.holesPlayed === 18);
  const completed9 = completed.filter((s) => s.round.holesPlayed === 9);

  function avgs(items: typeof summaries) {
    if (items.length === 0) return null;
    const score = items.reduce((s, x) => s + x.kpis.totalScore, 0) / items.length;
    const noDouble = items.reduce((s, x) => s + x.kpis.pctNoDoubleBogey, 0) / items.length;
    const putts = items.reduce((s, x) => s + (x.kpis.puttsDataHoles > 0 ? x.kpis.avgPuttsPerHole : 0), 0) / items.length;
    return { score, noDouble, putts };
  }
  const avg18 = avgs(completed18.slice(0, 5));
  const avg9 = avgs(completed9.slice(0, 5));

  // Drills aggregations por tipo
  type DrillStat = {
    type: DrillType;
    label: string;
    sessions: number;
    achievements: number;
    bestDisplay: string;       // texto formateado del mejor récord
    lastDate: Date | null;
    currentLevel: string;
  };
  const drillStats: DrillStat[] = [];
  const drillsByType = new Map<string, typeof ppSessions[number]["drills"]>();
  for (const s of ppSessions) {
    for (const d of s.drills) {
      if (!drillsByType.has(d.drillType)) drillsByType.set(d.drillType, []);
      drillsByType.get(d.drillType)!.push(d);
    }
  }
  for (const [type, drills] of Array.from(drillsByType.entries())) {
    const def = DRILL_BY_TYPE[type as DrillType];
    if (!def) continue;
    let lastDate: Date | null = null;
    for (const s of ppSessions) {
      for (const d of s.drills) {
        if (d.drillType !== type) continue;
        if (!lastDate || s.date > lastDate) lastDate = s.date;
      }
    }

    let currentLevel = "—";
    let bestDisplay = "—";
    const target = def.levelUpStreak ?? def.scoreOf;

    if (def.type === "GO_TO_CLUB") {
      let bestRank = -1;
      let bestScore = 0;
      for (const d of drills) {
        if (!d.club) continue;
        const data = parseAttempts(d.attemptsJson, "LEGACY_NUMBER_ARRAY");
        if (data.type !== "LEGACY_NUMBER_ARRAY") continue;
        const max = data.attempts.length > 0 ? Math.max(...data.attempts) : 0;
        bestScore = Math.max(bestScore, max);
        if (max === def.scoreOf) {
          const rank = GO_TO_CLUB_LADDER.indexOf(d.club);
          if (rank > bestRank) bestRank = rank;
        }
      }
      const club = bestRank === -1 ? GO_TO_CLUB_LADDER[0] : GO_TO_CLUB_LADDER[bestRank];
      currentLevel = PP_CLUB_LABEL[club] ?? club;
      bestDisplay = bestScore > 0 ? `${bestScore}/9` : "—";
    } else if (def.format === "STREAK_BY_DIST") {
      // Mejor streak por distancia + currentLevel = passedDist + step
      const allByDist: Record<number, number> = {};
      let bestPassedDist = -Infinity;
      for (const d of drills) {
        const data = parseAttempts(d.attemptsJson, "STREAK_BY_DIST");
        if (data.type === "STREAK_BY_DIST") {
          const m = maxStreakByDistance(data.attempts);
          for (const [k, v] of Object.entries(m)) {
            const dd = Number(k);
            allByDist[dd] = Math.max(allByDist[dd] ?? 0, v);
            if (v >= target && dd > bestPassedDist) bestPassedDist = dd;
          }
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && d.distance != null) {
          const max = data.attempts.length > 0 ? Math.max(...data.attempts) : 0;
          allByDist[d.distance] = Math.max(allByDist[d.distance] ?? 0, max);
          if (max >= target && d.distance > bestPassedDist) bestPassedDist = d.distance;
        }
      }
      const passed = bestPassedDist === -Infinity ? null : bestPassedDist;
      const dist = passed != null && def.distanceStep
        ? passed + def.distanceStep
        : (passed ?? def.defaultDistance);
      currentLevel = `${dist}${def.distanceUnit}`;
      const records = Object.entries(allByDist)
        .map(([k, v]) => [Number(k), v] as const)
        .sort((a, b) => b[1] - a[1]);
      if (records.length > 0) {
        bestDisplay = `${records[0][1]}@${records[0][0]}${def.distanceUnit}`;
      }
    } else if (def.format === "RATIO_LOWER_BY_DIST") {
      const bestByDist: Record<number, { strokes: number; balls: number; ratio: number }> = {};
      for (const d of drills) {
        const data = parseAttempts(d.attemptsJson, "RATIO_LOWER_BY_DIST");
        if (data.type === "RATIO_LOWER_BY_DIST") {
          const m = ratioLowerByDistance(data.attempts);
          for (const [k, v] of Object.entries(m)) {
            const dd = Number(k);
            const cur = bestByDist[dd];
            if (!cur || v.ratio < cur.ratio) bestByDist[dd] = v;
          }
        } else if (data.type === "LEGACY_NUMBER_ARRAY" && d.distance != null && data.attempts.length > 0) {
          const strokes = data.attempts.reduce((a, b) => a + b, 0);
          const balls = data.attempts.length;
          const ratio = strokes / balls;
          const cur = bestByDist[d.distance];
          if (!cur || ratio < cur.ratio) bestByDist[d.distance] = { strokes, balls, ratio };
        }
      }
      currentLevel = `${def.defaultDistance}${def.distanceUnit}`;
      const records = Object.entries(bestByDist)
        .map(([k, v]) => [Number(k), v] as const)
        .sort((a, b) => a[1].ratio - b[1].ratio);
      if (records.length > 0) {
        bestDisplay = `${records[0][1].ratio.toFixed(2)}@${records[0][0]}${def.distanceUnit}`;
      }
    } else if (def.format === "RATIO_HIGHER") {
      let best: { inTarget: number; balls: number; ratio: number } | null = null;
      for (const d of drills) {
        const data = parseAttempts(d.attemptsJson, "RATIO_HIGHER");
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
      currentLevel = `${def.defaultDistance}${def.distanceUnit}`;
      if (best) bestDisplay = `${(best.ratio * 100).toFixed(0)}%`;
    }

    drillStats.push({
      type: def.type,
      label: def.shortLabel,
      sessions: drills.length,
      achievements: drills.filter((d) => d.leveledUp).length,
      bestDisplay,
      lastDate,
      currentLevel,
    });
  }

  // Palos: agregado FlightScope
  const byClub = new Map<string, { shots: number; sessions: Set<string>; carrySum: number; smashSum: number; smashN: number }>();
  for (const sess of rangeSessions) {
    for (const sh of sess.shots) {
      if (sh.rowType !== "SHOT" || sh.carryYds == null) continue;
      if (!byClub.has(sess.club)) byClub.set(sess.club, { shots: 0, sessions: new Set(), carrySum: 0, smashSum: 0, smashN: 0 });
      const e = byClub.get(sess.club)!;
      e.shots++;
      e.sessions.add(sess.id);
      e.carrySum += sh.carryYds;
      if (sh.smashFactor != null) {
        e.smashSum += sh.smashFactor;
        e.smashN++;
      }
    }
  }
  const clubAgg = Array.from(byClub.entries())
    .map(([club, v]) => ({
      club,
      shots: v.shots,
      sessions: v.sessions.size,
      avgCarry: v.shots > 0 ? v.carrySum / v.shots : 0,
      avgSmash: v.smashN > 0 ? v.smashSum / v.smashN : null,
    }))
    .sort((a, b) => {
      const ai = CLUB_ORDER.indexOf(a.club);
      const bi = CLUB_ORDER.indexOf(b.club);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Stats</h1>
        <p className="text-sm text-[var(--muted)]">Resumen de tu juego</p>
      </header>

      <Link href="/stats/por-hoyo" className="gf-btn gf-btn-secondary w-full text-sm">
        🏌️ Stats por hoyo (cross-rondas)
      </Link>

      {avg18 ? (
        <>
          <SectionHeader>
            Promedios últimas 5 rondas (18 hoyos · {completed18.length} ronda{completed18.length === 1 ? "" : "s"} completas)
          </SectionHeader>
          <div className="grid grid-cols-3 gap-3">
            <KPI label="Score" value={avg18.score.toFixed(0)} />
            <KPI label="Sin 2x" value={`${avg18.noDouble.toFixed(0)}%`} />
            <KPI label="Putts/h" value={avg18.putts.toFixed(1)} />
          </div>
        </>
      ) : (
        <Card className="text-center text-xs text-[var(--muted)] !p-3">
          Sin rondas de 18 hoyos completadas todavía
        </Card>
      )}

      {avg9 && (
        <>
          <SectionHeader>
            Promedios últimas 5 rondas (9 hoyos · {completed9.length} ronda{completed9.length === 1 ? "" : "s"} completas)
          </SectionHeader>
          <div className="grid grid-cols-3 gap-3">
            <KPI label="Score" value={avg9.score.toFixed(0)} />
            <KPI label="Sin 2x" value={`${avg9.noDouble.toFixed(0)}%`} />
            <KPI label="Putts/h" value={avg9.putts.toFixed(1)} />
          </div>
        </>
      )}

      {/* Tabla rondas */}
      <SectionHeader>Rondas</SectionHeader>
      <Card className="!p-2 overflow-x-auto">
        {summaries.length === 0 ? (
          <p className="text-center text-xs text-[var(--muted)] p-4">No hay rondas todavía</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Fecha</th>
                <th className="text-left p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Cancha</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Score</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">±Par</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Sin 2x</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Putts</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(({ round, kpis }) => (
                <tr key={round.id} className="border-b border-[var(--green-pale)]">
                  <td className="p-1 gf-mono">
                    <Link href={`/rondas/${round.id}/resumen`}>
                      {new Date(round.date).toLocaleDateString("es-AR")}
                    </Link>
                  </td>
                  <td className="p-1">{round.course.name}</td>
                  <td className="p-1 text-right gf-mono font-semibold">{kpis.totalScore || "—"}</td>
                  <td className="p-1 text-right gf-mono">
                    {kpis.holesPlayed >= round.holesPlayed
                      ? `${kpis.scoreVsPar >= 0 ? "+" : ""}${kpis.scoreVsPar}`
                      : `${kpis.holesPlayed}/${round.holesPlayed}h`}
                  </td>
                  <td className="p-1 text-right gf-mono">{kpis.pctNoDoubleBogey.toFixed(0)}%</td>
                  <td className="p-1 text-right gf-mono">{kpis.totalPutts || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Niveles Scoring Method del jugador */}
      <SectionHeader>Niveles Scoring Method</SectionHeader>
      <Card className="!p-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Enter SZ
            </div>
            <div className="gf-display text-2xl text-[var(--fairway)]">
              {me.enterSzYds === 0 ? "GIR" : `${me.enterSzYds} yds`}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Down in SZ
            </div>
            <div className="gf-display text-2xl text-[var(--fairway)]">
              ≤ {me.downInSzStrokes} golpes
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              1-Putt circle
            </div>
            <div className="gf-display text-2xl text-[var(--fairway)]">
              {me.onePuttCircleFt} ft
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              2-Putt circle
            </div>
            <div className="gf-display text-2xl text-[var(--fairway)]">
              {me.twoPuttCircleYds} yds
            </div>
          </div>
        </div>
        <p className="text-[10px] text-[var(--muted)] mt-2">
          Subís nivel cuando lográs perfect run en una ronda (≥14 hoyos cargados al 100%).
        </p>
      </Card>

      {/* Tabla drills */}
      <SectionHeader>Drills (PP)</SectionHeader>
      <Card className="!p-2 overflow-x-auto">
        {drillStats.length === 0 ? (
          <p className="text-center text-xs text-[var(--muted)] p-4">No hay sesiones PP cargadas</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Drill</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Nivel</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Mejor</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Ses</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">🎯</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Última</th>
              </tr>
            </thead>
            <tbody>
              {drillStats.map((d) => (
                <tr key={d.type} className="border-b border-[var(--green-pale)]">
                  <td className="p-1">{d.label}</td>
                  <td className="p-1 text-right gf-mono font-semibold">{d.currentLevel}</td>
                  <td className="p-1 text-right gf-mono">{d.bestDisplay}</td>
                  <td className="p-1 text-right gf-mono">{d.sessions}</td>
                  <td className="p-1 text-right gf-mono">{d.achievements}</td>
                  <td className="p-1 text-right gf-mono text-[10px]">
                    {d.lastDate ? new Date(d.lastDate).toLocaleDateString("es-AR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Tabla palos FlightScope */}
      <SectionHeader>Palos (FlightScope)</SectionHeader>
      <Card className="!p-2 overflow-x-auto">
        {clubAgg.length === 0 ? (
          <p className="text-center text-xs text-[var(--muted)] p-4">No hay sesiones FlightScope</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Palo</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Avg Carry</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Smash</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Shots</th>
                <th className="text-right p-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">Ses</th>
              </tr>
            </thead>
            <tbody>
              {clubAgg.map((c) => (
                <tr key={c.club} className="border-b border-[var(--green-pale)]">
                  <td className="p-1">{RANGE_CLUB_LABEL[c.club] ?? c.club}</td>
                  <td className="p-1 text-right gf-mono font-semibold">{c.avgCarry.toFixed(0)}<span className="text-[var(--muted)] text-[9px]"> yds</span></td>
                  <td className="p-1 text-right gf-mono">{c.avgSmash != null ? c.avgSmash.toFixed(2) : "—"}</td>
                  <td className="p-1 text-right gf-mono">{c.shots}</td>
                  <td className="p-1 text-right gf-mono">{c.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
