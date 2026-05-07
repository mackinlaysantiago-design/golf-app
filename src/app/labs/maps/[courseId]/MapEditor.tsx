"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { parseLatLng } from "@/lib/geo";

type Point = {
  holeNumber: number;
  frontLat: number | null;
  frontLng: number | null;
  centerLat: number | null;
  centerLng: number | null;
  backLat: number | null;
  backLng: number | null;
  notes: string | null;
};

type CourseHoleInfo = { number: number; par: number };

function pointToString(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return "";
  return `${lat}, ${lng}`;
}

export default function MapEditor({
  courseId,
  courseHoles,
  initialPoints,
}: {
  courseId: string;
  courseHoles: CourseHoleInfo[];
  initialPoints: Point[];
}) {
  const router = useRouter();
  const [openHole, setOpenHole] = useState<number | null>(null);

  // Index points by hole
  const pointsMap = new Map<number, Point>();
  for (const p of initialPoints) pointsMap.set(p.holeNumber, p);

  return (
    <div className="space-y-2">
      {courseHoles.map((h) => {
        const point = pointsMap.get(h.number);
        const hasAny = point && (point.frontLat != null || point.centerLat != null || point.backLat != null);
        const hasAll =
          point &&
          point.frontLat != null &&
          point.centerLat != null &&
          point.backLat != null;
        const isOpen = openHole === h.number;

        return (
          <Card
            key={h.number}
            className="!p-2"
            style={{
              borderLeft: hasAll
                ? "4px solid var(--green)"
                : hasAny
                ? "4px solid var(--accent)"
                : "4px solid var(--green-pale)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpenHole(isOpen ? null : h.number)}
              className="w-full flex justify-between items-center"
            >
              <span className="font-semibold text-sm">
                Hoyo {h.number}{" "}
                <span className="text-[10px] text-[var(--muted)] font-normal gf-mono">
                  par {h.par}
                </span>
              </span>
              <span className="text-[10px] gf-mono">
                {hasAll ? "✓ completo" : hasAny ? "parcial" : "vacío"}{" "}
                {isOpen ? "▾" : "▸"}
              </span>
            </button>
            {isOpen && (
              <HoleEditor
                courseId={courseId}
                holeNumber={h.number}
                initial={point ?? null}
                onSaved={() => {
                  router.refresh();
                  setOpenHole(null);
                }}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}

function HoleEditor({
  courseId,
  holeNumber,
  initial,
  onSaved,
}: {
  courseId: string;
  holeNumber: number;
  initial: Point | null;
  onSaved: () => void;
}) {
  const [front, setFront] = useState(
    pointToString(initial?.frontLat ?? null, initial?.frontLng ?? null),
  );
  const [center, setCenter] = useState(
    pointToString(initial?.centerLat ?? null, initial?.centerLng ?? null),
  );
  const [back, setBack] = useState(
    pointToString(initial?.backLat ?? null, initial?.backLng ?? null),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const f = front.trim() ? parseLatLng(front) : null;
    const c = center.trim() ? parseLatLng(center) : null;
    const b = back.trim() ? parseLatLng(back) : null;
    if (front.trim() && !f) {
      setError("Coords del frente inválidas");
      return;
    }
    if (center.trim() && !c) {
      setError("Coords del centro inválidas");
      return;
    }
    if (back.trim() && !b) {
      setError("Coords del fondo inválidas");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/labs/course-map/${courseId}/${holeNumber}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frontLat: f?.lat ?? null,
        frontLng: f?.lng ?? null,
        centerLat: c?.lat ?? null,
        centerLng: c?.lng ?? null,
        backLat: b?.lat ?? null,
        backLng: b?.lng ?? null,
        notes: notes.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) onSaved();
    else setError("Error guardando");
  }

  async function clear() {
    if (!confirm("¿Borrar coords del hoyo?")) return;
    setBusy(true);
    await fetch(`/api/labs/course-map/${courseId}/${holeNumber}`, {
      method: "DELETE",
    });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="space-y-2 mt-2 pt-2 border-t border-[var(--green-pale)]">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          🟢 Frente del green (lat, lng)
        </label>
        <input
          className="gf-input mt-0.5 gf-mono text-xs"
          placeholder="-34.491234, -58.621234"
          value={front}
          onChange={(e) => setFront(e.target.value)}
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          🎯 Centro del green
        </label>
        <input
          className="gf-input mt-0.5 gf-mono text-xs"
          placeholder="-34.491234, -58.621234"
          value={center}
          onChange={(e) => setCenter(e.target.value)}
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          🔵 Fondo del green
        </label>
        <input
          className="gf-input mt-0.5 gf-mono text-xs"
          placeholder="-34.491234, -58.621234"
          value={back}
          onChange={(e) => setBack(e.target.value)}
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Notas (opcional)
        </label>
        <input
          className="gf-input mt-0.5 text-xs"
          placeholder="ej: bunker frontal a 10y, agua a la derecha"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="gf-btn flex-1 !text-xs">
          {busy ? "Guardando..." : "Guardar"}
        </button>
        {initial && (
          <button
            onClick={clear}
            disabled={busy}
            className="gf-btn gf-btn-secondary !text-xs px-3"
            style={{ color: "var(--red)" }}
          >
            Borrar
          </button>
        )}
      </div>
    </div>
  );
}
