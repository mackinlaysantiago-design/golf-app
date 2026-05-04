import { prisma } from "@/lib/db";
import { Card, KPI, Pill, SectionHeader } from "@/components/ui/Card";
import { computeRoundKPIs, type HoleData } from "@/lib/scoring-method";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const me = await prisma.player.findFirst({ where: { isMe: true } });
  if (!me) return { me: null, lastRound: null, recentRounds: [], lastRangeSession: null, inProgressRound: null };

  const recentRounds = await prisma.round.findMany({
    where: { players: { some: { playerId: me.id } } },
    orderBy: { date: "desc" },
    take: 5,
    include: {
      course: true,
      players: { where: { playerId: me.id }, include: { holes: true } },
    },
  });

  // Ronda en curso: la más reciente con < 18 hoyos cargados
  const inProgressRound = recentRounds.find((r) => {
    const meRP = r.players[0];
    if (!meRP) return false;
    const played = meRP.holes.filter((h) => h.score && h.score > 0).length;
    return played < 18;
  }) ?? null;

  // Última ronda completada para los KPIs (saltea las en curso)
  const lastRound = recentRounds.find((r) => {
    const meRP = r.players[0];
    if (!meRP) return false;
    const played = meRP.holes.filter((h) => h.score && h.score > 0).length;
    return played > 0;
  }) ?? null;

  const lastRangeSession = await prisma.rangeSession.findFirst({
    orderBy: { date: "desc" },
    include: { shots: { where: { rowType: "AVG" } } },
  });

  return { me, lastRound, recentRounds, lastRangeSession, inProgressRound };
}

function buildHoleData(rp: { holes: { holeNumber: number; strokesToEnterSz: number | null; distanceInRegYds: number | null; strokesInsideSz: number | null; putts: number | null; firstPuttDistanceFt: number | null; puttMadeDistanceFt: number | null; puttsInside1PuttCircle: number | null; score: number | null }[] }, courseHoles: { number: number; par: number }[]): HoleData[] {
  const parByNumber = new Map(courseHoles.map((h) => [h.number, h.par]));
  return rp.holes.map((h) => ({
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
}

export default async function HomePage() {
  const { me, lastRound, recentRounds, lastRangeSession, inProgressRound } = await getDashboardData();

  // KPIs de la última ronda
  let lastKpis = null;
  let lastCourseHoles: { number: number; par: number }[] = [];
  if (lastRound && lastRound.players[0]) {
    lastCourseHoles = await prisma.courseHole.findMany({
      where: { courseId: lastRound.courseId },
      orderBy: { number: "asc" },
      select: { number: true, par: true },
    });
    const holes = buildHoleData(lastRound.players[0], lastCourseHoles);
    lastKpis = computeRoundKPIs(holes, {
      enterSzYds: lastRound.enterSzYds,
      downInSzStrokes: lastRound.downInSzStrokes,
      onePuttCircleFt: lastRound.onePuttCircleFt,
      twoPuttCircleYds: lastRound.twoPuttCircleYds,
    });
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      {/* Header */}
      <header className="gf-fadeup">
        <h1 className="gf-display text-5xl text-[var(--fairway)]">Golf Performance</h1>
        <p className="text-sm text-[var(--muted)]">
          {me ? `Hola ${me.name}` : "Configurá tu perfil para arrancar"}
          {me?.hcpIndex != null && (
            <>
              {" · "}
              <Pill>HCP {me.hcpIndex.toFixed(1)}</Pill>
            </>
          )}
        </p>
      </header>

      {/* Banner Ronda en curso */}
      {inProgressRound && (
        <Link href={`/rondas/${inProgressRound.id}`} className="block gf-fadeup">
          <Card
            variant="fairway"
            className="!p-4 flex justify-between items-center"
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">
                Ronda en curso
              </div>
              <div className="font-bold text-lg">{inProgressRound.course.name}</div>
              <div className="text-xs opacity-90 gf-mono">
                {inProgressRound.players[0]?.holes.filter(
                  (h) => h.score && h.score > 0,
                ).length}/18 hoyos · seguir cargando
              </div>
            </div>
            <span className="text-2xl">›</span>
          </Card>
        </Link>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 gf-fadeup gf-fadeup-1">
        <Link href="/range">
          <Card className="text-center !p-4">
            <div className="text-3xl mb-1">🎯</div>
            <div className="font-semibold text-[var(--fairway)]">Range</div>
            <div className="text-xs text-[var(--muted)]">PP / FlightScope</div>
          </Card>
        </Link>
        <Link href="/rondas/nueva">
          <Card className="text-center !p-4">
            <div className="text-3xl mb-1">🏌️</div>
            <div className="font-semibold text-[var(--fairway)]">Nueva Ronda</div>
            <div className="text-xs text-[var(--muted)]">Solo / 2 / 3 / 4P</div>
          </Card>
        </Link>
      </div>

      {/* KPIs últimos datos cargados */}
      {lastKpis && lastRound ? (
        <>
          <SectionHeader>Última ronda · {lastRound.course.name}</SectionHeader>
          <div className="grid grid-cols-2 gap-3 gf-fadeup gf-fadeup-2">
            <KPI
              label="Score"
              value={lastKpis.totalScore}
              hint={`${lastKpis.scoreVsPar >= 0 ? "+" : ""}${lastKpis.scoreVsPar} vs par`}
              tone={lastKpis.scoreVsPar <= 0 ? "good" : lastKpis.scoreVsPar <= 6 ? "neutral" : "warn"}
            />
            <KPI
              label="Sin doble bogey"
              value={lastKpis.pctNoDoubleBogey.toFixed(0)}
              unit="%"
              tone={lastKpis.pctNoDoubleBogey >= 75 ? "good" : "warn"}
            />
            <KPI
              label="Enter SZ"
              value={`${lastKpis.enterSzCount}/${lastKpis.enterSzDataHoles || "—"}`}
              hint={`≤ ${lastRound.enterSzYds} yds`}
            />
            <KPI
              label="Down in SZ"
              value={`${lastKpis.downInSzCount}/${lastKpis.downInSzDataHoles || "—"}`}
              hint={`≤ ${lastRound.downInSzStrokes} golpes`}
            />
            <KPI
              label="Putts totales"
              value={lastKpis.totalPutts}
              hint={lastKpis.puttsDataHoles > 0 ? `avg ${lastKpis.avgPuttsPerHole.toFixed(1)}/hoyo` : "sin datos"}
            />
            <KPI
              label="3-putts"
              value={`${lastKpis.threePuttsHoles}/${lastKpis.puttsDataHoles || "—"}`}
              tone={lastKpis.threePuttsHoles === 0 && lastKpis.puttsDataHoles > 0 ? "good" : "bad"}
            />
          </div>
        </>
      ) : (
        <Card className="gf-fadeup gf-fadeup-2 text-center">
          <p className="text-sm text-[var(--muted)] mb-3">
            No hay rondas cargadas todavía
          </p>
          <Link href="/rondas/nueva" className="gf-btn">
            Cargar primera ronda
          </Link>
        </Card>
      )}

      {/* Última range session */}
      {lastRangeSession && (
        <>
          <SectionHeader>Última range</SectionHeader>
          <Card className="gf-fadeup gf-fadeup-3">
            <div className="flex justify-between items-baseline mb-2">
              <span className="font-semibold">{lastRangeSession.club}</span>
              <span className="text-xs text-[var(--muted)] gf-mono">
                {new Date(lastRangeSession.date).toLocaleDateString("es-AR")}
              </span>
            </div>
            {lastRangeSession.shots[0] && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-[var(--muted)] uppercase">Carry</div>
                  <div className="gf-display text-2xl">
                    {lastRangeSession.shots[0].carryYds?.toFixed(0) ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--muted)] uppercase">Total</div>
                  <div className="gf-display text-2xl">
                    {lastRangeSession.shots[0].totalYds?.toFixed(0) ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--muted)] uppercase">Smash</div>
                  <div className="gf-display text-2xl">
                    {lastRangeSession.shots[0].smashFactor?.toFixed(2) ?? "—"}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Lista últimas rondas */}
      {recentRounds.length > 1 && (
        <>
          <SectionHeader>Rondas recientes</SectionHeader>
          <div className="space-y-2 gf-fadeup gf-fadeup-4">
            {recentRounds.slice(1).map((r) => (
              <Link key={r.id} href={`/rondas/${r.id}`}>
                <Card className="!p-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{r.course.name}</div>
                    <div className="text-xs text-[var(--muted)] gf-mono">
                      {new Date(r.date).toLocaleDateString("es-AR")} · {r.mode.replace("_", " ")}
                    </div>
                  </div>
                  <span className="text-[var(--muted)]">›</span>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
