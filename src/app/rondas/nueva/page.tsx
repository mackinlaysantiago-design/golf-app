import { prisma } from "@/lib/db";
import NuevaRondaClient from "./NuevaRondaClient";

export const dynamic = "force-dynamic";

export default async function NuevaRondaPage() {
  const [courses, players] = await Promise.all([
    prisma.course.findMany({
      include: { holes: { orderBy: { number: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.player.findMany({ orderBy: [{ isMe: "desc" }, { name: "asc" }] }),
  ]);

  return <NuevaRondaClient courses={courses} players={players} />;
}
