import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import RondaTracker from "./RondaTracker";

export const dynamic = "force-dynamic";

// Desde 02/08/2026 la vista de cancha por defecto es el mapa a pantalla completa
// (/rondas/[id]/mapa). Esta pantalla —el scroll de cards— sigue viva en
// ?vista=cards para poder comparar las dos en la cancha antes de decidir.
// Para restaurarla como default: sacar el redirect de acá.
export default async function RondaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { id } = await params;
  const { vista } = await searchParams;

  if (vista !== "cards") redirect(`/rondas/${id}/mapa`);

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
