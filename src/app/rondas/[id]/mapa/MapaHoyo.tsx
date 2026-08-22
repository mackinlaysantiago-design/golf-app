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
  targetLat: number | null;
  targetLng: number | null;
  club: string | null;
  lie: string | null;
  penaltyType: string | null;
  shotLengthYds: number | null;
  distanceToTargetYds: number | null;
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

// Área de agarre para un marcador que se arrastra. El visual queda chico (22 px) y con
// el dedo eso no se puede tomar: la guía de Apple pide 44. Se envuelve en una caja
// transparente de 48 centrada en el punto, así el ícono se ve igual pero el dedo tiene
// dónde agarrarlo.
const AGARRE = 48;
function conAgarre(visual: string, anclaje: "centro" | "pie" = "centro") {
  // "pie": la bandera se dibuja con el mástil apoyado abajo, así que el punto exacto
  // del pin es la BASE del ícono, no su centro. Centrarla desplazaría el pin ~13 px,
  // y de ese punto salen todas las distancias del hoyo.
  const dy = anclaje === "pie" ? AGARRE : AGARRE / 2;
  const align = anclaje === "pie" ? "flex-end" : "center";
  return `<div style="width:${AGARRE}px;height:${AGARRE}px;transform:translate(-${AGARRE / 2}px,-${dy}px);
    display:flex;align-items:${align};justify-content:center"><div class="gf-visual">${visual}</div></div>`;
}

/** Marca el marcador mientras lo arrastrás, para que se note que lo agarraste. */
function avisarAgarre(m: L.Marker) {
  m.on("dragstart", () => m.getElement()?.classList.add("gf-agarrando"));
  m.on("dragend", () => m.getElement()?.classList.remove("gf-agarrando"));
}

// Chapita del tiro, con la forma de H19: círculo azul con el palo pegado a una
// pastilla blanca con las yardas. Va en la punta donde llegó el tiro.
// Padding invisible alrededor de la chapita: el badge visual mide 26px, pero el área
// que se puede TOCAR para mantener apretado y arrastrar mide ~48px (mínimo recomendado
// ~44px). El translate compensa el padding para que el badge quede anclado al mismo
// punto del mapa que antes.
const SHOT_TOUCH_PAD = 11;

function shotIcon(club: string, yds: string | null) {
  const pastilla = yds
    ? `<div style="background:#fff;color:#111;font-weight:800;font-size:12px;
         padding:3px 8px 3px 14px;margin-left:-10px;border-radius:0 12px 12px 0;
         box-shadow:0 1px 5px rgba(0,0,0,.45)">${esc(yds)}</div>`
    : "";
  const offset = SHOT_TOUCH_PAD + 13;
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;padding:${SHOT_TOUCH_PAD}px;transform:translate(-${offset}px,-${offset}px)">
      <div class="gf-shot-badge" style="min-width:26px;height:26px;padding:0 5px;border-radius:13px;background:#4f46e5;
        color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;
        font-weight:800;font-size:11px;box-shadow:0 1px 5px rgba(0,0,0,.5);position:relative;z-index:2;
        transition:transform .15s, box-shadow .15s"
        >${esc(club)}</div>${pastilla}
    </div>`,
    iconSize: [0, 0],
  });
}

// Mantener apretado ~450ms antes de que el marker se pueda arrastrar: así un toque
// normal (para editar el tiro) o el gesto de mover el mapa no se confunden con
// "quiero corregir la posición". Reemplaza el drag nativo de Leaflet, que arranca
// apenas tocás y competía con el paneo del mapa.
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE_PX = 8;

function attachLongPressDrag(
  map: L.Map,
  marker: L.Marker,
  onMoved: (lat: number, lng: number) => void,
) {
  const el = marker.getElement();
  if (!el) return;
  const badge = el.querySelector<HTMLElement>(".gf-shot-badge");
  let timer: ReturnType<typeof setTimeout> | null = null;
  let armed = false;
  let start: { x: number; y: number } | null = null;

  const setArmed = (v: boolean) => {
    armed = v;
    if (badge) {
      badge.style.transform = v ? "scale(1.3)" : "scale(1)";
      badge.style.boxShadow = v
        ? "0 0 0 4px rgba(79,70,229,.4), 0 1px 5px rgba(0,0,0,.5)"
        : "0 1px 5px rgba(0,0,0,.5)";
    }
  };
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const onDown = (ev: PointerEvent) => {
    start = { x: ev.clientX, y: ev.clientY };
    clearTimer();
    timer = setTimeout(() => {
      setArmed(true);
      try {
        el.setPointerCapture?.(ev.pointerId);
      } catch {
        // Algunos navegadores tiran InvalidPointerId si el puntero ya cambió de
        // estado justo al cumplirse el timeout — no es crítico, seguimos igual.
      }
    }, LONG_PRESS_MS);
  };
  const onMove = (ev: PointerEvent) => {
    if (!start) return;
    if (!armed) {
      const d = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      if (d > LONG_PRESS_MOVE_TOLERANCE_PX) {
        // Se movió antes de que se arme el drag: es un gesto de paneo, no de corregir.
        clearTimer();
        start = null;
      }
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    const ll = map.mouseEventToLatLng(ev as unknown as MouseEvent);
    marker.setLatLng(ll);
  };
  const onUp = () => {
    clearTimer();
    if (armed) {
      const ll = marker.getLatLng();
      onMoved(ll.lat, ll.lng);
    }
    setArmed(false);
    start = null;
  };
  el.style.touchAction = "none";
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
}

export default function MapaHoyo({
  green,
  userLat,
  userLng,
  originLat,
  originLng,
  targetLat,
  targetLng,
  esTee,
  showBallMarker = true,
  caminadoDesdeLat,
  caminadoDesdeLng,
  shots,
  onMoveOrigin,
  onMovePin,
  onMoveShot,
  onTapShot,
  clubBounds,
}: {
  green: MapaGreen;
  userLat: number | null;
  userLng: number | null;
  /** De dónde sale el tiro que estás planificando: el TEE en el drive, tu GPS después. */
  originLat: number | null;
  originLng: number | null;
  targetLat: number | null;
  targetLng: number | null;
  /** El tiro de salida: el marcador del origen es el TEE, no la pelota. */
  esTee: boolean;
  /** Ocultar el marcador de la pelota (se usa cuando origin === GPS en vivo y el
   *  punto azul del GPS ya lo representa, para evitar dos círculos superpuestos). */
  showBallMarker?: boolean;
  /** Desde dónde venís caminando (el último tiro): se dibuja el rastro punteado.
   *  Van como primitivos: un objeto nuevo por render redibujaría todo el mapa. */
  caminadoDesdeLat: number | null;
  caminadoDesdeLng: number | null;
  shots: MapaShot[];
  /** Mover la PELOTA: de dónde sale el próximo tiro. */
  onMoveOrigin: (lat: number, lng: number) => void;
  /** Mover la BANDERA: la posición real del pin ese día. */
  onMovePin: (lat: number, lng: number) => void;
  onMoveShot: (id: string, lat: number, lng: number) => void;
  onTapShot: (id: string) => void;
  /** Puntos (tee/green) de TODOS los hoyos de la ronda — arma el límite de paneo:
   *  te podés mover libre por toda la cancha, no solo por el hoyo actual. */
  clubBounds: { lat: number; lng: number }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const onMoveOriginRef = useRef(onMoveOrigin);
  onMoveOriginRef.current = onMoveOrigin;
  const fittedHoleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      // Pedido de Santi (22/08): se puede mover libre con el dedo (por si un tiro
      // cayó en otro fairway) — el límite es el cuadrado de todo el club, más abajo.
      dragging: true,
      // El encuadre entra el hoyo entero, así que no hace falta pan para ver nada.
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
    });
    mapRef.current = map;
    const cancelled = { current: false };
    void attachSatelliteLayer(map, cancelled);
    map.setView([-35.0129, -63.0088], 17);
    // Mantener apretado el mapa (vacío, sin tocar un marker) = marcar ahí dónde
    // está/cayó la pelota (pedido de Santi 22/08: sirve para corregir un GPS
    // impreciso en cancha Y para cargar tiros de memoria estando lejos de la cancha).
    // Con un toque SIMPLE no alcanza — un toque sin querer (pasó el 22/08, movió la
    // salida de un hoyo ya jugado) no puede mover nada. No crea tiros: el tiro se
    // registra con el botón.
    const container = containerRef.current;
    let removeLongPress: (() => void) | undefined;
    if (container) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let aplicarTimer: ReturnType<typeof setTimeout> | null = null;
      let start: { x: number; y: number; lat: number; lng: number } | null = null;
      let armado = false;
      const clear = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        start = null;
        armado = false;
      };
      const onDown = (ev: PointerEvent) => {
        // Solo el mapa vacío: si el toque empezó sobre un marker o cualquier otro
        // elemento interactivo de Leaflet, ese elemento ya tiene su propio gesto —
        // no pisarlo acá.
        if ((ev.target as HTMLElement)?.closest(".leaflet-marker-icon, .leaflet-interactive")) return;
        const ll0 = map.mouseEventToLatLng(ev);
        start = { x: ev.clientX, y: ev.clientY, lat: ll0.lat, lng: ll0.lng };
        armado = false;
        // Solo ARMA acá: aplicar el cambio con el dedo todavía apretando hace que el
        // mapa se redibuje a mitad del gesto (todos los markers dependen de la
        // posición) y Leaflet se cuelga tocando DOM que ya no está. Se aplica recién
        // al soltar, como con la chapita de corregir un tiro.
        timer = setTimeout(() => {
          armado = true;
          navigator.vibrate?.(40); // avisa que ya se puede soltar
        }, LONG_PRESS_MS);
      };
      const onMove = (ev: PointerEvent) => {
        if (!start || armado) return;
        const d = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
        if (d > LONG_PRESS_MOVE_TOLERANCE_PX) clear();
      };
      const onUp = () => {
        if (armado && start) {
          const { lat, lng } = start;
          // Un tick después: si el estado cambia (y redibuja todos los markers) en
          // el mismo evento en que Leaflet está terminando de procesar SU propio
          // pointerup sobre el contenedor, Leaflet se cuelga leyendo DOM que el
          // redibujo ya sacó (_leaflet_pos undefined).
          aplicarTimer = setTimeout(() => onMoveOriginRef.current(lat, lng), 60);
        }
        clear();
      };
      container.addEventListener("pointerdown", onDown);
      container.addEventListener("pointermove", onMove);
      container.addEventListener("pointerup", onUp);
      container.addEventListener("pointercancel", clear);
      removeLongPress = () => {
        clear();
        if (aplicarTimer) clearTimeout(aplicarTimer);
        container.removeEventListener("pointerdown", onDown);
        container.removeEventListener("pointermove", onMove);
        container.removeEventListener("pointerup", onUp);
        container.removeEventListener("pointercancel", clear);
      };
    }
    return () => {
      removeLongPress?.();
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

  // El mapa se puede mover libre con el dedo (pedido de Santi 22/08 — un tiro puede
  // caer en el fairway de al lado y tenés que poder marcarlo ahí), pero no "para
  // cualquier lado": el límite es el cuadrado que arma el tee/green de TODOS los
  // hoyos de la ronda, el club entero.
  const puntosClub: L.LatLngTuple[] = useMemo(
    () => clubBounds.map((p): L.LatLngTuple => [p.lat, p.lng]),
    [clubBounds],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Con menos de dos puntos distintos el bounds es degenerado: getBoundsZoom
    // devuelve Infinity y setMinZoom(Infinity) deja el mapa muerto. Mejor sin límite.
    const distintos = new Set(puntosClub.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`));
    if (distintos.size < 2) {
      map.setMaxBounds(null as unknown as L.LatLngBounds); // null = sin límite (API de Leaflet)
      map.setMinZoom(1);
      return;
    }
    const limite = L.latLngBounds(puntosClub).pad(0.15);
    map.setMaxBounds(limite);
    map.options.maxBoundsViscosity = 1.0; // tope duro, no elástico
    // Tampoco se puede alejar más allá del club: si no, "no moverse" no sirve de nada.
    const zoomMin = map.getBoundsZoom(limite);
    map.setMinZoom(Number.isFinite(zoomMin) ? Math.max(1, Math.min(zoomMin, 18)) : 1);
  }, [puntosClub]);

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

    // Pedido de Santi (22/08): nada de línea "hacia adelante" (pelota→green) ni
    // círculo de objetivo arrastrable — solo el punto de dónde estás parado y, atrás
    // tuyo, el camino ya jugado (más abajo). El target sigue existiendo en el estado
    // (para el cálculo de palo sugerido en el background), simplemente no se dibuja.

    // La bandera se arrastra: el pin cambia todas las semanas y de él dependen TODAS
    // las distancias del hoyo. El centro del green del mapa de la cancha es fijo.
    if (green.centerLat != null && green.centerLng != null) {
      const bandera = add(
        L.marker([green.centerLat, green.centerLng], {
          icon: L.divIcon({
            className: "gf-arrastrable",
            html: conAgarre(
              `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.8))">⛳</div>`,
              "pie",
            ),
            iconSize: [0, 0],
          }),
          draggable: true,
          zIndexOffset: 300,
        }),
      );
      avisarAgarre(bandera);
      bandera.on("dragend", () => {
        const ll = bandera.getLatLng();
        onMovePin(ll.lat, ll.lng);
      });
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
            className: "gf-arrastrable",
            html: conAgarre(
              `<div style="width:14px;height:14px;border-radius:50%;background:#4f46e5;
                border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
            ),
            iconSize: [0, 0],
          }),
          draggable: true,
        }),
      );
      avisarAgarre(tee);
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
      // Sin tiro siguiente el tiro está abierto: no dibujamos la chapita porque su
      // posición sería `origin` (el GPS en vivo), que se mueve con cada pulso de GPS
      // y parecería que el tiro registrado se mueve. El ball marker blanco ya está en
      // `origin` y cumple esa función. La chapita aparece recién cuando se registra
      // el siguiente tiro y el punto queda fijo.
      const llegada: L.LatLngTuple | null = siguiente
        ? [siguiente.fromLat!, siguiente.fromLng!]
        : null;
      if (!llegada) continue;

      const m = add(
        L.marker(llegada, {
          icon: shotIcon(
            s.club?.split(" ")[0] ?? String(s.shotNumber),
            s.shotLengthYds != null ? String(s.shotLengthYds) : null,
          ),
        }),
      );
      // Mantener apretado para corregir la posición (si seguiste caminando y te
      // olvidaste de marcar el tiro, lo corrés hacia atrás). Un toque normal, corto,
      // abre la hoja de edición del tiro.
      let arrastrando = false;
      attachLongPressDrag(map, m, (lat, lng) => {
        arrastrando = true;
        if (siguiente) onMoveShot(siguiente.id, lat, lng);
        setTimeout(() => {
          arrastrando = false;
        }, 200);
      });
      m.on("click", () => {
        if (!arrastrando) onTapShot(s.id);
      });
    }

    // Rastro de lo caminado desde el último tiro hasta donde estás. Es lo que en H19
    // te deja ver el recorrido del tiro en curso mientras vas a buscar la pelota.
    if (caminadoDesdeLat != null && caminadoDesdeLng != null && userLat != null && userLng != null) {
      add(
        L.polyline(
          [
            [caminadoDesdeLat, caminadoDesdeLng],
            [userLat, userLng],
          ],
          { color: "#fff", weight: 2, opacity: 0.75, dashArray: "3 7", interactive: false },
        ),
      );
    }

    // La PELOTA: de dónde sale el próximo tiro. Se oculta cuando el origen ES el GPS
    // en vivo (showBallMarker=false): el punto azul de abajo ya está en la misma
    // posición y dos círculos superpuestos confundían — parecía que el tiro registrado
    // se movía con el jugador. Se muestra en el tee (icono de golfista) o cuando el
    // origen fue puesto a mano (GPS no disponible o arrastrado a dedo).
    if (origin && showBallMarker) {
      // En el tiro de salida el marcador es el TEE; después es la pelota. Los dos se
      // arrastran, pero se ven distinto para saber qué estás moviendo.
      const iconoOrigen = esTee
        ? `<div style="width:26px;height:26px;border-radius:7px;background:#fff;
             border:2px solid #4f46e5;box-shadow:0 1px 6px rgba(0,0,0,.6);
             display:flex;align-items:center;justify-content:center;font-size:15px;
             line-height:1">🏌</div>`
        : `<div style="width:20px;height:20px;border-radius:50%;background:#fff;
             border:3px solid #4f46e5;box-shadow:0 1px 6px rgba(0,0,0,.6)"></div>`;
      const bola = add(
        L.marker(origin, {
          icon: L.divIcon({
            className: "gf-arrastrable",
            html: conAgarre(iconoOrigen),
            iconSize: [0, 0],
          }),
          draggable: true,
          zIndexOffset: 500,
        }),
      );
      avisarAgarre(bola);
      bola.on("dragend", () => {
        const ll = bola.getLatLng();
        onMoveOrigin(ll.lat, ll.lng);
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
  }, [green, userLat, userLng, originLat, originLng, targetLat, targetLng, caminadoDesdeLat, caminadoDesdeLng, esTee, shots, onMoveShot, onMoveOrigin, onMovePin, onTapShot]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ touchAction: "pan-x pinch-zoom" }}
    />
  );
}
