import { prisma } from "@/lib/db";
import { Card, KPI, SectionHeader } from "@/components/ui/Card";
import { computeRoundKPIs, type HoleData } from "@/lib/scoring-method";
import { DRILL_BY_TYPE, CLUB_LABEL as PP_CLUB_LABEL, type DrillType } from "@/lib/pp-drills";
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

  const last5 = summaries.slice(0, 5);
  const avgScore = last5.length > 0 ? last5.reduce((s, x) => s + x.kpis.totalScore, 0) / last5.length : 0;
  const avgNoDouble = last5.length > 0 ? last5.reduce((s, x) => s + x.kpis.pctNoDoubleBogey, 0) / last5.length : 0;
  const avgPutts = last5.length > 0
    ? last5.reduce((s, x) => s + (x.kpis.puttsDataHoles > 0 ? x.kpis.avgPuttsPerHole : 0), 0) / last5.length
    : 0;

  // Drills aggregations por tipo
  type DrillStat = {
    type: DrillType;
    label: string;
    sessions: number;
    achievements: number;
    bestScore: number | null;
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
    const allAttempts = drills.flatMap((d) => (d.attemptsJson as number[] | null) ?? []);
    const best = allAttempts.length === 0
      ? null
      : def.scoring === "BEAT_BEST_LOWER_BY_1"
      ? Math.min(...drills.map((d) => {
          const att = (d.attemptsJson as number[] | null) ?? [];
          return att.reduce((a, b) => a + b, 0);
        }).filter((s) => s > 0))
      : Math.max(...allAttempts);
    let lastDate: Date | null = null;
    for (const s of ppSessions) {
      for (const d of s.drills) {
        if (d.drillType !== type) continue;
        if (!lastDate || s.date > lastDate) lastDate = s.date;
      }
    }
    let currentLevel = "—";
    if (def.type === "GO_TO_CLUB") {
      // último palo logrado 9/9
      const { GO_TO_CLUB_LADDER } = await import("@/lib/pp-drills");
      let bestRank = -1;
      for (const d of drills) {
        if (!d.club) continue;
        const att = (d.attemptsJson as number[] | null) ?? [];
        const score = att.length > 0 ? Math.max(...att) : 0;
        if (score === def.scoreOf) {
          const rank = GO_TO_CLUB_LADDER.indexOf(d.club);
          if (rank > bestRank) bestRank = rank;
        }
      }
      // Nivel actual = el último palo donde completaste 9/9 (no el siguiente)
      const club = bestRank === -1 ? GO_TO_CLUB_LADDER[0] : GO_TO_CLUB_LADDER[bestRank];
      currentLevel = PP_CLUB_LABEL[club] ?? club;
    } else if (def.distanceStep) {
      let bestDist = -Infinity;
      for (const d of drills) {
        if (d.distance == null) continue;
        const att = (d.attemptsJson as number[] | null) ?? [];
        const score = att.length > 0 ? Math.max(...att) : 0;
        if (score === def.scoreOf && d.distance > bestDist) bestDist = d.distance;
      }
      // Nivel actual = última distancia donde completaste el target (no la siguiente)
      const dist = bestDist === -Infinity ? def.defaultDistance : bestDist;
      currentLevel = `${dist}${def.distanceUnit}`;
    } else {
      currentLevel = `${def.defaultDistance}${def.distanceUnit}`;
    }
    drillStats.push({
      type: def.type,
      label: def.shortLabel,
      sessions: drills.length,
      achievements: drills.filter((d) => d.leveledUp).length,
      bestScore: best,
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

      <SectionHeader>Promedios últimas 5 rondas</SectionHeader>
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Score" value={avgScore.toFixed(0)} />
        <KPI label="Sin 2x" value={`${avgNoDouble.toFixed(0)}%`} />
        <KPI label="Putts/h" value={avgPutts.toFixed(1)} />
      </div>

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
                    {kpis.holesPlayed === 18 ? `${kpis.scoreVsPar >= 0 ? "+" : ""}${kpis.scoreVsPar}` : `${kpis.holesPlayed}h`}
                  </td>
                  <td className="p-1 text-right gf-mono">{kpis.pctNoDoubleBogey.toFixed(0)}%</td>
                  <td className="p-1 text-right gf-mono">{kpis.totalPutts || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
                  <td className="p-1 text-right gf-mono">{d.bestScore ?? "—"}</td>
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
