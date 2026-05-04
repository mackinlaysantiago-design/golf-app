import { prisma } from "@/lib/db";
import { SectionHeader } from "@/components/ui/Card";
import PlayersClient from "./PlayersClient";
import CoursesList from "./CoursesList";
import LogoutButton from "./LogoutButton";
import LucilaSyncButton from "./LucilaSyncButton";

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

      <SectionHeader>Jugadores ({players.length})</SectionHeader>
      <LucilaSyncButton />
      <PlayersClient initialPlayers={players} />

      <SectionHeader>Canchas ({courses.length})</SectionHeader>
      <CoursesList courses={courses} />

      <LogoutButton />
    </div>
  );
}
