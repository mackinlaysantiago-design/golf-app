"use client";

// Mapa satelital del hoyo para marcar dónde cayó cada tiro. Tap en el mapa → guarda la
// posición del tiro activo (por roundHoleId + shotNumber, vía /api/shots/position).
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HoleGreen } from "@/lib/shot-gps";

type ShotLite = { shotNumber: number; club: string | null };

function numIcon(n: number, active: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${
      active ? "#dc2626" : "#15803d"
    };color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function ShotMap({
  roundHoleId,
  green,
  shots,
}: {
  roundHoleId: string;
  green: HoleGreen;
  shots: ShotLite[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});

  const [active, setActive] = useState<number>(shots[0]?.shotNumber ?? 1);
  const [positions, setPositions] = useState<Record<number, { lat: number; lng: number }>>({});

  const activeRef = useRef(active);
  const posRef = useRef(positions);
  const shotsRef = useRef(shots);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    posRef.current = positions;
  }, [positions]);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const c: [number, number] =
      green.centerLat != null && green.centerLng != null
        ? [green.centerLat, green.centerLng]
        : [-34.5, -58.6];
    const map = L.map(ref.current, { zoomControl: true, attributionControl: false }).setView(c, 17);
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 20 },
    ).addTo(map);
    if (green.centerLat != null && green.centerLng != null) {
      L.circleMarker([green.centerLat, green.centerLng], {
        radius: 9,
        color: "#fff",
        weight: 2,
        fillColor: "#22c55e",
        fillOpacity: 0.9,
      })
        .bindTooltip("Green")
        .addTo(map);
    }
    map.on("click", (e: L.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshIcons() {
    for (const key of Object.keys(markersRef.current)) {
      const n = Number(key);
      markersRef.current[n]?.setIcon(numIcon(n, n === activeRef.current));
    }
  }

  function place(lat: number, lng: number) {
    const n = activeRef.current;
    const map = mapRef.current;
    if (!map) return;
    if (markersRef.current[n]) map.removeLayer(markersRef.current[n]);
    markersRef.current[n] = L.marker([lat, lng], { icon: numIcon(n, true) }).addTo(map);
    setPositions((p) => ({ ...p, [n]: { lat, lng } }));
    void fetch("/api/shots/position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundHoleId, shotNumber: n, lat, lng }),
    });
    const next = shotsRef.current
      .map((s) => s.shotNumber)
      .find((sn) => sn > n && !(sn in posRef.current));
    setActive(next ?? n);
    setTimeout(refreshIcons, 0);
  }

  return (
    <div className="space-y-2">
      <div ref={ref} style={{ width: "100%", height: 340, borderRadius: 12, overflow: "hidden" }} />
      <div className="flex flex-wrap gap-1">
        {shots.map((s) => (
          <button
            key={s.shotNumber}
            onClick={() => {
              setActive(s.shotNumber);
              setTimeout(refreshIcons, 0);
            }}
            className="rounded px-2 py-1 text-xs font-bold"
            style={{
              background:
                s.shotNumber === active
                  ? "var(--red)"
                  : s.shotNumber in positions
                  ? "var(--green-pale)"
                  : "#e9ece9",
              color: s.shotNumber === active ? "#fff" : "var(--fairway)",
            }}
          >
            {s.shotNumber}
            {s.club ? ` ${s.club}` : ""}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[var(--muted)] text-center">
        Elegí un tiro y tocá el mapa donde cayó. 🟢 = green.
      </p>
    </div>
  );
}
