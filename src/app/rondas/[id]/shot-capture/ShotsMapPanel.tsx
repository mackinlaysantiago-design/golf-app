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
    (lat: number, lng: number) => {
      const target = shots.find((s) => s.fromLat == null || s.fromLng == null);
      if (target) void onMoveShot(target.id, lat, lng);
    },
    [shots, onMoveShot],
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
    </div>
  );
}
