"use client";

// Carga los tiros del hoyo, sigue el GPS y renderiza el mapa (dynamic, sin SSR por Leaflet).
// Arrastrar un marker o tocar el mapa persiste la ubicación vía PATCH /api/shots/[id].
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { MapShot, MapHole } from "./ShotsMap";

const ShotsMap = dynamic(() => import("./ShotsMap"), { ssr: false });

export default function ShotsMapPanel({ roundHoleId, hole }: { roundHoleId: string; hole: MapHole }) {
  const [shots, setShots] = useState<MapShot[]>([]);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/shots?roundHoleId=${roundHoleId}`);
      const j = (await r.json()) as { shots?: MapShot[] };
      if (j.shots) setShots(j.shots);
    } catch {
      /* silencioso */
    }
  }, [roundHoleId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setUserLat(p.coords.latitude);
        setUserLng(p.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const onMoveShot = useCallback(async (id: string, lat: number, lng: number) => {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, fromLat: lat, fromLng: lng } : s)));
    await fetch(`/api/shots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromLat: lat, fromLng: lng }),
    });
  }, []);

  const onPlaceShot = useCallback(
    async (lat: number, lng: number) => {
      // Si hay un tiro sin ubicar, lo ubico. Si no, CREO un tiro nuevo en ese punto.
      const target = shots.find((s) => s.fromLat == null || s.fromLng == null);
      if (target) {
        void onMoveShot(target.id, lat, lng);
        return;
      }
      try {
        const r = await fetch("/api/shots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundHoleId, lat, lng }),
        });
        const j = (await r.json()) as { shot?: MapShot };
        if (j.shot) setShots((prev) => [...prev, j.shot!]);
      } catch {
        /* silencioso */
      }
    },
    [shots, onMoveShot, roundHoleId],
  );

  const onDeleteShot = useCallback(
    async (id: string) => {
      setShots((prev) => prev.filter((s) => s.id !== id));
      setConfirmId(null);
      try {
        const r = await fetch(`/api/shots/${id}`, { method: "DELETE" });
        if (!r.ok) throw new Error();
      } catch {
        // Falló el DELETE (sin señal): recargo de la DB para que el tiro reaparezca
        void load();
      }
    },
    [load],
  );

  return (
    <div className="space-y-2">
      <ShotsMap
        hole={hole}
        userLat={userLat}
        userLng={userLng}
        shots={shots}
        onMoveShot={onMoveShot}
        onPlaceShot={onPlaceShot}
      />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[var(--muted)]">
          Arrastrá un tiro para corregirlo · tap en el mapa ubica el próximo sin GPS
        </p>
        <button onClick={() => void load()} className="text-[10px] underline text-[var(--muted)]">
          ↻ refrescar
        </button>
      </div>
      {shots.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shots.map((s) => (
            <button
              key={s.id}
              onClick={() =>
                confirmId === s.id ? void onDeleteShot(s.id) : setConfirmId(s.id)
              }
              className="text-xs font-semibold px-2 py-1 rounded-lg"
              style={
                confirmId === s.id
                  ? { background: "var(--red)", color: "white" }
                  : { background: "white", color: "var(--muted)", boxShadow: "0 1px 3px rgba(20,35,26,.06)" }
              }
            >
              {confirmId === s.id
                ? `¿Borrar tiro ${s.shotNumber}?`
                : `${s.shotNumber}${s.club ? ` · ${s.club}` : ""} 🗑️`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
