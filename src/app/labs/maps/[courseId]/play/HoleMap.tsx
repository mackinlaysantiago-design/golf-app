"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

export default function HoleMap({
  point,
  userLat,
  userLng,
}: {
  point: Point;
  userLat: number | null;
  userLng: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const layupMarkerRef = useRef<L.CircleMarker | null>(null);
  const layupLineRef = useRef<L.Polyline | null>(null);
  const layupLabelRef = useRef<L.Marker | null>(null);

  const [layup, setLayup] = useState<{ lat: number; lng: number } | null>(null);

  // Init map una sola vez
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    });
    mapRef.current = map;

    // Tile layer: Mapbox satellite (mejor calidad) si hay token, sino fallback a ESRI.
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (mapboxToken) {
      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
        {
          maxZoom: 20,
          maxNativeZoom: 19,
          tileSize: 512,
          zoomOffset: -1,
          attribution: "© Mapbox © Maxar",
        },
      ).addTo(map);
    } else {
      // ESRI World Imagery — en zonas rurales (golf courses Argentina) no hay tiles
      // más allá de z=18. maxNativeZoom: 18 hace que Leaflet escale tiles z=18 para
      // zooms 19-20 en vez de mostrar "Map data not yet available".
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 20,
          maxNativeZoom: 18,
          attribution: "Esri, Maxar, Earthstar Geographics",
        },
      ).addTo(map);
    }

    // Click en el mapa coloca/mueve el layup
    map.on("click", (e: L.LeafletMouseEvent) => {
      setLayup({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Pintar puntos del green + anillos cuando cambia el hoyo o se centra
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Limpiar capas previas
    for (const l of layersRef.current) map.removeLayer(l);
    layersRef.current = [];

    const cLat = point.centerLat;
    const cLng = point.centerLng;

    // Marcadores green: front (verde), center (blanco), back (azul)
    const adds: L.Layer[] = [];
    if (point.frontLat != null && point.frontLng != null) {
      adds.push(
        L.circleMarker([point.frontLat, point.frontLng], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#7ed957",
          fillOpacity: 1,
        })
          .bindTooltip("Frente", { permanent: false }),
      );
    }
    if (cLat != null && cLng != null) {
      adds.push(
        L.circleMarker([cLat, cLng], {
          radius: 7,
          color: "#7ed957",
          weight: 2,
          fillColor: "#fff",
          fillOpacity: 1,
        })
          .bindTooltip("Centro", { permanent: false }),
      );
    }
    if (point.backLat != null && point.backLng != null) {
      adds.push(
        L.circleMarker([point.backLat, point.backLng], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#3a86ff",
          fillOpacity: 1,
        })
          .bindTooltip("Fondo", { permanent: false }),
      );
    }

    // Anillos de distancia desde el centro del green (100, 150, 200 yds)
    if (cLat != null && cLng != null) {
      const ringDefs = [
        { yds: 100, color: "#7ed957" }, // verde
        { yds: 150, color: "#ffb627" }, // amarillo
        { yds: 200, color: "#ff5252" }, // rojo
      ];
      for (const r of ringDefs) {
        const meters = r.yds * 0.9144;
        adds.push(
          L.circle([cLat, cLng], {
            radius: meters,
            color: r.color,
            weight: 1.5,
            fillOpacity: 0,
            opacity: 0.7,
            dashArray: "5,4",
          }),
        );
      }
    }

    for (const a of adds) a.addTo(map);
    layersRef.current = adds;

    // Centrar en el green
    if (cLat != null && cLng != null) {
      map.setView([cLat, cLng], 18);
    } else if (point.frontLat && point.frontLng) {
      map.setView([point.frontLat, point.frontLng], 18);
    }
  }, [point]);

  // User position marker (live)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
    if (userLat == null || userLng == null) return;
    const m = L.circleMarker([userLat, userLng], {
      radius: 9,
      color: "#fff",
      weight: 2,
      fillColor: "#3a86ff",
      fillOpacity: 1,
    })
      .bindTooltip("Tu posición", { permanent: false })
      .addTo(map);
    userMarkerRef.current = m;
  }, [userLat, userLng]);

  // Layup marker + línea + label
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Limpiar
    if (layupMarkerRef.current) {
      map.removeLayer(layupMarkerRef.current);
      layupMarkerRef.current = null;
    }
    if (layupLineRef.current) {
      map.removeLayer(layupLineRef.current);
      layupLineRef.current = null;
    }
    if (layupLabelRef.current) {
      map.removeLayer(layupLabelRef.current);
      layupLabelRef.current = null;
    }

    if (!layup) return;

    layupMarkerRef.current = L.circleMarker([layup.lat, layup.lng], {
      radius: 8,
      color: "#fff",
      weight: 2,
      fillColor: "#ffb627",
      fillOpacity: 1,
    })
      .bindTooltip("Layup (tap mapa para mover)", { permanent: false })
      .addTo(map);

    // Línea desde user → layup → centro green
    if (userLat != null && userLng != null && point.centerLat != null && point.centerLng != null) {
      layupLineRef.current = L.polyline(
        [
          [userLat, userLng],
          [layup.lat, layup.lng],
          [point.centerLat, point.centerLng],
        ],
        { color: "#3a86ff", weight: 2, opacity: 0.9, dashArray: "5,4" },
      ).addTo(map);

      // Label de yds desde layup al centro
      const yds = yardsBetween(layup.lat, layup.lng, point.centerLat, point.centerLng);
      const labelLat = (layup.lat + point.centerLat) / 2;
      const labelLng = (layup.lng + point.centerLng) / 2;
      layupLabelRef.current = L.marker([labelLat, labelLng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#3a86ff;color:white;padding:3px 7px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid white;">${yds.toFixed(0)}y</div>`,
          iconSize: [40, 22],
          iconAnchor: [20, 11],
        }),
      }).addTo(map);
    }
  }, [layup, userLat, userLng, point.centerLat, point.centerLng]);

  const userToCenter =
    userLat != null && userLng != null && point.centerLat != null && point.centerLng != null
      ? yardsBetween(userLat, userLng, point.centerLat, point.centerLng)
      : null;
  const userToLayup =
    userLat != null && userLng != null && layup
      ? yardsBetween(userLat, userLng, layup.lat, layup.lng)
      : null;
  const layupToCenter =
    layup && point.centerLat != null && point.centerLng != null
      ? yardsBetween(layup.lat, layup.lng, point.centerLat, point.centerLng)
      : null;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 400,
          borderRadius: 12,
          overflow: "hidden",
        }}
      />

      {/* Resumen de distancias del layup */}
      {layup && (
        <div
          className="grid grid-cols-3 gap-2 text-center text-[11px] gf-mono"
          style={{ background: "var(--green-pale)", padding: "8px", borderRadius: 8 }}
        >
          <div>
            <div className="text-[9px] uppercase text-[var(--muted)]">Vos → green</div>
            <div className="font-bold text-[var(--fairway)] text-base">
              {userToCenter?.toFixed(0) ?? "—"}y
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-[var(--muted)]">Vos → layup</div>
            <div className="font-bold text-[var(--accent)] text-base">
              {userToLayup?.toFixed(0) ?? "—"}y
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-[var(--muted)]">Layup → green</div>
            <div className="font-bold text-[var(--green)] text-base">
              {layupToCenter?.toFixed(0) ?? "—"}y
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-[var(--muted)] text-center">
        Tap en el mapa para marcar un punto layup. Anillos: 🟢 100y · 🟡 150y · 🔴 200y desde el centro.
      </p>

      {layup && (
        <button
          onClick={() => setLayup(null)}
          className="text-[10px] text-[var(--muted)] underline w-full text-center py-1"
        >
          Quitar layup
        </button>
      )}
    </div>
  );
}
