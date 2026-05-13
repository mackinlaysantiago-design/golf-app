import { prisma } from "@/lib/db";
import { SectionHeader } from "@/components/ui/Card";
import Link from "next/link";
import PendingTasks from "./PendingTasks";
import DispersionUploader from "./DispersionUploader";
import DispersionList from "./DispersionList";
import { dedupPendingRoundTasksByCode } from "@/lib/practice-tasks";

export const dynamic = "force-dynamic";

export default async function RangePage() {
  // Limpia tasks duplicadas/menos exigentes antes de listar
  await dedupPendingRoundTasksByCode();

  const [dispersions, pendingTasks] = await Promise.all([
    prisma.clubDispersion.findMany({
      orderBy: { carryAvgYds: "desc" },
    }),
    prisma.practiceTask.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        round: { include: { course: true } },
        rangeSession: true,
      },
    }),
  ]);

  // Convertir Date a ISO string para client component
  const tasksSerialized = pendingTasks.map((t) => ({
    id: t.id,
    sourceType: t.sourceType,
    code: t.code,
    label: t.label,
    description: t.description,
    timesToAchieve: t.timesToAchieve,
    timesCompleted: t.timesCompleted,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    round: t.round
      ? {
          id: t.round.id,
          date: t.round.date.toISOString(),
          course: { name: t.round.course.name },
        }
      : null,
    rangeSession: t.rangeSession
      ? {
          id: t.rangeSession.id,
          date: t.rangeSession.date.toISOString(),
          club: t.rangeSession.club,
        }
      : null,
  }));

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <h1 className="gf-display text-4xl text-[var(--fairway)]">Range</h1>
        <p className="text-sm text-[var(--muted)]">Dispersión por palo · Purposeful Practice</p>
      </header>

      <Link href="/range/pp" className="gf-btn gf-btn-secondary w-full">
        🎯 Purposeful Practice
      </Link>

      <SectionHeader>Tareas pendientes ({pendingTasks.length})</SectionHeader>
      <PendingTasks tasks={tasksSerialized} />

      <SectionHeader>Dispersión por palo</SectionHeader>
      <DispersionUploader />
      <DispersionList rows={dispersions} />
    </div>
  );
}
