import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import RondaTracker from "./RondaTracker";

export const dynamic = "force-dynamic";

export default async function RondaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      course: { include: { holes: { orderBy: { number: "asc" } } } },
      players: {
        orderBy: { position: "asc" },
        include: { player: true, holes: true },
      },
    },
  });

  if (!round) return notFound();

  return <RondaTracker round={round} />;
}
