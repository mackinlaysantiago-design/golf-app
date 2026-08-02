"use client";

// Hoja de cierre de hoyo: sale al pasar al siguiente y pide SOLO lo que no se puede
// derivar de los tiros. Tu score, las penalidades y el "apunté al centro" salen solos
// de la secuencia de tiros — acá quedan los putts (que el GPS no puede medir: a dos
// pasos del hoyo el error del teléfono es más grande que el putt), los golpes de los
// otros jugadores y las keys.

import { useState } from "react";
import type { PlayerLite, RoundMapa } from "./MapaTracker";
import { SM_KEYS } from "@/lib/sm-keys";
import { derivePutts } from "@/lib/putts-derive";

export type CierreState = {
  hole: number;
  roundHoleId: string | null;
  golpesMios: number;
  /** Tiros marcados como penalización: suman un golpe extra cada uno. */
  penalidadesMias: number;
  siguiente: number;
};

export default function CierreHoyo({
  round,
  state,
  onDone,
  onCancel,
}: {
  round: RoundMapa;
  state: CierreState;
  onDone: (siguiente: number, cerrado: number) => void;
  onCancel: () => void;
}) {
  const [puttsFt, setPuttsFt] = useState<number[]>([]);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [keys, setKeys] = useState<number[]>([]);
  const [otros, setOtros] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const otrosJugadores = round.players.filter((p) => !p.isMe);
  const d = derivePutts(puttsFt, round.onePuttCircleFt);
  const circlePasos = Math.max(1, Math.round(round.onePuttCircleFt / 3));
  // Misma cuenta que deriveSmFromShots en el server. Si acá mostrara otra cosa, te
  // confirmaría un score y guardaría otro.
  const miScore = state.golpesMios + puttsFt.length + state.penalidadesMias;

  const commit = (next: number[]) => {
    setDraft({});
    setPuttsFt(next);
  };

  async function guardar() {
    setBusy(true);
    try {
      const entries: Record<string, unknown>[] = [
        {
          roundPlayerId: round.meRoundPlayerId,
          holeNumber: state.hole,
          // El server lo recalcula desde los tiros (deriveSmFromShots) y esa cuenta
          // manda; esto va igual para que el hoyo quede completo si los tiros se
          // borraran después.
          score: miScore,
          puttDistancesFt: puttsFt,
          keysBroken: keys.length ? keys : null,
        },
      ];
      for (const p of otrosJugadores) {
        const v = otros[p.id];
        if (v == null || v === "") continue;
        entries.push({
          roundPlayerId: playerRoundPlayerId(p),
          holeNumber: state.hole,
          score: parseInt(v),
        });
      }
      await fetch(`/api/rondas/${round.id}/hoyos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      onDone(state.siguiente, state.hole);
    } finally {
      setBusy(false);
    }
  }

  // Los otros jugadores llegan con su roundPlayerId como id (ver la page).
  function playerRoundPlayerId(p: PlayerLite) {
    return p.id;
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Cerrás el hoyo {state.hole}</h2>
          <button type="button" onClick={onCancel} className="text-neutral-400 text-xl px-2">
            ×
          </button>
        </div>

        <div className="space-y-4">
          <section>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Golpes</div>
            <div className="text-sm mb-2">
              Vos: <b>{miScore}</b>{" "}
              <span className="text-neutral-500">
                ({state.golpesMios} tiro{state.golpesMios === 1 ? "" : "s"} + {puttsFt.length} putt
                {puttsFt.length === 1 ? "" : "s"}
                {state.penalidadesMias > 0
                  ? ` + ${state.penalidadesMias} penalidad${state.penalidadesMias === 1 ? "" : "es"}`
                  : ""}
                )
              </span>
            </div>
            {otrosJugadores.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {otrosJugadores.map((p) => (
                  <label key={p.id} className="text-xs">
                    <span className="block text-neutral-500">{p.name}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="gf-input w-16 text-center"
                      value={otros[p.id] ?? ""}
                      onChange={(e) => setOtros((o) => ({ ...o, [p.id]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                Putts (pasos, uno por putt)
              </span>
              {puttsFt.length > 0 && (
                <span className="text-[10px] text-neutral-500">
                  {d.putts} putt{d.putts === 1 ? "" : "s"} · {d.puttsInside1PuttCircle} dentro del
                  círculo ({circlePasos} paso{circlePasos > 1 ? "s" : ""})
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

          <section>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
              Keys rotas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SM_KEYS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() =>
                    setKeys((prev) =>
                      prev.includes(k.id) ? prev.filter((x) => x !== k.id) : [...prev, k.id].sort((a, b) => a - b),
                    )
                  }
                  className={`rounded-lg px-2 py-1.5 text-[11px] ${keys.includes(k.id) ? "bg-amber-500 text-white" : "bg-neutral-100"}`}
                >
                  {k.id}. {k.short}
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            disabled={busy}
            onClick={() => void guardar()}
            className="w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
            style={{ background: "#4f46e5" }}
          >
            Guardar y seguir →
          </button>
        </div>
      </div>
    </div>
  );
}
