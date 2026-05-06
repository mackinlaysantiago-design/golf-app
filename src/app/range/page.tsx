import { prisma } from "@/lib/db";
import { Card, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";
import PendingTasks from "./PendingTasks";
import { dedupPendingRoundTasksByCode } from "@/lib/practice-tasks";

export const dynamic = "force-dynamic";

const CLUB_LABEL: Record<string, string> = {
  DRIVER: "Driver",
  WOOD_3: "Madera 3",
  WOOD_5: "Madera 5",
  HYBRID: "Híbrido",
  IRON_3: "Hierro 3",
  IRON_4: "Hierro 4",
  IRON_5: "Hierro 5",
  IRON_6: "Hierro 6",
  IRON_7: "Hierro 7",
  IRON_8: "Hierro 8",
  IRON_9: "Hierro 9",
  PW: "PW",
  GW: "GW",
  SW: "SW",
  LW: "LW",
};

export default async function RangePage() {
  // Limpia tasks duplicadas/menos exigentes antes de listar
  await dedupPendingRoundTasksByCode();

  const [sessions, pendingTasks] = await Promise.all([
    prisma.rangeSession.findMany({
      orderBy: { date: "desc" },
      include: { _count: { select: { shots: true } } },
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
        <p className="text-sm text-[var(--muted)]">FlightScope sessions</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/range/nueva" className="gf-btn">
          + FlightScope
        </Link>
        <Link href="/range/pp" className="gf-btn gf-btn-secondary">
          🎯 Purposeful Practice
        </Link>
      </div>
      <Link href="/range/stats" className="gf-btn gf-btn-secondary w-full text-sm">
        📊 Stats por palo
      </Link>

      <SectionHeader>Tareas pendientes ({pendingTasks.length})</SectionHeader>
      <PendingTasks tasks={tasksSerialized} />

      <SectionHeader>Sesiones FlightScope</SectionHeader>
      <div className="space-y-2">
        {sessions.length === 0 && (
          <Card className="text-center text-sm text-[var(--muted)]">
            No hay sesiones todavía
          </Card>
        )}
        {sessions.map((s) => (
          <Link key={s.id} href={`/range/${s.id}`}>
            <Card className="!p-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{CLUB_LABEL[s.club] ?? s.club}</div>
                <div className="text-xs text-[var(--muted)] gf-mono">
                  {new Date(s.date).toLocaleDateString("es-AR")} · {s._count.shots} shots
                </div>
              </div>
              <span className="text-[var(--muted)]">›</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
