import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";
import Link from "next/link";
import MapEditor from "./MapEditor";

export const dynamic = "force-dynamic";

export default async function CourseMapEditorPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      holes: { orderBy: { number: "asc" } },
      mapPoints: { orderBy: { holeNumber: "asc" } },
    },
  });
  if (!course) notFound();

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/labs/maps" className="text-xs text-[var(--muted)]">
          ‹ Volver a canchas
        </Link>
        <h1 className="gf-display text-2xl text-[var(--fairway)] mt-1">
          {course.name} · Coords GPS
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {course.mapPoints.length}/18 hoyos cargados
        </p>
      </header>

      <Card style={{ borderLeft: "4px solid var(--accent)" }}>
        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
          <strong>Cómo cargar:</strong>
          <br />
          1. Abrí Google Maps y ubicá la cancha en vista satelital
          <br />
          2. Hacé click derecho sobre el <strong>frente</strong>, <strong>centro</strong> y <strong>fondo</strong> de cada green
          <br />
          3. Google te da las coords en formato <code>-34.491234, -58.621234</code>
          <br />
          4. Pegalas acá en cada campo
        </p>
      </Card>

      <SectionHeader>Greens por hoyo</SectionHeader>
      <MapEditor
        courseId={course.id}
        courseHoles={course.holes.map((h) => ({ number: h.number, par: h.par }))}
        initialPoints={course.mapPoints.map((p) => ({
          holeNumber: p.holeNumber,
          frontLat: p.frontLat,
          frontLng: p.frontLng,
          centerLat: p.centerLat,
          centerLng: p.centerLng,
          backLat: p.backLat,
          backLng: p.backLng,
          notes: p.notes,
        }))}
      />

      {course.mapPoints.length >= 9 && (
        <Link
          href={`/labs/maps/${course.id}/play`}
          className="gf-btn w-full"
        >
          📍 Probar GPS en cancha
        </Link>
      )}
    </div>
  );
}
