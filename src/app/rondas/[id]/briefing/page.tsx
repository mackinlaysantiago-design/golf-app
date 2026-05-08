import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";
import { findGoalByConfig } from "@/lib/sm-goals";
import CLUB_LABEL from "@/lib/club-labels";
import BriefingActions from "./BriefingActions";

export const dynamic = "force-dynamic";

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const round = await prisma.round.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!round) notFound();

  const me = await prisma.player.findFirst({ where: { isMe: true } });
  if (!me) notFound();

  // Goal SM del día
  const goal = findGoalByConfig(round.enterSzYds, round.downInSzStrokes);

  // Dispersión por palo (top 5 más usados)
  const rangeShots = await prisma.rangeShot.findMany({
    where: {
      rowType: "SHOT",
      carryYds: { not: null },
    },
    select: {
      club: true,
      sessionId: true,
      carryYds: true,
      lateralYds: true,
      lateralDir: true,
    },
  });
  const allSessions = await prisma.rangeSession.findMany({
    select: { id: true, club: true },
  });
  const sessionClubMap = new Map(allSessions.map((s) => [s.id, s.club]));

  const byClub = new Map<string, { carries: number[]; lats: number[] }>();
  for (const s of rangeShots) {
    const club = s.club ?? sessionClubMap.get(s.sessionId);
    if (!club || s.carryYds == null) continue;
    if (!byClub.has(club)) byClub.set(club, { carries: [], lats: [] });
    byClub.get(club)!.carries.push(s.carryYds);
    if (s.lateralYds != null) {
      const lat = s.lateralDir === "L" ? -s.lateralYds : s.lateralYds;
      byClub.get(club)!.lats.push(lat);
    }
  }

  function median(nums: number[]): number {
    if (nums.length === 0) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  const clubStats = Array.from(byClub.entries())
    .map(([club, d]) => ({
      club,
      carryMed: median(d.carries),
      latMed: median(d.lats),
      n: d.carries.length,
    }))
    .filter((c) => c.n >= 5)
    .sort((a, b) => b.carryMed - a.carryMed)
    .slice(0, 6);

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-3xl text-[var(--fairway)]">
          Pre-Round Briefing
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {round.course.name} ·{" "}
          {new Date(round.date).toLocaleDateString("es-AR")} ·{" "}
          {round.holesPlayed === 9
            ? `9 hoyos (${round.nineWhich === "VUELTA" ? "Vuelta" : "Ida"})`
            : "18 hoyos"}
        </p>
      </header>

      {/* GOAL del día */}
      {goal && (
        <Card className="text-center !p-4" variant="fairway">
          <div className="text-[10px] uppercase tracking-wider opacity-80">
            Tu goal del día
          </div>
          <div className="gf-display text-5xl mt-1">{goal.label}</div>
          <div className="text-xs opacity-90 mt-1">{goal.description}</div>
        </Card>
      )}

      {/* THERMOSTAT + score deseado — si es ronda de 9 hoyos, dividimos por 2
          como estimación rápida (el termostato se configura para 18). */}
      <SectionHeader>🌡️ Tu termostato</SectionHeader>
      <Card className="!p-3 space-y-2">
        {me.scoreThermostatMin && me.scoreThermostatMax ? (
          (() => {
            const halve = round.holesPlayed === 9;
            const min = halve ? Math.round(me.scoreThermostatMin / 2) : me.scoreThermostatMin;
            const max = halve ? Math.round(me.scoreThermostatMax / 2) : me.scoreThermostatMax;
            const desired = me.scoreDesired
              ? halve ? Math.round(me.scoreDesired / 2) : me.scoreDesired
              : null;
            return (
              <>
                <div className="text-xs text-[var(--muted)]">
                  Tu rango habitual {halve && "(9 hoyos · estimado)"}:{" "}
                  <strong>{min}–{max}</strong>
                </div>
                {desired != null && (
                  <div className="text-sm">
                    <span className="text-[var(--muted)]">Score deseado hoy: </span>
                    <span className="gf-display text-2xl text-[var(--accent)]">
                      {desired}
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-[var(--muted)]">
                  El termostato es tu rango habitual. Para bajarlo, primero hay que creerlo:
                  visualizá una ronda perfecta antes de jugar.
                </p>
              </>
            );
          })()
        ) : (
          <div className="text-xs text-[var(--muted)]">
            Configurá tu termostato en la sección de abajo. Definir tu rango
            habitual y tu score deseado te ayuda a ajustar expectativas.
          </div>
        )}
      </Card>

      {/* DISPERSIÓN POR PALO — recordatorio rápido */}
      {clubStats.length > 0 && (
        <>
          <SectionHeader>🎯 Tu dispersión típica (recordatorio)</SectionHeader>
          <Card className="!p-2 overflow-x-auto">
            <table className="w-full text-[11px] gf-mono">
              <thead>
                <tr className="text-[var(--muted)] uppercase tracking-wider text-[9px]">
                  <th className="text-left py-1">Palo</th>
                  <th className="text-right">Carry típico</th>
                  <th className="text-right">Suele ir</th>
                </tr>
              </thead>
              <tbody>
                {clubStats.map((c) => {
                  const dir =
                    Math.abs(c.latMed) < 3
                      ? "—"
                      : `${c.latMed > 0 ? "R" : "L"} ${Math.abs(c.latMed).toFixed(0)}y`;
                  return (
                    <tr key={c.club} className="border-t border-[var(--green-pale)]">
                      <td className="py-1.5 font-semibold">
                        {CLUB_LABEL[c.club] ?? c.club}
                      </td>
                      <td className="text-right">{c.carryMed.toFixed(0)}y</td>
                      <td className="text-right text-[var(--muted)]">{dir}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* DECADE TIPS */}
      <SectionHeader>🧠 Recordatorios DECADE</SectionHeader>
      <Card className="!p-3 space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-base">🟢</span>
          <span>
            <strong>Pin verde</strong>: bandera al centro, sin obstáculos → vas a la bandera.
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-base">🟡🔴</span>
          <span>
            <strong>Pin amarillo o rojo</strong>: apuntá al CENTRO del green. Las banderas trampa son trampas.
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-base">⛳</span>
          <span>
            <strong>Desde el tee</strong>: identificá el lado peor (OB &gt; agua &gt; obstáculos). Apuntá al centro de la mitad opuesta.
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-base">🛟</span>
          <span>
            <strong>En problemas</strong>: único objetivo = volver al juego. Ego golf = 8 en el marcador.
          </span>
        </div>
      </Card>

      {/* ACTIONS — visualización + thermostat config + start */}
      <BriefingActions
        roundId={round.id}
        playerId={me.id}
        initialThermostatMin={me.scoreThermostatMin}
        initialThermostatMax={me.scoreThermostatMax}
        initialScoreDesired={me.scoreDesired}
      />
    </div>
  );
}
