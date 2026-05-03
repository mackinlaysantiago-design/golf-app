import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(s: string): string {
  return normalizeName(s)
    .split(" ")
    .filter((t) => t.length > 0)
    .sort()
    .join(" ");
}

// POST: dedupe Players por tokens ordenados.
// Para cada grupo de duplicados:
//  - "primary" = el que tiene roundEntries (preferencia) — sino el más viejo
//  - Copia lucilaMatricula / hcpIndex / lastHcpUpdate del más reciente al primary
//  - Mueve todos los RoundPlayer apuntando a duplicados → primary
//  - Borra los Players duplicados
export async function POST() {
  const allPlayers = await prisma.player.findMany({
    include: { _count: { select: { roundEntries: true } } },
  });

  // Agrupar por tokens
  const groups = new Map<string, typeof allPlayers>();
  for (const p of allPlayers) {
    const key = nameTokens(p.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const merges: { primary: string; merged: string[] }[] = [];

  for (const [key, players] of Array.from(groups.entries())) {
    if (players.length < 2) continue;
    if (!key) continue;

    // Elegir primary: el que tiene rondas; sino el más viejo (createdAt menor)
    const sorted = [...players].sort((a, b) => {
      const aHas = a._count.roundEntries > 0 ? 1 : 0;
      const bHas = b._count.roundEntries > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const primary = sorted[0];
    const dups = sorted.slice(1);

    // Tomar el "mejor" set de datos del scrape (el que tenga lucilaMatricula + lastHcpUpdate más reciente)
    let bestMatricula = primary.lucilaMatricula;
    let bestHcp = primary.hcpIndex;
    let bestUpdate = primary.lastHcpUpdate;
    for (const d of dups) {
      if (
        d.lucilaMatricula &&
        (!bestMatricula ||
          (d.lastHcpUpdate &&
            (!bestUpdate || d.lastHcpUpdate > bestUpdate)))
      ) {
        bestMatricula = d.lucilaMatricula;
        bestHcp = d.hcpIndex;
        bestUpdate = d.lastHcpUpdate;
      }
    }

    await prisma.$transaction(async (tx) => {
      // Mover RoundPlayer: cualquier RoundPlayer que apunte a un duplicado, apunte al primary
      for (const d of dups) {
        await tx.roundPlayer.updateMany({
          where: { playerId: d.id },
          data: { playerId: primary.id },
        });
      }
      // Para evitar conflicto unique en lucilaMatricula al borrar, primero null en duplicados
      for (const d of dups) {
        if (d.lucilaMatricula) {
          await tx.player.update({
            where: { id: d.id },
            data: { lucilaMatricula: null },
          });
        }
      }
      // Borrar duplicados
      for (const d of dups) {
        await tx.player.delete({ where: { id: d.id } });
      }
      // Actualizar primary con los mejores datos
      await tx.player.update({
        where: { id: primary.id },
        data: {
          lucilaMatricula: bestMatricula,
          hcpIndex: bestHcp,
          lastHcpUpdate: bestUpdate,
        },
      });
    });

    merges.push({
      primary: `${primary.name} (${primary.id})`,
      merged: dups.map((d) => `${d.name} (${d.id})`),
    });
  }

  return NextResponse.json({
    groupsFound: merges.length,
    merges,
  });
}
