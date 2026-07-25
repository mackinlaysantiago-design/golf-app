"use client";

// Mapa de tiros del hoyo: satélite + green + tu posición + un marker numerado por tiro,
// ARRASTRABLE (corregís dónde cayó). Tap en el mapa = ubicar el próximo tiro sin coords.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapShot = {
  id: string;
  shotNumber: number;
  fromLat: number | null;
  fromLng: number | null;
};
export type MapHole = {
  teeLat: number | null;
  teeLng: number | null;
  centerLat: number | null;
  centerLng: number | null;
};

const SAT_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function numberIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:#15803d;color:#fff;
      border:2px solid #fff;display:flex;align-items:center;justify-content:center;
      font-weight:800;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function ShotsMap({
  hole,
  userLat,
  userLng,
  shots,
  onMoveShot,
  onPlaceShot,
}: {
  hole: MapHole;
  userLat: number | null;
  userLng: number | null;
  shots: MapShot[];
  onMoveShot: (id: string, lat: number, lng: number) => void;
  onPlaceShot: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const userRef = useRef<L.CircleMarker | null>(null);
  const onPlaceRef = useRef(onPlaceShot);
  onPlaceRef.current = onPlaceShot;
  const fittedRef = useRef(false);

  // Init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false });
    mapRef.current = map;
    L.tileLayer(SAT_URL, { maxZoom: 21 }).addTo(map);
    map.setView([-34.6, -58.4], 16); // vista inicial provisoria
    map.on("click", (e: L.LeafletMouseEvent) => onPlaceRef.current(e.latlng.lat, e.latlng.lng));
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fit al green/tee la primera vez que hay datos
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedRef.current) return;
    const pts: L.LatLngTuple[] = [];
    if (hole.centerLat != null && hole.centerLng != null) pts.push([hole.centerLat, hole.centerLng]);
    if (userLat != null && userLng != null) pts.push([userLat, userLng]);
    else if (hole.teeLat != null && hole.teeLng != null) pts.push([hole.teeLat, hole.teeLng]);
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 19, animate: false });
      fittedRef.current = true;
    } else if (pts.length === 1) {
      map.setView(pts[0], 17, { animate: false });
    }
  }, [hole, userLat, userLng]);

  // Green + tee (base) — se dibuja una vez por hoyo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const base: L.Layer[] = [];
    if (hole.centerLat != null && hole.centerLng != null) {
      base.push(
        L.circleMarker([hole.centerLat, hole.centerLng], {
          radius: 8, color: "#fff", weight: 2, fillColor: "#22c55e", fillOpacity: 1,
        }).bindTooltip("Green", { permanent: false }).addTo(map),
      );
    }
    if (hole.teeLat != null && hole.teeLng != null) {
      base.push(
        L.circleMarker([hole.teeLat, hole.teeLng], {
          radius: 6, color: "#fff", weight: 2, fillColor: "#eab308", fillOpacity: 1,
        }).bindTooltip("Tee", { permanent: false }).addTo(map),
      );
    }
    return () => base.forEach((b) => map.removeLayer(b));
  }, [hole]);

  // User (live)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userRef.current) { map.removeLayer(userRef.current); userRef.current = null; }
    if (userLat == null || userLng == null) return;
    userRef.current = L.circleMarker([userLat, userLng], {
      radius: 7, color: "#fff", weight: 2, fillColor: "#3a86ff", fillOpacity: 1,
    }).bindTooltip("Vos").addTo(map);
  }, [userLat, userLng]);

  // Markers de tiros (numerados, arrastrables)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = shots
      .filter((s) => s.fromLat != null && s.fromLng != null)
      .map((s) => {
        const m = L.marker([s.fromLat!, s.fromLng!], {
          icon: numberIcon(s.shotNumber),
          draggable: true,
        }).addTo(map);
        m.on("dragend", () => {
          const ll = m.getLatLng();
          onMoveShot(s.id, ll.lat, ll.lng);
        });
        return m;
      });
    return () => markersRef.current.forEach((m) => map.removeLayer(m));
  }, [shots, onMoveShot]);

  return <div ref={containerRef} style={{ width: "100%", height: 340, borderRadius: 12, overflow: "hidden" }} />;
}
