/**
 * Página 2 (back) del TSM Advanced Scorecard Level 2.
 * Ref: docs/knowledge-base/resources/advanced_scorecard_level_2.pdf (página 2)
 *
 * Contenido:
 *  - Tabla 10 Keys to Scoring: nombre | tally count | solution
 *  - Best parts of your round (3 líneas)
 *  - Describe your best shot
 *  - Logo TSM grande
 *  - www.TheScoringMethod.com
 *  - Copyright
 */

import type { ScorecardData } from "@/lib/scorecard";

const C = {
  ink: "#000",
  muted: "#666",
  grayBg: "#f0f0f0",
  border: "#888",
};

const KEYS = [
  { num: 1, label: "MISSED SHORT PUTTS", solution: "TEST YOURSELF FROM YOUR ONE-PUTT CIRCLE", key: "missedShortPutts" },
  { num: 2, label: "PENALTY STROKES", solution: "PLAY AWAY, AVOID TROUBLE AT ALL COST", key: "penaltyStrokes" },
  { num: 3, label: "NOT GETTING OUT OF TROUBLE", solution: "PLAY THE SAFE SHOT TO GET BACK IN PLAY", key: "notOutOfTrouble" },
  { num: 4, label: "THREE PUTTS", solution: "LONG PUTTS NEED GOOD PACE, NOT GREAT READS", key: "threePutts" },
  { num: 5, label: "UNDER CLUBBING", solution: "LEARN YOUR CARRY YARDAGE", key: "underClubbing" },
  { num: 6, label: "PLAYING RISKY SHOTS", solution: "PLAY WITHIN YOUR COMFORT LEVEL", key: "riskyShots" },
  { num: 7, label: "SHORT SIDING", solution: "PLAY TO THE LONG SIDE OF THE FLAG", key: "shortSiding" },
  { num: 8, label: "HOLDING ON TO BAD SHOTS", solution: "PUT THE LAST SHOT BEHIND & FOCUS ON NEXT SHOT", key: "holdingBadShots" },
  { num: 9, label: "MISREADING THE LIE", solution: "LEARN WHAT SHOT IS POSSIBLE FROM YOUR LIE", key: "misreadingLie" },
  { num: 10, label: "STARTING POORLY", solution: "START OFF IN FIRST GEAR", key: "startingPoorly" },
] as const;

export function OfficialScorecardBack({ data }: { data: ScorecardData }) {
  return (
    <div
      className="mx-auto bg-white p-6 shadow-lg"
      style={{
        width: 1400,
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: C.ink,
      }}
    >
      <div className="grid grid-cols-[1.5fr_1fr] gap-8">
        {/* ============ LEFT: 10 KEYS TABLE + BEST PARTS ============ */}
        <div>
          {/* Title */}
          <div className="mb-3">
            <div className="text-center text-[14px] font-extrabold uppercase tracking-wider">
              {'THE "10 KEYS TO SCORING"'}
            </div>
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
              {"CIRCLE TOP 2 KEYS BROKEN & SOLUTIONS YOU'LL PRACTICE"}
            </div>
          </div>

          {/* Tabla 3 columnas */}
          <table className="w-full border-collapse text-[10px]" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "45%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "45%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: C.grayBg }}>
                <th className="border border-black px-2 py-1.5 text-left font-bold tracking-wider">TALLY KEYS BROKEN</th>
                <th className="border border-black px-2 py-1.5 text-center font-bold tracking-wider">{"#'s"}</th>
                <th className="border border-black px-2 py-1.5 text-left font-bold tracking-wider">THE SOLUTIONS</th>
              </tr>
            </thead>
            <tbody>
              {KEYS.map((k, i) => {
                const count = data.keys[k.key as keyof typeof data.keys] ?? 0;
                const altBg = i % 2 === 1 ? C.grayBg : "#fff";
                return (
                  <tr key={k.num}>
                    <td className="border border-black px-2 py-1" style={{ background: altBg }}>
                      <span className="font-semibold">{k.num}. </span>
                      {k.label}
                    </td>
                    <td className="border border-black text-center font-bold" style={{ background: altBg, fontVariantNumeric: "tabular-nums" }}>
                      {count > 0 ? count : ""}
                    </td>
                    <td className="border border-black px-2 py-1 uppercase" style={{ background: altBg }}>
                      {k.solution}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* BEST PARTS */}
          <div className="mt-6">
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wider leading-tight">
                BEST PARTS OF<br />YOUR ROUND
              </div>
              <div className="space-y-1.5">
                {data.bestParts.map((part, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-[11px]">
                    <span className="font-semibold">{i + 1})</span>
                    <span
                      className="flex-1 border-b pb-0.5"
                      style={{ borderColor: C.border, minHeight: 18 }}
                    >
                      {part || <span style={{ color: C.muted }}>—</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DESCRIBE YOUR BEST SHOT */}
          <div className="mt-4">
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wider leading-tight">
                DESCRIBE YOUR<br />BEST SHOT, IN<br />DETAIL
              </div>
              <div className="space-y-1.5">
                <BestShotLine value={data.bestShotDescription} />
                <BestShotLine value="" />
                <BestShotLine value="" />
              </div>
            </div>
          </div>
        </div>

        {/* ============ RIGHT: TSM LOGO + URL + COPYRIGHT ============ */}
        <div className="flex flex-col items-center justify-between py-4">
          <div className="flex flex-col items-center gap-6">
            {/* Logo grande */}
            <TsmLogoLarge />
            {/* URL */}
            <div className="mt-2 text-[16px] font-light tracking-wide">
              www.TheScoringMethod.com
            </div>
          </div>
          {/* Three dots + copyright */}
          <div className="flex w-full items-end justify-between">
            <div className="flex gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: C.ink }} />
              <div className="h-2 w-2 rounded-full" style={{ background: C.ink }} />
              <div className="h-2 w-2 rounded-full" style={{ background: C.ink }} />
            </div>
            <div className="text-[9px]" style={{ color: C.muted }}>
              Tracked with Scoring Method Tracker · Copyright©2020 RGX
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BestShotLine({ value }: { value: string }) {
  return (
    <div className="border-b text-[11px]" style={{ borderColor: C.border, minHeight: 18, paddingBottom: 1 }}>
      {value || ""}
    </div>
  );
}

function TsmLogoLarge() {
  const dots = [
    [1, 0, 1],
    [0, 1, 0],
  ].flat();
  return (
    <div className="flex items-center gap-4 border-r-2 pr-4" style={{ borderColor: C.ink }}>
      <div className="grid grid-cols-3" style={{ gap: 6 }}>
        {dots.map((filled, i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: filled ? C.ink : "transparent",
              border: filled ? "none" : `2px solid ${C.ink}`,
            }}
          />
        ))}
      </div>
      <div className="font-extrabold leading-[1.05] tracking-wide" style={{ fontSize: 32, color: C.ink }}>
        THE
        <br />
        SCORING
        <br />
        METHOD
      </div>
    </div>
  );
}
