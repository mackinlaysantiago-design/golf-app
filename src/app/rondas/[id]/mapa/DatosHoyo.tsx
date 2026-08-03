"use client";

// Panel de datos del hoyo. Es la SEGUNDA pantalla del pager: el mapa no se arrastra,
// así que deslizar al costado te trae acá (patrón H19).
//
// Pide SOLO lo que no se puede derivar de los tiros. Tu score, enter/inside SZ, la
// distancia REG, las penalidades y el "apunté al centro" salen solos de la secuencia
// de tiros y del target — acá quedan los putts (que el GPS no puede medir: a dos
// pasos del hoyo el error del teléfono es más grande que el putt), los golpes de los
// otros jugadores, las keys y el DECADE de cierre.
//
// OJO: el padre lo monta con key={hole}. El estado nace de las props y se reinicia
// remontando, no con un efecto — un efecto que dependa de `guardados` corre en cada
// pulso de GPS (es un objeto nuevo por render) y te borra lo que estás tipeando.

import { useRef, useState } from "react";
import type { RoundMapa } from "./MapaTracker";
import type { MapaShot } from "./MapaHoyo";
import { SM_KEYS } from "@/lib/sm-keys";
import { derivePutts } from "@/lib/putts-derive";
import { deriveSmFromShots } from "@/lib/shots-to-sm";

export type DatosGuardados = {
  /** Score ya guardado. Si el hoyo no tiene tiros no hay nada que derivar y este se
   *  reenvía tal cual: mandar null borraría lo que ya estaba cargado. */
  score: number | null;
  puttsFt: number[];
  keys: number[];
  scoresOtros: Record<string, number | null>;
  pinColor: string | null;
  recoveryMode: boolean | null;
};

const PINS = [
  { key: "GREEN", label: "Centro", dot: "#16a34a" },
  { key: "YELLOW", label: "Borde", dot: "#eab308" },
  { key: "RED", label: "Trampa", dot: "#dc2626" },
];

export default function DatosHoyo({
  round,
  hole,
  par,
  shots,
  guardados,
  onSaved,
  hoyos,
  onHoyo,
  pendiente,
  onSiguiente,
  onVolver,
}: {
  round: RoundMapa;
  hole: number;
  par: number | null;
  shots: MapaShot[];
  guardados: DatosGuardados;
  onSaved: (hole: number) => void;
  /** Hoyo al que ibas cuando tocaste "siguiente" en el mapa, si había uno. */
  pendiente: number | null;
  onSiguiente: () => void;
  onVolver: () => void;
  /** Para navegar entre hojas de datos sin volver al mapa. */
  hoyos: { number: number; completo: boolean; aMedias: boolean }[];
  onHoyo: (n: number) => void;
}) {
  const [puttsFt, setPuttsFt] = useState<number[]>(guardados.puttsFt);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [keys, setKeys] = useState<number[]>(guardados.keys);
  const [pin, setPin] = useState<string | null>(guardados.pinColor);
  const [recovery, setRecovery] = useState<boolean | null>(guardados.recoveryMode);
  const [otros, setOtros] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(guardados.scoresOtros).map(([id, v]) => [id, v == null ? "" : String(v)]),
    ),
  );
  const [busy, setBusy] = useState(false);
  // Arranca en verde si el hoyo ya está guardado y todavía no tocaste nada.
  const [guardado, setGuardado] = useState(guardados.score != null);
  const [error, setError] = useState<string | null>(null);
  // Con señal lenta en la cancha es normal tocar dos veces: sin esta guarda salían dos
  // guardados y dos navegaciones encimadas. El estado `busy` no alcanza porque React
  // no lo aplica antes del segundo toque. Guarda la promesa y no un booleano para que
  // el segundo toque espere el resultado del primero en vez de leerlo como un fallo.
  const enVuelo = useRef<Promise<boolean> | null>(null);
  // Modificado ≠ "sin guardar": un hoyo vacío arranca sin score y no hay NADA que
  // guardar hasta que toques algo. Sin esto, salir de un hoyo que ni miraste
  // disparaba un guardado al pedo.
  const [modificado, setModificado] = useState(false);
  // Salida de emergencia: si el guardado falla (sin señal en la cancha) no se puede
  // dejar al jugador encerrado en la pantalla.
  const [dejarSalir, setDejarSalir] = useState(false);

  const otrosJugadores = round.players.filter((p) => !p.isMe);
  const dPutts = derivePutts(puttsFt, round.onePuttCircleFt);
  const circlePasos = Math.max(1, Math.round(round.onePuttCircleFt / 3));

  // El mismo cálculo que hace el server al guardar: lo que ves acá es lo que queda.
  const sm = deriveSmFromShots(
    shots.map((s) => ({
      shotNumber: s.shotNumber,
      distanceToTargetYds: s.distanceToTargetYds,
      lie: s.lie,
    })),
    puttsFt.length,
    round.enterSzYds,
  );

  // Un solo lugar para "el usuario tocó algo": son seis controles y olvidarse un
  // setter en uno solo hace que salir de la hoja se coma justo ese dato.
  // El contador existe porque los inputs NO se bloquean durante un guardado en vuelo:
  // si tipeás mientras la señal está lenta, el guardado que termina no incluye eso y
  // no puede marcar la hoja como limpia ni sacarte de la pantalla.
  const cambios = useRef(0);
  const tocado = () => {
    cambios.current++;
    setGuardado(false);
    setModificado(true);
    setDejarSalir(false);
  };

  const commit = (next: number[]) => {
    setDraft({});
    setPuttsFt(next);
    tocado();
  };

  // Salir de la hoja guarda lo que haya sin guardar. Antes te ibas al mapa a tocar
  // "Terminar ronda" y perdías las distancias de los putts, las keys y el DECADE:
  // eran estado local hasta que tocabas Guardar.
  async function salirGuardando(accion: () => void) {
    if (!modificado || dejarSalir) {
      accion();
      return;
    }
    const antes = cambios.current;
    const ok = await guardar();
    if (ok) {
      // Si tipeaste algo MIENTRAS se guardaba, eso no viajó: no te saco de la
      // pantalla con datos nuevos sin guardar. Salís de nuevo cuando termines.
      if (cambios.current !== antes) return;
      accion();
      return;
    }
    // Falló: no te saco con los datos sin guardar, pero habilito salir igual para no
    // dejarte encerrado si la señal no vuelve.
    setDejarSalir(true);
  }

  function guardar(): Promise<boolean> {
    if (!enVuelo.current) {
      enVuelo.current = guardarAhora().finally(() => {
        enVuelo.current = null;
      });
    }
    return enVuelo.current;
  }

  async function guardarAhora(): Promise<boolean> {
    // Lo que viaja en el PUT es lo que había HASTA acá: si entra un cambio durante
    // el vuelo, este guardado no puede dejar la hoja en verde.
    const snapshot = cambios.current;
    setBusy(true);
    try {
      const entries: Record<string, unknown>[] = [
        {
          roundPlayerId: round.meRoundPlayerId,
          holeNumber: hole,
          // Sin tiros no hay nada que derivar: se reenvía el score que ya estaba.
          score: sm?.score ?? guardados.score ?? null,
          puttDistancesFt: puttsFt,
          keysBroken: keys.length ? keys : null,
          pinColor: pin,
          recoveryMode: recovery,
        },
      ];
      for (const p of otrosJugadores) {
        const v = otros[p.id];
        if (v == null || v === "") continue;
        entries.push({ roundPlayerId: p.id, holeNumber: hole, score: parseInt(v) });
      }
      const res = await fetch(`/api/rondas/${round.id}/hoyos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (res.ok) {
        // La hoja queda limpia solo si no tipeaste nada durante el vuelo. Sin el
        // setModificado(false), guardar a mano y salir enseguida disparaba un segundo
        // PUT al pedo — y si justo se cortaba la señal te frenaba con los datos ya
        // guardados.
        if (cambios.current === snapshot) {
          setGuardado(true);
          setModificado(false);
        }
        setError(null);
        onSaved(hole);
        return true;
      }
      setError(`No se pudo guardar (${res.status}). Los datos siguen acá, probá de nuevo.`);
      return false;
    } catch {
      setError("No se pudo guardar: sin conexión. Los datos siguen acá, probá de nuevo.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const vsPar = sm && par != null ? sm.score - par : null;

  // Por índice y no por hole±1: una ronda de solo Vuelta empieza en el 10, y así el
  // recorrido no depende de que los números sean contiguos.
  const iActual = hoyos.findIndex((h) => h.number === hole);
  const anterior = iActual > 0 ? hoyos[iActual - 1] : null;
  const siguiente = iActual >= 0 && iActual < hoyos.length - 1 ? hoyos[iActual + 1] : null;

  return (
    <div className="h-full overflow-y-auto bg-white px-4 pt-2 pb-40">
      <div className="-mx-4 px-2 pb-2 mb-2 border-b border-neutral-200">
        <button
          type="button"
          disabled={busy}
          onClick={() => void salirGuardando(onVolver)}
          className="rounded-full bg-neutral-900 text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "‹ Volver al mapa"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Hoyo anterior"
          disabled={!anterior || busy}
          onClick={() => anterior && void salirGuardando(() => onHoyo(anterior.number))}
          className="text-2xl px-2 disabled:opacity-25"
        >
          ‹
        </button>
        <h2 className="font-black text-xl flex-1 text-center">
          Hoyo {hole}
          {par != null && (
            <span className="text-neutral-400 font-normal text-sm"> · par {par}</span>
          )}
        </h2>
        <button
          type="button"
          aria-label="Hoyo siguiente"
          disabled={!siguiente || busy}
          onClick={() => siguiente && void salirGuardando(() => onHoyo(siguiente.number))}
          className="text-2xl px-2 disabled:opacity-25"
        >
          ›
        </button>
      </div>

      {/* Tira de hoyos con el semáforo: se salta directo al que falta completar. */}
      <div className="flex gap-1 overflow-x-auto mt-2 pb-1 -mx-1 px-1">
        {hoyos.map((h) => (
          <button
            key={h.number}
            type="button"
            disabled={busy}
            onClick={() => void salirGuardando(() => onHoyo(h.number))}
            className={`shrink-0 w-8 h-8 rounded-lg text-xs font-bold ${
              h.number === hole
                ? "bg-indigo-600 text-white"
                : h.completo
                  ? "bg-green-600 text-white"
                  : h.aMedias
                    ? "bg-amber-400 text-neutral-900"
                    : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {h.number}
          </button>
        ))}
      </div>

      {/* Lo que sale solo de los tiros: lectura, sin inputs. */}
      <section className="mt-3 rounded-xl bg-neutral-100 p-3">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
          De tus tiros — no hace falta cargarlo
        </div>
        {sm ? (
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <Dato label="Score">
              {sm.score}
              {vsPar != null && (
                <span className="text-neutral-500 font-normal">
                  {" "}
                  ({vsPar === 0 ? "par" : vsPar > 0 ? `+${vsPar}` : vsPar})
                </span>
              )}
            </Dato>
            <Dato label="Penalidades">{sm.penaltyStrokes}</Dato>
            <Dato label="Enter SZ">{sm.strokesToEnterSz}</Dato>
            <Dato label="Inside SZ">{sm.strokesInsideSz}</Dato>
            <Dato label="Distancia REG">
              {sm.distanceInRegYds === 0 ? (
                <span className="text-green-700">GIR</span>
              ) : sm.distanceInRegYds != null ? (
                `${sm.distanceInRegYds} yd`
              ) : (
                "—"
              )}
            </Dato>
            <Dato label="Tiros">{shots.length}</Dato>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            Todavía no registraste tiros en este hoyo. Deslizá al mapa y usá “Registrar golpe”.
          </p>
        )}
      </section>

      <section className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            Putts (pasos, uno por putt)
          </span>
          {puttsFt.length > 0 && (
            <span className="text-[10px] text-neutral-500">
              {dPutts.putts} putt{dPutts.putts === 1 ? "" : "s"} · {dPutts.puttsInside1PuttCircle}{" "}
              dentro del círculo ({circlePasos} paso{circlePasos > 1 ? "s" : ""})
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2 mt-1">
          {puttsFt.map((ft, i) => (
            <div key={i} className="w-[64px]">
              <label className="text-[9px] uppercase text-neutral-500 flex justify-between">
                {i + 1}º
                <button
                  type="button"
                  aria-label={`Borrar putt ${i + 1}`}
                  onClick={() => commit(puttsFt.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </label>
              <input
                type="number"
                inputMode="numeric"
                className="gf-input text-center"
                value={draft[i] ?? String(Math.round(ft / 3))}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  setDraft((dd) => ({ ...dd, [i]: e.target.value }));
                  const n = parseInt(e.target.value);
                  const next = [...puttsFt];
                  next[i] = Number.isFinite(n) && n > 0 ? n * 3 : 0;
                  setPuttsFt(next);
                  tocado();
                }}
                onBlur={() =>
                  setDraft((dd) => {
                    const c = { ...dd };
                    delete c[i];
                    return c;
                  })
                }
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => commit([...puttsFt, 0])}
            className="gf-pill gf-pill-accent mb-1"
          >
            + putt
          </button>
        </div>
      </section>

      {otrosJugadores.length > 0 && (
        <section className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
            Golpes de los otros
          </div>
          <div className="flex flex-wrap gap-2">
            {otrosJugadores.map((p) => (
              <label key={p.id} className="text-xs">
                <span className="block text-neutral-500">{p.name}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="gf-input w-16 text-center"
                  value={otros[p.id] ?? ""}
                  onChange={(e) => {
                    setOtros((o) => ({ ...o, [p.id]: e.target.value }));
                    tocado();
                  }}
                />
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="mt-4">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
          DECADE · cierre del hoyo
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PINS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setPin(pin === p.key ? null : p.key);
                tocado();
              }}
              className={`rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 ${pin === p.key ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: p.dot }}
              />
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setRecovery(recovery ? null : true);
              tocado();
            }}
            className={`rounded-lg px-3 py-1.5 text-xs ${recovery ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
          >
            Recovery
          </button>
        </div>
      </section>

      <section className="mt-4">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Keys rotas</div>
        <div className="flex flex-wrap gap-1.5">
          {SM_KEYS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                setKeys((prev) =>
                  prev.includes(k.id)
                    ? prev.filter((x) => x !== k.id)
                    : [...prev, k.id].sort((a, b) => a - b),
                );
                tocado();
              }}
              className={`rounded-lg px-2 py-1.5 text-[11px] ${keys.includes(k.id) ? "bg-amber-500 text-white" : "bg-neutral-100"}`}
            >
              {k.id}. {k.short}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">
          <p>{error}</p>
          {dejarSalir && (
            <p className="mt-1 text-xs">
              Podés volver a intentar con Guardar, o salir igual —perdiendo lo que
              cargaste— tocando de nuevo el botón con el que quisiste salir.
            </p>
          )}
        </div>
      )}

      {/* Guardar y avanzar son DOS acciones separadas: antes "guardar" era la única
          forma de pasar de hoyo, y si volvías al mapa sin guardar quedabas trabado. */}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          disabled={busy || !modificado}
          onClick={() => void guardar()}
          className="flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-50"
          style={{ background: guardado ? "#16a34a" : "#4f46e5" }}
        >
          {guardado ? "Guardado ✓" : modificado ? "Guardar" : "Sin cambios"}
        </button>
        {(pendiente != null || siguiente) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void salirGuardando(onSiguiente)}
            className="flex-1 rounded-xl py-3 font-bold bg-neutral-900 text-white disabled:opacity-50"
          >
            Hoyo {pendiente ?? siguiente?.number} →
          </button>
        )}
      </div>
    </div>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="font-bold">{children}</div>
    </div>
  );
}
