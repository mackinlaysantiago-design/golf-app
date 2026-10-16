"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";
import {
  COMBINE_ATTEMPTS,
  COMBINE_TEST_META,
  COMBINE_TEST_ORDER,
  CHIPPING_MAX_PACES,
  LAG_PUTT_CIRCLE_FT,
  SHORT_PUTT_DISTANCE_FT,
  driverFairwayHalfWidthYds,
  lagPuttDistanceFt,
  scoreForTest,
  wedgeTargetYds,
  wedgeWindowYds,
  type ChipStrokes,
  type CombineTestType,
  type LagPuttOutcome,
} from "@/lib/combine";

type AttemptsState = {
  SHORT_PUTTS: boolean[];
  LAG_PUTTS: LagPuttOutcome[];
  CHIPPING: ChipStrokes[];
  WEDGES: { hits: boolean[]; customDistanceYds: number };
  DRIVER: { hits: boolean[]; carryYds: number };
};

const DRAFT_KEY = "combine-draft-v2";

function emptyAttempts(driverDefaultCarryYds: number): AttemptsState {
  return {
    SHORT_PUTTS: Array(COMBINE_ATTEMPTS).fill(false),
    LAG_PUTTS: Array(COMBINE_ATTEMPTS).fill("OUT") as LagPuttOutcome[],
    CHIPPING: Array(COMBINE_ATTEMPTS).fill(4) as ChipStrokes[],
    WEDGES: { hits: Array(COMBINE_ATTEMPTS).fill(false), customDistanceYds: 100 },
    DRIVER: { hits: Array(COMBINE_ATTEMPTS).fill(false), carryYds: driverDefaultCarryYds },
  };
}

function segBtnStyle(active: boolean) {
  return active
    ? { borderColor: "var(--green)", background: "var(--green-pale)", color: "var(--green)" }
    : { borderColor: "var(--border)", color: "var(--muted)" };
}

export default function NuevoCombineClient() {
  const router = useRouter();
  const [driverDefaultCarryYds, setDriverDefaultCarryYds] = useState(250);
  const [attempts, setAttempts] = useState<AttemptsState | null>(null);
  const [step, setStep] = useState(0); // 0..4 = tests, 5 = resumen/guardar
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill del carry del Driver con la mediana real de FlightScope, si hay.
  useEffect(() => {
    fetch("/api/range/dispersion", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { rows?: { club: string; carryP50: number }[] }) => {
        const driver = d.rows?.find((r) => r.club === "Driver");
        if (driver) setDriverDefaultCarryYds(Math.round(driver.carryP50));
      })
      .catch(() => {});
  }, []);

  // Restaurar un draft si quedó a mitad de camino; si no hay, arrancar con el
  // default de carry ya resuelto (o 250 mientras carga).
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DRAFT_KEY) : null;
    if (raw) {
      try {
        const draft = JSON.parse(raw) as { step: number; attempts: AttemptsState };
        if (draft?.attempts) {
          setStep(draft.step ?? 0);
          setAttempts(draft.attempts);
          return;
        }
      } catch {
        window.localStorage.removeItem(DRAFT_KEY);
      }
    }
    setAttempts(emptyAttempts(driverDefaultCarryYds));
    // Solo al montar / cuando todavía no hay draft propio — no pisar lo que ya tocó el usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (attempts) window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, attempts }));
  }, [step, attempts]);

  if (!attempts) return <p className="text-sm text-[var(--muted)] px-1">Cargando...</p>;

  const testType = COMBINE_TEST_ORDER[step];
  const isSummary = step === COMBINE_TEST_ORDER.length;
  const meta = !isSummary ? COMBINE_TEST_META[testType] : null;

  function buildPayload(a: AttemptsState) {
    return COMBINE_TEST_ORDER.map((t) => {
      switch (t) {
        case "SHORT_PUTTS":
          return { testType: t, data: { hits: a.SHORT_PUTTS } };
        case "LAG_PUTTS":
          return { testType: t, data: { outcomes: a.LAG_PUTTS } };
        case "CHIPPING":
          return { testType: t, data: { strokes: a.CHIPPING } };
        case "WEDGES":
          return { testType: t, data: a.WEDGES };
        case "DRIVER":
          return { testType: t, data: a.DRIVER };
      }
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/combine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: buildPayload(attempts!) }),
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
    setAttempts(emptyAttempts(driverDefaultCarryYds));
  }

  if (isSummary) {
    const scores: Record<CombineTestType, number> = {
      SHORT_PUTTS: scoreForTest("SHORT_PUTTS", { hits: attempts.SHORT_PUTTS }),
      LAG_PUTTS: scoreForTest("LAG_PUTTS", { outcomes: attempts.LAG_PUTTS }),
      CHIPPING: scoreForTest("CHIPPING", { strokes: attempts.CHIPPING }),
      WEDGES: scoreForTest("WEDGES", attempts.WEDGES),
      DRIVER: scoreForTest("DRIVER", attempts.DRIVER),
    };
    return (
      <div className="space-y-4">
        <SectionHeader>Resumen antes de guardar</SectionHeader>
        <div className="space-y-2">
          {COMBINE_TEST_ORDER.map((t) => (
            <Card key={t} className="!p-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--fairway)]">
                {COMBINE_TEST_META[t].icon} {COMBINE_TEST_META[t].label}
              </div>
              <div className="gf-display text-2xl text-[var(--ink)]">{scores[t]}</div>
            </Card>
          ))}
        </div>
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setStep(COMBINE_TEST_ORDER.length - 1)} className="gf-btn gf-btn-secondary flex-1 !text-sm">
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

  const score =
    testType === "SHORT_PUTTS"
      ? scoreForTest("SHORT_PUTTS", { hits: attempts.SHORT_PUTTS })
      : testType === "LAG_PUTTS"
      ? scoreForTest("LAG_PUTTS", { outcomes: attempts.LAG_PUTTS })
      : testType === "CHIPPING"
      ? scoreForTest("CHIPPING", { strokes: attempts.CHIPPING })
      : testType === "WEDGES"
      ? scoreForTest("WEDGES", attempts.WEDGES)
      : scoreForTest("DRIVER", attempts.DRIVER);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {COMBINE_TEST_ORDER.map((t, i) => (
          <div
            key={t}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: i <= step ? "var(--fairway)" : "var(--border)" }}
          />
        ))}
      </div>

      <SectionHeader>
        Test {step + 1}/{COMBINE_TEST_ORDER.length} · {meta!.icon} {meta!.label}
      </SectionHeader>

      <Card className="!p-4 space-y-3">
        <p className="text-sm text-[var(--ink)]">{meta!.setup}</p>

        {testType === "SHORT_PUTTS" && (
          <ShortPuttsStep
            hits={attempts.SHORT_PUTTS}
            onChange={(hits) => setAttempts({ ...attempts, SHORT_PUTTS: hits })}
          />
        )}
        {testType === "LAG_PUTTS" && (
          <LagPuttsStep
            outcomes={attempts.LAG_PUTTS}
            onChange={(outcomes) => setAttempts({ ...attempts, LAG_PUTTS: outcomes })}
          />
        )}
        {testType === "CHIPPING" && (
          <ChippingStep
            strokes={attempts.CHIPPING}
            onChange={(strokes) => setAttempts({ ...attempts, CHIPPING: strokes })}
          />
        )}
        {testType === "WEDGES" && (
          <WedgesStep
            data={attempts.WEDGES}
            onChange={(data) => setAttempts({ ...attempts, WEDGES: data })}
          />
        )}
        {testType === "DRIVER" && (
          <DriverStep
            data={attempts.DRIVER}
            onChange={(data) => setAttempts({ ...attempts, DRIVER: data })}
          />
        )}

        <div className="text-center gf-display text-3xl text-[var(--ink)]">{score}</div>
      </Card>

      <div className="flex gap-2">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="gf-btn gf-btn-secondary flex-1 !text-sm">
            ← Anterior
          </button>
        )}
        <button onClick={() => setStep((s) => s + 1)} className="gf-btn flex-1">
          {step === COMBINE_TEST_ORDER.length - 1 ? "Ver resumen →" : "Siguiente →"}
        </button>
      </div>
    </div>
  );
}

function ShortPuttsStep({
  hits,
  onChange,
}: {
  hits: boolean[];
  onChange: (hits: boolean[]) => void;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)] mb-2">
        ✅ Éxito: embocar desde {SHORT_PUTT_DISTANCE_FT} ft
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {hits.map((hit, i) => (
          <button
            key={i}
            onClick={() => onChange(hits.map((v, j) => (j === i ? !v : v)))}
            className="rounded-xl border py-3 text-center font-bold transition active:scale-95"
            style={segBtnStyle(hit)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function LagPuttsStep({
  outcomes,
  onChange,
}: {
  outcomes: LagPuttOutcome[];
  onChange: (outcomes: LagPuttOutcome[]) => void;
}) {
  const OPTS: { v: LagPuttOutcome; label: string }[] = [
    { v: "HOLED", label: "Embocó (2)" },
    { v: "CIRCLE", label: `Círculo ${LAG_PUTT_CIRCLE_FT}ft (1)` },
    { v: "OUT", label: "Afuera (0)" },
  ];
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--muted)]">✅ Target: círculo de {LAG_PUTT_CIRCLE_FT} ft</p>
      {outcomes.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] w-16 text-[var(--muted)] gf-mono">
            #{i + 1} · {lagPuttDistanceFt(i)}ft
          </span>
          <div className="flex gap-1 flex-1">
            {OPTS.map((opt) => (
              <button
                key={opt.v}
                onClick={() => onChange(outcomes.map((v, j) => (j === i ? opt.v : v)))}
                className="flex-1 rounded-lg border py-1.5 text-[10px] font-semibold transition active:scale-95"
                style={segBtnStyle(o === opt.v)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChippingStep({
  strokes,
  onChange,
}: {
  strokes: ChipStrokes[];
  onChange: (strokes: ChipStrokes[]) => void;
}) {
  const OPTS: { v: ChipStrokes; label: string }[] = [
    { v: 1, label: "Chip-in (2)" },
    { v: 2, label: "2 (1)" },
    { v: 3, label: "3 (0.5)" },
    { v: 4, label: "4+ (0)" },
  ];
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--muted)]">
        ✅ Adentro de {CHIPPING_MAX_PACES} pasos — jugá cada chip hasta embocar
      </p>
      {strokes.map((n, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] w-8 text-[var(--muted)] gf-mono">#{i + 1}</span>
          <div className="flex gap-1 flex-1">
            {OPTS.map((opt) => (
              <button
                key={opt.v}
                onClick={() => onChange(strokes.map((v, j) => (j === i ? opt.v : v)))}
                className="flex-1 rounded-lg border py-1.5 text-[10px] font-semibold transition active:scale-95"
                style={segBtnStyle(n === opt.v)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WedgesStep({
  data,
  onChange,
}: {
  data: { hits: boolean[]; customDistanceYds: number };
  onChange: (data: { hits: boolean[]; customDistanceYds: number }) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
        Distancia del shot 10 (yds)
        <input
          type="number"
          value={data.customDistanceYds}
          onChange={(e) =>
            onChange({ ...data, customDistanceYds: parseInt(e.target.value) || 0 })
          }
          className="gf-input !w-20 !py-1 text-sm"
        />
      </label>
      <div className="grid grid-cols-5 gap-1.5">
        {data.hits.map((hit, i) => {
          const target = wedgeTargetYds(i, data.customDistanceYds);
          const window = wedgeWindowYds(target);
          return (
            <button
              key={i}
              onClick={() => onChange({ ...data, hits: data.hits.map((v, j) => (j === i ? !v : v)) })}
              className="rounded-xl border py-2 text-center transition active:scale-95"
              style={segBtnStyle(hit)}
              title={`Target ${target}yds ±${window.toFixed(1)}`}
            >
              <div className="font-bold">{i + 1}</div>
              <div className="text-[9px] gf-mono">{target}y</div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-[var(--muted)]">
        ✅ Éxito: adentro del 10% de la distancia target
      </p>
    </div>
  );
}

function DriverStep({
  data,
  onChange,
}: {
  data: { hits: boolean[]; carryYds: number };
  onChange: (data: { hits: boolean[]; carryYds: number }) => void;
}) {
  const halfWidth = driverFairwayHalfWidthYds(data.carryYds);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
        Tu carry real (yds)
        <input
          type="number"
          value={data.carryYds}
          onChange={(e) => onChange({ ...data, carryYds: parseInt(e.target.value) || 0 })}
          className="gf-input !w-20 !py-1 text-sm"
        />
      </label>
      <p className="text-[11px] text-[var(--muted)]">
        ✅ Fairway: ±{halfWidth.toFixed(0)} yds del centro de la línea
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {data.hits.map((hit, i) => (
          <button
            key={i}
            onClick={() => onChange({ ...data, hits: data.hits.map((v, j) => (j === i ? !v : v)) })}
            className="rounded-xl border py-3 text-center font-bold transition active:scale-95"
            style={segBtnStyle(hit)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
