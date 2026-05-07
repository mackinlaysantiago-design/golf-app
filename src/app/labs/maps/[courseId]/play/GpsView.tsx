"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { yardsBetween } from "@/lib/geo";

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

export default function GpsView({
  courseHoles,
  points,
}: {
  courseHoles: CourseHoleInfo[];
  points: Point[];
}) {
  const [currentHole, setCurrentHole] = useState(1);
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (!watching) return;
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta GPS");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition(pos);
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching]);

  const currentPoint = points.find((p) => p.holeNumber === currentHole);
  const lat = position?.coords.latitude ?? null;
  const lng = position?.coords.longitude ?? null;

  function distYds(targetLat: number | null, targetLng: number | null) {
    if (lat == null || lng == null || targetLat == null || targetLng == null)
      return null;
    return yardsBetween(lat, lng, targetLat, targetLng);
  }

  const dFront = distYds(currentPoint?.frontLat ?? null, currentPoint?.frontLng ?? null);
  const dCenter = distYds(currentPoint?.centerLat ?? null, currentPoint?.centerLng ?? null);
  const dBack = distYds(currentPoint?.backLat ?? null, currentPoint?.backLng ?? null);

  const hasCoords =
    !!currentPoint &&
    (currentPoint.frontLat != null ||
      currentPoint.centerLat != null ||
      currentPoint.backLat != null);

  function go(delta: number) {
    const next = currentHole + delta;
    if (next < 1 || next > courseHoles.length) return;
    setCurrentHole(next);
  }

  return (
    <div className="space-y-3">
      {/* Toggle GPS */}
      {!watching ? (
        <button
          onClick={() => setWatching(true)}
          className="gf-btn w-full !py-3"
        >
          📍 Activar GPS
        </button>
      ) : (
        <div className="flex items-center justify-between p-2 rounded" style={{ background: "var(--green-pale)" }}>
          <span className="text-xs gf-mono">
            {position
              ? `📍 GPS activo · precisión ${position.coords.accuracy.toFixed(0)}m`
              : "🔄 Buscando señal..."}
          </span>
          <button
            onClick={() => setWatching(false)}
            className="text-[10px] text-[var(--muted)] underline"
          >
            apagar
          </button>
        </div>
      )}

      {error && (
        <Card className="!p-2" style={{ borderLeft: "4px solid var(--red)" }}>
          <p className="text-xs text-[var(--red)]">{error}</p>
        </Card>
      )}

      {/* Hole header + nav */}
      <Card className="!p-3 text-center">
        <div className="flex items-center justify-between">
          <button
            onClick={() => go(-1)}
            disabled={currentHole === 1}
            className="text-2xl px-3 disabled:opacity-30"
          >
            ‹
          </button>
          <div>
            <div className="gf-display text-3xl text-[var(--fairway)]">
              Hoyo {currentHole}
            </div>
            <div className="text-xs text-[var(--muted)] gf-mono">
              par {courseHoles.find((h) => h.number === currentHole)?.par ?? "—"}
            </div>
          </div>
          <button
            onClick={() => go(1)}
            disabled={currentHole === courseHoles.length}
            className="text-2xl px-3 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </Card>

      {/* Distancias */}
      {!hasCoords ? (
        <Card className="text-center !p-4">
          <p className="text-sm text-[var(--muted)]">
            No hay coords cargadas para el hoyo {currentHole}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          <DistanceCard
            label="🔵 Fondo"
            yds={dBack}
            color="var(--fairway)"
            available={currentPoint!.backLat != null}
          />
          <DistanceCard
            label="🎯 Centro"
            yds={dCenter}
            color="var(--accent)"
            available={currentPoint!.centerLat != null}
            highlight
          />
          <DistanceCard
            label="🟢 Frente"
            yds={dFront}
            color="var(--green)"
            available={currentPoint!.frontLat != null}
          />
        </div>
      )}

      {currentPoint?.notes && (
        <Card className="!p-2">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Notas del hoyo
          </div>
          <div className="text-sm mt-1">{currentPoint.notes}</div>
        </Card>
      )}

      {/* Quick jump */}
      <div className="grid grid-cols-9 gap-1 text-[10px]">
        {courseHoles.map((h) => {
          const has = points.some(
            (p) =>
              p.holeNumber === h.number &&
              (p.frontLat != null || p.centerLat != null || p.backLat != null),
          );
          return (
            <button
              key={h.number}
              onClick={() => setCurrentHole(h.number)}
              className="rounded gf-mono py-1.5"
              style={{
                background:
                  currentHole === h.number
                    ? "var(--fairway)"
                    : has
                    ? "var(--green-pale)"
                    : "transparent",
                color:
                  currentHole === h.number
                    ? "white"
                    : has
                    ? "var(--fairway)"
                    : "var(--muted)",
                fontWeight: currentHole === h.number ? 700 : 500,
                opacity: has ? 1 : 0.4,
              }}
            >
              {h.number}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DistanceCard({
  label,
  yds,
  color,
  available,
  highlight,
}: {
  label: string;
  yds: number | null;
  color: string;
  available: boolean;
  highlight?: boolean;
}) {
  if (!available) {
    return (
      <Card className="!p-2 opacity-50">
        <div className="flex justify-between items-center">
          <span className="text-sm">{label}</span>
          <span className="text-xs text-[var(--muted)]">sin coord</span>
        </div>
      </Card>
    );
  }
  return (
    <Card
      className="!p-3"
      style={{
        borderLeft: `4px solid ${color}`,
        background: highlight ? "var(--green-pale)" : undefined,
      }}
    >
      <div className="flex justify-between items-center">
        <span className="font-semibold">{label}</span>
        <span className="gf-display text-3xl" style={{ color }}>
          {yds == null ? (
            <span className="text-base text-[var(--muted)]">esperando GPS</span>
          ) : (
            <>
              {yds.toFixed(0)}
              <span className="text-base text-[var(--muted)] ml-1">yds</span>
            </>
          )}
        </span>
      </div>
    </Card>
  );
}
