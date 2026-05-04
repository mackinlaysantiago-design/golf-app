import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import CanchaEditor from "./CanchaEditor";

export const dynamic = "force-dynamic";

export default async function CanchaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      holes: { orderBy: { number: "asc" } },
      tees: { orderBy: [{ category: "asc" }, { name: "asc" }] },
    },
  });
  if (!course) notFound();

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header>
        <Link href="/jugadores" className="text-xs text-[var(--muted)]">
          ‹ Volver a Setup
        </Link>
        <h1 className="gf-display text-3xl text-[var(--fairway)] mt-1">
          {course.name}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {course.holes.length} hoyos · Par{" "}
          {course.holes.reduce((s, h) => s + h.par, 0)}
        </p>
      </header>

      <CanchaEditor courseId={course.id} initialTees={course.tees} />
    </div>
  );
}
