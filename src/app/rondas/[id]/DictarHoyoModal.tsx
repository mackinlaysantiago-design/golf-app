"use client";

// Dictado de hoyo completo por voz: graba, manda a /api/rondas/[id]/hoyos/voice
// (Gemini transcribe + interpreta), y muestra lo entendido EDITABLE antes de
// aplicarlo al hoyo — no autoguarda. Aplicar solo llena el estado local del
// tracker; el guardado real sigue siendo el botón "💾 Guardar" de siempre.

import { useRef, useState } from "react";
import type { ParsedHole } from "@/lib/gemini-hole";
import { SM_KEYS } from "@/lib/sm-keys";

type Phase = "idle" | "recording" | "sending" | "preview" | "error";

export default function DictarHoyoModal({
  roundId,
  holeNumber,
  par,
  enterSzYds,
  onApply,
  onClose,
}: {
  roundId: string;
  holeNumber: number;
  par: number;
  enterSzYds: number;
  onApply: (parsed: ParsedHole) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<ParsedHole | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setErrMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void sendAudio(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      };
      recorderRef.current = rec;
      rec.start();
      setPhase("recording");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "no pude acceder al micrófono");
      setPhase("error");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setPhase("sending");
  }

  async function sendAudio(blob: Blob) {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "hoyo.webm");
      fd.append("holeNumber", String(holeNumber));
      fd.append("par", String(par));
      fd.append("enterSzYds", String(enterSzYds));
      const res = await fetch(`/api/rondas/${roundId}/hoyos/voice`, {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as { parsed?: ParsedHole; error?: string };
      if (!res.ok || !json.parsed) throw new Error(json.error || "error en el servidor");
      setDraft(json.parsed);
      setPhase("preview");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "error enviando el audio");
      setPhase("error");
    }
  }

  function patch(fields: Partial<ParsedHole>) {
    setDraft((d) => (d ? { ...d, ...fields } : d));
  }

  function toggleKey(id: number) {
    setDraft((d) => {
      if (!d) return d;
      const cur = d.keysBroken ?? [];
      const next = cur.includes(id) ? cur.filter((k) => k !== id) : [...cur, id].sort((a, b) => a - b);
      return { ...d, keysBroken: next.length ? next : null };
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-2xl bg-white p-4 space-y-3 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold">🎙 Dictar hoyo {holeNumber}</h3>
          <button type="button" onClick={onClose} className="text-xl leading-none px-1">
            ×
          </button>
        </div>

        {(phase === "idle" || phase === "error") && (
          <>
            <p className="text-xs text-[var(--muted)]">
              Contá cómo te fue: score, putts, penalidades, si entraste a la scoring zone, la
              bandera, si apuntaste al centro, si jugaste de recovery, y las keys que rompiste.
            </p>
            <button type="button" onClick={() => void startRecording()} className="gf-btn w-full">
              ● Grabar
            </button>
            {errMsg && <p className="text-xs" style={{ color: "var(--red)" }}>{errMsg}</p>}
          </>
        )}

        {phase === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="gf-btn w-full"
            style={{ background: "var(--red)" }}
          >
            ■ Detener
          </button>
        )}

        {phase === "sending" && (
          <p className="text-sm text-center py-4">Escuchando…</p>
        )}

        {phase === "preview" && draft && (
          <>
            <p className="text-xs italic text-[var(--muted)]">“{draft.transcript}”</p>

            <div className="grid grid-cols-2 gap-2">
              <NumField label="Score" value={draft.score} onChange={(v) => patch({ score: v })} />
              <NumField label="Putts" value={draft.putts} onChange={(v) => patch({ putts: v })} />
              <NumField
                label="Penalidades"
                value={draft.penaltyStrokes}
                onChange={(v) => patch({ penaltyStrokes: v })}
              />
              <NumField
                label="Enter SZ"
                value={draft.strokesToEnterSz}
                onChange={(v) => patch({ strokesToEnterSz: v })}
              />
              <NumField
                label="Inside SZ"
                value={draft.strokesInsideSz}
                onChange={(v) => patch({ strokesInsideSz: v })}
              />
              <NumField
                label="Distancia REG (yd)"
                value={draft.distanceInRegYds}
                onChange={(v) => patch({ distanceInRegYds: v })}
              />
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                Bandera
              </div>
              <div className="flex gap-1.5">
                {(["GREEN", "YELLOW", "RED"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ pinColor: draft.pinColor === c ? null : c })}
                    className={`rounded-lg px-3 py-1.5 text-xs ${draft.pinColor === c ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
                  >
                    {c === "GREEN" ? "Centro" : c === "YELLOW" ? "Borde" : "Trampa"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                Peligro / decisión
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["L", "R", "NONE"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => patch({ dangerSide: draft.dangerSide === d ? null : d })}
                    className={`rounded-lg px-3 py-1.5 text-xs ${draft.dangerSide === d ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
                  >
                    {d === "L" ? "Peligro izq" : d === "R" ? "Peligro der" : "Sin peligro"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => patch({ aimedAtCenter: draft.aimedAtCenter ? null : true })}
                  className={`rounded-lg px-3 py-1.5 text-xs ${draft.aimedAtCenter ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
                >
                  Apuntó al centro
                </button>
                <button
                  type="button"
                  onClick={() => patch({ recoveryMode: draft.recoveryMode ? null : true })}
                  className={`rounded-lg px-3 py-1.5 text-xs ${draft.recoveryMode ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
                >
                  Recovery
                </button>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                Keys rotas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SM_KEYS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => toggleKey(k.id)}
                    className={`rounded-lg px-2 py-1.5 text-[11px] ${
                      draft.keysBroken?.includes(k.id) ? "bg-amber-500 text-white" : "bg-neutral-100"
                    }`}
                  >
                    {k.id}. {k.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setPhase("idle");
                }}
                className="gf-btn gf-btn-secondary"
              >
                Grabar de nuevo
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(draft);
                  onClose();
                }}
                className="gf-btn"
              >
                Aplicar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="text-xs">
      <span className="block text-[10px] uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        className="gf-input w-full text-center"
        value={value ?? ""}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const n = e.target.value === "" ? null : parseInt(e.target.value);
          onChange(Number.isFinite(n as number) ? n : null);
        }}
      />
    </label>
  );
}
