import { prisma } from "@/lib/db";
import { SectionHeader } from "@/components/ui/Card";
import PlayersClient from "./PlayersClient";
import CoursesList from "./CoursesList";
import LogoutButton from "./LogoutButton";
import LucilaSyncButton from "./LucilaSyncButton";
import IdentidadEditor from "./IdentidadEditor";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [players, courses, me] = await Promise.all([
    prisma.player.findMany({ orderBy: [{ isMe: "desc" }, { name: "asc" }] }),
    prisma.course.findMany({ include: { holes: true }, orderBy: { name: "asc" } }),
    prisma.player.findFirst({ where: { isMe: true } }),
  ]);

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header className="gf-fadeup">
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Setup</h1>
        <p className="text-sm text-[var(--muted)]">Jugadores y canchas</p>
      </header>

      {me && (
        <>
          <SectionHeader>🧠 Mental Mastery</SectionHeader>
          <IdentidadEditor
            playerId={me.id}
            initial={{
              limitingBelief: me.limitingBelief,
              empoweringBelief: me.empoweringBelief,
              admiredGolfer: me.admiredGolfer,
              beDoHave: me.beDoHave,
              preShotRoutine: me.preShotRoutine,
              postShotRoutine: me.postShotRoutine,
            }}
          />
        </>
      )}

      <SectionHeader>Jugadores ({players.length})</SectionHeader>
      <LucilaSyncButton />
      <PlayersClient initialPlayers={players} />

      <SectionHeader>Canchas ({courses.length})</SectionHeader>
      <CoursesList courses={courses} />

      <LogoutButton />
    </div>
  );
}
