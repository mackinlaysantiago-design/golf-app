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
  const userLayupLabelRef = useRef<L.Marker | null>(null);
  const userFrontLabelRef = useRef<L.Marker | null>(null);
  const userCenterLabelRef = useRef<L.Marker | null>(null);
  const userBackLabelRef = useRef<L.Marker | null>(null);
  // Función reactiva para recolocar labels cuando se mueve/zoomea el mapa.
  // Cambia entre renders → la guardo en ref para que el listener siempre llame al último.
  const repositionLabelsRef = useRef<(() => void) | null>(null);

  const [layup, setLayup] = useState<{ lat: number; lng: number } | null>(null);
  // Toggle: mostrar también frente y fondo (centro siempre se muestra). Default OFF.
  const [showFrontBackLabels, setShowFrontBackLabels] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("gf-show-front-back-labels") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gf-show-front-back-labels", showFrontBackLabels ? "1" : "0");
    }
  }, [showFrontBackLabels]);
  // Track el hoyo del que ya hicimos auto-fit, para no re-fitear en cada GPS update.
  const fittedHoleRef = useRef<number | null>(null);

  // Modo torneo: deshabilita features que violan Rule 4.3a (viento, etc).
  const [tournamentMode, setTournamentMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("gf-tournament-mode") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gf-tournament-mode", tournamentMode ? "1" : "0");
    }
  }, [tournamentMode]);

  // Viento — opt-in (default OFF). Si modo torneo ON, se fuerza OFF.
  const [windEnabled, setWindEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("gf-wind-enabled") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gf-wind-enabled", windEnabled ? "1" : "0");
    }
  }, [windEnabled]);
  const showWind = windEnabled && !tournamentMode;

  const [wind, setWind] = useState<{ speed: number; direction: number } | null>(null);
  useEffect(() => {
    if (!showWind) {
      setWind(null);
      return;
    }
    if (point.centerLat == null || point.centerLng == null) return;
    let cancelled = false;
    const fetchWind = async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${point.centerLat}&longitude=${point.centerLng}&current_weather=true&windspeed_unit=kmh`,
        );
        if (!r.ok) return;
        const d = (await r.json()) as {
          current_weather?: { windspeed: number; winddirection: number };
        };
        if (cancelled || !d.current_weather) return;
        setWind({
          speed: d.current_weather.windspeed,
          direction: d.current_weather.winddirection,
        });
      } catch {
        // noop
      }
    };
    fetchWind();
    const id = setInterval(fetchWind, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [showWind, point.centerLat, point.centerLng]);

  // Init map una sola vez
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    });
    mapRef.current = map;

    // Tiles: prioridad Google Tile API > Mapbox > ESRI fallback.
    // Google Tile API requiere session token (POST createSession primero).
    let cancelled = false;
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const addMapboxLayer = () => {
      L.tileLayer(
        `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${mapboxToken}`,
        { maxZoom: 22, maxNativeZoom: 19, attribution: "© Mapbox © Maxar" },
      ).addTo(map);
    };

    const addEsriLayer = () => {
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, maxNativeZoom: 18, attribution: "Esri, Maxar, Earthstar Geographics" },
      ).addTo(map);
    };

    const addGoogleLayer = async (): Promise<boolean> => {
      if (!googleKey) return false;
      try {
        const res = await fetch(
          `https://tile.googleapis.com/v1/createSession?key=${googleKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mapType: "satellite",
              language: "es-AR",
              region: "AR",
              highDpi: true,
            }),
          },
        );
        if (!res.ok) return false;
        const data = (await res.json()) as { session: string };
        if (cancelled || !data.session) return false;
        L.tileLayer(
          `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${data.session}&key=${googleKey}`,
          { maxZoom: 22, maxNativeZoom: 22, attribution: "© Google" },
        ).addTo(map);
        return true;
      } catch {
        return false;
      }
    };

    (async () => {
      const ok = await addGoogleLayer();
      if (cancelled) return;
      if (!ok) {
        if (mapboxToken) addMapboxLayer();
        else addEsriLayer();
      }
    })();

    // Click en el mapa coloca/mueve el layup
    map.on("click", (e: L.LeafletMouseEvent) => {
      setLayup({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    // Recolocar labels en cada move/zoom para que siempre queden a la vista
    const onMoveZoom = () => repositionLabelsRef.current?.();
    map.on("move zoom moveend zoomend", onMoveZoom);

    return () => {
      cancelled = true;
      map.off("move zoom moveend zoomend", onMoveZoom);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Liang-Barsky: clippea un segmento [p1,p2] dentro de un rect [min,max].
  // Devuelve los 2 puntos del segmento clippeado (en pixels), o null si el segmento
  // no intersecta el viewport.
  function clipSegment(
    p1: L.Point,
    p2: L.Point,
    min: L.Point,
    max: L.Point,
  ): [L.Point, L.Point] | null {
    let t0 = 0;
    let t1 = 1;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const tests: [number, number][] = [
      [-dx, p1.x - min.x],
      [dx, max.x - p1.x],
      [-dy, p1.y - min.y],
      [dy, max.y - p1.y],
    ];
    for (const [p, q] of tests) {
      if (p === 0) {
        if (q < 0) return null;
      } else {
        const t = q / p;
        if (p < 0) {
          if (t > t1) return null;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return null;
          if (t < t1) t1 = t;
        }
      }
    }
    return [
      L.point(p1.x + t0 * dx, p1.y + t0 * dy),
      L.point(p1.x + t1 * dx, p1.y + t1 * dy),
    ];
  }

  // Devuelve la latlng del midpoint visible del segmento [a,b] dentro del viewport
  // (con padding para que no quede pegado al borde). Null si el segmento no cruza la pantalla.
  function visibleMidLatLng(
    map: L.Map,
    a: L.LatLngExpression,
    b: L.LatLngExpression,
    padding = 28,
  ): L.LatLng | null {
    const p1 = map.latLngToContainerPoint(a);
    const p2 = map.latLngToContainerPoint(b);
    const size = map.getSize();
    const min = L.point(padding, padding);
    const max = L.point(size.x - padding, size.y - padding);
    const clipped = clipSegment(p1, p2, min, max);
    if (!clipped) return null;
    const mid = L.point(
      (clipped[0].x + clipped[1].x) / 2,
      (clipped[0].y + clipped[1].y) / 2,
    );
    return map.containerPointToLatLng(mid);
  }

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

    // Centrado inicial: si todavía no se hizo auto-fit para este hoyo, centrar en el green.
    // El auto-fit con user GPS se hace en el effect dedicado más abajo.
    if (fittedHoleRef.current !== point.holeNumber) {
      if (cLat != null && cLng != null) {
        map.setView([cLat, cLng], 18);
      } else if (point.frontLat && point.frontLng) {
        map.setView([point.frontLat, point.frontLng], 18);
      }
    }
  }, [point]);

  // Auto-fit: una sola vez por hoyo, espera a tener GPS antes de fitear.
  // Si cambiás de hoyo sin GPS, el fit se posterga hasta que llegue. Una vez fiteado
  // para un hoyo, GPS jitter no re-mueve el mapa (libre de panear/zoomear).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (fittedHoleRef.current === point.holeNumber) return;
    if (userLat == null || userLng == null) return;
    const pts: L.LatLngTuple[] = [[userLat, userLng]];
    if (point.frontLat != null && point.frontLng != null)
      pts.push([point.frontLat, point.frontLng]);
    if (point.centerLat != null && point.centerLng != null)
      pts.push([point.centerLat, point.centerLng]);
    if (point.backLat != null && point.backLng != null)
      pts.push([point.backLat, point.backLng]);
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), {
        padding: [60, 60],
        maxZoom: 19,
        animate: true,
      });
      fittedHoleRef.current = point.holeNumber;
    }
  }, [point, userLat, userLng]);

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

  // Layup marker + línea + labels de distancia (clamped al viewport visible)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Helpers de cleanup
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

    // anchorOffsetX/Y: shift en pixels desde el centro del icon.
    // X: positivo = label se mueve a la derecha del lat/lng. Negativo = izquierda.
    // Y: positivo = label se mueve arriba. Negativo = abajo.
    const makeLabelIcon = (
      yds: number,
      bg: string,
      anchorOffsetX = 0,
      anchorOffsetY = 0,
    ) =>
      L.divIcon({
        className: "",
        html: `<div style="background:${bg};color:white;padding:3px 7px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);">${yds.toFixed(0)}y</div>`,
        iconSize: [40, 22],
        iconAnchor: [20 - anchorOffsetX, 11 + anchorOffsetY],
      });

    const userPos: [number, number] | null =
      userLat != null && userLng != null ? [userLat, userLng] : null;

    // Labels vos → frente / centro / fondo del green (semáforo).
    // Anclados al marker correspondiente con stagger vertical: frente arriba, centro al medio, fondo abajo.
    // (anchorOffsetY > 0 → label aparece arriba del lat/lng; < 0 → abajo)
    // Centro: siempre visible (cuando hay GPS). Frente y Fondo: solo si el toggle está ON.
    if (userPos) {
      // Labels al costado derecho del green con stagger vertical (frente arriba, centro al medio, fondo abajo)
      // X positivo = label a la derecha; Y positivo = arriba; Y negativo = abajo.
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

    // Layup marker + línea + sus labels
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

    // Reposicionar labels:
    // - Para los del GREEN (frente/centro/fondo): si el marker está visible, dejar el label
    //   anclado al marker (la posición no cambia). Si el marker está fuera de pantalla,
    //   recolocar al midpoint visible de la línea user→marker para que igual se vea la distancia.
    // - Para los del LAYUP: midpoint visible del segmento (siempre).
    const reposition = () => {
      const mUL = mapRef.current;
      if (!mUL) return;
      const size = mUL.getSize();

      const isInViewport = (latlng: [number, number]) => {
        const p = mUL.latLngToContainerPoint(latlng);
        return p.x >= 0 && p.x <= size.x && p.y >= 0 && p.y <= size.y;
      };

      // Para labels anclados al marker: si el marker es visible, dejarlo en el marker;
      // si no, reposicionar al midpoint clippeado del segmento user→marker.
      const updateAnchored = (
        labelRef: { current: L.Marker | null },
        markerPos: [number, number] | null,
        userPosArg: [number, number] | null,
      ) => {
        if (!labelRef.current) return;
        if (!markerPos) {
          labelRef.current.getElement()?.style.setProperty("display", "none");
          return;
        }
        if (isInViewport(markerPos)) {
          labelRef.current.setLatLng(markerPos);
          labelRef.current.getElement()?.style.setProperty("display", "");
          return;
        }
        if (!userPosArg) {
          labelRef.current.getElement()?.style.setProperty("display", "none");
          return;
        }
        const mid = visibleMidLatLng(mUL, userPosArg, markerPos);
        if (mid) {
          labelRef.current.setLatLng(mid);
          labelRef.current.getElement()?.style.setProperty("display", "");
        } else {
          labelRef.current.getElement()?.style.setProperty("display", "none");
        }
      };

      // Para labels del layup: siempre midpoint visible del segmento.
      const updateMidpoint = (
        labelRef: { current: L.Marker | null },
        a: [number, number] | null,
        b: [number, number] | null,
      ) => {
        if (!labelRef.current) return;
        if (!a || !b) {
          labelRef.current.getElement()?.style.setProperty("display", "none");
          return;
        }
        const mid = visibleMidLatLng(mUL, a, b);
        if (mid) {
          labelRef.current.setLatLng(mid);
          labelRef.current.getElement()?.style.setProperty("display", "");
        } else {
          labelRef.current.getElement()?.style.setProperty("display", "none");
        }
      };

      const front: [number, number] | null =
        point.frontLat != null && point.frontLng != null ? [point.frontLat, point.frontLng] : null;
      const center: [number, number] | null =
        point.centerLat != null && point.centerLng != null
          ? [point.centerLat, point.centerLng]
          : null;
      const back: [number, number] | null =
        point.backLat != null && point.backLng != null ? [point.backLat, point.backLng] : null;

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

// Cardinales: dado un ángulo en grados (0-360) devuelve N/NE/E/SE/S/SW/W/NW.
function cardinalFromDeg(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

// Bearing: rumbo (en grados desde norte) entre 2 lat/lng.
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const x = Math.sin(dLambda) * Math.cos(phi2);
  const y =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function WindCard({
  enabled,
  wind,
  userLat,
  userLng,
  greenLat,
  greenLng,
  tournamentMode,
  onToggle,
}: {
  enabled: boolean;
  wind: { speed: number; direction: number } | null;
  userLat: number | null;
  userLng: number | null;
  greenLat: number | null;
  greenLng: number | null;
  tournamentMode: boolean;
  onToggle: () => void;
}) {
  if (tournamentMode) {
    return (
      <div className="text-[10px] gf-mono text-[var(--muted)] text-center py-1">
        🌬️ Viento bloqueado en modo torneo
      </div>
    );
  }
  if (!enabled) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="text-[10px] gf-mono text-[var(--muted)] underline w-full text-center py-1"
      >
        🌬️ Activar viento (no usar en torneo)
      </button>
    );
  }
  if (!wind) {
    return (
      <div className="flex items-center justify-between gap-2 text-[10px] gf-mono p-2 rounded" style={{ background: "var(--green-pale)" }}>
        <span className="text-[var(--muted)]">🌬️ Cargando viento...</span>
        <button onClick={onToggle} className="underline text-[var(--muted)]">
          desactivar
        </button>
      </div>
    );
  }

  // Cardinal del viento (de dónde viene)
  const fromCardinal = cardinalFromDeg(wind.direction);

  // Componentes head/tail/cross si tenemos shot direction
  let bearing: number | null = null;
  if (
    userLat != null &&
    userLng != null &&
    greenLat != null &&
    greenLng != null
  ) {
    bearing = bearingDeg(userLat, userLng, greenLat, greenLng);
  }
  // Wind blows TO direction = (from + 180) % 360
  // angle entre dirección del viento y rumbo del tiro
  let head: number | null = null;
  let cross: number | null = null;
  let crossSide: "izq" | "der" | null = null;
  if (bearing != null) {
    const windTo = (wind.direction + 180) % 360;
    const diffDeg = ((windTo - bearing + 540) % 360) - 180; // -180..180
    const rad = (diffDeg * Math.PI) / 180;
    const tailComp = wind.speed * Math.cos(rad); // + tail, - head
    const crossComp = wind.speed * Math.sin(rad); // + de izq, - de der
    head = -tailComp; // positivo = head, negativo = tail
    cross = Math.abs(crossComp);
    crossSide = crossComp >= 0 ? "izq" : "der";
  }

  return (
    <div
      className="text-[11px] gf-mono p-2 rounded flex items-center gap-3"
      style={{ background: "var(--green-pale)" }}
    >
      {/* Flecha apuntando en la dirección a la que sopla */}
      <div
        className="flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--fairway)",
          color: "white",
          flexShrink: 0,
        }}
        title={`Viene del ${fromCardinal}`}
      >
        <span
          style={{
            display: "inline-block",
            transform: `rotate(${(wind.direction + 180) % 360}deg)`,
            fontSize: 18,
            lineHeight: 1,
          }}
          aria-label={`viento ${fromCardinal}`}
        >
          ↑
        </span>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-baseline">
          <span className="font-bold">
            {wind.speed.toFixed(0)} km/h del {fromCardinal}
          </span>
          <button
            onClick={onToggle}
            className="text-[9px] underline text-[var(--muted)]"
          >
            apagar
          </button>
        </div>
        {head != null && cross != null && crossSide != null ? (
          <div className="text-[10px] text-[var(--muted)] mt-0.5">
            {Math.abs(head) < 1
              ? "sin viento longitudinal"
              : head > 0
                ? `${head.toFixed(0)} km/h en contra`
                : `${(-head).toFixed(0)} km/h a favor`}
            {cross >= 1 && (
              <>
                {" · "}
                {cross.toFixed(0)} km/h cruzado de {crossSide === "izq" ? "izquierda" : "derecha"}
              </>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-[var(--muted)] mt-0.5">
            sin GPS — solo dirección general
          </div>
        )}
      </div>
    </div>
  );
}
