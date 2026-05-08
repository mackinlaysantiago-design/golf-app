"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { yardsBetween } from "@/lib/geo";
import { attachSatelliteLayer } from "./mapTiles";
import { isInViewport, visibleMidLatLng } from "./labelClipping";
import { buildHoleLayers, makeLabelIcon, type HolePoint } from "./holeLayers";
import { useWind } from "./useWind";
import { WindCard } from "./WindCard";

function readLocalFlag(key: string, fallback = false): boolean {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) === "1";
}

function writeLocalFlag(key: string, value: boolean) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value ? "1" : "0");
  }
}

export default function HoleMap({
  point,
  userLat,
  userLng,
}: {
  point: HolePoint;
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
  const userLayupLabelRef = useRef<L.Marker | null>(null);
  const userFrontLabelRef = useRef<L.Marker | null>(null);
  const userCenterLabelRef = useRef<L.Marker | null>(null);
  const userBackLabelRef = useRef<L.Marker | null>(null);
  // Función reactiva para recolocar labels cuando se mueve/zoomea el mapa.
  // Cambia entre renders → la guardo en ref para que el listener siempre llame al último.
  const repositionLabelsRef = useRef<(() => void) | null>(null);
  // Track el hoyo del que ya hicimos auto-fit con GPS, para no re-fitear en cada update.
  const fittedHoleRef = useRef<number | null>(null);

  const [layup, setLayup] = useState<{ lat: number; lng: number } | null>(null);
  const [showFrontBackLabels, setShowFrontBackLabels] = useState(() =>
    readLocalFlag("gf-show-front-back-labels"),
  );
  useEffect(() => writeLocalFlag("gf-show-front-back-labels", showFrontBackLabels), [
    showFrontBackLabels,
  ]);

  const [tournamentMode, setTournamentMode] = useState(() =>
    readLocalFlag("gf-tournament-mode"),
  );
  useEffect(() => writeLocalFlag("gf-tournament-mode", tournamentMode), [tournamentMode]);

  const [windEnabled, setWindEnabled] = useState(() => readLocalFlag("gf-wind-enabled"));
  useEffect(() => writeLocalFlag("gf-wind-enabled", windEnabled), [windEnabled]);
  const showWind = windEnabled && !tournamentMode;

  const wind = useWind(showWind, point.centerLat, point.centerLng);

  // Init map una sola vez
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    });
    mapRef.current = map;

    const cancelledRef = { current: false };
    attachSatelliteLayer(map, cancelledRef);

    map.on("click", (e: L.LeafletMouseEvent) => {
      setLayup({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    const onMoveZoom = () => repositionLabelsRef.current?.();
    map.on("move zoom moveend zoomend", onMoveZoom);

    return () => {
      cancelledRef.current = true;
      map.off("move zoom moveend zoomend", onMoveZoom);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Pintar puntos del green + anillos cuando cambia el hoyo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const l of layersRef.current) map.removeLayer(l);
    const adds = buildHoleLayers(point);
    for (const a of adds) a.addTo(map);
    layersRef.current = adds;

    // Centrado inicial: si todavía no se hizo auto-fit con GPS para este hoyo,
    // centrar en el green. El fit con GPS vive en el effect siguiente.
    if (fittedHoleRef.current !== point.holeNumber) {
      if (point.centerLat != null && point.centerLng != null) {
        map.setView([point.centerLat, point.centerLng], 18);
      } else if (point.frontLat != null && point.frontLng != null) {
        map.setView([point.frontLat, point.frontLng], 18);
      }
    }
  }, [point]);

  // Auto-fit: anchor (GPS si está, sino tee) + green en pantalla.
  // - Si llega GPS después: re-fit (1 vez) y marca el hoyo para no re-fitear con jitter.
  // - Sin GPS y sin tee: no fiteamos — queda el setView simple del effect previo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (fittedHoleRef.current === point.holeNumber) return;

    const hasGps = userLat != null && userLng != null;
    const anchor: L.LatLngTuple | null = hasGps
      ? [userLat!, userLng!]
      : point.teeLat != null && point.teeLng != null
        ? [point.teeLat, point.teeLng]
        : null;
    if (!anchor) return;

    const greens: L.LatLngTuple[] = [];
    if (point.frontLat != null && point.frontLng != null)
      greens.push([point.frontLat, point.frontLng]);
    if (point.centerLat != null && point.centerLng != null)
      greens.push([point.centerLat, point.centerLng]);
    if (point.backLat != null && point.backLng != null)
      greens.push([point.backLat, point.backLng]);
    if (greens.length === 0) return;

    map.fitBounds(L.latLngBounds([anchor, ...greens]), {
      padding: [60, 60],
      maxZoom: 19,
      animate: true,
    });
    if (hasGps) fittedHoleRef.current = point.holeNumber;
  }, [point, userLat, userLng]);

  // User marker (live)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
    if (userLat == null || userLng == null) return;
    userMarkerRef.current = L.circleMarker([userLat, userLng], {
      radius: 9,
      color: "#fff",
      weight: 2,
      fillColor: "#3a86ff",
      fillOpacity: 1,
    })
      .bindTooltip("Tu posición", { permanent: false })
      .addTo(map);
  }, [userLat, userLng]);

  // Layup + labels (clamped al viewport)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearLayer = (refObj: { current: L.Layer | null }) => {
      if (refObj.current) {
        map.removeLayer(refObj.current);
        refObj.current = null;
      }
    };
    clearLayer(layupMarkerRef);
    clearLayer(layupLineRef);
    clearLayer(layupLabelRef);
    clearLayer(userLayupLabelRef);
    clearLayer(userFrontLabelRef);
    clearLayer(userCenterLabelRef);
    clearLayer(userBackLabelRef);
    repositionLabelsRef.current = null;

    const userPos: [number, number] | null =
      userLat != null && userLng != null ? [userLat, userLng] : null;

    // Labels vos→frente/centro/fondo del green con stagger vertical.
    // X positivo → label a la derecha del marker; Y positivo → arriba; Y negativo → abajo.
    if (userPos) {
      if (showFrontBackLabels && point.frontLat != null && point.frontLng != null) {
        const yds = yardsBetween(userLat!, userLng!, point.frontLat, point.frontLng);
        userFrontLabelRef.current = L.marker([point.frontLat, point.frontLng], {
          icon: makeLabelIcon(yds, "#16a34a", 50, 30),
          interactive: false,
          keyboard: false,
        }).addTo(map);
      }
      if (point.centerLat != null && point.centerLng != null) {
        const yds = yardsBetween(userLat!, userLng!, point.centerLat, point.centerLng);
        userCenterLabelRef.current = L.marker([point.centerLat, point.centerLng], {
          icon: makeLabelIcon(yds, "#1f2937", 50, 0),
          interactive: false,
          keyboard: false,
        }).addTo(map);
      }
      if (showFrontBackLabels && point.backLat != null && point.backLng != null) {
        const yds = yardsBetween(userLat!, userLng!, point.backLat, point.backLng);
        userBackLabelRef.current = L.marker([point.backLat, point.backLng], {
          icon: makeLabelIcon(yds, "#dc2626", 50, -30),
          interactive: false,
          keyboard: false,
        }).addTo(map);
      }
    }

    let layupPos: [number, number] | null = null;
    if (layup) {
      layupPos = [layup.lat, layup.lng];
      layupMarkerRef.current = L.circleMarker(layupPos, {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: "#ffb627",
        fillOpacity: 1,
      })
        .bindTooltip("Layup (tap mapa para mover)", { permanent: false })
        .addTo(map);

      if (userPos && point.centerLat != null && point.centerLng != null) {
        layupLineRef.current = L.polyline(
          [userPos, layupPos, [point.centerLat, point.centerLng]],
          { color: "#3a86ff", weight: 2, opacity: 0.9, dashArray: "5,4" },
        ).addTo(map);

        const userToLayupYds = yardsBetween(userLat!, userLng!, layup.lat, layup.lng);
        const layupToGreenYds = yardsBetween(
          layup.lat,
          layup.lng,
          point.centerLat,
          point.centerLng,
        );
        userLayupLabelRef.current = L.marker(layupPos, {
          icon: makeLabelIcon(userToLayupYds, "#ff8c00"),
          interactive: false,
          keyboard: false,
        }).addTo(map);
        layupLabelRef.current = L.marker(layupPos, {
          icon: makeLabelIcon(layupToGreenYds, "#3a86ff"),
          interactive: false,
          keyboard: false,
        }).addTo(map);
      }
    }

    // Reposicionar:
    // - Labels GREEN: si el marker está en pantalla, dejar al marker; si no, midpoint clippeado.
    // - Labels LAYUP: siempre midpoint visible.
    const reposition = () => {
      const mUL = mapRef.current;
      if (!mUL) return;

      const updateAnchored = (
        labelRef: { current: L.Marker | null },
        markerPos: [number, number] | null,
        userPosArg: [number, number] | null,
      ) => {
        if (!labelRef.current) return;
        const el = labelRef.current.getElement();
        if (!markerPos) {
          el?.style.setProperty("display", "none");
          return;
        }
        if (isInViewport(mUL, markerPos)) {
          labelRef.current.setLatLng(markerPos);
          el?.style.setProperty("display", "");
          return;
        }
        if (!userPosArg) {
          el?.style.setProperty("display", "none");
          return;
        }
        const mid = visibleMidLatLng(mUL, userPosArg, markerPos);
        if (mid) {
          labelRef.current.setLatLng(mid);
          el?.style.setProperty("display", "");
        } else {
          el?.style.setProperty("display", "none");
        }
      };

      const updateMidpoint = (
        labelRef: { current: L.Marker | null },
        a: [number, number] | null,
        b: [number, number] | null,
      ) => {
        if (!labelRef.current) return;
        const el = labelRef.current.getElement();
        if (!a || !b) {
          el?.style.setProperty("display", "none");
          return;
        }
        const mid = visibleMidLatLng(mUL, a, b);
        if (mid) {
          labelRef.current.setLatLng(mid);
          el?.style.setProperty("display", "");
        } else {
          el?.style.setProperty("display", "none");
        }
      };

      const front: [number, number] | null =
        point.frontLat != null && point.frontLng != null
          ? [point.frontLat, point.frontLng]
          : null;
      const center: [number, number] | null =
        point.centerLat != null && point.centerLng != null
          ? [point.centerLat, point.centerLng]
          : null;
      const back: [number, number] | null =
        point.backLat != null && point.backLng != null
          ? [point.backLat, point.backLng]
          : null;

      updateAnchored(userFrontLabelRef, front, userPos);
      updateAnchored(userCenterLabelRef, center, userPos);
      updateAnchored(userBackLabelRef, back, userPos);
      updateMidpoint(userLayupLabelRef, userPos, layupPos);
      updateMidpoint(layupLabelRef, layupPos, center);
    };
    repositionLabelsRef.current = reposition;
    requestAnimationFrame(reposition);
  }, [
    layup,
    userLat,
    userLng,
    point.centerLat,
    point.centerLng,
    point.frontLat,
    point.frontLng,
    point.backLat,
    point.backLng,
    showFrontBackLabels,
  ]);

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

      <div className="flex items-center gap-2 text-[10px]">
        <button
          type="button"
          onClick={() => setShowFrontBackLabels((v) => !v)}
          className="rounded px-2 py-1 gf-mono flex-1"
          style={{
            background: showFrontBackLabels ? "var(--fairway)" : "var(--green-pale)",
            color: showFrontBackLabels ? "white" : "var(--fairway)",
            fontWeight: 600,
          }}
          aria-pressed={showFrontBackLabels}
        >
          {showFrontBackLabels ? "🎯 Frente + Fondo: ON" : "🎯 Solo centro"}
        </button>
        {layup && (
          <button
            type="button"
            onClick={() => setLayup(null)}
            className="rounded px-2 py-1 gf-mono flex-1"
            style={{
              background: "var(--green-pale)",
              color: "var(--fairway)",
              fontWeight: 600,
            }}
          >
            ✕ Quitar layup
          </button>
        )}
      </div>

      <WindCard
        enabled={showWind}
        wind={wind}
        userLat={userLat}
        userLng={userLng}
        greenLat={point.centerLat}
        greenLng={point.centerLng}
        tournamentMode={tournamentMode}
        onToggle={() => setWindEnabled((v) => !v)}
      />

      <button
        type="button"
        onClick={() => setTournamentMode((v) => !v)}
        className="text-[10px] gf-mono w-full text-center py-1 rounded"
        style={{
          background: tournamentMode ? "#dc2626" : "transparent",
          color: tournamentMode ? "white" : "var(--muted)",
          fontWeight: tournamentMode ? 700 : 500,
          textDecoration: tournamentMode ? "none" : "underline",
        }}
        aria-pressed={tournamentMode}
      >
        {tournamentMode
          ? "🏆 MODO TORNEO ACTIVO · click para desactivar"
          : "🏆 Activar modo torneo (deshabilita viento)"}
      </button>

      <p className="text-[10px] text-[var(--muted)] text-center">
        Tap en el mapa para marcar un layup. Anillos: 🟢 100y · 🟡 150y · 🔴 200y desde el centro.
      </p>
    </div>
  );
}
