import { prisma } from "@/lib/db";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RondasPage() {
  const me = await prisma.player.findFirst({ where: { isMe: true } });
  const rounds = await prisma.round.findMany({
    orderBy: { date: "desc" },
    include: {
      course: true,
      players: { include: { player: true, holes: true } },
    },
  });

  // Marcar "en curso" si el jugador "yo" tiene menos hoyos con score que los planificados (9 o 18)
  const enriched = rounds.map((r) => {
    const meRP = r.players.find((rp) => rp.player.id === me?.id) ?? r.players[0];
    const holesWithScore = meRP.holes.filter((h) => h.score && h.score > 0).length;
    const inProgress = holesWithScore > 0 && holesWithScore < r.holesPlayed;
    const notStarted = holesWithScore === 0;
    return { round: r, holesWithScore, inProgress, notStarted };
  });

  const inProgressRounds = enriched.filter((e) => e.inProgress || e.notStarted);
  const completedRounds = enriched.filter((e) => !e.inProgress && !e.notStarted);

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Cancha</h1>
        <p className="text-sm text-[var(--muted)]">Tus rondas</p>
      </header>

      <Link href="/rondas/nueva" className="gf-btn w-full">
        + Nueva ronda
      </Link>

      {inProgressRounds.length > 0 && (
        <>
          <SectionHeader>En curso</SectionHeader>
          <div className="space-y-2">
            {inProgressRounds.map(({ round: r, holesWithScore, notStarted }) => (
              <Link key={r.id} href={`/rondas/${r.id}`}>
                <Card
                  className="!p-3 flex justify-between items-center"
                  style={{ borderLeft: "4px solid var(--accent)" }}
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {r.course.name}
                      <Pill variant="accent">
                        {notStarted ? "Sin empezar" : `${holesWithScore}/${r.holesPlayed}`}
                      </Pill>
                    </div>
                    <div className="text-xs text-[var(--muted)] gf-mono">
                      {new Date(r.date).toLocaleDateString("es-AR")} ·{" "}
                      {r.mode.replace("_P", "P").toLowerCase()} · {r.players.length} j
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">
                      {r.players.map((rp) => rp.player.name).join(" · ")}
                    </div>
                  </div>
                  <span className="text-[var(--fairway)] font-bold">›</span>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionHeader>Historial</SectionHeader>
      <div className="space-y-2">
        {completedRounds.length === 0 && inProgressRounds.length === 0 && (
          <Card className="text-center text-sm text-[var(--muted)]">
            No hay rondas todavía
          </Card>
        )}
        {completedRounds.map(({ round: r }) => (
          <Link key={r.id} href={`/rondas/${r.id}/resumen`}>
            <Card className="!p-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{r.course.name}</div>
                <div className="text-xs text-[var(--muted)] gf-mono">
                  {new Date(r.date).toLocaleDateString("es-AR")} ·{" "}
                  {r.mode.replace("_P", "P").toLowerCase()} · {r.players.length} j
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  {r.players.map((rp) => rp.player.name).join(" · ")}
                </div>
              </div>
              <span className="text-[var(--muted)]">›</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
