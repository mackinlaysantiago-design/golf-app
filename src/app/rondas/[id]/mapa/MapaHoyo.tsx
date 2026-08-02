"use client";

// Mapa del hoyo a pantalla completa: satélite, línea al target, anillos de distancia,
// tu posición y los tiros ya registrados. Tocar el mapa mueve el TARGET (a dónde
// apuntás), que es lo que hace que después se pueda medir decisión vs ejecución.
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { attachSatelliteLayer } from "@/lib/map-tiles";
import { yardsBetween } from "@/lib/geo";

export type MapaShot = {
  id: string;
  shotNumber: number;
  fromLat: number | null;
  fromLng: number | null;
  club: string | null;
  lie: string | null;
  shotLengthYds: number | null;
  lateralDeviationYds: number | null;
  gpsAccuracyM: number | null;
};

export type MapaGreen = {
  teeLat: number | null;
  teeLng: number | null;
  centerLat: number | null;
  centerLng: number | null;
  frontLat: number | null;
  frontLng: number | null;
};

const YD_PER_M = 1.09361;
const RINGS_YDS = [50, 100, 150, 200, 250, 300];
// Si el GPS te ubica más lejos que esto del green, no estás jugando el hoyo: estás
// probando la app desde tu casa. Incluir esa posición en el encuadre alejaba el mapa
// a nivel provincia y no se veía nada.
const LEJOS_YDS = 1200;

// Leaflet inyecta el html del divIcon tal cual en el DOM. Los nombres de palo salen
// de ClubDispersion, que se llena importando CSV de FlightScope: no es texto en el
// que confiar a ciegas.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Chapita del tiro, con la forma de H19: círculo azul con el palo pegado a una
// pastilla blanca con las yardas. Va en la punta donde llegó el tiro.
function shotIcon(club: string, yds: string | null) {
  const pastilla = yds
    ? `<div style="background:#fff;color:#111;font-weight:800;font-size:12px;
         padding:3px 8px 3px 14px;margin-left:-10px;border-radius:0 12px 12px 0;
         box-shadow:0 1px 5px rgba(0,0,0,.45)">${esc(yds)}</div>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;transform:translate(-13px,-13px)">
      <div style="min-width:26px;height:26px;padding:0 5px;border-radius:13px;background:#4f46e5;
        color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;
        font-weight:800;font-size:11px;box-shadow:0 1px 5px rgba(0,0,0,.5);position:relative;z-index:2"
        >${esc(club)}</div>${pastilla}
    </div>`,
    iconSize: [0, 0],
  });
}

function labelIcon(text: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#fff;color:#111;border-radius:12px;padding:2px 8px;
      font-weight:700;font-size:12px;white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,.4);
      transform:translate(16px,-10px)">${esc(text)}</div>`,
    iconSize: [0, 0],
  });
}

export default function MapaHoyo({
  green,
  userLat,
  userLng,
  originLat,
  originLng,
  targetLat,
  targetLng,
  shots,
  onMoveTarget,
  onMoveShot,
  onTapShot,
}: {
  green: MapaGreen;
  userLat: number | null;
  userLng: number | null;
  /** De dónde sale el tiro que estás planificando: el TEE en el drive, tu GPS después. */
  originLat: number | null;
  originLng: number | null;
  targetLat: number | null;
  targetLng: number | null;
  shots: MapaShot[];
  onMoveTarget: (lat: number, lng: number) => void;
  onMoveShot: (id: string, lat: number, lng: number) => void;
  onTapShot: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const onMoveTargetRef = useRef(onMoveTarget);
  onMoveTargetRef.current = onMoveTarget;
  const fittedHoleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;
    const cancelled = { current: false };
    void attachSatelliteLayer(map, cancelled);
    map.setView([-35.0129, -63.0088], 17);
    // Tocar el mapa = mover a dónde apuntás. No crea tiros: el tiro se registra
    // con el botón, para que un toque accidental no ensucie la ronda.
    map.on("click", (e: L.LeafletMouseEvent) =>
      onMoveTargetRef.current(e.latlng.lat, e.latlng.lng),
    );
    return () => {
      cancelled.current = true;
      map.remove();
      mapRef.current = null;
      // La ref sobrevive al remount (React 18 monta dos veces en dev); si no se
      // limpia, el mapa nuevo cree que ya encuadró y queda en la vista inicial.
      fittedHoleRef.current = null;
    };
  }, []);

  // Todos los puntos que tienen que entrar en pantalla para este hoyo.
  const puntosDelHoyo = useMemo(() => {
    const pts: L.LatLngTuple[] = [];
    const push = (la: number | null, ln: number | null) => {
      if (la != null && ln != null) pts.push([la, ln]);
    };
    push(green.teeLat, green.teeLng);
    push(green.frontLat, green.frontLng);
    push(green.centerLat, green.centerLng);
    push(originLat, originLng);
    push(targetLat, targetLng);
    for (const s of shots) push(s.fromLat, s.fromLng);
    return pts;
  }, [green, originLat, originLng, targetLat, targetLng, shots]);

  // Encuadre: tee/vos → green. Se rehace cuando cambia el hoyo, no en cada tick de GPS.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const key = `${green.centerLat},${green.centerLng}`;
    if (fittedHoleRef.current === key) return;
    if (puntosDelHoyo.length >= 2) {
      map.fitBounds(L.latLngBounds(puntosDelHoyo), {
        padding: [60, 90],
        maxZoom: 19,
        animate: false,
      });
      fittedHoleRef.current = key;
    } else if (puntosDelHoyo.length === 1) {
      map.setView(puntosDelHoyo[0], 17, { animate: false });
    }
  }, [green, puntosDelHoyo]);

  // El mapa queda ANCLADO al hoyo: se hace zoom y se toca, pero no te podés ir
  // caminando hasta el hoyo de al lado (pedido de Santi — "me voy siempre para algún
  // lado raro"). El margen es generoso para que entre un tiro bien errado y para que
  // se pueda arrastrar un nodo afuera de la calle.
  //
  // El límite se calcula SOLO con los puntos firmes del hoyo (tee, green y los tiros
  // ya guardados). Si entraran el target o el GPS vivo, moverías el objetivo y el
  // mapa se re-encerraría abajo del dedo en cada arrastre.
  const puntosFirmes = useMemo(() => {
    const pts: L.LatLngTuple[] = [];
    const push = (la: number | null, ln: number | null) => {
      if (la != null && ln != null) pts.push([la, ln]);
    };
    push(green.teeLat, green.teeLng);
    push(green.frontLat, green.frontLng);
    push(green.centerLat, green.centerLng);
    for (const s of shots) push(s.fromLat, s.fromLng);
    return pts;
  }, [green, shots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Con menos de dos puntos distintos el bounds es degenerado: getBoundsZoom
    // devuelve Infinity y setMinZoom(Infinity) deja el mapa muerto. Mejor sin límite.
    const distintos = new Set(puntosFirmes.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`));
    if (distintos.size < 2) {
      map.setMaxBounds(null as unknown as L.LatLngBounds); // null = sin límite (API de Leaflet)
      map.setMinZoom(1);
      return;
    }
    const limite = L.latLngBounds(puntosFirmes).pad(0.6);
    map.setMaxBounds(limite);
    map.options.maxBoundsViscosity = 1.0; // tope duro, no elástico
    // Tampoco se puede alejar más allá del hoyo: si no, "no moverse" no sirve de nada.
    const zoomMin = map.getBoundsZoom(limite);
    map.setMinZoom(Number.isFinite(zoomMin) ? Math.max(1, Math.min(zoomMin, 18)) : 1);
  }, [puntosFirmes]);

  // Todo lo dibujable se rehace junto: son pocas capas y así no quedan restos.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = []; // sin esto el array crece en cada render aunque las capas ya no estén
    const add = <T extends L.Layer>(l: T): T => {
      l.addTo(map);
      layersRef.current.push(l);
      return l;
    };

    const origin: L.LatLngTuple | null =
      originLat != null && originLng != null ? [originLat, originLng] : null;

    // Anillos de distancia desde donde estás — la referencia visual de Hole19.
    if (origin) {
      for (const yds of RINGS_YDS) {
        const meters = yds / YD_PER_M;
        add(
          L.circle(origin, {
            radius: meters,
            color: "#ffffff",
            weight: 1,
            opacity: 0.35,
            fill: false,
            interactive: false,
          }),
        );
      }
    }

    // Línea al target + chapita con la distancia.
    if (origin && targetLat != null && targetLng != null) {
      add(
        L.polyline([origin, [targetLat, targetLng]], {
          color: "#ffffff",
          weight: 2,
          opacity: 0.9,
          interactive: false,
        }),
      );
      add(
        L.circleMarker([targetLat, targetLng], {
          radius: 9,
          color: "#fff",
          weight: 3,
          fillColor: "#4f46e5",
          fillOpacity: 0.9,
        }),
      );
      const d = Math.round(yardsBetween(origin[0], origin[1], targetLat, targetLng));
      add(L.marker([targetLat, targetLng], { icon: labelIcon(`${d} yd`), interactive: false }));
    }

    if (green.centerLat != null && green.centerLng != null) {
      add(
        L.circleMarker([green.centerLat, green.centerLng], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#22c55e",
          fillOpacity: 1,
          interactive: false,
        }),
      );
    }

    // Recorrido de tiros ya registrados: línea AZUL (lo jugado), contra la línea
    // BLANCA de arriba que es el tiro que estás planificando. Mismo criterio que H19.
    const placed = shots.filter((s) => s.fromLat != null && s.fromLng != null);
    if (placed.length > 0) {
      const path: L.LatLngTuple[] = placed.map((s) => [s.fromLat!, s.fromLng!]);
      if (origin) path.push(origin);
      add(L.polyline(path, { color: "#4f46e5", weight: 3, opacity: 0.85, interactive: false }));
    }

    // Punto de salida del hoyo. Arrastrable: si el GPS lo tomó mal al pegar el
    // primer tiro, es el único lugar donde se puede corregir esa posición.
    if (placed.length > 0) {
      const tee = add(
        L.marker([placed[0].fromLat!, placed[0].fromLng!], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:12px;height:12px;border-radius:50%;background:#4f46e5;
              border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);
              transform:translate(-6px,-6px)"></div>`,
            iconSize: [0, 0],
          }),
          draggable: true,
        }),
      );
      tee.on("dragend", () => {
        const ll = tee.getLatLng();
        onMoveShot(placed[0].id, ll.lat, ll.lng);
      });
    }

    // La chapita va en la PUNTA donde llegó el tiro, con el palo y las yardas de ESE
    // tiro — no en el origen. Como la llegada del tiro N es la salida del N+1, el
    // nodo es el mismo punto: tocarlo edita el tiro que llegó ahí, arrastrarlo corrige
    // la posición de la pelota (o sea, la salida del siguiente).
    for (let i = 0; i < placed.length; i++) {
      const s = placed[i];
      const siguiente = placed[i + 1];
      // Sin tiro siguiente, la punta es tu posición actual. Si tampoco hay `origin`
      // no se sabe dónde cayó, y dibujar la chapita en la salida del propio tiro la
      // encimaría al nodo anterior (o al tee) tapándolo. Se omite: en la práctica
      // solo pasa en canchas sin coordenadas cargadas, donde el mapa no sirve igual.
      const llegada: L.LatLngTuple | null = siguiente
        ? [siguiente.fromLat!, siguiente.fromLng!]
        : origin;
      if (!llegada) continue;

      const m = add(
        L.marker(llegada, {
          icon: shotIcon(
            s.club?.split(" ")[0] ?? String(s.shotNumber),
            s.shotLengthYds != null ? String(s.shotLengthYds) : null,
          ),
          // Solo se arrastra si hay un tiro siguiente cuya posición corregir; la
          // punta del último tiro es tu posición GPS actual y no se mueve a mano.
          draggable: !!siguiente,
        }),
      );
      // Leaflet dispara `click` junto con `dragend` al soltar un marker. Sin esta
      // guarda, corregir la posición de un tiro te abría la hoja de edición encima.
      let arrastrando = false;
      m.on("dragstart", () => {
        arrastrando = true;
      });
      m.on("dragend", () => {
        const ll = m.getLatLng();
        if (siguiente) onMoveShot(siguiente.id, ll.lat, ll.lng);
        setTimeout(() => {
          arrastrando = false;
        }, 200);
      });
      m.on("click", () => {
        if (!arrastrando) onTapShot(s.id);
      });
    }

    // Punto azul = dónde estás vos según el GPS. Es distinto del origen del tiro:
    // en el drive el tiro sale del TEE aunque estés parado en otro lado.
    const enLaCancha =
      userLat != null &&
      userLng != null &&
      green.centerLat != null &&
      green.centerLng != null &&
      yardsBetween(userLat, userLng, green.centerLat, green.centerLng) < LEJOS_YDS;
    if (enLaCancha) {
      add(
        L.circleMarker([userLat!, userLng!], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#3a86ff",
          fillOpacity: 1,
          interactive: false,
        }),
      );
    }

    return () => {
      layersRef.current.forEach((l) => map.removeLayer(l));
      layersRef.current = [];
    };
  }, [green, userLat, userLng, originLat, originLng, targetLat, targetLng, shots, onMoveShot, onTapShot]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
