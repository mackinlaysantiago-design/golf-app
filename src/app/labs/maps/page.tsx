import { prisma } from "@/lib/db";
import { Card, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LabsMapsPage() {
  const [coursesRaw, allPoints] = await Promise.all([
    prisma.course.findMany({ orderBy: { name: "asc" } }),
    prisma.courseMapPoint.findMany({ select: { courseId: true, holeNumber: true } }),
  ]);
  const pointsByCourse = new Map<string, number[]>();
  for (const p of allPoints) {
    if (!pointsByCourse.has(p.courseId)) pointsByCourse.set(p.courseId, []);
    pointsByCourse.get(p.courseId)!.push(p.holeNumber);
  }
  const courses = coursesRaw.map((c) => ({
    ...c,
    mapPoints: (pointsByCourse.get(c.id) ?? []).map((holeNumber) => ({ holeNumber })),
  }));

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/" className="text-xs text-[var(--muted)]">
          ‹ Volver
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          🧪 Labs · Mapas GPS
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Distancias al green con GPS. Cargá las coords del frente / centro / fondo
          de cada green una vez por cancha.
        </p>
      </header>

      <Card style={{ borderLeft: "4px solid var(--accent)" }}>
        <p className="text-[11px] text-[var(--muted)]">
          🚧 <strong>Experimental.</strong> Esta sección está separada del flujo
          principal — podés cargar coords y probar el GPS sin afectar tus rondas.
        </p>
      </Card>

      <SectionHeader>Canchas</SectionHeader>
      <div className="space-y-2">
        {courses.map((c) => {
          const cargados = c.mapPoints.length;
          return (
            <Card key={c.id} className="!p-3 space-y-2">
              <Link
                href={`/labs/maps/${c.id}`}
                className="flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-[var(--muted)] gf-mono mt-0.5">
                    {cargados > 0
                      ? `${cargados}/18 hoyos con coords`
                      : "sin coords cargadas"}
                  </div>
                </div>
                <span className="text-[var(--muted)]">›</span>
              </Link>
              {cargados >= 9 && (
                <Link
                  href={`/labs/maps/${c.id}/play`}
                  className="text-[11px] text-[var(--fairway)] underline inline-block"
                >
                  📍 Usar GPS en cancha →
                </Link>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
