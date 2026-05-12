"use client";

/**
 * Cliente del Round Assessment Card.
 *
 * - Mantiene el state local de los campos editables (texts, %, booleans).
 * - El componente visual <OfficialAssessmentCard> recibe la data merged.
 * - Edición vía panel lateral (no inline en el card, para que el card quede
 *   limpio para descarga PNG).
 * - Botón "Descargar PNG" usa html2canvas-pro sobre el ref del card.
 * - Botón "Guardar" hace POST al endpoint /api/rondas/[id]/assessment.
 */

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { OfficialAssessmentCard } from "@/components/round-assessment-card/OfficialCard";
import type { AssessmentCardData } from "@/lib/round-assessment";

type EditableFields = Pick<
  AssessmentCardData,
  | "practiceRound"
  | "yardageBook"
  | "writtenPlan"
  | "personalParDefined"
  | "warmUp"
  | "mentalFocus"
  | "bestPartOfRound"
  | "mentalStrengthPct"
  | "positiveSelfTalkPct"
  | "fortitudePct"
  | "shotSelectionPct"
  | "shotExecutionPct"
  | "skillUnder10Putts"
  | "skillLagPutts"
  | "skillChippingProx"
  | "skillWedgesProx"
  | "skillBallStriking"
  | "skillGoToClub"
  | "lessonsLearned"
>;

export default function CardClient({
  roundId,
  initialData,
}: {
  roundId: string;
  initialData: AssessmentCardData;
}) {
  const [data, setData] = useState<AssessmentCardData>(initialData);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  function patch<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    setSaveStatus("idle");
    const editable: Partial<EditableFields> = {
      practiceRound: data.practiceRound,
      yardageBook: data.yardageBook,
      writtenPlan: data.writtenPlan,
      personalParDefined: data.personalParDefined,
      warmUp: data.warmUp,
      mentalFocus: data.mentalFocus,
      bestPartOfRound: data.bestPartOfRound,
      mentalStrengthPct: data.mentalStrengthPct,
      positiveSelfTalkPct: data.positiveSelfTalkPct,
      fortitudePct: data.fortitudePct,
      shotSelectionPct: data.shotSelectionPct,
      shotExecutionPct: data.shotExecutionPct,
      skillUnder10Putts: data.skillUnder10Putts,
      skillLagPutts: data.skillLagPutts,
      skillChippingProx: data.skillChippingProx,
      skillWedgesProx: data.skillWedgesProx,
      skillBallStriking: data.skillBallStriking,
      skillGoToClub: data.skillGoToClub,
      lessonsLearned: data.lessonsLearned,
    };
    startTransition(async () => {
      try {
        const resp = await fetch(`/api/rondas/${roundId}/assessment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editable),
        });
        if (!resp.ok) throw new Error("save failed");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch {
        setSaveStatus("error");
      }
    });
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // 2x resolución para que se vea nítido en Circle
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const filename = `assessment-${data.playerName.replace(/\s+/g, "-")}-${data.date.replace(/\//g, "-")}.png`;
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#e8e8e8]">
      {/* Toolbar arriba */}
      <div className="sticky top-0 z-10 border-b bg-white/90 px-4 py-2 backdrop-blur" style={{ borderColor: "#7CAA8E" }}>
        <div className="mx-auto flex max-w-[820px] items-center justify-between gap-3 text-sm">
          <Link href={`/rondas/${roundId}/resumen`} className="text-[#1E5631] hover:underline">
            ← Volver al resumen
          </Link>
          <div className="flex items-center gap-2">
            {saveStatus === "saved" && <span className="text-xs text-green-700">✓ Guardado</span>}
            {saveStatus === "error" && <span className="text-xs text-red-700">✗ Error</span>}
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded bg-[#1E5631] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#16432a] disabled:opacity-50"
            >
              {isPending ? "Guardando…" : "Guardar"}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="rounded border border-[#1E5631] px-3 py-1.5 text-xs font-semibold text-[#1E5631] hover:bg-[#1E5631] hover:text-white disabled:opacity-50"
            >
              {downloading ? "Generando…" : "Descargar PNG"}
            </button>
          </div>
        </div>
      </div>

      {/* Layout 2 columnas: card (mobile = full, desktop = 820px) + editor lateral */}
      <div className="mx-auto flex max-w-[1280px] gap-4 px-4 py-6">
        {/* Card visible — usado para captura PNG */}
        <div ref={cardRef} className="flex-shrink-0">
          <OfficialAssessmentCard data={data} />
        </div>

        {/* Editor lateral */}
        <aside className="w-[320px] flex-shrink-0 space-y-4 rounded-lg bg-white p-4 shadow">
          <h2 className="border-b pb-2 text-sm font-bold uppercase tracking-wider text-[#1E5631]">
            Editar campos
          </h2>

          {/* Pre Round Prep */}
          <Section title="Pre Round Preparation">
            <YesNoToggle
              label="Practice Round"
              value={data.practiceRound}
              onChange={(v) => patch("practiceRound", v)}
            />
            <YesNoToggle
              label="Yardage Book"
              value={data.yardageBook}
              onChange={(v) => patch("yardageBook", v)}
            />
            <YesNoToggle
              label="Written Plan"
              value={data.writtenPlan}
              onChange={(v) => patch("writtenPlan", v)}
            />
            <YesNoToggle
              label="Personal Par"
              value={data.personalParDefined}
              onChange={(v) => patch("personalParDefined", v)}
            />
          </Section>

          <Section title="Prep That Day">
            <TextArea
              label="Warm Up"
              value={data.warmUp}
              onChange={(v) => patch("warmUp", v)}
            />
            <TextArea
              label="Mental Focus"
              value={data.mentalFocus}
              onChange={(v) => patch("mentalFocus", v)}
            />
          </Section>

          <Section title="Best Part">
            <TextArea
              value={data.bestPartOfRound}
              onChange={(v) => patch("bestPartOfRound", v)}
              minRows={3}
            />
          </Section>

          <Section title="Post Round Self Assessment (%)">
            <PctSlider
              label="Mental Strength"
              value={data.mentalStrengthPct}
              onChange={(v) => patch("mentalStrengthPct", v)}
            />
            <PctSlider
              label="Positive Self Talk"
              value={data.positiveSelfTalkPct}
              onChange={(v) => patch("positiveSelfTalkPct", v)}
            />
            <PctSlider
              label="Fortitude"
              value={data.fortitudePct}
              onChange={(v) => patch("fortitudePct", v)}
            />
            <PctSlider
              label="Shot Selection"
              value={data.shotSelectionPct}
              onChange={(v) => patch("shotSelectionPct", v)}
            />
            <PctSlider
              label="Shot Execution"
              value={data.shotExecutionPct}
              onChange={(v) => patch("shotExecutionPct", v)}
            />
          </Section>

          <Section title="Skill Sets to Work On">
            <TextArea label="<10 Putts" value={data.skillUnder10Putts} onChange={(v) => patch("skillUnder10Putts", v)} />
            <TextArea label="Lag Putts" value={data.skillLagPutts} onChange={(v) => patch("skillLagPutts", v)} />
            <TextArea label="Chipping Prox" value={data.skillChippingProx} onChange={(v) => patch("skillChippingProx", v)} />
            <TextArea label="Wedges Prox" value={data.skillWedgesProx} onChange={(v) => patch("skillWedgesProx", v)} />
            <TextArea label="Ball Striking" value={data.skillBallStriking} onChange={(v) => patch("skillBallStriking", v)} />
            <TextArea label="Go to Club" value={data.skillGoToClub} onChange={(v) => patch("skillGoToClub", v)} />
          </Section>

          <Section title="Lessons Learned">
            <TextArea
              value={data.lessonsLearned}
              onChange={(v) => patch("lessonsLearned", v)}
              minRows={4}
            />
          </Section>
        </aside>
      </div>
    </div>
  );
}

// ============ Sub-components del editor ============

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1E5631]">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
          value ? "bg-[#1E5631] text-white" : "bg-gray-200 text-gray-600"
        }`}
      >
        {value ? "YES" : "NO"}
      </button>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  minRows = 2,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
}) {
  return (
    <label className="block text-xs">
      {label && <span className="mb-0.5 block text-gray-700">{label}</span>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={minRows}
        className="w-full resize-y rounded border px-2 py-1 text-[11px] leading-tight focus:border-[#1E5631] focus:outline-none"
        style={{ borderColor: "#d0e6d5" }}
      />
    </label>
  );
}

function PctSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const current = value ?? 50;
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between">
        <span className="text-gray-700">{label}</span>
        <span className="font-mono text-[11px] font-semibold text-[#1E5631]">
          {value != null ? `${value}%` : "—"}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#1E5631]"
      />
    </div>
  );
}
