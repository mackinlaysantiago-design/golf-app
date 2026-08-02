import { prisma } from "./db";
import { buildClubCarries } from "./club-carries";
import type { ClubCarry } from "./shot-gps";

/**
 * Carga la tabla de carries desde la DB (server-side): ClubDispersion para el juego
 * largo + Wedge Matrix para el corto. La celda que vale es la de la sesión más
 * reciente, igual que en GET /api/wedge-matrix.
 */
export async function loadClubCarries(): Promise<ClubCarry[]> {
  const [dispersions, sessions] = await Promise.all([
    prisma.clubDispersion.findMany({ select: { club: true, carryP50: true } }),
    prisma.wedgeMatrixSession.findMany({
      orderBy: { date: "desc" },
      include: { entries: true },
    }),
  ]);

  const seen = new Set<string>();
  const cells = [];
  for (const s of sessions) {
    for (const e of s.entries) {
      const k = `${e.wedgeType}__${e.swingType}`;
      if (seen.has(k)) continue;
      seen.add(k);
      cells.push({ wedgeType: e.wedgeType, swingType: e.swingType, avgYards: e.avgYards });
    }
  }

  return buildClubCarries(dispersions, cells);
}
