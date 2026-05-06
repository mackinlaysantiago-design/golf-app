import { prisma } from "@/lib/db";
import type { PPPlan } from "@/lib/scoring-method";

type RoundConfig = {
  enterSzYds: number;
  downInSzStrokes: number;
  onePuttCircleFt: number;
  twoPuttCircleYds: number;
};

// Difficulty score: higher = más exigente (tarea más dura).
// Sirve para comparar dos tasks del mismo `code` y quedarse con la peor.
//   A: SZ más chica (menos yds) = más dura
//   B: bajar en menos golpes = más dura
//   1: 1-putt circle más chico = más dura
//   2: no varía con config, solo importa el count
function difficultyScore(code: string, c: RoundConfig | null): number {
  if (!c) return 0;
  switch (code) {
    case "A":
      return -c.enterSzYds;
    case "B":
      return -c.downInSzStrokes;
    case "1":
      return -c.onePuttCircleFt;
    default:
      return 0;
  }
}

// Para cada code (A,B,1,2) deja una sola task PENDING:
// la más dura, y a igualdad de dificultad, la de más timesToAchieve restantes.
// Borra el resto. Idempotente.
export async function dedupPendingRoundTasksByCode() {
  const tasks = await prisma.practiceTask.findMany({
    where: {
      status: "PENDING",
      sourceType: "ROUND",
      code: { in: ["A", "B", "1", "2"] },
    },
    include: {
      round: {
        select: {
          enterSzYds: true,
          downInSzStrokes: true,
          onePuttCircleFt: true,
          twoPuttCircleYds: true,
        },
      },
    },
  });

  const byCode: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    (byCode[t.code] ??= []).push(t);
  }

  const toDelete: string[] = [];
  for (const [code, group] of Object.entries(byCode)) {
    if (group.length <= 1) continue;
    // Ordenar: dificultad desc, timesRestantes desc, fecha desc
    group.sort((a, b) => {
      const da = difficultyScore(code, a.round);
      const db = difficultyScore(code, b.round);
      if (db !== da) return db - da;
      const ra = a.timesToAchieve - a.timesCompleted;
      const rb = b.timesToAchieve - b.timesCompleted;
      if (rb !== ra) return rb - ra;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    // Mantener el primero, borrar el resto
    for (let i = 1; i < group.length; i++) toDelete.push(group[i].id);
  }

  if (toDelete.length > 0) {
    await prisma.practiceTask.deleteMany({ where: { id: { in: toDelete } } });
  }
  return toDelete.length;
}

// Genera tasks PENDING para los items del PP plan con count > 0.
// Idempotente por (round, code) y dedupea contra tasks PENDING de rondas anteriores
// quedándose con la más dura / más veces a hacer.
export async function ensureRoundTasks(roundId: string, ppPlan: PPPlan) {
  const existingForRound = await prisma.practiceTask.findMany({
    where: { roundId },
    select: { code: true },
  });
  const existingCodesForRound = new Set(existingForRound.map((t) => t.code));

  const toCreate = ppPlan
    .filter((p) => p.count > 0 && !existingCodesForRound.has(p.code))
    .map((p) => ({
      sourceType: "ROUND",
      roundId,
      code: p.code,
      label: p.label,
      description: p.reason,
      timesToAchieve: p.count,
    }));

  if (toCreate.length > 0) {
    await prisma.practiceTask.createMany({ data: toCreate });
  }

  // Dedup global por code: deja una sola task PENDING por code, la más dura
  await dedupPendingRoundTasksByCode();
}

// Crea (si no existe) una task de "Revisar análisis" para una RangeSession con AI analysis.
export async function ensureRangeTask(
  rangeSessionId: string,
  clubLabel: string,
) {
  const existing = await prisma.practiceTask.findFirst({
    where: { rangeSessionId },
  });
  if (existing) return;

  await prisma.practiceTask.create({
    data: {
      sourceType: "RANGE_SESSION",
      rangeSessionId,
      code: "FLIGHTSCOPE",
      label: `Revisar análisis FlightScope · ${clubLabel}`,
      description: "Trabajar los puntos del análisis AI en el range",
      timesToAchieve: 1,
    },
  });
}

// Aplica progreso de una sesión PP a las tasks pendientes:
// para cada drill cargado con leveledUp, busca task PENDING con su ppCode
// e incrementa timesCompleted. Si llega al target, marca DONE.
export async function applyPracticeProgress(
  drills: { ppCode: string | null; leveledUp: boolean }[],
) {
  const codesAchieved = drills
    .filter((d) => d.leveledUp && d.ppCode)
    .map((d) => d.ppCode as string);

  if (codesAchieved.length === 0) return;

  // Tally por code
  const counts: Record<string, number> = {};
  for (const c of codesAchieved) counts[c] = (counts[c] ?? 0) + 1;

  // Para cada code, encontrar la task más vieja PENDING con ese code y incrementar
  for (const [code, increment] of Object.entries(counts)) {
    const tasks = await prisma.practiceTask.findMany({
      where: { code, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    let remaining = increment;
    for (const task of tasks) {
      if (remaining <= 0) break;
      const newCompleted = task.timesCompleted + remaining;
      const isDone = newCompleted >= task.timesToAchieve;
      await prisma.practiceTask.update({
        where: { id: task.id },
        data: {
          timesCompleted: Math.min(newCompleted, task.timesToAchieve),
          status: isDone ? "DONE" : "PENDING",
          doneAt: isDone ? new Date() : null,
        },
      });
      remaining -= task.timesToAchieve - task.timesCompleted;
    }
  }
}
