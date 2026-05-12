/**
 * Round Assessment Card — replica visual del PDF oficial TSM.
 * Ref: docs/knowledge-base/resources/round_assessment_card.pdf
 *
 * Diseñado para:
 *   - Renderizar en /rondas/[id]/card (preview / edit)
 *   - Source para generación de imagen (@vercel/og)
 *   - Página pública /r/[shareId] (share)
 *
 * NO depende de la DB — recibe data como props (ver AssessmentCardData).
 */

import type { AssessmentCardData } from "@/lib/round-assessment";

// Colores oficiales del PDF
const COLORS = {
  green: "#1E5631",
  greenDark: "#16432a",
  greenPale: "#D5E4D0",
  greenBorder: "#7CAA8E",
  red: "#C0392B",
  redPale: "#FBE5E1",
  ink: "#0d1a0f",
  muted: "#6b7c6e",
};

// ============ Sub-components ============

function TsmLogo() {
  // El logo del PDF: pattern de 6 dots en grid 3×2 (un dot por celda alterno)
  // + texto "THE SCORING METHOD" en 3 líneas a la derecha del pattern.
  const dots = [
    [1, 0, 1],
    [0, 1, 0],
  ].flat();
  return (
    <div className="flex items-center gap-1.5">
      <div className="grid grid-cols-3" style={{ gap: 2 }}>
        {dots.map((filled, i) => (
          <div
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: filled ? COLORS.ink : "transparent",
              border: filled ? "none" : `1px solid ${COLORS.ink}`,
            }}
          />
        ))}
      </div>
      <div className="text-[8px] font-extrabold leading-[1.05] tracking-wide" style={{ color: COLORS.ink }}>
        THE
        <br />
        SCORING
        <br />
        METHOD
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="mb-2 rounded-md border px-3 py-1.5 text-[13px] font-bold tracking-wide"
      style={{
        background: COLORS.greenPale,
        borderColor: COLORS.greenBorder,
        color: COLORS.green,
      }}
    >
      {title}
    </div>
  );
}

function FieldBox({
  label,
  value,
  red,
  small,
  className = "",
}: {
  label?: string;
  value: string | number | null;
  red?: boolean;
  small?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className={`${small ? "text-[10px]" : "text-[11px]"} font-medium`} style={{ color: COLORS.green }}>
          {label}
        </span>
      )}
      <div
        className={`inline-flex min-w-[40px] items-center justify-center rounded border px-2 py-0.5 ${
          small ? "text-[10px]" : "text-[12px]"
        } font-semibold`}
        style={{
          borderColor: red ? COLORS.red : COLORS.green,
          background: red ? COLORS.redPale : "#fff",
          color: red ? COLORS.red : COLORS.ink,
        }}
      >
        {value ?? ""}
      </div>
    </div>
  );
}

function YesNoField({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span style={{ color: COLORS.green }}>{label}</span>
      <div className="flex items-center gap-1">
        <span className={`px-1 ${value ? "font-bold" : "opacity-40"}`} style={{ color: COLORS.green }}>
          YES
        </span>
        <span style={{ color: COLORS.muted }}>/</span>
        <span className={`px-1 ${!value ? "font-bold" : "opacity-40"}`} style={{ color: COLORS.green }}>
          NO
        </span>
      </div>
    </div>
  );
}

function TextArea({ value, minHeight = 60 }: { value: string; minHeight?: number }) {
  return (
    <div
      className="rounded border px-2 py-1.5 text-[11px] leading-[1.4]"
      style={{
        borderColor: COLORS.greenBorder,
        background: "#fff",
        color: COLORS.ink,
        minHeight,
      }}
    >
      {value || <span style={{ color: COLORS.muted }}>—</span>}
    </div>
  );
}

function PctField({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-[11px]" style={{ color: COLORS.green }}>
        {label}
      </span>
      <div
        className="inline-flex min-w-[55px] items-center justify-center rounded border px-2 py-0.5 text-[12px] font-semibold"
        style={{ borderColor: COLORS.green, background: "#fff", color: COLORS.ink }}
      >
        {value != null ? `${value} %` : ""}
      </div>
    </div>
  );
}

function SkillField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 w-[80px] flex-shrink-0 text-[11px]" style={{ color: COLORS.green }}>
        {label}
      </span>
      <div
        className="flex-1 rounded border px-2 py-1 text-[10.5px] leading-[1.35]"
        style={{ borderColor: COLORS.greenBorder, background: "#fff", color: COLORS.ink, minHeight: 22 }}
      >
        {value || <span style={{ color: COLORS.muted }}>—</span>}
      </div>
    </div>
  );
}

// ============ Section: Entering the Scoring Zone (con círculos concéntricos) ============

function EnteringScoringZone({ d }: { d: AssessmentCardData }) {
  // Layout: SVG decorativo a la IZQUIERDA, columna de label+input al CENTRO,
  // y columna de proximity/penalties/fórmula a la DERECHA. NO hay superposiciones.
  // Los inputs centrales están alineados verticalmente — cada uno corresponde a
  // un anillo del SVG pero no se solapan visualmente.
  return (
    <div>
      <SectionHeader title="ENTERING THE SCORING ZONE" />
      <div className="grid grid-cols-[110px_70px_1fr] gap-3 items-start">
        {/* Col 1: Círculos concéntricos SOLO decorativos, sin inputs encima */}
        <div className="relative" style={{ width: 110, height: 110 }}>
          <svg viewBox="0 0 110 110" className="h-full w-full">
            <circle cx="55" cy="55" r="52" fill="none" stroke={COLORS.greenBorder} strokeWidth="1" />
            <circle cx="55" cy="55" r="40" fill="none" stroke={COLORS.greenBorder} strokeWidth="1" />
            <circle cx="55" cy="55" r="28" fill="none" stroke={COLORS.greenBorder} strokeWidth="1" />
            <circle cx="55" cy="55" r="14" fill="none" stroke={COLORS.greenBorder} strokeWidth="1" />
            {/* Labels DENTRO de los anillos */}
            <text x="55" y="10" fontSize="7" fill={COLORS.green} fontWeight="700" textAnchor="middle">100Y</text>
            <text x="55" y="22" fontSize="7" fill={COLORS.green} fontWeight="700" textAnchor="middle">50Y</text>
            <text x="55" y="34" fontSize="7" fill={COLORS.green} fontWeight="700" textAnchor="middle">25Y</text>
            <text x="55" y="46" fontSize="7" fill={COLORS.green} fontWeight="700" textAnchor="middle">GIR</text>
          </svg>
        </div>
        {/* Col 2: 4 inputs apilados verticalmente con labels al lado */}
        <div className="flex flex-col gap-[6px] pt-1">
          <FieldBox label="100Y" value={d.enterSz100Y} small />
          <FieldBox label="50Y" value={d.enterSz50Y} small />
          <FieldBox label="25Y" value={d.enterSz25Y} small />
          <FieldBox label="GIR" value={d.enterSzGIR} small />
        </div>
        {/* Col 3: x100, Penalties, Proximity, fórmula */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <FieldBox label="x100" value={d.x100} red small />
            <FieldBox label="Penalties" value={d.penalties} red small />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold tracking-wider" style={{ color: COLORS.green }}>
              PROXIMITY
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <FieldBox label="GIR =" value={d.proximityFromGirFt} small />
              <FieldBox label="50Y =" value={d.proximityFrom50YFt} small />
              <FieldBox label="25Y =" value={d.proximityFrom25YFt} small />
              <FieldBox label="100Y =" value={d.proximityFrom100YFt} small />
            </div>
          </div>
          <div className="space-y-0.5 pt-1 text-[9px] font-semibold leading-tight" style={{ color: COLORS.green }}>
            <div>95 − ( ___ × 2 ) = ___</div>
            <div>95 − ( GIR × 2 ) = Score × Strokes Gained +/−</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Card principal ============

export function OfficialAssessmentCard({ data }: { data: AssessmentCardData }) {
  return (
    <div
      className="mx-auto rounded-lg bg-white p-6 shadow-lg"
      style={{
        width: 820,
        // No fijo aspect ratio porque queremos que la card crezca según contenido
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      {/* Header fila — NAME / DATE / COURSE / YARDAGE / PAR */}
      <div className="mb-3 grid grid-cols-[1.5fr_1fr_2fr_1fr_0.7fr] items-center gap-3 border-b pb-2 text-[10px]" style={{ borderColor: COLORS.greenBorder }}>
        <FieldHeader label="NAME" value={data.playerName} />
        <FieldHeader label="DATE" value={data.date} />
        <FieldHeader label="COURSE" value={data.course} />
        <FieldHeader label="YARDAGE" value={data.yardage} />
        <FieldHeader label="PAR" value={data.par} />
      </div>

      {/* Title row — logo separado del título con gap claro */}
      <div className="mb-4 flex items-center gap-6">
        <div className="flex-shrink-0">
          <TsmLogo />
        </div>
        <h1 className="flex-1 text-[26px] font-extrabold leading-none tracking-tight" style={{ color: COLORS.green }}>
          ROUND ASSESSMENT CARD
        </h1>
      </div>

      {/* 2-col body */}
      <div className="grid grid-cols-2 gap-4">
        {/* ============ LEFT COLUMN ============ */}
        <div className="space-y-3">
          {/* A — PRE ROUND PREPARATION */}
          <div>
            <SectionHeader title="PRE ROUND PREPARATION" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <YesNoField label="Practice Round" value={data.practiceRound} />
              <YesNoField label="Yardage Book" value={data.yardageBook} />
              <YesNoField label="Written Plan" value={data.writtenPlan} />
              <YesNoField label="Personal Par" value={data.personalParDefined} />
            </div>
          </div>

          {/* C — ENTERING THE SCORING ZONE */}
          <EnteringScoringZone d={data} />

          {/* E — PAR BREAKDOWN */}
          <div>
            <div className="mb-2 flex items-end justify-between rounded-md border px-3 py-1.5" style={{ background: COLORS.greenPale, borderColor: COLORS.greenBorder }}>
              <span className="text-[13px] font-bold tracking-wide" style={{ color: COLORS.green }}>
                PAR BREAKDOWN
              </span>
              <span className="text-[8.5px] italic" style={{ color: COLORS.green }}>
                (total shots taken /<br />
                # of holes = avg)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <FieldBox label="# of par 5's" value={data.par5Avg?.toFixed(2) ?? ""} small />
              <FieldBox label="# of par 4's" value={data.par4Avg?.toFixed(2) ?? ""} small />
              <FieldBox label="# of par 3's" value={data.par3Avg?.toFixed(2) ?? ""} small />
            </div>
          </div>

          {/* F — SCORE BREAKDOWN */}
          <div>
            <div className="mb-2 flex items-center justify-between rounded-md border px-3 py-1.5" style={{ background: COLORS.greenPale, borderColor: COLORS.greenBorder }}>
              <span className="text-[13px] font-bold tracking-wide" style={{ color: COLORS.green }}>
                SCORE BREAKDOWN
              </span>
              <FieldBox label="SCORE" value={data.score} small />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <FieldBox label="Eagles" value={data.eagles} small />
              <FieldBox label="Birdies" value={data.birdies} small />
              <FieldBox label="Pars" value={data.pars} small />
              <FieldBox label="Bogeys" value={data.bogeys} small />
              <FieldBox label="Double Bogeys" value={data.doubleBogeys} red small />
              <FieldBox label="Others" value={data.others} red small />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              <FieldBox label="First 3 holes" value={data.firstThree} small />
              <FieldBox label="Front 9" value={data.front9} small />
              <FieldBox label="Last 3 holes" value={data.lastThree} small />
              <FieldBox label="Back 9" value={data.back9} small />
            </div>
          </div>

          {/* G — STATS */}
          <div>
            <SectionHeader title="STATS" />
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <FieldBoxStacked label="Bunker Shots" value={`${data.bunkerShotsUpAndDown} / ${data.bunkerShotsTotal}`} />
                <FieldBoxStacked label="Green Side Up/Down" value={`${data.greenSideUpDownMade} / ${data.greenSideUpDownAttempts}`} />
                <div className="space-y-1">
                  <FieldBox label="Total Putts" value={data.totalPutts} small />
                  <FieldBox label="Total 3 Putts" value={data.total3Putts} small />
                </div>
              </div>
              {/* Distance in feet grid */}
              <div>
                <div className="mb-1 grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 text-[10px] font-semibold" style={{ color: COLORS.green }}>
                  <div>Distance in feet</div>
                  <div className="text-center">0 - 3 ft.</div>
                  <div className="text-center">3 - 6 ft.</div>
                  <div className="text-center">6 - 10 ft.</div>
                </div>
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 items-center">
                  <span className="text-[10px]" style={{ color: COLORS.green }}>Putts Made from</span>
                  <FieldBox value={data.puttsMade0to3} red={data.puttsAttempts0to3 - data.puttsMade0to3 > 1} small />
                  <FieldBox value={data.puttsMade3to6} small />
                  <FieldBox value={data.puttsMade6to10} small />
                </div>
                <div className="mt-1 grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 items-center">
                  <span className="text-[10px]" style={{ color: COLORS.green }}>Attempts</span>
                  <FieldBox value={data.puttsAttempts0to3} small />
                  <FieldBox value={data.puttsAttempts3to6} small />
                  <FieldBox value={data.puttsAttempts6to10} small />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ RIGHT COLUMN ============ */}
        <div className="space-y-3">
          {/* B — PREP THAT DAY */}
          <div>
            <SectionHeader title="PREP THAT DAY" />
            <div className="space-y-2">
              <div>
                <div className="mb-1 text-[10px] font-semibold" style={{ color: COLORS.green }}>Warm Up</div>
                <TextArea value={data.warmUp} minHeight={36} />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold" style={{ color: COLORS.green }}>Mental Focus</div>
                <TextArea value={data.mentalFocus} minHeight={36} />
              </div>
            </div>
          </div>

          {/* D — DOWN IN THE SCORING ZONE */}
          <div>
            <SectionHeader title="DOWN IN THE SCORING ZONE" />
            <div className="grid grid-cols-6 gap-1.5">
              {data.downInSz.map((count, i) => (
                <div key={i} className="text-center">
                  <div className="mb-1 text-[14px] font-bold" style={{ color: COLORS.green }}>
                    {i}
                  </div>
                  <FieldBox value={count} small />
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] font-semibold" style={{ color: COLORS.green }}>
              SHOTS TO GET DOWN
            </div>
          </div>

          {/* H — BEST PART */}
          <div>
            <SectionHeader title="BEST PART OF YOUR ROUND" />
            <TextArea value={data.bestPartOfRound} minHeight={80} />
          </div>

          {/* I — POST ROUND SELF ASSESSMENT */}
          <div>
            <SectionHeader title="POST ROUND SELF ASSESSMENT" />
            <div className="space-y-1.5">
              <PctField label="Mental Strength" value={data.mentalStrengthPct} />
              <PctField label="Positive Self Talk" value={data.positiveSelfTalkPct} />
              <PctField label="Fortitude" value={data.fortitudePct} />
              <PctField label="Shot Selection" value={data.shotSelectionPct} />
              <PctField label="Shot execution" value={data.shotExecutionPct} />
            </div>
          </div>

          {/* J — SKILL SETS TO WORK ON */}
          <div>
            <SectionHeader title="SKILL SETS TO WORK ON" />
            <div className="space-y-1.5">
              <SkillField label="<10 Putts" value={data.skillUnder10Putts} />
              <SkillField label="Lag Putts" value={data.skillLagPutts} />
              <SkillField label="Chipping Prox" value={data.skillChippingProx} />
              <SkillField label="Wedges Prox" value={data.skillWedgesProx} />
              <SkillField label="Ball Striking" value={data.skillBallStriking} />
              <SkillField label="Go to Club" value={data.skillGoToClub} />
            </div>
          </div>

          {/* K — LESSONS LEARNED */}
          <div>
            <SectionHeader title="LESSONS LEARNED" />
            <TextArea value={data.lessonsLearned} minHeight={70} />
          </div>
        </div>
      </div>

      {/* Footer (branding sutil) */}
      <div className="mt-5 border-t pt-2 text-center text-[9px] tracking-wide" style={{ borderColor: COLORS.greenBorder, color: COLORS.muted }}>
        Tracked with Scoring Method Tracker
      </div>
    </div>
  );
}

// ============ Sub: Header field ============
function FieldHeader({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-baseline gap-2 text-[10px]">
      <span className="font-semibold tracking-wider" style={{ color: COLORS.muted }}>
        {label}:
      </span>
      <span className="border-b text-[12px] font-semibold" style={{ borderColor: COLORS.greenBorder, color: COLORS.ink, minWidth: 40, paddingBottom: 1 }}>
        {value ?? ""}
      </span>
    </div>
  );
}

// ============ Sub: Stacked field box (label arriba, value abajo) ============
function FieldBoxStacked({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[9.5px] font-semibold leading-tight" style={{ color: COLORS.green }}>
        {label}
      </div>
      <div
        className="inline-flex min-w-[60px] items-center justify-center rounded border px-2 py-0.5 text-[12px] font-semibold"
        style={{ borderColor: COLORS.green, background: "#fff", color: COLORS.ink }}
      >
        {value}
      </div>
    </div>
  );
}
