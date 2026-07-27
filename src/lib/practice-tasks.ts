import { prisma } from "@/lib/db";
import type { PPPlan } from "@/lib/scoring-method";

// El homework NO acumula (regla Santi 26/07): las tasks PENDING de ronda reflejan
// SIEMPRE y SOLO la última ronda jugada.
// - Al ver el resumen de la ÚLTIMA ronda: borra las PENDING de rondas anteriores y
//   sincroniza las de esta ronda con el plan actual (crea faltantes, actualiza targets,
//   borra las que ya no aplican) preservando el progreso ya hecho.
// - Ver el resumen de una ronda VIEJA no toca nada.
// Las DONE quedan como historial.
export async function ensureRoundTasks(roundId: string, ppPlan: PPPlan) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { date: true },
  });
  if (!round) return;
  const newer = await prisma.round.findFirst({
    where: { id: { not: roundId }, date: { gt: round.date } },
    select: { id: true },
  });
  if (newer) return;

  // Chau homework acumulado: fuera las PENDING de cualquier otra ronda
  await prisma.practiceTask.deleteMany({
    where: { sourceType: "ROUND", status: "PENDING", roundId: { not: roundId } },
  });

  const active = ppPlan.filter((p) => p.count > 0);
  const activeCodes = active.map((p) => p.code);

  // Fuera las de esta ronda cuyo problema ya no está en el plan (ej. tras editar stats)
  await prisma.practiceTask.deleteMany({
    where: {
      roundId,
      status: "PENDING",
      code: { notIn: activeCodes.length > 0 ? activeCodes : ["__none__"] },
    },
  });

  const existing = await prisma.practiceTask.findMany({
    where: { roundId },
    select: { id: true, code: true, timesToAchieve: true, status: true },
  });
  // Si conviven DONE y PENDING del mismo code, mandar la PENDING (es la que se sincroniza)
  const byCode = new Map<string, (typeof existing)[number]>();
  for (const t of existing) {
    const cur = byCode.get(t.code);
    if (!cur || (cur.status !== "PENDING" && t.status === "PENDING")) byCode.set(t.code, t);
  }

  for (const p of active) {
    const t = byCode.get(p.code);
    if (!t) {
      await prisma.practiceTask.create({
        data: {
          sourceType: "ROUND",
          roundId,
          code: p.code,
          label: p.label,
          description: p.reason,
          timesToAchieve: p.count,
        },
      });
    } else if (t.status === "PENDING" && t.timesToAchieve !== p.count) {
      await prisma.practiceTask.update({
        where: { id: t.id },
        data: { timesToAchieve: p.count, label: p.label, description: p.reason },
      });
    }
  }
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
