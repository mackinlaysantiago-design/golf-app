import { prisma } from "@/lib/db";
import { Card, SectionHeader } from "@/components/ui/Card";
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
      orderBy: { carryP50: "desc" },
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
        <p className="text-sm text-[var(--muted)]">Tareas · Dispersión · Práctica</p>
      </header>

      {/* 1. Tareas pendientes */}
      <SectionHeader>Tareas pendientes ({pendingTasks.length})</SectionHeader>
      <PendingTasks tasks={tasksSerialized} />

      {/* 2. Dispersión por palo */}
      <SectionHeader>Dispersión por palo</SectionHeader>
      <DispersionUploader />
      <DispersionList rows={dispersions} />

      {/* 3. Wedge Matrix */}
      <SectionHeader>Wedge Matrix</SectionHeader>
      <Link href="/range/wedge-matrix" className="block">
        <Card className="!p-4 flex items-center justify-between hover:shadow-lg transition-shadow" style={{ borderLeft: "4px solid var(--accent)" }}>
          <div>
            <div className="font-bold text-base text-[var(--fairway)]">
              🎯 Wedge gapping
            </div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              Distancias conocidas wedge × posición · cargá desde FlightScope
            </div>
          </div>
          <span className="text-[var(--accent)] text-2xl">›</span>
        </Card>
      </Link>

      {/* 4. Purposeful Practice — botón prominente al final */}
      <SectionHeader>Purposeful Practice</SectionHeader>
      <Link href="/range/pp" className="block">
        <Card className="!p-4 flex items-center justify-between hover:shadow-lg transition-shadow" style={{ borderLeft: "4px solid var(--green)" }}>
          <div>
            <div className="font-bold text-base text-[var(--fairway)]">
              🎯 Empezar Purposeful Practice
            </div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              Wizard de drills · Auto-PP o Custom · Historial de sesiones
            </div>
          </div>
          <span className="text-[var(--green)] text-2xl">›</span>
        </Card>
      </Link>
    </div>
  );
}
