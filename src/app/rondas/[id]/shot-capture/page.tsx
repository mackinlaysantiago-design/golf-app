import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { loadClubCarries } from "@/lib/club-carries-load";
import ShotCaptureRound, { type HoleForCapture } from "./ShotCaptureRound";

export const dynamic = "force-dynamic";

export default async function ShotCapturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          holes: { orderBy: { number: "asc" } },
          mapPoints: true,
        },
      },
      players: { include: { player: true } },
    },
  });
  if (!round) notFound();

  // Jugador = Santi (isMe) o el primero de la ronda.
  const rp = round.players.find((p) => p.player.isMe) ?? round.players[0];
  if (!rp) notFound();

  // Asegurar un RoundHole por hoyo del recorrido → tener roundHoleId (donde también
  // viven las keys del Scoring Method: el tiro y las keys quedan en la MISMA fila).
  await Promise.all(
    round.course.holes.map((h) =>
      prisma.roundHole.upsert({
        where: {
          roundPlayerId_holeNumber: { roundPlayerId: rp.id, holeNumber: h.number },
        },
        update: {},
        create: { roundId: round.id, roundPlayerId: rp.id, holeNumber: h.number },
      }),
    ),
  );
  const roundHoles = await prisma.roundHole.findMany({
    where: { roundPlayerId: rp.id },
    select: { id: true, holeNumber: true },
  });
  const rhByHole = new Map(roundHoles.map((rh) => [rh.holeNumber, rh.id]));
  const greenByHole = new Map(round.course.mapPoints.map((mp) => [mp.holeNumber, mp]));

  const holes: HoleForCapture[] = round.course.holes
    .map((h) => {
      const roundHoleId = rhByHole.get(h.number);
      if (!roundHoleId) return null;
      const mp = greenByHole.get(h.number);
      return {
        number: h.number,
        par: h.par,
        roundHoleId,
        green: {
          frontLat: mp?.frontLat ?? null,
          frontLng: mp?.frontLng ?? null,
          centerLat: mp?.centerLat ?? null,
          centerLng: mp?.centerLng ?? null,
          backLat: mp?.backLat ?? null,
          backLng: mp?.backLng ?? null,
        },
      } satisfies HoleForCapture;
    })
    .filter((h): h is HoleForCapture => h !== null);

  const carries = await loadClubCarries();

  return (
    <div className="pt-4">
      <header className="px-4">
        <Link href={`/rondas/${round.id}`} className="text-xs text-[var(--muted)]">
          ‹ Volver a la ronda
        </Link>
        <h1 className="gf-display text-2xl text-[var(--fairway)] mt-1">🎙 Cargar tiros por voz</h1>
        <p className="text-sm text-[var(--muted)]">{round.course.name}</p>
      </header>
      <ShotCaptureRound holes={holes} carries={carries} />
    </div>
  );
}
