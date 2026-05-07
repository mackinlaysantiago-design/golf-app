"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";

export default function IdentidadEditor({
  playerId,
  initial,
}: {
  playerId: string;
  initial: {
    limitingBelief: string | null;
    empoweringBelief: string | null;
    admiredGolfer: string | null;
    beDoHave: string | null;
    preShotRoutine: string | null;
    postShotRoutine: string | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [limitingBelief, setLimitingBelief] = useState(initial.limitingBelief ?? "");
  const [empoweringBelief, setEmpoweringBelief] = useState(initial.empoweringBelief ?? "");
  const [admiredGolfer, setAdmiredGolfer] = useState(initial.admiredGolfer ?? "");
  const [beDoHave, setBeDoHave] = useState(initial.beDoHave ?? "");
  const [preShotRoutine, setPreShotRoutine] = useState(initial.preShotRoutine ?? "");
  const [postShotRoutine, setPostShotRoutine] = useState(initial.postShotRoutine ?? "");

  const isConfigured = !!(
    limitingBelief ||
    empoweringBelief ||
    admiredGolfer ||
    beDoHave ||
    preShotRoutine ||
    postShotRoutine
  );

  async function save() {
    setBusy(true);
    setSaved(false);
    const res = await fetch(`/api/jugadores/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limitingBelief: limitingBelief.trim() || null,
        empoweringBelief: empoweringBelief.trim() || null,
        admiredGolfer: admiredGolfer.trim() || null,
        beDoHave: beDoHave.trim() || null,
        preShotRoutine: preShotRoutine.trim() || null,
        postShotRoutine: postShotRoutine.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } else {
      alert("Error guardando");
    }
  }

  if (!open) {
    return (
      <Card
        className="!p-3"
        style={{ borderLeft: "4px solid var(--accent)" }}
      >
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left"
        >
          <div className="font-semibold flex items-center gap-2">
            🧠 Identidad y rutinas mentales
            {isConfigured && (
              <span className="gf-pill text-[10px] gf-pill-accent">configurado</span>
            )}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Tu historia, tu modelo, tus rutinas pre/post-shot. Mental Mastery del SM.
          </div>
        </button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3" style={{ borderLeft: "4px solid var(--accent)" }}>
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">🧠 Identidad y rutinas</h3>
        <button onClick={() => setOpen(false)} className="text-xl px-2">✕</button>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Tu historia
        </div>
        <div>
          <label className="text-[11px] text-[var(--muted)]">
            Historia limitante actual
          </label>
          <textarea
            className="gf-input mt-0.5"
            rows={2}
            placeholder='ej: "Siempre que estoy ganando me derrumbo en los últimos 3 hoyos"'
            value={limitingBelief}
            onChange={(e) => setLimitingBelief(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] text-[var(--muted)]">
            Historia opuesta (la que querés contarte)
          </label>
          <textarea
            className="gf-input mt-0.5"
            rows={2}
            placeholder='ej: "Cierro mejor que nadie, los últimos hoyos son mi fuerte"'
            value={empoweringBelief}
            onChange={(e) => setEmpoweringBelief(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-[var(--green-pale)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Be / Do / Have (modelado)
        </div>
        <div>
          <label className="text-[11px] text-[var(--muted)]">
            Golfista que admirás
          </label>
          <input
            className="gf-input mt-0.5"
            placeholder="ej: Tiger Woods, un amigo, un pro de tu club"
            value={admiredGolfer}
            onChange={(e) => setAdmiredGolfer(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] text-[var(--muted)]">
            ¿Qué ES, HACE y TIENE? ¿Cómo empezás a serlo?
          </label>
          <textarea
            className="gf-input mt-0.5"
            rows={3}
            placeholder='Be: tranquilo, confiado / Do: pre-shot routine, comprometido / Have: sub-80 / Cómo: practicar como él, prepararse así, etc.'
            value={beDoHave}
            onChange={(e) => setBeDoHave(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-[var(--green-pale)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Rutinas
        </div>
        <div>
          <label className="text-[11px] text-[var(--muted)]">
            Rutina pre-shot (10/10 commitment)
          </label>
          <textarea
            className="gf-input mt-0.5"
            rows={2}
            placeholder="Lie, target, yardage, palo, visualización, sentimiento, ensayo, compromiso"
            value={preShotRoutine}
            onChange={(e) => setPreShotRoutine(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] text-[var(--muted)]">
            Rutina post-shot
          </label>
          <textarea
            className="gf-input mt-0.5"
            rows={2}
            placeholder="Aceptar resultado en 10s, foco en el próximo, no cargado"
            value={postShotRoutine}
            onChange={(e) => setPostShotRoutine(e.target.value)}
          />
        </div>
      </div>

      <button onClick={save} disabled={busy} className="gf-btn w-full">
        {saved ? "✓ Guardado" : busy ? "Guardando..." : "Guardar"}
      </button>
    </Card>
  );
}
