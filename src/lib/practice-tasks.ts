import { prisma } from "@/lib/db";
import type { PPPlan } from "@/lib/scoring-method";

// Genera tasks PENDING para los items del PP plan con count > 0.
// Idempotente: si ya existen tasks para esa ronda+code, no las duplica.
export async function ensureRoundTasks(roundId: string, ppPlan: PPPlan) {
  const existing = await prisma.practiceTask.findMany({
    where: { roundId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((t) => t.code));

  const toCreate = ppPlan
    .filter((p) => p.count > 0 && !existingCodes.has(p.code))
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
