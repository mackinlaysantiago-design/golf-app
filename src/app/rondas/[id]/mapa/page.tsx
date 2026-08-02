import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { loadClubCarries } from "@/lib/club-carries-load";
import MapaTracker, { type HoleMapa } from "./MapaTracker";

export const dynamic = "force-dynamic";

export default async function MapaPage({
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
      players: {
        orderBy: { position: "asc" },
        include: { player: true, holes: { select: { id: true, holeNumber: true, score: true } } },
      },
    },
  });
  if (!round) return notFound();

  const me = round.players.find((rp) => rp.player.isMe) ?? round.players[0];
  if (!me) return notFound();

  const misHoyos = new Map(me.holes.map((h) => [h.holeNumber, h]));
  const puntos = new Map(round.course.mapPoints.map((p) => [p.holeNumber, p]));

  // Ida (1-9) o Vuelta (10-18) según cómo se configuró la ronda, igual que el tracker.
  const todos = round.course.holes;
  const jugados =
    round.holesPlayed === 9
      ? round.nineWhich === "VUELTA"
        ? todos.filter((h) => h.number >= 10)
        : todos.filter((h) => h.number <= 9)
      : todos;

  const holes: HoleMapa[] = jugados.map((h) => {
    const mp = puntos.get(h.number);
    return {
      number: h.number,
      par: h.par,
      hcpHoyo: h.hcpHoyo,
      roundHoleId: misHoyos.get(h.number)?.id ?? null,
      tieneScore: misHoyos.get(h.number)?.score != null,
      green: {
        teeLat: mp?.teeLat ?? null,
        teeLng: mp?.teeLng ?? null,
        centerLat: mp?.centerLat ?? null,
        centerLng: mp?.centerLng ?? null,
        frontLat: mp?.frontLat ?? null,
        frontLng: mp?.frontLng ?? null,
      },
    };
  });

  const carries = await loadClubCarries();

  return (
    <MapaTracker
      round={{
        id: round.id,
        courseName: round.course.name,
        onePuttCircleFt: round.onePuttCircleFt,
        meRoundPlayerId: me.id,
        // Se manda el roundPlayerId como id: la hoja de cierre guarda por jugador
        // de la ronda, no por Player global.
        players: round.players.map((rp) => ({
          id: rp.id,
          name: rp.player.name,
          isMe: rp.player.isMe,
        })),
      }}
      holes={holes}
      carries={carries}
      initialHole={holes[0]?.number ?? 1}
    />
  );
}
