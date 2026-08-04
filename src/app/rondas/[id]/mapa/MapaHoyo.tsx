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

export default function MapaHoyo({
  green,
  userLat,
  userLng,
  originLat,
  originLng,
  targetLat,
  targetLng,
  esTee,
  caminadoDesdeLat,
  caminadoDesdeLng,
  shots,
  onMoveTarget,
  onMoveOrigin,
  onMovePin,
  onLegsY,
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
  /** El tiro de salida: el marcador del origen es el TEE, no la pelota. */
  esTee: boolean;
  /** Desde dónde venís caminando (el último tiro): se dibuja el rastro punteado.
   *  Van como primitivos: un objeto nuevo por render redibujaría todo el mapa. */
  caminadoDesdeLat: number | null;
  caminadoDesdeLng: number | null;
  shots: MapaShot[];
  onMoveTarget: (lat: number, lng: number) => void;
  /** Mover la PELOTA: de dónde sale el próximo tiro. */
  onMoveOrigin: (lat: number, lng: number) => void;
  /** Mover la BANDERA: la posición real del pin ese día. */
  onMovePin: (lat: number, lng: number) => void;
  /** Altura en pantalla del medio de cada pierna, para que los carteles del borde
   *  izquierdo suban y bajen con el objetivo. */
  onLegsY: (y: { uno: number | null; dos: number | null }) => void;
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
      // El mapa NO se arrastra: queda anclado al hoyo y el deslizar horizontal se lo
      // queda el pager (mapa ↔ datos), como en H19. Zoom y tap siguen andando.
      dragging: false,
      // El encuadre entra el hoyo entero, así que no hace falta pan para ver nada.
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
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
    // Los tiros entran salvo los que quedaron con la posición disparatada (guardados
    // con el GPS lejos de la cancha). Si entraran, un solo tiro malo estiraría el
    // límite kilómetros y el anclaje al hoyo dejaría de servir. Esos se editan y se
    // borran desde la lista de tiros, que no depende del mapa.
    for (const sh of shots) {
      if (sh.fromLat == null || sh.fromLng == null) continue;
      if (
        green.centerLat != null &&
        green.centerLng != null &&
        yardsBetween(sh.fromLat, sh.fromLng, green.centerLat, green.centerLng) > LEJOS_YDS
      ) {
        continue;
      }
      pts.push([sh.fromLat, sh.fromLng]);
    }
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

    // La línea del plan: de la pelota al CENTRO DEL GREEN, con el círculo del objetivo
    // en el medio. Como en H19, se muestran las DOS piernas del plan — hasta el círculo
    // y del círculo al green — cada una con el palo que la cubre. Eso es DECADE: el
    // tiro de ahora y el de después, decididos juntos.
    const greenPt: L.LatLngTuple | null =
      green.centerLat != null && green.centerLng != null ? [green.centerLat, green.centerLng] : null;

    // Dos tramos: de la pelota al objetivo y del objetivo al green. Si movés el
    // objetivo al costado la línea se quiebra, que es lo que querés ver cuando el
    // plan es un dogleg o un bailout — no una recta obligada al green.
    const plan: L.LatLngTuple[] = [];
    if (origin) plan.push(origin);
    if (targetLat != null && targetLng != null) plan.push([targetLat, targetLng]);
    if (greenPt) plan.push(greenPt);
    if (plan.length >= 2) {
      add(
        L.polyline(plan, { color: "#ffffff", weight: 2, opacity: 0.9, interactive: false }),
      );
    }

    if (origin && targetLat != null && targetLng != null) {
      // Círculo grande y transparente: se arrastra para mover el objetivo.
      const aro = add(
        L.circleMarker([targetLat, targetLng], {
          radius: 26,
          color: "#fff",
          weight: 3,
          opacity: 0.95,
          fillColor: "#fff",
          fillOpacity: 0.12,
        }),
      );
      const centro = add(
        L.circleMarker([targetLat, targetLng], { radius: 2, color: "#fff", fillOpacity: 1 }),
      );
      // circleMarker no se arrastra: va un marker invisible encima que sí lo hace.
      const asa = add(
        L.marker([targetLat, targetLng], {
          icon: L.divIcon({
            className: "",
            html: '<div style="width:56px;height:56px;transform:translate(-28px,-28px)"></div>',
            iconSize: [0, 0],
          }),
          draggable: true,
          zIndexOffset: 400,
        }),
      );
      asa.on("drag", () => {
        const ll = asa.getLatLng();
        aro.setLatLng(ll);
        centro.setLatLng(ll); // si no, el puntito queda clavado hasta que soltás
      });
      asa.on("dragend", () => {
        const ll = asa.getLatLng();
        onMoveTarget(ll.lat, ll.lng);
      });

    }

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

    // La PELOTA: de dónde sale el próximo tiro. Es arrastrable porque el GPS no
    // siempre sirve — reconstruyendo un hoyo desde el sillón, o con señal mala en
    // cancha, hay que poder decir "la bola está acá" y que el tiro salga de ahí.
    if (origin) {
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
  }, [green, userLat, userLng, originLat, originLng, targetLat, targetLng, caminadoDesdeLat, caminadoDesdeLng, esTee, shots, onMoveTarget, onMoveShot, onMoveOrigin, onMovePin, onTapShot]);

  // touch-action: Leaflet le pone `none` al contenedor y se comería el deslizar
  // horizontal, dejando el pager congelado. `pan-x pinch-zoom` deja pasar el swipe
  // al pager y mantiene el zoom de dos dedos.
  // Alturas de los carteles: se recalculan al dibujar y mientras movés o hacés zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const medio = (a: L.LatLngTuple, b: L.LatLngTuple): L.LatLngTuple => [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
    ];
    const recalcular = () => {
      const o: L.LatLngTuple | null =
        originLat != null && originLng != null ? [originLat, originLng] : null;
      const t: L.LatLngTuple | null =
        targetLat != null && targetLng != null ? [targetLat, targetLng] : null;
      const g: L.LatLngTuple | null =
        green.centerLat != null && green.centerLng != null
          ? [green.centerLat, green.centerLng]
          : null;
      const yDe = (p: L.LatLngTuple | null) =>
        p ? map.latLngToContainerPoint(L.latLng(p[0], p[1])).y : null;
      onLegsY({
        uno: o && t ? yDe(medio(o, t)) : null,
        dos: t && g ? yDe(medio(t, g)) : null,
      });
    };
    recalcular();
    map.on("move zoom moveend zoomend", recalcular);
    return () => {
      map.off("move zoom moveend zoomend", recalcular);
    };
  }, [originLat, originLng, targetLat, targetLng, green, onLegsY]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ touchAction: "pan-x pinch-zoom" }}
    />
  );
}
