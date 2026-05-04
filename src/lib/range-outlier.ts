// Filtra outliers obvios de un set de shots del MISMO palo antes de guardar.
// Razones típicas: mishits, swings fallidos, tiro con otro palo sin cambiar el club.

export type ShotForFilter = {
  rowType?: string | null;
  carryYds?: number | null;
  lateralYds?: number | null;
  lateralDir?: string | null;
  shotNumber?: number;
};

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type OutlierResult<T extends ShotForFilter> = {
  kept: T[];
  discarded: { shot: T; reason: string }[];
};

// Reglas:
//  - Solo aplicar si n >= 5 shots con carry (no descartar con muestras chicas)
//  - Outlier de carry: < 60% o > 160% de la mediana
//  - Outlier de lateral absoluto: |lat| > 50 yds (slice/hook severo o palo distinto)
//  - Mantiene siempre AVG/DEV rows (no son shots)
export function filterClubOutliers<T extends ShotForFilter>(
  shots: T[],
): OutlierResult<T> {
  const result: OutlierResult<T> = { kept: [], discarded: [] };

  // Separar SHOT vs AVG/DEV (los segundos siempre se mantienen)
  const shotRows = shots.filter((s) => (s.rowType ?? "SHOT") === "SHOT");
  const otherRows = shots.filter((s) => (s.rowType ?? "SHOT") !== "SHOT");
  result.kept.push(...otherRows);

  const carries = shotRows
    .map((s) => s.carryYds)
    .filter((v): v is number => v != null);

  if (carries.length < 5) {
    // Muestra muy chica para tener mediana confiable
    result.kept.push(...shotRows);
    return result;
  }

  const med = median(carries);
  const lowerCarry = med * 0.6;
  const upperCarry = med * 1.6;

  for (const s of shotRows) {
    const reasons: string[] = [];
    if (s.carryYds != null) {
      if (s.carryYds < lowerCarry) reasons.push(`carry ${s.carryYds.toFixed(0)}y (<60% de la mediana ${med.toFixed(0)})`);
      else if (s.carryYds > upperCarry) reasons.push(`carry ${s.carryYds.toFixed(0)}y (>160% de la mediana ${med.toFixed(0)})`);
    }
    if (s.lateralYds != null && Math.abs(s.lateralYds) > 50) {
      reasons.push(`lateral ${s.lateralYds.toFixed(0)}${s.lateralDir ?? ""}y (extremo)`);
    }
    if (reasons.length > 0) {
      result.discarded.push({ shot: s, reason: reasons.join(" + ") });
    } else {
      result.kept.push(s);
    }
  }

  return result;
}
