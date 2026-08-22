import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import RondaTracker from "./RondaTracker";

export const dynamic = "force-dynamic";

// Desde 22/08/2026 el default vuelve a ser cards: el mapa (/rondas/[id]/mapa)
// tiene bugs de shot tracking en revisión. El mapa sigue disponible con
// ?vista=mapa (o el FAB 🗺️ de esta pantalla) mientras se arregla.
// Para volver a poner el mapa como default: invertir esta condición.
export default async function RondaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { id } = await params;
  const { vista } = await searchParams;

  if (vista === "mapa") redirect(`/rondas/${id}/mapa`);

  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      course: { include: { holes: { orderBy: { number: "asc" } } } },
      players: {
        orderBy: { position: "asc" },
        include: { player: true, holes: true },
      },
      bets: true,
    },
  });

  if (!round) return notFound();

  return <RondaTracker round={round} />;
}
