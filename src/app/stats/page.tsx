import { prisma } from "@/lib/db";
import { Card, KPI, SectionHeader } from "@/components/ui/Card";
import { computeRoundKPIs, type HoleData } from "@/lib/scoring-method";
import { computeTiger5Round, avgTiger5, TIGER5_LABELS } from "@/lib/tiger5";
import { tallyKeys, topKeys, KEY_AREA, KEY_BY_ID } from "@/lib/sm-keys";
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

  // Tiger 5 — últimas 5 rondas completas
  const last5Completed = completed.slice(0, 5);
  const tiger5Last = last5Completed[0]
    ? computeTiger5Round(
        last5Completed[0].round.players[0].holes.map((h) => {
          const par = last5Completed[0].round.course.holes.find((c) => c.number === h.holeNumber)?.par ?? 4;
          return {
            par,
            score: h.score,
            putts: h.putts,
            distanceInRegYds: h.distanceInRegYds,
            strokesInsideSz: h.strokesInsideSz,
          };
        }),
      )
    : null;
  const tiger5Avg = avgTiger5(
    last5Completed.map((s) =>
      computeTiger5Round(
        s.round.players[0].holes.map((h) => {
          const par = s.round.course.holes.find((c) => c.number === h.holeNumber)?.par ?? 4;
          return {
            par,
            score: h.score,
            putts: h.putts,
            distanceInRegYds: h.distanceInRegYds,
            strokesInsideSz: h.strokesInsideSz,
          };
        }),
      ),
    ),
  );

  // Keys cross-rondas — últimas 5 rondas
  const allKeysLast5 = last5Completed.flatMap((s) =>
    s.round.players[0].holes.map((h) => (h.keysBroken as number[] | null) ?? []),
  );
  const keysCount = tallyKeys(allKeysLast5);
  const keysTop3 = topKeys(keysCount, 3);
  const totalKeysLast5 = Object.values(keysCount).reduce((s, v) => s + v, 0);

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

  // Palos: agregado FlightScope (agrupa por shot.club, fallback a sess.club)
  const byClub = new Map<string, {
    shots: number;
    sessions: Set<string>;
    carries: number[];
    lats: number[];
    smashes: number[];
  }>();
  for (const sess of rangeSessions) {
    for (const sh of sess.shots) {
      if (sh.rowType !== "SHOT" || sh.carryYds == null) continue;
      const club = sh.club ?? sess.club;
      if (!byClub.has(club)) {
        byClub.set(club, {
          shots: 0,
          sessions: new Set(),
          carries: [],
          lats: [],
          smashes: [],
        });
      }
      const e = byClub.get(club)!;
      e.shots++;
      e.sessions.add(sess.id);
      e.carries.push(sh.carryYds);
      if (sh.lateralYds != null) {
        const lat = sh.lateralDir === "L" ? -sh.lateralYds : sh.lateralYds;
        e.lats.push(lat);
      }
      if (sh.smashFactor != null) e.smashes.push(sh.smashFactor);
    }
  }
  function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
  }
  const clubAgg = Array.from(byClub.entries())
    .map(([club, v]) => {
      const carriesSorted = [...v.carries].sort((a, b) => a - b);
      const med = carriesSorted.length > 0 ? percentile(carriesSorted, 0.5) : 0;
      const safe = percentile(carriesSorted, 0.25);
      const good = percentile(carriesSorted, 0.9);
      const insideBand = v.carries.filter((c) => Math.abs(c - med) <= 10).length;
      const confidence = v.carries.length > 0 ? (insideBand / v.carries.length) * 100 : 0;
      const latsSorted = [...v.lats].sort((a, b) => a - b);
      const latMed = latsSorted.length > 0 ? percentile(latsSorted, 0.5) : 0;
      const smashesSorted = [...v.smashes].sort((a, b) => a - b);
      return {
        club,
        shots: v.shots,
        sessions: v.sessions.size,
        carrySafe: safe,
        carryAvg: med,
        carryGood: good,
        confidence,
        latMed,
        latDisplay:
          Math.abs(latMed) < 3
            ? "—"
            : `${Math.abs(latMed).toFixed(0)}y ${latMed > 0 ? "R" : "L"}`,
        smash: smashesSorted.length > 0 ? percentile(smashesSorted, 0.5) : null,
      };
    })
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

      {/* Tiger 5 dashboard — últimas 5 rondas */}
      {last5Completed.length > 0 && (
        <>
          <SectionHeader>🐅 Tiger 5 · últimas {last5Completed.length} rondas</SectionHeader>
          <Card className="!p-3">
            <table className="w-full text-[11px] gf-mono">
              <thead>
                <tr className="text-[var(--muted)] uppercase tracking-wider text-[9px]">
                  <th className="text-left py-1">Métrica</th>
                  <th className="text-right" title="Última ronda">Última</th>
                  <th className="text-right" title="Promedio últimas 5">Avg</th>
                </tr>
              </thead>
              <tbody>
                {TIGER5_LABELS.map(({ key, label, hint }) => {
                  const last = tiger5Last?.[key] ?? 0;
                  const avg = tiger5Avg[key];
                  const trend = last < avg ? "↓" : last > avg ? "↑" : "=";
                  // ↓ es mejor (menos errores)
                  const trendColor = trend === "↓" ? "var(--green)" : trend === "↑" ? "var(--red)" : "var(--muted)";
                  return (
                    <tr key={key} className="border-t border-[var(--green-pale)]">
                      <td className="py-1.5">
                        <div className="font-semibold">{label}</div>
                        <div className="text-[9px] text-[var(--muted)]">{hint}</div>
                      </td>
                      <td className="text-right">
                        {last}
                        <span style={{ color: trendColor }} className="ml-1 text-[9px]">{trend}</span>
                      </td>
                      <td className="text-right text-[var(--muted)]">{avg.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-[var(--muted)] mt-2">
              Las 5 métricas más correlacionadas con score alto (DECADE).
              ↓ = mejor (menos errores) que tu promedio.
            </p>
          </Card>
        </>
      )}

      {/* Keys cross-rondas */}
      {totalKeysLast5 > 0 && (
        <>
          <SectionHeader>🎯 Keys cross-rondas · top 3</SectionHeader>
          <div className="space-y-2">
            {keysTop3.map(({ key, count }) => {
              const meta = KEY_AREA[key.id];
              const areaColor =
                meta.area === "DECADE"
                  ? "var(--accent)"
                  : meta.area === "MENTAL"
                  ? "var(--green)"
                  : meta.area === "PP"
                  ? "var(--fairway)"
                  : "var(--muted)";
              return (
                <Card
                  key={key.id}
                  className="!p-3"
                  style={{ borderLeft: `4px solid ${areaColor}` }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        {key.id}. {key.label}
                        <span
                          className="gf-pill text-[9px]"
                          style={{ background: areaColor, color: "white" }}
                        >
                          {meta.area}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        💡 {meta.tip}
                      </div>
                    </div>
                    <span className="gf-display text-2xl" style={{ color: areaColor }}>
                      {count}×
                    </span>
                  </div>
                </Card>
              );
            })}
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--muted)] py-1">
                Ver todas ({totalKeysLast5} keys rotas en {last5Completed.length} rondas)
              </summary>
              <div className="space-y-0.5 mt-2 gf-mono text-[11px]">
                {Object.entries(keysCount)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([id, count]) => (
                    <div key={id} className="flex justify-between">
                      <span>{id}. {KEY_BY_ID[parseInt(id)].short}</span>
                      <span>{count}</span>
                    </div>
                  ))}
              </div>
            </details>
          </div>
        </>
      )}

      {/* 🌡️ Golfing Thermostat */}
      {(me.scoreThermostatMin || me.scoreThermostatMax || me.scoreDesired) && (
        <>
          <SectionHeader>🌡️ Golfing Thermostat</SectionHeader>
          <Card className="!p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)]">
                  Min habitual
                </div>
                <div className="gf-display text-2xl text-[var(--fairway)]">
                  {me.scoreThermostatMin ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)]">
                  Max habitual
                </div>
                <div className="gf-display text-2xl text-[var(--fairway)]">
                  {me.scoreThermostatMax ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)]">
                  Score deseado
                </div>
                <div className="gf-display text-2xl text-[var(--accent)]">
                  {me.scoreDesired ?? "—"}
                </div>
              </div>
            </div>
            {/* Comparativa con últimas rondas */}
            {completed.length > 0 && me.scoreThermostatMin != null && me.scoreThermostatMax != null && (
              <div className="mt-3 pt-2 border-t border-[var(--green-pale)]">
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">
                  Últimas {Math.min(completed.length, 5)} rondas
                </div>
                <div className="flex flex-wrap gap-1">
                  {completed.slice(0, 5).map((s) => {
                    const score = s.kpis.totalScore;
                    const inRange =
                      score >= me.scoreThermostatMin! && score <= me.scoreThermostatMax!;
                    const beatDesired = me.scoreDesired != null && score <= me.scoreDesired;
                    return (
                      <span
                        key={s.round.id}
                        className="gf-pill gf-mono text-[10px]"
                        style={{
                          background: beatDesired
                            ? "var(--green)"
                            : inRange
                            ? "var(--green-pale)"
                            : "#fde0dc",
                          color: beatDesired
                            ? "white"
                            : inRange
                            ? "var(--fairway)"
                            : "var(--red)",
                        }}
                      >
                        {score}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-[10px] text-[var(--muted)] mt-2">
              Tu rango habitual. Para bajarlo, primero hay que creerlo: visualizá
              tu ronda antes de jugar.
            </p>
          </Card>
        </>
      )}

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

      {/* Tabla palos FlightScope — para decidir palo en cancha */}
      <div id="palos" style={{ scrollMarginTop: 16 }}>
        <SectionHeader>Palos (FlightScope) · decidir palo</SectionHeader>
      </div>
      <Card className="!p-2 overflow-x-auto">
        {clubAgg.length === 0 ? (
          <p className="text-center text-xs text-[var(--muted)] p-4">
            No hay sesiones FlightScope
          </p>
        ) : (
          <>
            <table className="w-full text-[11px] gf-mono">
              <thead>
                <tr className="text-[var(--muted)] uppercase tracking-wider text-[9px]">
                  <th className="text-left p-1">Palo</th>
                  <th
                    className="text-right p-1"
                    title="P25 · casi siempre llegás"
                  >
                    Safe
                  </th>
                  <th
                    className="text-right p-1"
                    title="Mediana · distancia típica"
                  >
                    Avg
                  </th>
                  <th
                    className="text-right p-1"
                    title="Dirección típica · apuntá al lado opuesto"
                  >
                    Lateral
                  </th>
                </tr>
              </thead>
              <tbody>
                {clubAgg.map((c) => (
                  <tr
                    key={c.club}
                    className="border-t border-[var(--green-pale)]"
                  >
                    <td className="p-1.5 font-semibold">
                      {RANGE_CLUB_LABEL[c.club] ?? c.club}
                      <span className="text-[9px] text-[var(--muted)] font-normal ml-1">
                        ({c.shots})
                      </span>
                    </td>
                    <td className="p-1 text-right text-[var(--muted)]">
                      {c.carrySafe.toFixed(0)}
                    </td>
                    <td className="p-1 text-right font-bold text-[var(--fairway)]">
                      {c.carryAvg.toFixed(0)}
                    </td>
                    <td
                      className="p-1 text-right"
                      style={{
                        color:
                          c.latDisplay === "—"
                            ? "var(--muted)"
                            : "var(--accent)",
                      }}
                    >
                      {c.latDisplay}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-[var(--muted)] mt-2 px-1">
              <strong>Safe</strong>: P25 — casi siempre llegás ·{" "}
              <strong>Avg</strong>: mediana — típico · <strong>Lateral</strong>:
              dirección típica (R 10y = apuntá 10y a la izquierda)
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
