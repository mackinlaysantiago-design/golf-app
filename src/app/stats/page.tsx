import { prisma } from "@/lib/db";
import { Card, KPI, SectionHeader } from "@/components/ui/Card";
import { computeRoundKPIs, type HoleData } from "@/lib/scoring-method";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

  const rounds = await prisma.round.findMany({
    where: { players: { some: { playerId: me.id } } },
    orderBy: { date: "desc" },
    take: 10,
    include: {
      course: { include: { holes: { orderBy: { number: "asc" } } } },
      players: { where: { playerId: me.id }, include: { holes: true } },
    },
  });

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
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const last5 = summaries.slice(0, 5);
  const avgScore = last5.length > 0 ? last5.reduce((s, x) => s + x.kpis.totalScore, 0) / last5.length : 0;
  const avgNoDouble = last5.length > 0 ? last5.reduce((s, x) => s + x.kpis.pctNoDoubleBogey, 0) / last5.length : 0;
  const avgPutts = last5.length > 0 ? last5.reduce((s, x) => s + x.kpis.avgPuttsPerHole, 0) / last5.length : 0;

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Stats</h1>
        <p className="text-sm text-[var(--muted)]">Progresión histórica</p>
      </header>

      <SectionHeader>Promedios últimas 5</SectionHeader>
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Score" value={avgScore.toFixed(0)} />
        <KPI label="Sin 2x" value={`${avgNoDouble.toFixed(0)}%`} />
        <KPI label="Putts/h" value={avgPutts.toFixed(1)} />
      </div>

      <SectionHeader>Tabla rondas</SectionHeader>
      <Card className="!p-2 overflow-x-auto">
        <table className="gf-table" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cancha</th>
              <th className="text-right">Score</th>
              <th className="text-right">vs par</th>
              <th className="text-right">Sin 2x</th>
              <th className="text-right">Putts</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(({ round, kpis }) => (
              <tr key={round.id}>
                <td className="gf-mono">
                  {new Date(round.date).toLocaleDateString("es-AR")}
                </td>
                <td>{round.course.name}</td>
                <td className="text-right gf-mono font-semibold">{kpis.totalScore || "—"}</td>
                <td className="text-right gf-mono">
                  {kpis.holesPlayed > 0 ? `${kpis.scoreVsPar >= 0 ? "+" : ""}${kpis.scoreVsPar}` : "—"}
                </td>
                <td className="text-right gf-mono">{kpis.pctNoDoubleBogey.toFixed(0)}%</td>
                <td className="text-right gf-mono">{kpis.totalPutts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
