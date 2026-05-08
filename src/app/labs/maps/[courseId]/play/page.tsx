import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import GpsView from "./GpsView";

export const dynamic = "force-dynamic";

export default async function GpsPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ round?: string }>;
}) {
  const { courseId } = await params;
  const { round: roundId } = await searchParams;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      holes: { orderBy: { number: "asc" } },
      mapPoints: { orderBy: { holeNumber: "asc" } },
    },
  });
  if (!course) notFound();

  const backHref = roundId ? `/rondas/${roundId}` : `/labs/maps/${course.id}`;
  const backLabel = roundId ? "‹ Volver al tracker" : "‹ Volver al editor";

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href={backHref} className="text-xs text-[var(--muted)]">
          {backLabel}
        </Link>
        <h1 className="gf-display text-2xl text-[var(--fairway)] mt-1">
          📍 {course.name}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          GPS · distancias al green
        </p>
      </header>

      <GpsView
        roundId={roundId ?? null}
        courseHoles={course.holes.map((h) => ({ number: h.number, par: h.par }))}
        points={course.mapPoints.map((p) => ({
          holeNumber: p.holeNumber,
          teeLat: p.teeLat,
          teeLng: p.teeLng,
          frontLat: p.frontLat,
          frontLng: p.frontLng,
          centerLat: p.centerLat,
          centerLng: p.centerLng,
          backLat: p.backLat,
          backLng: p.backLng,
          notes: p.notes,
        }))}
      />
    </div>
  );
}
