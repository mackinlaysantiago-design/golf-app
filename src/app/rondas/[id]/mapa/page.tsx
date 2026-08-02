import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { loadClubCarries } from "@/lib/club-carries-load";
import { parsePuttDistances } from "@/lib/putts-derive";
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
        include: {
          player: true,
          holes: {
            select: {
              id: true,
              holeNumber: true,
              score: true,
              puttDistancesFt: true,
              keysBroken: true,
              pinColor: true,
              recoveryMode: true,
            },
          },
        },
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
      score: misHoyos.get(h.number)?.score ?? null,
      // Lo ya cargado, para que la hoja de cierre abra con los datos puestos y no
      // en blanco: si abriera vacía, volver a guardar te borraría los putts.
      puttsFt: parsePuttDistances(misHoyos.get(h.number)?.puttDistancesFt) ?? [],
      keys: (() => {
        const k = misHoyos.get(h.number)?.keysBroken;
        return Array.isArray(k) ? (k as number[]) : [];
      })(),
      pinColor: misHoyos.get(h.number)?.pinColor ?? null,
      recoveryMode: misHoyos.get(h.number)?.recoveryMode ?? null,
      scoresOtros: Object.fromEntries(
        round.players
          .filter((rp) => !rp.player.isMe)
          .map((rp) => [rp.id, rp.holes.find((x) => x.holeNumber === h.number)?.score ?? null]),
      ),
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
        enterSzYds: round.enterSzYds,
        tournamentMode: round.tournamentMode,
        noDistanceDevice: round.noDistanceDevice,
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
