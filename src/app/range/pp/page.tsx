import { prisma } from "@/lib/db";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import { DRILL_BY_TYPE, type DrillType } from "@/lib/pp-drills";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PPListPage() {
  const sessions = await prisma.practiceSession.findMany({
    orderBy: { date: "desc" },
    include: { drills: true },
  });

  // Sugerencia: traer las últimas rondas para mostrar PP plan pendiente
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
        <p className="text-sm text-[var(--muted)]">
          Drills basados en Will Robins method
        </p>
      </header>

      {/* Pendientes de la última ronda */}
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

      <Link href="/range/pp/nueva" className="gf-btn w-full">
        + Nueva sesión PP
      </Link>

      <SectionHeader>Sesiones</SectionHeader>
      {sessions.length === 0 && (
        <Card className="text-center text-sm text-[var(--muted)]">
          Todavía no cargaste ninguna sesión PP
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
                  const score = d.successes != null && d.attempts != null
                    ? `${d.successes}/${d.attempts}`
                    : d.bestScore != null
                    ? `${d.bestScore}`
                    : "—";
                  return (
                    <span key={d.id} className="text-[10px] gf-pill">
                      {def.label.split("(")[0].trim()}: {score}
                    </span>
                  );
                })}
              </div>
              {s.notes && (
                <div className="text-xs text-[var(--muted)] mt-1">{s.notes}</div>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
