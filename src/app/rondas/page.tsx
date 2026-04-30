import { prisma } from "@/lib/db";
import { Card, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RondasPage() {
  const rounds = await prisma.round.findMany({
    orderBy: { date: "desc" },
    include: { course: true, players: { include: { player: true } } },
  });

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Cancha</h1>
        <p className="text-sm text-[var(--muted)]">Tus rondas</p>
      </header>

      <Link href="/rondas/nueva" className="gf-btn w-full">
        + Nueva ronda
      </Link>

      <SectionHeader>Historial</SectionHeader>
      <div className="space-y-2">
        {rounds.length === 0 && (
          <Card className="text-center text-sm text-[var(--muted)]">
            No hay rondas todavía
          </Card>
        )}
        {rounds.map((r) => (
          <Link key={r.id} href={`/rondas/${r.id}`}>
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
