import { prisma } from "@/lib/db";
import { Card, SectionHeader, Pill } from "@/components/ui/Card";
import Link from "next/link";
import PlayersClient from "./PlayersClient";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [players, courses] = await Promise.all([
    prisma.player.findMany({ orderBy: [{ isMe: "desc" }, { name: "asc" }] }),
    prisma.course.findMany({ include: { holes: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header className="gf-fadeup">
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Setup</h1>
        <p className="text-sm text-[var(--muted)]">Jugadores y canchas</p>
      </header>

      <SectionHeader>Jugadores</SectionHeader>
      <PlayersClient initialPlayers={players} />

      <SectionHeader>Canchas</SectionHeader>
      <div className="space-y-2">
        {courses.map((c) => (
          <Card key={c.id} className="!p-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-[var(--muted)] gf-mono">
                  {c.holes.length} hoyos · Par {c.holes.reduce((s, h) => s + h.par, 0)}
                </div>
              </div>
              <Pill>OK</Pill>
            </div>
          </Card>
        ))}
        <Link href="/jugadores/nueva-cancha">
          <Card className="!p-3 text-center text-[var(--fairway)] font-semibold border-dashed">
            + Nueva cancha
          </Card>
        </Link>
      </div>
    </div>
  );
}
