"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";
import {
  COMBINE_ATTEMPTS,
  COMBINE_TESTS,
  playerTargets,
  scoreAttempts,
  type CombineTestType,
  type PlayerTargets,
} from "@/lib/combine";

type Player = {
  id: string;
  name: string;
  isMe: boolean;
  onePuttCircleFt: number;
  twoPuttCircleYds: number;
  enterSzYds: number;
};

const DRAFT_KEY = "combine-draft-v1";

function emptyAttempts(): Record<CombineTestType, boolean[]> {
  return Object.fromEntries(
    COMBINE_TESTS.map((t) => [t.type, Array(COMBINE_ATTEMPTS).fill(false)]),
  ) as Record<CombineTestType, boolean[]>;
}

export default function NuevoCombineClient() {
  const router = useRouter();
  const [targets, setTargets] = useState<PlayerTargets | null>(null);
  const [step, setStep] = useState(0); // 0..4 = tests, 5 = resumen/guardar
  const [attempts, setAttempts] = useState<Record<CombineTestType, boolean[]>>(emptyAttempts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restaurar un draft si quedó a mitad de camino (refresh, cierre de pestaña, etc).
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DRAFT_KEY) : null;
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { step: number; attempts: Record<CombineTestType, boolean[]> };
      if (draft?.attempts) {
        setStep(draft.step ?? 0);
        setAttempts(draft.attempts);
      }
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // Guardar el draft en cada cambio para no perder datos si se sale a mitad de camino.
  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, attempts }));
  }, [step, attempts]);

  useEffect(() => {
    fetch("/api/jugadores", { cache: "no-store" })
      .then((r) => r.json())
      .then((players: Player[]) => {
        const me = players.find((p) => p.isMe) ?? players[0];
        if (me) setTargets(playerTargets(me));
      });
  }, []);

  const test = COMBINE_TESTS[step];
  const isSummary = step === COMBINE_TESTS.length;

  function toggle(testType: CombineTestType, i: number) {
    setAttempts((prev) => ({
      ...prev,
      [testType]: prev[testType].map((v, j) => (j === i ? !v : v)),
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/combine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        results: COMBINE_TESTS.map((t) => ({ testType: t.type, attempts: attempts[t.type] })),
      }),
    });
    if (res.ok) {
      const { session } = await res.json();
      window.localStorage.removeItem(DRAFT_KEY);
      router.push(`/combine/${session.id}`);
    } else {
      setError("Error guardando el Combine");
      setSaving(false);
    }
  }

  function startOver() {
    window.localStorage.removeItem(DRAFT_KEY);
    setStep(0);
    setAttempts(emptyAttempts());
  }

  if (!targets) return <p className="text-sm text-[var(--muted)] px-1">Cargando...</p>;

  if (isSummary) {
    return (
      <div className="space-y-4">
        <SectionHeader>Resumen antes de guardar</SectionHeader>
        <div className="space-y-2">
          {COMBINE_TESTS.map((t) => (
            <Card key={t.type} className="!p-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--fairway)]">
                {t.icon} {t.label}
              </div>
              <div className="gf-display text-2xl text-[var(--ink)]">
                {scoreAttempts(attempts[t.type])}
                <span className="text-xs text-[var(--muted)] gf-mono"> /{COMBINE_ATTEMPTS}</span>
              </div>
            </Card>
          ))}
        </div>
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setStep(COMBINE_TESTS.length - 1)} className="gf-btn gf-btn-secondary flex-1 !text-sm">
            ← Volver
          </button>
          <button onClick={save} disabled={saving} className="gf-btn flex-1">
            {saving ? "Guardando..." : "💾 Guardar Combine"}
          </button>
        </div>
        <button onClick={startOver} className="text-xs text-[var(--muted)] underline w-full text-center">
          Empezar de nuevo
        </button>
      </div>
    );
  }

  const made = scoreAttempts(attempts[test.type]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {COMBINE_TESTS.map((t, i) => (
          <div
            key={t.type}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: i <= step ? "var(--fairway)" : "var(--border)" }}
          />
        ))}
      </div>

      <SectionHeader>
        Test {step + 1}/{COMBINE_TESTS.length} · {test.icon} {test.label}
      </SectionHeader>

      <Card className="!p-4 space-y-3">
        <p className="text-sm text-[var(--ink)]">{test.protocol}</p>
        <p className="text-xs text-[var(--muted)]">
          ✅ Éxito: {test.successCriteria(targets)}
        </p>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1">
            Intentos · tocá para marcar éxito
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {attempts[test.type].map((hit, i) => (
              <button
                key={i}
                onClick={() => toggle(test.type, i)}
                className="rounded-xl border py-3 text-center font-bold transition active:scale-95"
                style={
                  hit
                    ? { borderColor: "var(--green)", background: "var(--green-pale)", color: "var(--green)" }
                    : { borderColor: "var(--border)", color: "var(--muted)" }
                }
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center gf-display text-3xl text-[var(--ink)]">
          {made}
          <span className="text-sm text-[var(--muted)] gf-mono"> /{COMBINE_ATTEMPTS}</span>
        </div>
      </Card>

      <div className="flex gap-2">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="gf-btn gf-btn-secondary flex-1 !text-sm">
            ← Anterior
          </button>
        )}
        <button onClick={() => setStep((s) => s + 1)} className="gf-btn flex-1">
          {step === COMBINE_TESTS.length - 1 ? "Ver resumen →" : "Siguiente →"}
        </button>
      </div>
    </div>
  );
}
