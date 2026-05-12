/**
 * TSM Advanced Scorecard Level 2 — replica visual del PDF oficial.
 * Ref: docs/knowledge-base/resources/advanced_scorecard_level_2.pdf
 *
 * Layout wide horizontal con 2 páginas:
 *  - Page 1 (front): grid 18 hoyos + bottom panel (10 keys + circles)
 *  - Page 2 (back): tabla keys + solutions + best parts
 *
 * Diseñado para descarga PNG (subir a Circle TSM).
 */

import type { ScorecardData, ScorecardHole } from "@/lib/scorecard";

const C = {
  ink: "#000000",
  muted: "#888",
  red: "#E63946",
  grayBg: "#f0f0f0",
  borderDark: "#000",
  borderLight: "#888",
};

// Diagonal slash dentro de una celda (top-right a bottom-left)
const DIAG_STYLE: React.CSSProperties = {
  background: `linear-gradient(to top right, transparent calc(50% - 0.5px), ${C.borderLight} calc(50% - 0.5px), ${C.borderLight} calc(50% + 0.5px), transparent calc(50% + 0.5px))`,
};

// ============ Logo TSM ============
function TsmLogo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const dots = [
    [1, 0, 1],
    [0, 1, 0],
  ].flat();
  const dotSize = size === "lg" ? 10 : 5;
  const textSize = size === "lg" ? 16 : 8;
  return (
    <div className="flex items-center gap-2">
      <div className="grid grid-cols-3" style={{ gap: 2 }}>
        {dots.map((filled, i) => (
          <div
            key={i}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: "50%",
              background: filled ? C.ink : "transparent",
              border: filled ? "none" : `1px solid ${C.ink}`,
            }}
          />
        ))}
      </div>
      <div className="font-extrabold leading-[1.05] tracking-wide" style={{ fontSize: textSize, color: C.ink }}>
        THE
        <br />
        SCORING
        <br />
        METHOD
      </div>
    </div>
  );
}

// ============ Cell con valor + check/X opcional, diagonal slash ============
function DiagonalCell({
  value,
  mark,
  isExample,
  small,
}: {
  value?: string | number | null;
  mark?: "check" | "x" | null;
  isExample?: boolean;
  small?: boolean;
}) {
  return (
    <td
      className="relative border border-black p-0"
      style={{
        width: small ? 28 : 32,
        height: small ? 26 : 28,
        ...DIAG_STYLE,
        background: isExample ? C.grayBg : "#fff",
      }}
    >
      {value != null && value !== "" && (
        <span
          className="absolute font-semibold"
          style={{ top: 1, left: 3, fontSize: 9, color: C.ink }}
        >
          {value}
        </span>
      )}
      {mark === "check" && (
        <span
          className="absolute font-bold"
          style={{ bottom: 1, right: 3, fontSize: 11, color: C.ink, lineHeight: 1 }}
        >
          ✓
        </span>
      )}
      {mark === "x" && (
        <span
          className="absolute font-bold"
          style={{ bottom: 1, right: 3, fontSize: 11, color: C.ink, lineHeight: 1 }}
        >
          ✗
        </span>
      )}
    </td>
  );
}

// Cell simple (sin diagonal) para subtotals
function PlainCell({
  value,
  bold,
  small,
  background,
}: {
  value: string | number | null;
  bold?: boolean;
  small?: boolean;
  background?: string;
}) {
  return (
    <td
      className="border border-black text-center"
      style={{
        width: small ? 36 : 44,
        height: small ? 26 : 28,
        fontSize: 11,
        fontWeight: bold ? 700 : 500,
        background: background ?? "#fff",
        color: C.ink,
      }}
    >
      {value ?? ""}
    </td>
  );
}

// Header cell (label de fila)
function RowLabel({
  primary,
  secondary,
  width = 140,
}: {
  primary: string;
  secondary?: string;
  width?: number;
}) {
  return (
    <td
      className="border border-black px-2 py-1 text-right align-middle"
      style={{ width, background: C.grayBg }}
    >
      <div className="text-[10px] font-bold uppercase tracking-tight" style={{ color: C.ink }}>
        {primary}
      </div>
      {secondary && (
        <div className="text-[8.5px] font-semibold" style={{ color: C.muted }}>
          {secondary}
        </div>
      )}
    </td>
  );
}

// ============ Sub-row sub-header debajo de un row label (ej. "100 50 25 GIR") ============
function SubHeaderRow({ labels }: { labels: string[] }) {
  return (
    <>
      {labels.map((l, i) => (
        <td
          key={i}
          className="border border-black text-center"
          style={{ fontSize: 8, fontWeight: 600, background: C.grayBg, padding: "1px 2px", color: C.ink }}
        >
          {l}
        </td>
      ))}
    </>
  );
}

// ============ Helpers para marks ============

function enterSzMark(hole: ScorecardHole, goalLevel: ScorecardData["enterSzGoal"]): "check" | "x" | null {
  if (hole.enterSzLevel == null) return null;
  if (hole.enterSzLevel === "OUT") return "x";
  // Check si llegó al goal o mejor (un level más adentro)
  const order = ["100", "50", "25", "GIR"];
  const achievedIdx = order.indexOf(hole.enterSzLevel);
  const goalIdx = order.indexOf(goalLevel);
  return achievedIdx >= goalIdx ? "check" : null;
}

function downSzMark(hole: ScorecardHole): "check" | "x" | null {
  if (hole.szGoalAchieved == null) return null;
  return hole.szGoalAchieved ? "check" : "x";
}

function shortPuttMark(hole: ScorecardHole): "check" | "x" | null {
  if (!hole.shortPuttAttempted) return null;
  return hole.shortPuttMade ? "check" : "x";
}

// ============ Cuartos de círculo concéntricos (Entering SZ + Down SZ) ============
function ConcentricSemicircle({
  values,
  highlighted,
  colors,
}: {
  values: { label: string; count: number }[]; // 5 labels (top to bottom)
  highlighted?: string; // ej ">100" o ">5"
  colors: string[]; // [exterior → interior], solo 4 colores (el 5to label no tiene arco)
}) {
  // 5 labels equi-espaciados verticalmente. Centro común está en el BOTTOM-LEFT
  // del SVG (alineado con el último label). 4 cuartos de círculo arrancan desde
  // la línea horizontal de cada label (primeros 4 labels). El 5to (GIR/1) NO tiene arco.
  //
  // ViewBox 100x100. Labels en y = 10, 30, 50, 70, 90. Centro arc en (0, 90).
  // Radios: 80 (>100/>5), 60 (100/4), 40 (50/3), 20 (25/2).
  // Arc i: M 0 y_top  A r r 0 0 1 r 90
  const ROW_Y = [10, 30, 50, 70, 90]; // y de cada label
  const RADII = [80, 60, 40, 20]; // exterior → interior
  const CENTER_Y = 90;

  return (
    <div className="flex items-stretch gap-1" style={{ height: 110 }}>
      {/* Labels + counts a la izquierda, equi-espaciados */}
      <div className="flex flex-col justify-around text-[9px] font-semibold" style={{ color: C.ink }}>
        {values.map((v) => (
          <div key={v.label} className="flex items-center gap-1.5">
            <span
              className={v.label === highlighted ? "rounded border px-1 font-bold" : ""}
              style={{
                color: v.label === highlighted ? C.red : C.ink,
                borderColor: v.label === highlighted ? C.red : "transparent",
                minWidth: 28,
                textAlign: "right",
              }}
            >
              {v.label}
            </span>
            <span
              className="border-b text-center"
              style={{
                borderColor: C.ink,
                minWidth: 26,
                paddingBottom: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {v.count > 0 ? v.count : ""}
            </span>
          </div>
        ))}
      </div>
      {/* SVG con 4 cuartos de círculo concéntricos */}
      <svg width="95" height="110" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
        {RADII.map((r, i) => {
          const yTop = ROW_Y[i]; // arc arranca en la línea del label i
          return (
            <path
              key={i}
              d={`M 0 ${yTop} A ${r} ${r} 0 0 1 ${r} ${CENTER_Y}`}
              fill="none"
              stroke={colors[i] ?? "#888"}
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}

// ============ Card principal ============

export function OfficialScorecard({ data }: { data: ScorecardData }) {
  const front9 = data.holes.slice(0, 9);
  const back9 = data.holes.slice(9, 18);

  // PUTT < ___ row needs special handling — su último 3 celdas son los buckets 0-3/3-6/6-10
  // y muestran "made/attempts" tipo "5/6"
  const bucketCell = (made: number, attempts: number) => (attempts === 0 ? "—" : `${made}/${attempts}`);

  return (
    <div
      className="mx-auto bg-white p-4 shadow-lg"
      style={{
        width: 1400,
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: C.ink,
      }}
    >
      {/* ============ HEADER ============ */}
      <div className="mb-3 flex items-end gap-6 border-b border-black pb-2">
        <TsmLogo size="sm" />
        <HeaderField label="NAME" value={data.playerName} width={260} />
        <HeaderField label="DATE" value={data.date} width={110} />
        <HeaderField label="COURSE" value={data.course} width={260} />
        <HeaderField label="YARDAGE" value={data.yardage} width={100} />
        <HeaderField label="PAR" value={data.par} width={70} />
      </div>

      {/* ============ MAIN TABLE ============ */}
      <table className="border-collapse" style={{ width: "100%", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 140 }} />
          <col style={{ width: 32 }} /> {/* ex */}
          {Array.from({ length: 9 }, (_, i) => (
            <col key={i} style={{ width: 32 }} />
          ))}
          <col style={{ width: 36 }} /> {/* IN (front 9 subtotal) */}
          {Array.from({ length: 9 }, (_, i) => (
            <col key={i} style={{ width: 32 }} />
          ))}
          <col style={{ width: 36 }} /> {/* IN (back 9 subtotal) */}
          <col style={{ width: 36 }} /> {/* OUT */}
          <col style={{ width: 44 }} /> {/* TOTAL */}
        </colgroup>

        <thead>
          {/* Hole numbers header */}
          <tr>
            <RowLabel primary="HOLE" />
            <PlainCell value="ex" bold small background={C.grayBg} />
            {front9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.holeNumber} bold small background={C.grayBg} />
            ))}
            <PlainCell value="IN" bold small background={C.grayBg} />
            {back9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.holeNumber} bold small background={C.grayBg} />
            ))}
            <PlainCell value="IN" bold small background={C.grayBg} />
            <PlainCell value="OUT" bold small background={C.grayBg} />
            <PlainCell value="TOTAL" bold small background={C.grayBg} />
          </tr>
        </thead>

        <tbody>
          {/* PAR */}
          <tr>
            <RowLabel primary="PAR" />
            <PlainCell value={4} small background={C.grayBg} />
            {front9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.par} small />
            ))}
            <PlainCell value={sumOrNull(front9.map((h) => h.par))} bold small background={C.grayBg} />
            {back9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.par} small />
            ))}
            <PlainCell value={sumOrNull(back9.map((h) => h.par))} bold small background={C.grayBg} />
            <PlainCell value={sumOrNull(front9.map((h) => h.par))} bold small background={C.grayBg} />
            <PlainCell value={data.par ?? sumOrNull(data.holes.map((h) => h.par))} bold small background={C.grayBg} />
          </tr>

          {/* SCORE */}
          <tr>
            <RowLabel primary="SCORE" />
            <PlainCell value={5} small background={C.grayBg} />
            {front9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.score} small />
            ))}
            <PlainCell value={data.scoreOut} bold small background={C.grayBg} />
            {back9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.score} small />
            ))}
            <PlainCell value={data.scoreIn} bold small background={C.grayBg} />
            <PlainCell value={data.scoreOut} bold small background={C.grayBg} />
            <PlainCell value={data.scoreTotal} bold small background={C.grayBg} />
          </tr>

          {/* ENTER SCORING ZONE */}
          <tr>
            <RowLabel primary="ENTER SCORING ZONE" secondary="100 / 50 / 25 / GIR" />
            <DiagonalCell value="50" mark="check" isExample />
            {front9.map((h) => (
              <DiagonalCell
                key={h.holeNumber}
                value={h.enterSzYds}
                mark={enterSzMark(h, data.enterSzGoal)}
              />
            ))}
            <PlainCell value={data.enterSzOutCount} bold small background={C.grayBg} />
            {back9.map((h) => (
              <DiagonalCell
                key={h.holeNumber}
                value={h.enterSzYds}
                mark={enterSzMark(h, data.enterSzGoal)}
              />
            ))}
            <PlainCell value={data.enterSzInCount} bold small background={C.grayBg} />
            <PlainCell value={data.enterSzOutCount} bold small background={C.grayBg} />
            <PlainCell value={data.enterSzTotalCount} bold small background={C.grayBg} />
          </tr>

          {/* LENGTH OF 1st PUTT */}
          <tr>
            <RowLabel primary="LENGTH OF 1ˢᵗ PUTT" />
            <PlainCell value="24'" small background={C.grayBg} />
            {front9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.firstPuttFt != null ? `${h.firstPuttFt}'` : ""} small />
            ))}
            <PlainCell value="" small background={C.grayBg} />
            {back9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.firstPuttFt != null ? `${h.firstPuttFt}'` : ""} small />
            ))}
            <PlainCell value="" small background={C.grayBg} />
            <PlainCell value="" small background={C.grayBg} />
            <PlainCell value="" small background={C.grayBg} />
          </tr>

          {/* SCORING ZONE - # of shots */}
          <tr>
            <RowLabel primary="SCORING ZONE" secondary={`# of shots · goal ${data.szShotsGoal}`} />
            <DiagonalCell value={3} mark="check" isExample />
            {front9.map((h) => (
              <DiagonalCell key={h.holeNumber} value={h.szShots} mark={downSzMark(h)} />
            ))}
            <PlainCell value={data.szShotsOutCount} bold small background={C.grayBg} />
            {back9.map((h) => (
              <DiagonalCell key={h.holeNumber} value={h.szShots} mark={downSzMark(h)} />
            ))}
            <PlainCell value={data.szShotsInCount} bold small background={C.grayBg} />
            <PlainCell value={data.szShotsOutCount} bold small background={C.grayBg} />
            <PlainCell value={data.szShotsTotalCount} bold small background={C.grayBg} />
          </tr>

          {/* TOTAL PUTTS */}
          <tr>
            <RowLabel primary="TOTAL PUTTS" />
            <PlainCell value={2} small background={C.grayBg} />
            {front9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.totalPutts} small />
            ))}
            <PlainCell value={data.puttsOut} bold small background={C.grayBg} />
            {back9.map((h) => (
              <PlainCell key={h.holeNumber} value={h.totalPutts} small />
            ))}
            <PlainCell value={data.puttsIn} bold small background={C.grayBg} />
            <PlainCell value={data.puttsOut} bold small background={C.grayBg} />
            <PlainCell value={data.puttsTotal} bold small background={C.grayBg} />
          </tr>

          {/* Sub-row de headers de buckets — solo arriba de las 3 últimas columnas para la fila PUTTS */}
          <tr>
            <td className="border border-black px-2 py-0.5 text-right" style={{ background: C.grayBg }}>
              <div className="text-[8px] font-semibold uppercase tracking-tight" style={{ color: C.muted }}>
                MAKES / ATTEMPTS
              </div>
            </td>
            <td colSpan={10} style={{ border: "none", background: "transparent" }} />
            <td colSpan={9} style={{ border: "none", background: "transparent" }} />
            <td className="border border-black text-center" style={{ fontSize: 8, fontWeight: 700, background: C.grayBg }}>
              0-3'
            </td>
            <td className="border border-black text-center" style={{ fontSize: 8, fontWeight: 700, background: C.grayBg }}>
              3-6'
            </td>
            <td className="border border-black text-center" style={{ fontSize: 8, fontWeight: 700, background: C.grayBg }}>
              6-10'
            </td>
          </tr>

          {/* PUTTS < threshold MADE/MISSED — los buckets van en las 3 últimas columnas */}
          <tr>
            <RowLabel
              primary={`PUTTS < ${data.shortPuttThresholdFt}'`}
              secondary="MADE / MISSED"
            />
            <DiagonalCell value="5'" mark="x" isExample />
            {front9.map((h) => (
              <DiagonalCell
                key={h.holeNumber}
                value={h.firstPuttFt != null && h.firstPuttFt <= data.shortPuttThresholdFt ? `${h.firstPuttFt}'` : ""}
                mark={shortPuttMark(h)}
              />
            ))}
            {/* Las 3 últimas columnas en esta fila NO son subtotales — son los buckets made/attempts */}
            <PlainCell value={bucketCell(data.puttsMade0to3, data.puttsAttempts0to3)} bold small background={C.grayBg} />
            {back9.map((h) => (
              <DiagonalCell
                key={h.holeNumber}
                value={h.firstPuttFt != null && h.firstPuttFt <= data.shortPuttThresholdFt ? `${h.firstPuttFt}'` : ""}
                mark={shortPuttMark(h)}
              />
            ))}
            <PlainCell value={bucketCell(data.puttsMade3to6, data.puttsAttempts3to6)} bold small background={C.grayBg} />
            <PlainCell value={bucketCell(data.puttsMade6to10, data.puttsAttempts6to10)} bold small background={C.grayBg} />
            {/* Última celda vacía o el threshold elegido */}
            <PlainCell value={`< ${data.shortPuttThresholdFt}'`} bold small background={C.grayBg} />
          </tr>
        </tbody>
      </table>

      {/* ============ BOTTOM PANEL ============ */}
      <div className="mt-3 grid grid-cols-[2fr_1fr_0.6fr_1fr] gap-4">
        {/* 10 KEYS TO SCORING TALLY */}
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: C.ink }}>
            THE "10 KEYS TO SCORING" · TALLY EACH TIME YOU BROKE ONE
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <KeyRow num={1} label="MISSED SHORT PUTTS" count={data.keys.missedShortPutts} />
            <KeyRow num={6} label="PLAYING RISKY SHOTS" count={data.keys.riskyShots} />
            <KeyRow num={2} label="PENALTY STROKES" count={data.keys.penaltyStrokes} />
            <KeyRow num={7} label="SHORT-SIDING" count={data.keys.shortSiding} />
            <KeyRow num={3} label="NOT GETTING OUT OF TROUBLE" count={data.keys.notOutOfTrouble} />
            <KeyRow num={8} label="HOLDING ONTO BAD SHOTS" count={data.keys.holdingBadShots} />
            <KeyRow num={4} label="THREE PUTTS" count={data.keys.threePutts} />
            <KeyRow num={9} label="MISREADING THE LIE" count={data.keys.misreadingLie} />
            <KeyRow num={5} label="UNDER CLUBBING" count={data.keys.underClubbing} />
            <KeyRow num={10} label="STARTING POORLY" count={data.keys.startingPoorly} />
          </div>
        </div>

        {/* ENTERING THE SCORING ZONE concentric */}
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide">
            ENTERING THE SCORING ZONE
          </div>
          <ConcentricSemicircle
            values={[
              { label: ">100", count: data.enterSzCounts.over100 },
              { label: "100", count: data.enterSzCounts.at100 },
              { label: "50", count: data.enterSzCounts.at50 },
              { label: "25", count: data.enterSzCounts.at25 },
              { label: "GIR", count: data.enterSzCounts.gir },
            ]}
            highlighted=">100"
            colors={["#1a1a1a", "#F1C40F", "#E67E22", "#3498DB"]}
          />
        </div>

        {/* PROXY */}
        <div>
          <div className="mb-1 rounded border px-2 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide" style={{ borderColor: C.ink }}>
            PROXY
          </div>
          <div className="space-y-0.5 text-[9px] font-semibold">
            <ProxyRow label="100" value={data.proxy.from100Ft} />
            <ProxyRow label="50" value={data.proxy.from50Ft} />
            <ProxyRow label="25" value={data.proxy.from25Ft} />
            <ProxyRow label="GIR" value={data.proxy.fromGirFt} />
          </div>
        </div>

        {/* DOWN THE SCORING ZONE concentric */}
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide">
            DOWN THE SCORING ZONE
          </div>
          <ConcentricSemicircle
            values={[
              { label: ">5", count: data.downSzCounts.over5 },
              { label: "4", count: data.downSzCounts.at4 },
              { label: "3", count: data.downSzCounts.at3 },
              { label: "2", count: data.downSzCounts.at2 },
              { label: "1", count: data.downSzCounts.at1 },
            ]}
            highlighted=">5"
            colors={["#1a1a1a", "#F1C40F", "#E67E22", "#3498DB"]}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 border-t pt-2 text-center text-[8px] tracking-wide" style={{ borderColor: C.borderLight, color: C.muted }}>
        Tracked with Scoring Method Tracker · www.TheScoringMethod.com
      </div>
    </div>
  );
}

// ============ Sub helpers ============

function HeaderField({ label, value, width }: { label: string; value: string | number | null; width: number }) {
  return (
    <div className="flex items-baseline gap-2" style={{ width }}>
      <span className="text-[9px] font-bold tracking-wider" style={{ color: C.muted }}>
        {label}
      </span>
      <span
        className="flex-1 border-b text-[11px] font-semibold"
        style={{ borderColor: C.borderLight, color: C.ink, paddingBottom: 1, minHeight: 14 }}
      >
        {value ?? ""}
      </span>
    </div>
  );
}

function KeyRow({ num, label, count }: { num: number; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[9.5px]">
      <span className="flex-1" style={{ color: C.ink }}>
        {num}. {label}
      </span>
      <span
        className="inline-flex h-[14px] w-[34px] items-center justify-center border text-[10px] font-bold"
        style={{ borderColor: C.borderLight, background: C.grayBg, color: C.ink }}
      >
        {count > 0 ? count : ""}
      </span>
    </div>
  );
}

function ProxyRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-1">
      <span style={{ minWidth: 26 }}>{label}</span>
      <span className="border-b" style={{ borderColor: C.borderLight, minWidth: 30, paddingBottom: 1, color: C.ink }}>
        {value != null ? value : ""}
      </span>
    </div>
  );
}

function sumOrNull(xs: (number | null)[]): number | null {
  const valid = xs.filter((x): x is number => x != null);
  return valid.length === 0 ? null : valid.reduce((a, b) => a + b, 0);
}
