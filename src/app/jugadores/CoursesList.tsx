"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

type Course = {
  id: string;
  name: string;
  holes: { par: number }[];
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function CoursesList({ courses }: { courses: Course[] }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return showAll ? courses : [];
    return courses.filter((c) => normalize(c.name).includes(q));
  }, [courses, query, showAll]);

  return (
    <div className="space-y-2">
      <input
        className="gf-input"
        placeholder={`Buscar entre ${courses.length} canchas...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.trim() === "" && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-[var(--fairway)] underline w-full text-center py-1"
        >
          Mostrar todas ({courses.length})
        </button>
      )}
      {query.trim() === "" && showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="text-xs text-[var(--muted)] underline w-full text-center py-1"
        >
          Ocultar lista
        </button>
      )}

      {filtered.map((c) => (
        <Link key={c.id} href={`/jugadores/canchas/${c.id}`}>
          <Card className="!p-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-[var(--muted)] gf-mono">
                  {c.holes.length} hoyos · Par {c.holes.reduce((s, h) => s + h.par, 0)}
                </div>
              </div>
              <span className="text-[var(--muted)]">›</span>
            </div>
          </Card>
        </Link>
      ))}

      {query.trim() !== "" && filtered.length === 0 && (
        <Card className="text-center text-sm text-[var(--muted)]">
          Sin resultados
        </Card>
      )}

      <Link href="/jugadores/nueva-cancha">
        <Card className="!p-3 text-center text-[var(--fairway)] font-semibold border-dashed">
          + Nueva cancha
        </Card>
      </Link>
    </div>
  );
}
