"use client";

// Tracker de cancha, versión mapa a pantalla completa (rediseño 02/08/2026).
// El mapa ES la pantalla; todo lo demás vive en botones flotantes y hojas que suben.
// La versión anterior (scroll de cards) sigue viva en /rondas/[id]?vista=cards.
//
// Regla de diseño: una interacción por tiro, en el momento en que igual ibas a mirar
// la distancia. Ese toque cierra el tiro anterior (dónde estás parado es dónde cayó)
// y abre el plan del siguiente.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { yardsBetween } from "@/lib/geo";
import { suggestClub, type ClubCarry } from "@/lib/shot-gps";
import { holePlan } from "@/lib/plan-cancha";
import { readCurrentHole, writeCurrentHole } from "@/lib/currentHole";
import { useWind } from "@/lib/use-wind";
import { bearingDeg, windComponents, cardinalFromDeg } from "@/lib/wind-math";
import { deviationIsMeaningful } from "@/lib/shot-geometry";
import type { MapaShot, MapaGreen } from "./MapaHoyo";
import DatosHoyo from "./DatosHoyo";

const MapaHoyo = dynamic(() => import("./MapaHoyo"), { ssr: false });

export type HoleMapa = {
  number: number;
  par: number;
  hcpHoyo: number | null;
  roundHoleId: string | null;
  /** Score ya guardado del hoyo (null si no tiene). */
  score: number | null;
  /** Lo ya cargado del hoyo, para que la hoja de cierre abra con datos y no en blanco. */
  puttsFt: number[];
  keys: number[];
  scoresOtros: Record<string, number | null>;
  pinColor: string | null;
  recoveryMode: boolean | null;
  green: MapaGreen;
};

export type PlayerLite = { id: string; name: string; isMe: boolean };

export type RoundMapa = {
  id: string;
  courseName: string;
  onePuttCircleFt: number;
  enterSzYds: number;
  /** Regla 4.3a(1): en torneo no se puede sugerir palo, medir viento ni ajustar por
   *  condiciones. Penalidad general la 1ª vez, descalificación la 2ª. */
  tournamentMode: boolean;
  /** Regla Local G-5: el torneo prohíbe medidores, así que ni las distancias van. */
  noDistanceDevice: boolean;
  clubSuggestion: boolean;
  windEnabled: boolean;
  meRoundPlayerId: string;
  players: PlayerLite[];
};

const GREEN_VACIO: MapaGreen = {
  teeLat: null, teeLng: null, centerLat: null, centerLng: null, frontLat: null, frontLng: null,
};
const LIES = ["Calle", "Green", "Rough", "Bunker", "Antegreen", "Penalización", "En el hoyo"];
const UNDO_MS = 6000;

export default function MapaTracker({
  round,
  holes,
  carries,
  initialHole,
}: {
  round: RoundMapa;
  holes: HoleMapa[];
  carries: ClubCarry[];
  initialHole: number;
}) {
  const router = useRouter();
  // El hoyo actual se guarda en localStorage (mismo storage que el tracker de cards).
  // Sin esto, salir a la tarjeta o al partido y volver te dejaba en el hoyo 1: los
  // tiros seguían guardados pero no se veían, y parecía que la ronda había arrancado
  // de cero. Fue lo primero que rompió en la cancha.
  const [hole, setHole] = useState(initialHole);
  // El efecto que escribe corre en el MISMO commit que el que lee, y con el `hole`
  // viejo: sin este guard pisaba el hoyo guardado con el inicial justo antes de
  // restaurarlo, y si salías de la pantalla en ese instante lo perdías.
  const holeRestaurado = useRef(false);
  useEffect(() => {
    const guardado = readCurrentHole(round.id);
    if (guardado != null) setHole(guardado);
    holeRestaurado.current = true;
    // Solo al montar: después manda el estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!holeRestaurado.current) return;
    writeCurrentHole(round.id, hole);
  }, [round.id, hole]);
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [shots, setShots] = useState<MapaShot[]>([]);
  // Hasta que no se sepa cuántos tiros tiene el hoyo no se puede decidir si estás en
  // el tee. Sin esto, tocar "Registrar golpe" en los primeros segundos guardaba el
  // tiro desde el tee en un hoyo que ya tenía tiros.
  const [shotsListos, setShotsListos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"none" | "holes" | "plan" | "shot" | "tiros" | "confirmar">("none");
  const [editingShot, setEditingShot] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ id: string; label: string; until: number } | null>(null);
  // Tiro recién cerrado, esperando que confirmes palo y lie.
  const [confirmar, setConfirmar] = useState<MapaShot | null>(null);
  // Pelota puesta a mano. Se limpia al cambiar de hoyo y al registrar un tiro: cada
  // tiro nuevo vuelve a decidir de dónde sale según el GPS.
  const [origenManual, setOrigenManual] = useState<{ lat: number; lng: number } | null>(null);
  // Una vez que movés el círculo, deja de reacomodarse solo.
  const [objetivoTocado, setObjetivoTocado] = useState(false);

  // El RoundHole se crea recién con el primer tiro, así que su id llega en la
  // respuesta del POST y no en las props hasta el próximo render del server.
  // Sin esto, el primer tiro de cada hoyo desaparecía del mapa (loadShots veía
  // roundHoleId null y limpiaba la lista) y volvías a tocar, duplicando tiros.
  const [holeIdNuevo, setHoleIdNuevo] = useState<Record<number, string>>({});
  const infoBase = holes.find((h) => h.number === hole);
  // useMemo obligatorio: si `info` fuera un objeto nuevo en cada render, el efecto
  // que fija el target correría siempre y te pisaría el objetivo que moviste a dedo.
  const info = useMemo(
    () =>
      infoBase
        ? { ...infoBase, roundHoleId: infoBase.roundHoleId ?? holeIdNuevo[hole] ?? null }
        : undefined,
    [infoBase, holeIdNuevo, hole],
  );
  const plan = holePlan(round.courseName, hole);
  const lat = pos?.coords.latitude ?? null;
  const lng = pos?.coords.longitude ?? null;
  const accM = pos?.coords.accuracy ?? null;

  // ── GPS ────────────────────────────────────────────────────────────────────
  // Safari corta la geolocalización cuando bloqueás el teléfono, así que esto se
  // vuelve a enganchar solo al volver a la pestaña. Es la diferencia real contra
  // una app nativa y no se puede tapar: se muestra la precisión para que sepas
  // cuánto vale el dato.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Este navegador no tiene GPS");
      return;
    }
    let id: number | null = null;
    const start = () => {
      if (id != null) return;
      id = navigator.geolocation.watchPosition(
        (p) => {
          setPos(p);
          setGpsError(null);
        },
        (e) => setGpsError(e.message),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
      );
    };
    const stop = () => {
      if (id != null) navigator.geolocation.clearWatch(id);
      id = null;
    };
    const onVisible = () => (document.visibilityState === "visible" ? start() : stop());
    start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stop();
    };
  }, []);

  // Target por defecto: el centro del green. En el tee de los hoyos donde tu plan
  // manda errar a un lado, igual se apunta al centro y el aviso del lado malo va en
  // la hoja de plan — mover el target a dedo es un toque en el mapa.
  // Depende del HOYO, no del objeto entero: cuando se crea el RoundHole del primer
  // tiro cambia `info` pero el target no se tiene que mover.
  const centerLat = infoBase?.green.centerLat ?? null;
  const centerLng = infoBase?.green.centerLng ?? null;
  useEffect(() => {
    setTarget(centerLat != null && centerLng != null ? { lat: centerLat, lng: centerLng } : null);
    setOrigenManual(null);
    setObjetivoTocado(false);
  }, [hole, centerLat, centerLng]);



  // Tiros del hoyo.
  const loadShots = useCallback(async () => {
    if (!info?.roundHoleId) {
      setShots([]);
      setShotsListos(true); // hoyo sin RoundHole = sin tiros, y eso ya se sabe
      return;
    }
    try {
      const res = await fetch(`/api/shots?roundHoleId=${info.roundHoleId}`);
      if (res.ok) {
        const d = (await res.json()) as { shots: MapaShot[] };
        setShots(d.shots);
      }
    } catch {
      // Sin señal en la cancha. Se sigue: dejar el botón trabado para siempre sería
      // peor que registrar con la posición aproximada, que después se corrige
      // arrastrando la pelota.
    } finally {
      setShotsListos(true);
    }
  }, [info?.roundHoleId]);

  useEffect(() => {
    setShotsListos(false);
    void loadShots();
  }, [loadShots]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), Math.max(0, undo.until - Date.now()));
    return () => clearTimeout(t);
  }, [undo]);

  // ── Distancias y sugerencia ────────────────────────────────────────────────
  const distTo = (tLat: number | null, tLng: number | null) =>
    lat == null || lng == null || tLat == null || tLng == null
      ? null
      : Math.round(yardsBetween(lat, lng, tLat, tLng));

  const dFront = distTo(info?.green.frontLat ?? null, info?.green.frontLng ?? null);
  const dCenter = distTo(info?.green.centerLat ?? null, info?.green.centerLng ?? null);

  // De dónde SALE el tiro que estás planificando — o sea, dónde está la pelota.
  //
  //  1. Si la moviste a mano en el mapa, manda eso. El GPS no siempre sirve:
  //     reconstruyendo un hoyo desde el sillón te pone a kilómetros, y en cancha
  //     puede tener mala señal.
  //  2. En el drive, el TEE. Aunque el GPS te ponga en otro lado, así podés
  //     registrarlo caminando al hoyo siguiente y queda bien igual.
  //  3. Tu GPS, si te pone en la cancha: ahí sí estás parado en la pelota.
  //  4. Si el GPS te pone lejos, la pelota arranca donde apuntaste el tiro anterior
  //     ("asumo que fue adonde apunté") y la corregís arrastrándola.
  const enElTee = shots.length === 0;
  const teePos =
    infoBase?.green.teeLat != null && infoBase.green.teeLng != null
      ? { lat: infoBase.green.teeLat, lng: infoBase.green.teeLng }
      : null;
  const gpsEnLaCancha =
    lat != null && lng != null && dCenter != null && dCenter <= 1200 ? { lat, lng } : null;
  const ultimoTarget = (() => {
    const u = shots[shots.length - 1];
    return u?.targetLat != null && u.targetLng != null
      ? { lat: u.targetLat, lng: u.targetLng }
      : null;
  })();
  const origen =
    origenManual ?? (enElTee ? (teePos ?? gpsEnLaCancha) : (gpsEnLaCancha ?? ultimoTarget ?? teePos));

  // Punto sobre la línea origen→green, a `yds` del origen. Sirve para poner el
  // círculo del objetivo donde llega el palo elegido.
  function puntoSobreLaLinea(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
    yds: number,
  ) {
    const total = yardsBetween(a.lat, a.lng, b.lat, b.lng);
    if (total < 1) return b;
    const t = Math.min(1, yds / total);
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  }

  // Cuánto llevás caminado desde el último tiro. Es el largo que va midiendo el tiro
  // en curso: en H19 ese número crece mientras caminás (64 → 115 → 225 yd) y es lo que
  // te dice cuánto pegaste. La distancia al green la tenés arriba.
  const ultimoTiro = shots[shots.length - 1];
  const desdeElTiro =
    ultimoTiro?.fromLat != null &&
    ultimoTiro.fromLng != null &&
    lat != null &&
    lng != null &&
    gpsEnLaCancha
      ? Math.round(yardsBetween(ultimoTiro.fromLat, ultimoTiro.fromLng, lat, lng))
      : null;

  // La distancia del tiro se mide desde ese origen, no desde el GPS.
  const dTarget =
    origen && target
      ? Math.round(yardsBetween(origen.lat, origen.lng, target.lat, target.lng))
      : dCenter;

  // En el tee manda el plan de cancha: por distancia el automático diría Driver en
  // el 1 y tu plan dice 4i porque con driver te pasás. Del segundo golpe en adelante
  // manda el cálculo por carry medido.
  const sugerido = useMemo(() => {
    // Regla 4.3a(1): "club selection based on the location of the player's ball" no
    // está permitido. El plan de cancha SÍ, porque es información de antes de la
    // vuelta (4.3a(3)) — pero se muestra en la hoja del plan, no pegado a la distancia.
    if (!round.clubSuggestion) return null;
    if (enElTee && plan) return { club: plan.teeClub, fuente: "plan" as const };
    if (dTarget == null) return null;
    const s = suggestClub(dTarget, carries);
    return s ? { club: s.pick.club, alt: s.alt?.club, fuente: "carry" as const } : null;
  }, [round.clubSuggestion, enElTee, plan, dTarget, carries]);

  // Viento (Open-Meteo, sin API key). Apagado en torneo: la Regla 4.3a(1) prohíbe
  // usar un dispositivo para medir condiciones que afecten el juego.
  // Se pide el viento de donde está la PELOTA, no del teléfono: si estás
  // reconstruyendo el hoyo desde otro lado, el viento de tu casa no sirve de nada.
  const wind = useWind(round.windEnabled, origen?.lat ?? null, origen?.lng ?? null);
  const viento = useMemo(() => {
    if (!wind || !origen || !target) return null;
    const rumbo = bearingDeg(origen.lat, origen.lng, target.lat, target.lng);
    const c = windComponents(wind.direction, wind.speed, rumbo);
    return { ...c, speed: wind.speed, cardinal: cardinalFromDeg(wind.direction) };
  }, [wind, origen, target]);

  // El círculo arranca donde LLEGA el palo con el que vas a pegar: en el tee del 1 el
  // plan dice 4i, así que el objetivo cae a 188 yd y el resto queda para el approach.
  // Si el green está más cerca que eso, el objetivo es el green. Se recalcula solo
  // hasta que lo movés a mano.
  useEffect(() => {
    if (objetivoTocado || !origen || centerLat == null || centerLng == null) return;
    const green = { lat: centerLat, lng: centerLng };
    const alGreen = yardsBetween(origen.lat, origen.lng, green.lat, green.lng);
    const planClub = enElTee && plan ? carries.find((c) => c.club === plan.teeClub) : undefined;
    const alcance = planClub?.carryYds ?? Math.max(...carries.map((c) => c.carryYds), 0);
    if (!alcance || alGreen <= alcance + 5) {
      setTarget(green);
      return;
    }
    setTarget(puntoSobreLaLinea(origen, green, alcance));
    // `origen` cambia con cada tick de GPS; se compara por valor para no re-fijar el
    // objetivo todo el tiempo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivoTocado, origen?.lat, origen?.lng, centerLat, centerLng, enElTee, plan, carries]);

  // Los dos palos del plan: el de ahora (hasta el círculo) y el de después (del
  // círculo al green). Es la decisión de los dos tiros juntos, que es de lo que se
  // trata DECADE.
  const dTargetAlGreen =
    target && centerLat != null && centerLng != null
      ? Math.round(yardsBetween(target.lat, target.lng, centerLat, centerLng))
      : null;
  const clubHastaTarget = !round.clubSuggestion
    ? null
    : enElTee && plan
      ? plan.teeClub
      : dTarget != null
        ? (suggestClub(dTarget, carries)?.pick.club ?? null)
        : null;
  const clubTargetAlGreen =
    !round.clubSuggestion || dTargetAlGreen == null || dTargetAlGreen < 5
      ? null
      : (suggestClub(dTargetAlGreen, carries)?.pick.club ?? null);

  // ── Acciones ───────────────────────────────────────────────────────────────
  async function registrarGolpe() {
    // Alcanza con tener el origen: en el tee sale de las coordenadas del hoyo, así
    // que se puede registrar el drive aunque el GPS todavía no haya enganchado.
    if (!origen || busy || !shotsListos) return;
    setBusy(true);
    try {
      const res = await fetch("/api/shots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundHoleId: info?.roundHoleId ?? undefined,
          roundPlayerId: info?.roundHoleId ? undefined : round.meRoundPlayerId,
          holeNumber: info?.roundHoleId ? undefined : hole,
          lat: origen.lat,
          lng: origen.lng,
          targetLat: target?.lat ?? null,
          targetLng: target?.lng ?? null,
          club: sugerido?.club ?? null,
          distanceToTargetYds: dTarget,
          gpsAccuracyM: accM,
        }),
      });
      if (!res.ok) return;
      const d = (await res.json()) as {
        shot: MapaShot;
        closed: MapaShot | null;
        roundHoleId: string;
      };
      // El tiro se pinta con lo que devolvió el server, sin depender de un refetch
      // que puede no tener todavía el id del hoyo.
      setShots((prev) => {
        const conCierre = d.closed
          ? prev.map((s) => (s.id === d.closed!.id ? d.closed! : s))
          : prev;
        return [...conCierre, d.shot];
      });
      if (!infoBase?.roundHoleId) {
        setHoleIdNuevo((m) => ({ ...m, [hole]: d.roundHoleId }));
      }
      setOrigenManual(null);
      // Si se cerró el tiro anterior, ya se sabe CUÁNTO midió. Recién ahí se puede
      // sugerir con qué palo lo pegaste — por la distancia, no por la que te faltaba.
      // Se abre la confirmación de ese tiro: aceptás el palo o lo cambiás, y marcás
      // dónde quedó la pelota.
      if (d.closed) {
        // La sugerencia acá es por la distancia MEDIDA, no por la que te faltaba
        // antes de pegar. Es la forma de deducir con qué palo pegaste.
        const porDistancia =
          round.clubSuggestion && d.closed.shotLengthYds != null
            ? (suggestClub(d.closed.shotLengthYds, carries)?.pick.club ?? null)
            : null;
        const cerrado = porDistancia ? { ...d.closed, club: porDistancia } : d.closed;
        if (porDistancia && porDistancia !== d.closed.club) {
          void patchShot(d.closed.id, { club: porDistancia });
        }
        setConfirmar(cerrado);
        setPanel("confirmar");
      } else {
        setUndo({
          id: d.shot.id,
          label: `${d.shot.club ?? "tiro"} · ${dTarget ?? "?"} yd`,
          until: Date.now() + UNDO_MS,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const handleMoveTarget = useCallback((la: number, ln: number) => {
    setTarget({ lat: la, lng: ln });
    setObjetivoTocado(true);
  }, []);
  const handleMoveOrigin = useCallback((la: number, ln: number) => {
    setOrigenManual({ lat: la, lng: ln });
  }, []);
  const handleTapShot = useCallback((id: string) => {
    setEditingShot(id);
    setPanel("shot");
  }, []);

  const patchShot = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      await fetch(`/api/shots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadShots();
    },
    [loadShots],
  );

  const handleMoveShot = useCallback(
    (id: string, la: number, ln: number) => {
      void patchShot(id, { fromLat: la, fromLng: ln });
    },
    [patchShot],
  );

  async function borrarShot(id: string) {
    await fetch(`/api/shots/${id}`, { method: "DELETE" });
    setUndo((u) => (u?.id === id ? null : u));
    setEditingShot(null);
    // Si venías de la lista, quedate en la lista: puede haber más de un tiro para borrar.
    setPanel((p) => (p === "shot" ? "none" : p));
    await loadShots();
  }

  // Hoyos cerrados EN ESTA sesión: evita que volver atrás a mirar un hoyo y avanzar
  // de nuevo te obligue a cerrarlo otra vez. NO se precarga con los que ya tienen
  // score: si lo hiciera, en una ronda ya cargada la hoja no aparecería nunca — que
  // es justo lo que estaba pasando.
  const [cerrados, setCerrados] = useState<Set<number>>(() => new Set());
  // Hoyo al que hay que saltar apenas guardes el actual.
  const [pendienteHoyo, setPendienteHoyo] = useState<number | null>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const irAPanel = useCallback((i: 0 | 1) => {
    const el = pagerRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);


  function irAHoyo(n: number) {
    if (n < 1 || n > 18) return;
    // La hoja de cierre sale solo al AVANZAR desde un hoyo con tiros que todavía no
    // cerraste. Si estás mirando hoyos para ver dónde pegar, se navega derecho.
    // Si el hoyo tiene tiros y todavía no lo guardaste, en vez de un modal te lleva
    // al panel de datos deslizando. Ahí guardás y volvés al mapa con el hoyo nuevo.
    if (n > hole && shots.length > 0 && !cerrados.has(hole)) {
      setPendienteHoyo(n);
      irAPanel(1);
      setPanel("none");
      return;
    }
    setHole(n);
    setPanel("none");
    irAPanel(0);
  }

  const editando = shots.find((s) => s.id === editingShot) ?? null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Pager horizontal: mapa ↔ datos. El mapa no se arrastra, así que el deslizar
          al costado se lo queda esto (patrón H19). scroll-snap nativo: sin gestos a
          mano, con la inercia del sistema. */}
      <div
        ref={pagerRef}
        className="h-full w-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
        // overscrollBehaviorX: sin esto, deslizar de vuelta al mapa desde el borde
        // dispara el gesto "atrás" de Safari y te saca de la pantalla.
        style={{ scrollbarWidth: "none", overscrollBehaviorX: "contain" }}
      >
        <section className="relative w-full h-full shrink-0 snap-start">
      <MapaHoyo
        green={info?.green ?? GREEN_VACIO}
        userLat={lat}
        userLng={lng}
        originLat={origen?.lat ?? null}
        originLng={origen?.lng ?? null}
        targetLat={target?.lat ?? null}
        targetLng={target?.lng ?? null}
        clubHastaTarget={clubHastaTarget}
        clubTargetAlGreen={clubTargetAlGreen}
        shots={shots}
        caminadoDesdeLat={gpsEnLaCancha ? (ultimoTiro?.fromLat ?? null) : null}
        caminadoDesdeLng={gpsEnLaCancha ? (ultimoTiro?.fromLng ?? null) : null}
        onMoveTarget={handleMoveTarget}
        onMoveOrigin={handleMoveOrigin}
        onMoveShot={handleMoveShot}
        onTapShot={handleTapShot}
      />

      {/* Barra de distancias */}
      <div className="absolute z-[1000] top-0 left-0 right-0 p-2 flex items-start gap-2 pointer-events-none">
        <Link
          href={`/rondas/${round.id}?vista=cards`}
          className="pointer-events-auto rounded-full bg-black/60 text-white text-[11px] px-3 py-2 backdrop-blur"
        >
          ‹ cards
        </Link>
        <div className="flex-1" />
        {round.noDistanceDevice ? (
          <div className="rounded-2xl bg-red-600 text-white px-3 py-1.5 text-right shadow-lg">
            <div className="text-xs font-black leading-tight">SIN MEDIDOR</div>
            <div className="text-[10px] leading-tight opacity-90">Regla local del torneo</div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/95 px-3 py-1.5 text-right shadow-lg">
            <div className="text-3xl font-black leading-none tabular-nums">{dCenter ?? "—"}</div>
            <div className="text-[10px] text-neutral-600 leading-tight">
              frente {dFront ?? "—"} · centro
            </div>
          </div>
        )}
      </div>

      {/* Rail derecho */}
      <div className="absolute z-[1000] right-2 top-24 flex flex-col gap-2">
        <RailBtn label="📋" title="Tarjeta" onClick={() => router.push(`/rondas/${round.id}/scorecard`)} />
        <RailBtn label="🏆" title="Partido" onClick={() => router.push(`/rondas/${round.id}/resumen`)} />
        <RailBtn
          label={plan?.danger ? "⚠️" : "📖"}
          title="Plan del hoyo"
          highlight={!!plan?.danger}
          onClick={() => setPanel(panel === "plan" ? "none" : "plan")}
        />
        <RailBtn
          label={shots.length ? `⛳${shots.length}` : "⛳"}
          title="Tiros del hoyo"
          onClick={() => setPanel(panel === "tiros" ? "none" : "tiros")}
        />
        <RailBtn label="📝" title="Datos del hoyo" onClick={() => irAPanel(1)} />
        <RailBtn label="⚙️" title="Setup" onClick={() => router.push(`/rondas/${round.id}?vista=cards`)} />
      </div>

      {/* Estado GPS */}
      <div className="absolute z-[1000] left-2 top-24 pointer-events-none">
        <div className="rounded-full bg-black/60 text-white text-[10px] px-2 py-1 backdrop-blur">
          {gpsError
            ? `GPS: ${gpsError}`
            : accM == null
              ? "buscando GPS…"
              : dCenter != null && dCenter > 1200
                ? `estás a ${(dCenter * 0.0009144).toFixed(1)} km de la cancha`
                : `GPS ±${Math.round(accM)} m`}
        </div>
      </div>

      {/* Viento — solo fuera de torneo (Regla 4.3a(1)) */}
      {viento && (
        <div className="absolute z-[1000] left-2 top-36 pointer-events-none">
          <div className="rounded-xl bg-black/65 text-white px-2.5 py-1.5 backdrop-blur text-[11px] leading-tight">
            <div className="font-bold">
              {Math.round(viento.speed)} km/h {viento.cardinal}
            </div>
            <div className="opacity-90">
              {Math.abs(viento.head) < 1
                ? "sin componente"
                : viento.head > 0
                  ? `${Math.round(viento.head)} en contra`
                  : `${Math.round(-viento.head)} a favor`}
              {viento.cross >= 1 && ` · ${Math.round(viento.cross)} de ${viento.crossSide}`}
            </div>
          </div>
        </div>
      )}

      {round.tournamentMode && (
        <div className="absolute z-[1000] left-2 top-36 pointer-events-none">
          <div className="rounded-full bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 shadow">
            MODO TORNEO · sin palo ni viento
          </div>
        </div>
      )}

      {/* Registrar golpe */}
      <div className="absolute z-[1000] left-2 bottom-28">
        <button
          type="button"
          disabled={!origen || busy || !shotsListos}
          onClick={() => void registrarGolpe()}
          className="rounded-2xl px-4 py-3 text-left shadow-xl disabled:opacity-50"
          style={{ background: "#4f46e5", color: "#fff" }}
        >
          <div className="font-bold text-sm">⛳ Registrar golpe</div>
          <div className="text-[11px] opacity-90">
            {!shotsListos
              ? "cargando los tiros del hoyo…"
              : !origen
                ? "esperando señal de GPS…"
              : round.noDistanceDevice
                ? "marcá dónde está la pelota"
                : `${desdeElTiro != null ? `${desdeElTiro} yd caminados · ` : ""}${dTarget ?? "—"} al target${sugerido ? ` · ${sugerido.club}` : ""}${
                  origenManual
                    ? " · pelota a mano"
                    : sugerido?.fuente === "plan"
                      ? " · desde el tee"
                      : ""
                }`}
          </div>
        </button>
      </div>

      {/* Toast de deshacer */}
      {undo && (
        <div className="absolute z-[1000] left-2 right-2 bottom-44">
          <div className="rounded-xl bg-white shadow-xl px-3 py-2 flex items-center gap-2">
            <button
              type="button"
              className="flex-1 text-left text-sm font-semibold"
              onClick={() => {
                setEditingShot(undo.id);
                setPanel("shot");
                setUndo(null);
              }}
            >
              {undo.label}
              <div className="text-[10px] text-neutral-500 font-normal">tocá para editar</div>
            </button>
            <button
              type="button"
              aria-label="Borrar el tiro"
              onClick={() => void borrarShot(undo.id)}
              className="text-lg px-2"
            >
              🗑
            </button>
          </div>
        </div>
      )}

      {/* Selector de hoyo */}
      <div className="absolute z-[1000] left-0 right-0 bottom-0 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-3 py-2">
          <button type="button" onClick={() => irAHoyo(hole - 1)} className="px-3 text-2xl">
            ‹
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "holes" ? "none" : "holes")}
            className="text-center"
          >
            <span className="text-2xl font-black tabular-nums">
              {String(hole).padStart(2, "0")}
            </span>
            <span className="ml-2 text-[11px] text-neutral-600">
              PAR {info?.par ?? "—"}
              {info?.hcpHoyo != null ? ` · S.I. ${info.hcpHoyo}` : ""}
            </span>
          </button>
          <button type="button" onClick={() => irAHoyo(hole + 1)} className="px-3 text-2xl">
            ›
          </button>
        </div>
      </div>

        </section>

        <section className="w-full h-full shrink-0 snap-start bg-white">
          <DatosHoyo
            key={hole}
            round={round}
            hole={hole}
            par={info?.par ?? null}
            shots={shots}
            guardados={{
              score: infoBase?.score ?? null,
              puttsFt: infoBase?.puttsFt ?? [],
              keys: infoBase?.keys ?? [],
              scoresOtros: infoBase?.scoresOtros ?? {},
              pinColor: infoBase?.pinColor ?? null,
              recoveryMode: infoBase?.recoveryMode ?? null,
            }}
            onSaved={(h) => {
              setCerrados((prev) => new Set(prev).add(h));
              router.refresh();
              // Si veníamos de tocar "siguiente hoyo", ahora sí saltamos.
              if (pendienteHoyo != null) {
                setHole(pendienteHoyo);
                setPendienteHoyo(null);
                irAPanel(0);
              }
            }}
          />
        </section>
      </div>

      {/* Hojas */}
      {panel === "holes" && (
        <Sheet onClose={() => setPanel("none")} title="Ir a un hoyo">
          <div className="grid grid-cols-5 gap-2">
            {holes.map((h) => (
              <button
                key={h.number}
                type="button"
                onClick={() => {
                  setHole(h.number);
                  setPanel("none");
                }}
                className={`rounded-xl py-3 font-bold ${h.number === hole ? "bg-indigo-600 text-white" : "bg-neutral-100"}`}
              >
                {h.number}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {panel === "plan" && (
        <Sheet onClose={() => setPanel("none")} title={`Plan del hoyo ${hole}`}>
          {plan ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-neutral-900 text-white px-3 py-1 font-bold">
                  {plan.teeClub}
                </span>
                {plan.teeClubIsConditional && (
                  <span className="text-[11px] text-neutral-500">si venís pegándolo bien</span>
                )}
              </div>
              {plan.danger && (
                <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 font-semibold">
                  ⚠ Peligro a la {plan.danger === "R" ? "DERECHA" : "IZQUIERDA"} — errá al otro lado
                </div>
              )}
              <p className="text-neutral-700">{plan.note}</p>
              <p className="text-[11px] text-neutral-500 pt-2 border-t">
                Reglas madre: fairway &gt; distancia · centro del green · entre dos palos, el corto.
              </p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              No hay plan cargado para {round.courseName}. Solo La Lucila lo tiene.
            </p>
          )}
        </Sheet>
      )}

      {panel === "confirmar" && confirmar && (
        <Sheet
          onClose={() => {
            setPanel("none");
            setConfirmar(null);
          }}
          title={
            confirmar.shotLengthYds != null
              ? `Pegaste ${confirmar.shotLengthYds} yd`
              : `Tiro ${confirmar.shotNumber}`
          }
        >
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                ¿Con qué palo? {round.clubSuggestion && "— sugerido por la distancia"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {carries.map((c) => (
                  <button
                    key={c.club}
                    type="button"
                    onClick={() => {
                      setConfirmar({ ...confirmar, club: c.club });
                      void patchShot(confirmar.id, { club: c.club });
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs ${confirmar.club === c.club ? "bg-indigo-600 text-white" : "bg-neutral-100"}`}
                  >
                    {c.club}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                ¿Dónde quedó la pelota?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LIES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setConfirmar({ ...confirmar, lie: l });
                      void patchShot(confirmar.id, { lie: l });
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs ${confirmar.lie === l ? "bg-indigo-600 text-white" : "bg-neutral-100"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPanel("none");
                setConfirmar(null);
              }}
              className="w-full rounded-xl py-3 font-bold text-white"
              style={{ background: "#4f46e5" }}
            >
              Listo
            </button>
          </div>
        </Sheet>
      )}

      {panel === "tiros" && (
        <Sheet onClose={() => setPanel("none")} title={`Tiros del hoyo ${hole}`}>
          {shots.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Todavía no registraste ningún tiro en este hoyo.
            </p>
          ) : (
            <div className="space-y-2">
              {shots.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl bg-neutral-100 p-2">
                  <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {s.shotNumber}
                  </span>
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => {
                      setEditingShot(s.id);
                      setPanel("shot");
                    }}
                  >
                    <div className="text-sm font-semibold">
                      {s.club ?? "sin palo"}
                      {s.shotLengthYds != null ? ` · ${s.shotLengthYds} yd` : ""}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {s.lie ?? "sin lie"}
                      {s.distanceToTargetYds != null ? ` · quedaban ${s.distanceToTargetYds} yd` : ""}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`Borrar tiro ${s.shotNumber}`}
                    onClick={() => void borrarShot(s.id)}
                    className="px-2 text-lg"
                  >
                    🗑
                  </button>
                </div>
              ))}
              <p className="text-[11px] text-neutral-500 pt-1">
                Desde acá se pueden borrar tiros que quedaron con la posición mal (por
                ejemplo, guardados con el GPS lejos de la cancha) y que no se alcanzan
                tocándolos en el mapa.
              </p>
            </div>
          )}
        </Sheet>
      )}

      {panel === "shot" && editando && (
        <Sheet onClose={() => setPanel("none")} title={`Tiro ${editando.shotNumber}`}>
          <div className="space-y-3">
            <div className="text-xs text-neutral-500">
              {editando.shotLengthYds != null
                ? `Midió ${editando.shotLengthYds} yd`
                : "Se mide cuando registres el próximo golpe"}
            </div>
            {editando.lateralDeviationYds != null && (
              <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm">
                {deviationIsMeaningful(editando.lateralDeviationYds, editando.gpsAccuracyM) ? (
                  <>
                    Apuntaste al target y saliste{" "}
                    <b>
                      {Math.abs(editando.lateralDeviationYds)} yd a la{" "}
                      {editando.lateralDeviationYds > 0 ? "derecha" : "izquierda"}
                    </b>
                  </>
                ) : (
                  <span className="text-neutral-500">
                    En la línea (el desvío queda dentro del error del GPS)
                  </span>
                )}
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Palo</div>
              <div className="flex flex-wrap gap-1.5">
                {carries.map((c) => (
                  <button
                    key={c.club}
                    type="button"
                    onClick={() => void patchShot(editando.id, { club: c.club })}
                    className={`rounded-lg px-2.5 py-1.5 text-xs ${editando.club === c.club ? "bg-indigo-600 text-white" : "bg-neutral-100"}`}
                  >
                    {c.club}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void patchShot(editando.id, { club: "Putter" })}
                  className={`rounded-lg px-2.5 py-1.5 text-xs ${editando.club === "Putter" ? "bg-indigo-600 text-white" : "bg-neutral-100"}`}
                >
                  Putter
                </button>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                Dónde terminó
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LIES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => void patchShot(editando.id, { lie: l })}
                    className={`rounded-lg px-2.5 py-1.5 text-xs ${editando.lie === l ? "bg-indigo-600 text-white" : "bg-neutral-100"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void borrarShot(editando.id)}
              className="w-full rounded-xl bg-red-50 text-red-700 py-2.5 font-semibold"
            >
              Borrar este tiro
            </button>
          </div>
        </Sheet>
      )}

    </div>
  );
}

function RailBtn({
  label,
  title,
  onClick,
  highlight,
}: {
  label: string;
  title: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="w-11 h-11 rounded-xl text-lg shadow-lg backdrop-blur flex items-center justify-center"
      style={{ background: highlight ? "rgba(220,38,38,.92)" : "rgba(17,24,39,.82)" }}
    >
      {label}
    </button>
  );
}

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[1100] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 text-xl px-2">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
