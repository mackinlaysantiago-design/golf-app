"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader } from "@/components/ui/Card";
import {
  COMBINE_ATTEMPTS,
  COMBINE_INTRO,
  COMBINE_LESSON_URL,
  COMBINE_TEST_ORDER,
  DRIVER_YARDS_DEFAULT,
  DRIVER_YARDS_MAX,
  DRIVER_YARDS_MIN,
  DRIVER_YARDS_STEP,
  LAG_FEET,
  WEDGE_ROUND,
  driverIntro,
  fairwayHalfWidth,
  scoreForTest,
  wedgeTargetYds,
  type ChipStrokes,
  type CombineTestType,
  type IntroCopy,
  type LagPuttOutcome,
} from "@/lib/combine";

type AttemptsState = {
  SHORT_PUTTS: boolean[];
  LAG_PUTTS: LagPuttOutcome[];
  CHIPPING: ChipStrokes[];
  WEDGES: { hits: boolean[]; shot10Distance: 50 | 75 | 100 };
  DRIVER: { hits: boolean[]; carryYds: number };
};

const DRAFT_KEY = "combine-draft-v3";
const DRIVER_YARDS_KEY = "combine-driver-yards";

function emptyAttempts(driverCarryYds: number): AttemptsState {
  return {
    SHORT_PUTTS: Array(COMBINE_ATTEMPTS).fill(false),
    LAG_PUTTS: Array(COMBINE_ATTEMPTS).fill("OUTSIDE") as LagPuttOutcome[],
    CHIPPING: Array(COMBINE_ATTEMPTS).fill(4) as ChipStrokes[],
    WEDGES: { hits: Array(COMBINE_ATTEMPTS).fill(false), shot10Distance: 100 },
    DRIVER: { hits: Array(COMBINE_ATTEMPTS).fill(false), carryYds: driverCarryYds },
  };
}

function segStyle(active: boolean) {
  return active
    ? { borderColor: "var(--green)", background: "var(--green-pale)", color: "var(--green)" }
    : { borderColor: "var(--border)", color: "var(--muted)" };
}

// Tarjeta "Setup / Play o Target / Score" — mismo layout que CombineIntro de TSM
// Caddie (tsmcaddie.com), con link a la lección de Circle.
function IntroCard({ test, intro }: { test: CombineTestType; intro: IntroCopy }) {
  return (
    <Card className="!p-4 space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1">Setup</div>
        <p className="text-sm text-[var(--ink)]">{intro.setup}</p>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1">
          {intro.secondLabel}
        </div>
        <p className="text-sm text-[var(--ink)]">{intro.second}</p>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1">Score</div>
        <div className="flex flex-wrap gap-2">
          {intro.score.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 rounded-full bg-[var(--green-pale)] pl-1 pr-2.5 py-1">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--fairway)] text-white text-[11px] font-bold">
                {s.points}
              </span>
              <span className="text-[11px] text-[var(--fairway)] font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <a
        href={COMBINE_LESSON_URL[test]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-[var(--accent)] underline"
      >
        Watch the lesson ↗
      </a>
    </Card>
  );
}

export default function NuevoCombineClient() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<AttemptsState | null>(null);
  const [step, setStep] = useState(0); // 0..4 = tests, 5 = resumen/guardar
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedDriverYds = Number(window.localStorage.getItem(DRIVER_YARDS_KEY)) || DRIVER_YARDS_DEFAULT;
    const raw = window.localStorage.getItem(DRAFT_KEY);
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
    setAttempts(emptyAttempts(savedDriverYds));
  }, []);

  useEffect(() => {
    if (attempts) window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, attempts }));
  }, [step, attempts]);

  if (!attempts) return <p className="text-sm text-[var(--muted)] px-1">Cargando...</p>;

  const testType = COMBINE_TEST_ORDER[step];
  const isSummary = step === COMBINE_TEST_ORDER.length;

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
    window.localStorage.setItem(DRIVER_YARDS_KEY, String(attempts!.DRIVER.carryYds));
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
    const savedDriverYds = Number(window.localStorage.getItem(DRIVER_YARDS_KEY)) || DRIVER_YARDS_DEFAULT;
    setAttempts(emptyAttempts(savedDriverYds));
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
              <div className="text-sm font-semibold text-[var(--fairway)]">{COMBINE_INTRO[t].label}</div>
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

  const intro =
    testType === "DRIVER" ? driverIntro(attempts.DRIVER.carryYds) : COMBINE_INTRO[testType];

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
        Test {step + 1}/{COMBINE_TEST_ORDER.length} · {intro.label}
      </SectionHeader>

      <IntroCard test={testType} intro={intro} />

      <Card className="!p-4 space-y-3">
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

function ShortPuttsStep({ hits, onChange }: { hits: boolean[]; onChange: (hits: boolean[]) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {hits.map((hit, i) => (
        <button
          key={i}
          onClick={() => onChange(hits.map((v, j) => (j === i ? !v : v)))}
          className="rounded-xl border py-3 text-center font-bold transition active:scale-95"
          style={segStyle(hit)}
        >
          {i + 1}
        </button>
      ))}
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
    { v: "HOLED", label: "Embocó" },
    { v: "INSIDE", label: "Adentro" },
    { v: "OUTSIDE", label: "Afuera" },
  ];
  return (
    <div className="space-y-2">
      {outcomes.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] w-14 text-[var(--muted)] gf-mono">
            #{i + 1} · {LAG_FEET[i]}ft
          </span>
          <div className="flex gap-1 flex-1">
            {OPTS.map((opt) => (
              <button
                key={opt.v}
                onClick={() => onChange(outcomes.map((v, j) => (j === i ? opt.v : v)))}
                className="flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition active:scale-95"
                style={segStyle(o === opt.v)}
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
    { v: 1, label: "Chip-in" },
    { v: 2, label: "2" },
    { v: 3, label: "3" },
    { v: 4, label: "4+" },
  ];
  return (
    <div className="space-y-2">
      {strokes.map((n, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] w-8 text-[var(--muted)] gf-mono">#{i + 1}</span>
          <div className="flex gap-1 flex-1">
            {OPTS.map((opt) => (
              <button
                key={opt.v}
                onClick={() => onChange(strokes.map((v, j) => (j === i ? opt.v : v)))}
                className="flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition active:scale-95"
                style={segStyle(n === opt.v)}
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
  data: { hits: boolean[]; shot10Distance: 50 | 75 | 100 };
  onChange: (data: { hits: boolean[]; shot10Distance: 50 | 75 | 100 }) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted)]">Shot 10 — tu elección:</span>
        <div className="flex gap-1">
          {WEDGE_ROUND.map((d) => (
            <button
              key={d}
              onClick={() => onChange({ ...data, shot10Distance: d as 50 | 75 | 100 })}
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
              style={segStyle(data.shot10Distance === d)}
            >
              {d}y
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {data.hits.map((hit, i) => (
          <button
            key={i}
            onClick={() => onChange({ ...data, hits: data.hits.map((v, j) => (j === i ? !v : v)) })}
            className="rounded-xl border py-2 text-center transition active:scale-95"
            style={segStyle(hit)}
          >
            <div className="font-bold">{i + 1}</div>
            <div className="text-[9px] gf-mono">{wedgeTargetYds(i, data.shot10Distance)}y</div>
          </button>
        ))}
      </div>
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
  const half = fairwayHalfWidth(data.carryYds);
  function step(delta: number) {
    const next = Math.max(DRIVER_YARDS_MIN, Math.min(DRIVER_YARDS_MAX, data.carryYds + delta));
    onChange({ ...data, carryYds: next });
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--muted)]">Tu distancia de driver</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => step(-DRIVER_YARDS_STEP)}
            disabled={data.carryYds <= DRIVER_YARDS_MIN}
            className="w-8 h-8 rounded-full border text-lg flex items-center justify-center disabled:opacity-30"
            style={{ borderColor: "var(--border)", color: "var(--fairway)" }}
          >
            −
          </button>
          <span className="gf-display text-xl w-14 text-center">{data.carryYds}</span>
          <button
            onClick={() => step(DRIVER_YARDS_STEP)}
            disabled={data.carryYds >= DRIVER_YARDS_MAX}
            className="w-8 h-8 rounded-full border text-lg flex items-center justify-center disabled:opacity-30"
            style={{ borderColor: "var(--border)", color: "var(--fairway)" }}
          >
            +
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[var(--muted)]">Fairway: ±{half} yds · se guarda para la próxima</p>
      <div className="grid grid-cols-5 gap-1.5">
        {data.hits.map((hit, i) => (
          <button
            key={i}
            onClick={() => onChange({ ...data, hits: data.hits.map((v, j) => (j === i ? !v : v)) })}
            className="rounded-xl border py-3 text-center font-bold transition active:scale-95"
            style={segStyle(hit)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
