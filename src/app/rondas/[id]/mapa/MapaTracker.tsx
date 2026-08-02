"use client";

// Tracker de cancha, versión mapa a pantalla completa (rediseño 02/08/2026).
// El mapa ES la pantalla; todo lo demás vive en botones flotantes y hojas que suben.
// La versión anterior (scroll de cards) sigue viva en /rondas/[id]?vista=cards.
//
// Regla de diseño: una interacción por tiro, en el momento en que igual ibas a mirar
// la distancia. Ese toque cierra el tiro anterior (dónde estás parado es dónde cayó)
// y abre el plan del siguiente.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { yardsBetween } from "@/lib/geo";
import { suggestClub, type ClubCarry } from "@/lib/shot-gps";
import { holePlan } from "@/lib/plan-cancha";
import { deviationIsMeaningful } from "@/lib/shot-geometry";
import type { MapaShot, MapaGreen } from "./MapaHoyo";
import CierreHoyo, { type CierreState } from "./CierreHoyo";

const MapaHoyo = dynamic(() => import("./MapaHoyo"), { ssr: false });

export type HoleMapa = {
  number: number;
  par: number;
  hcpHoyo: number | null;
  roundHoleId: string | null;
  /** Ya tiene score cargado: el hoyo se considera cerrado y no vuelve a pedir la hoja. */
  tieneScore: boolean;
  green: MapaGreen;
};

export type PlayerLite = { id: string; name: string; isMe: boolean };

export type RoundMapa = {
  id: string;
  courseName: string;
  onePuttCircleFt: number;
  meRoundPlayerId: string;
  players: PlayerLite[];
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
  const [hole, setHole] = useState(initialHole);
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [shots, setShots] = useState<MapaShot[]>([]);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"none" | "holes" | "plan" | "cierre" | "shot">("none");
  const [editingShot, setEditingShot] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ id: string; label: string; until: number } | null>(null);
  const [cierre, setCierre] = useState<CierreState | null>(null);

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
  }, [hole, centerLat, centerLng]);

  // Tiros del hoyo.
  const loadShots = useCallback(async () => {
    if (!info?.roundHoleId) {
      setShots([]);
      return;
    }
    const res = await fetch(`/api/shots?roundHoleId=${info.roundHoleId}`);
    if (!res.ok) return;
    const d = (await res.json()) as { shots: MapaShot[] };
    setShots(d.shots);
  }, [info?.roundHoleId]);

  useEffect(() => {
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
  const dTarget = target ? distTo(target.lat, target.lng) : dCenter;

  // En el tee manda el plan de cancha: por distancia el automático diría Driver en
  // el 1 y tu plan dice 4i porque con driver te pasás. Del segundo golpe en adelante
  // manda el cálculo por carry medido.
  const enElTee = shots.length === 0;
  const sugerido = useMemo(() => {
    if (enElTee && plan) return { club: plan.teeClub, fuente: "plan" as const };
    if (dTarget == null) return null;
    const s = suggestClub(dTarget, carries);
    return s ? { club: s.pick.club, alt: s.alt?.club, fuente: "carry" as const } : null;
  }, [enElTee, plan, dTarget, carries]);

  // ── Acciones ───────────────────────────────────────────────────────────────
  async function registrarGolpe() {
    if (lat == null || lng == null || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/shots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundHoleId: info?.roundHoleId ?? undefined,
          roundPlayerId: info?.roundHoleId ? undefined : round.meRoundPlayerId,
          holeNumber: info?.roundHoleId ? undefined : hole,
          lat,
          lng,
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
      setUndo({
        id: d.shot.id,
        label: `${d.shot.club ?? "tiro"} · ${dTarget ?? "?"} yd`,
        until: Date.now() + UNDO_MS,
      });
    } finally {
      setBusy(false);
    }
  }

  async function patchShot(id: string, body: Record<string, unknown>) {
    await fetch(`/api/shots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await loadShots();
  }

  async function borrarShot(id: string) {
    await fetch(`/api/shots/${id}`, { method: "DELETE" });
    setUndo((u) => (u?.id === id ? null : u));
    setEditingShot(null);
    setPanel("none");
    await loadShots();
  }

  // Hoyos que ya se cerraron (o que ya venían con score de antes). Sin esto, volver
  // atrás a mirar un hoyo y avanzar de nuevo te obligaba a cerrarlo otra vez.
  const [cerrados, setCerrados] = useState<Set<number>>(
    () => new Set(holes.filter((h) => h.tieneScore).map((h) => h.number)),
  );

  function irAHoyo(n: number) {
    if (n < 1 || n > 18) return;
    // La hoja de cierre sale solo al AVANZAR desde un hoyo con tiros que todavía no
    // cerraste. Si estás mirando hoyos para ver dónde pegar, se navega derecho.
    if (n > hole && shots.length > 0 && !cerrados.has(hole)) {
      setCierre({
        hole,
        roundHoleId: info?.roundHoleId ?? null,
        golpesMios: shots.length,
        // Las penalidades suman golpe además del tiro. Van acá para que el score que
        // ves en la hoja sea EXACTAMENTE el que el server calcula y guarda.
        penalidadesMias: shots.filter((s) => s.lie === "Penalización").length,
        siguiente: n,
      });
      setPanel("cierre");
      return;
    }
    setHole(n);
    setPanel("none");
  }

  const editando = shots.find((s) => s.id === editingShot) ?? null;

  return (
    <div className="fixed inset-0 bg-black">
      <MapaHoyo
        green={info?.green ?? { teeLat: null, teeLng: null, centerLat: null, centerLng: null, frontLat: null, frontLng: null }}
        userLat={lat}
        userLng={lng}
        targetLat={target?.lat ?? null}
        targetLng={target?.lng ?? null}
        shots={shots}
        onMoveTarget={(la, ln) => setTarget({ lat: la, lng: ln })}
        onMoveShot={(id, la, ln) => void patchShot(id, { fromLat: la, fromLng: ln })}
        onTapShot={(id) => {
          setEditingShot(id);
          setPanel("shot");
        }}
      />

      {/* Barra de distancias */}
      <div className="absolute top-0 left-0 right-0 p-2 flex items-start gap-2 pointer-events-none">
        <Link
          href={`/rondas/${round.id}?vista=cards`}
          className="pointer-events-auto rounded-full bg-black/60 text-white text-[11px] px-3 py-2 backdrop-blur"
        >
          ‹ cards
        </Link>
        <div className="flex-1" />
        <div className="rounded-2xl bg-white/95 px-3 py-1.5 text-right shadow-lg">
          <div className="text-3xl font-black leading-none tabular-nums">{dCenter ?? "—"}</div>
          <div className="text-[10px] text-neutral-600 leading-tight">
            frente {dFront ?? "—"} · centro
          </div>
        </div>
      </div>

      {/* Rail derecho */}
      <div className="absolute right-2 top-24 flex flex-col gap-2">
        <RailBtn label="📋" title="Tarjeta" onClick={() => router.push(`/rondas/${round.id}/scorecard`)} />
        <RailBtn label="🏆" title="Partido" onClick={() => router.push(`/rondas/${round.id}/resumen`)} />
        <RailBtn
          label={plan?.danger ? "⚠️" : "📖"}
          title="Plan del hoyo"
          highlight={!!plan?.danger}
          onClick={() => setPanel(panel === "plan" ? "none" : "plan")}
        />
        <RailBtn label="⚙️" title="Setup" onClick={() => router.push(`/rondas/${round.id}?vista=cards`)} />
      </div>

      {/* Estado GPS */}
      <div className="absolute left-2 top-24 pointer-events-none">
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

      {/* Registrar golpe */}
      <div className="absolute left-2 bottom-24">
        <button
          type="button"
          disabled={lat == null || busy}
          onClick={() => void registrarGolpe()}
          className="rounded-2xl px-4 py-3 text-left shadow-xl disabled:opacity-50"
          style={{ background: "#4f46e5", color: "#fff" }}
        >
          <div className="font-bold text-sm">⛳ Registrar golpe</div>
          <div className="text-[11px] opacity-90">
            {lat == null
              ? "esperando señal de GPS…"
              : `${dTarget ?? "—"} yd · ${sugerido?.club ?? "sin dato"}${sugerido?.fuente === "plan" ? " · del plan" : ""}`}
          </div>
        </button>
      </div>

      {/* Toast de deshacer */}
      {undo && (
        <div className="absolute left-2 right-2 bottom-40">
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
      <div className="absolute left-0 right-0 bottom-0 bg-white/95 backdrop-blur">
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

      {panel === "cierre" && cierre && (
        <CierreHoyo
          round={round}
          state={cierre}
          onDone={(siguiente, cerrado) => {
            setCerrados((prev) => new Set(prev).add(cerrado));
            setPanel("none");
            setCierre(null);
            setHole(siguiente);
            router.refresh();
          }}
          onCancel={() => {
            setPanel("none");
            setCierre(null);
          }}
        />
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
    <div className="absolute inset-0 z-20 flex flex-col justify-end" onClick={onClose}>
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
