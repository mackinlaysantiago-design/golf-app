"use client";

/**
 * Wizard client de PP setup.
 * Flow: tipo → (auto: confirmar) | (custom: áreas → drills) → resumen → start
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DRILL_BY_TYPE, type DrillType } from "@/lib/pp-drills";
import {
  AREA_LABEL,
  AREA_DESCRIPTION,
  AREA_ORDER,
  drillsByArea,
  type TsmArea,
} from "@/lib/pp-areas";
import type { AreaSuggestion } from "@/lib/pp-suggest";

type Step = "type" | "auto" | "custom-areas" | "custom-drills" | "review";
type Mode = "auto" | "custom";

export default function SetupClient({
  suggestions,
  taskCount,
  recentRound,
}: {
  suggestions: AreaSuggestion[];
  taskCount: number;
  recentRound: { date: string; course: string } | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("type");
  const [mode, setMode] = useState<Mode | null>(null);
  // Selecciones
  const [autoSelected, setAutoSelected] = useState<Set<DrillType>>(() => {
    // Por default todos los drills sugeridos están marcados
    const s = new Set<DrillType>();
    for (const sug of suggestions) {
      for (const d of sug.suggestedDrills) s.add(d.type);
    }
    return s;
  });
  const [customAreas, setCustomAreas] = useState<Set<TsmArea>>(new Set());
  const [customDrills, setCustomDrills] = useState<Set<DrillType>>(new Set());

  const drillsByAreaCatalog = drillsByArea();

  function pickMode(m: Mode) {
    setMode(m);
    setStep(m === "auto" ? "auto" : "custom-areas");
  }

  function toggleAuto(type: DrillType) {
    setAutoSelected((s) => {
      const n = new Set(s);
      if (n.has(type)) n.delete(type);
      else n.add(type);
      return n;
    });
  }

  function toggleCustomArea(area: TsmArea) {
    setCustomAreas((s) => {
      const n = new Set(s);
      if (n.has(area)) n.delete(area);
      else n.add(area);
      return n;
    });
  }

  function toggleCustomDrill(type: DrillType) {
    setCustomDrills((s) => {
      const n = new Set(s);
      if (n.has(type)) n.delete(type);
      else n.add(type);
      return n;
    });
  }

  function finalSelection(): DrillType[] {
    return mode === "auto" ? Array.from(autoSelected) : Array.from(customDrills);
  }

  function startSession() {
    const drills = finalSelection();
    if (drills.length === 0) return;
    // Pasar los drills a /range/pp/nueva vía query param
    const params = new URLSearchParams();
    params.set("drills", drills.join(","));
    router.push(`/range/pp/nueva?${params.toString()}`);
  }

  // ============ Step content ============
  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="gf-display text-3xl text-[var(--fairway)]">Nueva sesión PP</h1>
          <p className="text-sm text-[var(--muted)]">
            Setup de tu próxima práctica
          </p>
        </div>
        <StepIndicator current={step} mode={mode} />
      </header>

      {step === "type" && (
        <TypeStep
          taskCount={taskCount}
          recentRound={recentRound}
          suggestions={suggestions}
          onPick={pickMode}
        />
      )}

      {step === "auto" && (
        <AutoStep
          suggestions={suggestions}
          selected={autoSelected}
          onToggle={toggleAuto}
          onBack={() => setStep("type")}
          onNext={() => setStep("review")}
        />
      )}

      {step === "custom-areas" && (
        <CustomAreasStep
          selected={customAreas}
          onToggle={toggleCustomArea}
          onBack={() => setStep("type")}
          onNext={() => setStep("custom-drills")}
        />
      )}

      {step === "custom-drills" && (
        <CustomDrillsStep
          areas={Array.from(customAreas)}
          catalog={drillsByAreaCatalog}
          selected={customDrills}
          onToggle={toggleCustomDrill}
          onBack={() => setStep("custom-areas")}
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && (
        <ReviewStep
          drills={finalSelection()}
          mode={mode!}
          onBack={() => setStep(mode === "auto" ? "auto" : "custom-drills")}
          onStart={startSession}
        />
      )}
    </div>
  );
}

// ============ STEP COMPONENTS ============

function StepIndicator({ current, mode }: { current: Step; mode: Mode | null }) {
  const labels = mode === "custom"
    ? [["type", "Tipo"], ["custom-areas", "Áreas"], ["custom-drills", "Drills"], ["review", "Listo"]]
    : [["type", "Tipo"], ["auto", "Confirmar"], ["review", "Listo"]];
  return (
    <div className="flex items-center gap-1 text-[10px]">
      {labels.map(([k, label], i) => (
        <span
          key={k}
          className={`rounded px-2 py-0.5 ${
            current === k ? "bg-[var(--fairway)] text-white font-semibold" : "bg-gray-200 text-gray-600"
          }`}
        >
          {i + 1}. {label}
        </span>
      ))}
    </div>
  );
}

function TypeStep({
  taskCount,
  recentRound,
  suggestions,
  onPick,
}: {
  taskCount: number;
  recentRound: { date: string; course: string } | null;
  suggestions: AreaSuggestion[];
  onPick: (m: Mode) => void;
}) {
  const hasAuto = taskCount > 0 && suggestions.length > 0;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={() => onPick("auto")}
          disabled={!hasAuto}
          className={`gf-card text-left p-4 hover:shadow-lg transition-shadow ${
            !hasAuto ? "opacity-50 cursor-not-allowed" : ""
          }`}
          style={{ borderLeft: "4px solid var(--green)" }}
        >
          <div className="text-lg font-bold text-[var(--fairway)]">Auto-PP</div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Drills + tests que el sistema sugiere basado en tus tareas pendientes
            {recentRound &&
              ` de ${recentRound.course} (${new Date(recentRound.date).toLocaleDateString("es-AR")})`}
            .
          </div>
          {hasAuto ? (
            <div className="mt-3 space-y-1 text-xs">
              <div className="font-semibold text-[var(--green)]">
                {suggestions.length} {suggestions.length === 1 ? "área" : "áreas"} pendientes:
              </div>
              {suggestions.slice(0, 3).map((s) => (
                <div key={s.area} className="flex items-center gap-1.5">
                  <span className="text-[10px]">•</span>
                  <span>{AREA_LABEL[s.area]}</span>
                  <span className="text-[var(--muted)]">
                    ({s.suggestedDrills.length} {s.suggestedDrills.length === 1 ? "drill" : "drills"})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs text-[var(--muted)] italic">
              No hay tareas pendientes — necesitás una ronda reciente o usá Custom.
            </div>
          )}
        </button>

        <button
          onClick={() => onPick("custom")}
          className="gf-card text-left p-4 hover:shadow-lg transition-shadow"
          style={{ borderLeft: "4px solid var(--accent)" }}
        >
          <div className="text-lg font-bold text-[var(--fairway)]">Custom</div>
          <div className="text-xs text-[var(--muted)] mt-1">
            Vos elegís qué áreas trabajar y qué drills específicos hacer.
          </div>
          <div className="mt-3 text-xs space-y-1">
            <div className="font-semibold text-[var(--accent)]">Pasos:</div>
            <div>1. Elegí 1-5 áreas del short game</div>
            <div>2. Por cada área, elegí drill + test</div>
            <div>3. Confirmá y arrancá</div>
          </div>
        </button>
      </div>

      <div className="flex justify-end">
        <Link href="/range/pp" className="text-xs text-[var(--muted)] hover:underline">
          ← Volver a sesiones
        </Link>
      </div>
    </div>
  );
}

function AutoStep({
  suggestions,
  selected,
  onToggle,
  onBack,
  onNext,
}: {
  suggestions: AreaSuggestion[];
  selected: Set<DrillType>;
  onToggle: (t: DrillType) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const selectedCount = selected.size;
  return (
    <div className="space-y-3">
      <div className="text-sm text-[var(--muted)]">
        Confirmá qué drills hacer. Marcá/desmarcá lo que quieras.
      </div>
      <div className="space-y-3">
        {suggestions.map((sug) => (
          <div key={sug.area} className="gf-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-bold text-[var(--fairway)]">{AREA_LABEL[sug.area]}</div>
                <div className="text-[10px] text-[var(--muted)]">
                  {AREA_DESCRIPTION[sug.area]}
                </div>
              </div>
              <span className="text-[10px] gf-pill">
                Prioridad: {sug.priority}
              </span>
            </div>
            {sug.reasons.length > 0 && (
              <div className="mb-2 text-[11px] text-[var(--muted)] italic">
                {sug.reasons.slice(0, 2).join(" · ")}
              </div>
            )}
            <div className="space-y-1">
              {sug.suggestedDrills.map((d) => {
                const def = DRILL_BY_TYPE[d.type];
                return (
                  <label
                    key={d.type}
                    className="flex items-start gap-2 cursor-pointer rounded px-2 py-1 hover:bg-[var(--green-pale)]"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(d.type)}
                      onChange={() => onToggle(d.type)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${
                          d.kind === "DRILL" ? "text-blue-700" : "text-orange-700"
                        }`}>
                          {d.kind}
                        </span>
                        <span className="font-semibold text-sm">{def.shortLabel}</span>
                        <span className="text-[10px] gf-pill">PP {def.ppCode}</span>
                      </div>
                      <div className="text-[10px] text-[var(--muted)] leading-tight">
                        {def.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={selectedCount === 0} nextLabel={`Revisar (${selectedCount})`} />
    </div>
  );
}

function CustomAreasStep({
  selected,
  onToggle,
  onBack,
  onNext,
}: {
  selected: Set<TsmArea>;
  onToggle: (a: TsmArea) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-[var(--muted)]">
        ¿Qué áreas querés trabajar? Podés elegir hasta 5.
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {AREA_ORDER.map((area) => {
          const isSelected = selected.has(area);
          return (
            <button
              key={area}
              onClick={() => onToggle(area)}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                isSelected
                  ? "border-[var(--green)] bg-[var(--green-pale)]"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--fairway)]">{AREA_LABEL[area]}</span>
                {isSelected && <span className="text-[var(--green)] font-bold">✓</span>}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1">
                {AREA_DESCRIPTION[area]}
              </div>
            </button>
          );
        })}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={selected.size === 0} nextLabel={`Elegir drills (${selected.size})`} />
    </div>
  );
}

function CustomDrillsStep({
  areas,
  catalog,
  selected,
  onToggle,
  onBack,
  onNext,
}: {
  areas: TsmArea[];
  catalog: Record<TsmArea, { drills: DrillType[]; tests: DrillType[] }>;
  selected: Set<DrillType>;
  onToggle: (t: DrillType) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-[var(--muted)]">
        Por cada área, elegí qué drills y tests querés hacer. Filosofía TSM:{" "}
        <strong>drill primero (build skill) → test después (measure under pressure)</strong>.
      </div>
      <div className="space-y-3">
        {areas.map((area) => {
          const c = catalog[area];
          if (c.drills.length === 0 && c.tests.length === 0) {
            return (
              <div key={area} className="gf-card p-3 opacity-60">
                <div className="font-bold text-[var(--fairway)]">{AREA_LABEL[area]}</div>
                <div className="text-[10px] italic text-[var(--muted)] mt-1">
                  No hay drills en el catálogo para esta área (próximamente).
                </div>
              </div>
            );
          }
          return (
            <div key={area} className="gf-card p-3">
              <div className="font-bold text-[var(--fairway)] mb-2">{AREA_LABEL[area]}</div>
              {c.drills.length > 0 && (
                <div className="mb-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-blue-700 mb-1">
                    Drills (build skill)
                  </div>
                  {c.drills.map((t) => (
                    <DrillCheckbox key={t} type={t} checked={selected.has(t)} onToggle={() => onToggle(t)} />
                  ))}
                </div>
              )}
              {c.tests.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-orange-700 mb-1">
                    Tests (measure under pressure)
                  </div>
                  {c.tests.map((t) => (
                    <DrillCheckbox key={t} type={t} checked={selected.has(t)} onToggle={() => onToggle(t)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={selected.size === 0} nextLabel={`Revisar (${selected.size})`} />
    </div>
  );
}

function DrillCheckbox({
  type,
  checked,
  onToggle,
}: {
  type: DrillType;
  checked: boolean;
  onToggle: () => void;
}) {
  const def = DRILL_BY_TYPE[type];
  return (
    <label className="flex items-start gap-2 cursor-pointer rounded px-2 py-1 hover:bg-[var(--green-pale)]">
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1" />
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm">{def.shortLabel}</span>
          <span className="text-[10px] gf-pill">PP {def.ppCode}</span>
        </div>
        <div className="text-[10px] text-[var(--muted)] leading-tight">{def.description}</div>
      </div>
    </label>
  );
}

function ReviewStep({
  drills,
  mode,
  onBack,
  onStart,
}: {
  drills: DrillType[];
  mode: Mode;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-[var(--muted)]">
        Listo. Vas a hacer estos {drills.length} drills/tests en tu sesión.
      </div>
      <div className="gf-card p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Resumen (modo: {mode === "auto" ? "Auto-PP" : "Custom"})
        </div>
        {drills.map((type) => {
          const def = DRILL_BY_TYPE[type];
          return (
            <div key={type} className="flex justify-between text-sm border-b pb-1 last:border-0">
              <span>{def.shortLabel}</span>
              <span className="text-[10px] gf-pill">PP {def.ppCode}</span>
            </div>
          );
        })}
      </div>
      <div className="rounded bg-blue-50 p-2 text-[11px] text-blue-900">
        <strong>Próximo paso:</strong> arrancás la sesión en la pantalla de tracking,
        donde cargás los intentos de cada drill.
      </div>
      <NavRow onBack={onBack} onNext={onStart} nextDisabled={drills.length === 0} nextLabel="Empezar sesión →" />
    </div>
  );
}

function NavRow({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel: string;
}) {
  return (
    <div className="flex justify-between gap-2 pt-2">
      <button onClick={onBack} className="gf-btn-outline">
        ← Atrás
      </button>
      <button onClick={onNext} disabled={nextDisabled} className="gf-btn">
        {nextLabel}
      </button>
    </div>
  );
}
