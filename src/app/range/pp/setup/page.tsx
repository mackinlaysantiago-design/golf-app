/**
 * Wizard de setup de Purposeful Practice.
 *
 * Server-side fetcha:
 *   - PracticeTasks pendientes (status PENDING) del usuario
 *
 * Cliente:
 *   - Step 1: Elegir tipo (Auto-PP / Custom)
 *   - Step 2a (Auto-PP): confirmar áreas/drills sugeridos
 *   - Step 2b (Custom): elegir áreas
 *   - Step 3 (Custom): por cada área, elegir drill + test
 *   - Step 4: resumen + start
 *
 * Al finalizar, redirige a /range/pp/nueva?drills=type1,type2,...
 * con los drills pre-seleccionados.
 */

import { prisma } from "@/lib/db";
import { suggestAutoPp, type PracticeTaskInput } from "@/lib/pp-suggest";
import SetupClient from "./SetupClient";

export const dynamic = "force-dynamic";

export default async function PpSetupPage() {
  // Levantar las PracticeTasks pendientes (todas, no filtramos por user porque la app es mono-user)
  const tasks = await prisma.practiceTask.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      round: { select: { date: true, course: { select: { name: true } } } },
    },
  });

  const taskInputs: PracticeTaskInput[] = tasks.map((t) => ({
    id: t.id,
    code: t.code,
    label: t.label,
    timesToAchieve: t.timesToAchieve,
    timesCompleted: t.timesCompleted,
    roundDate: t.round?.date,
  }));

  const suggestions = suggestAutoPp(taskInputs);

  // Para mostrar contexto: la ronda más reciente
  const recentRound = tasks[0]?.round
    ? { date: tasks[0].round.date.toISOString(), course: tasks[0].round.course.name }
    : null;

  return (
    <SetupClient
      suggestions={suggestions}
      taskCount={tasks.length}
      recentRound={recentRound}
    />
  );
}
