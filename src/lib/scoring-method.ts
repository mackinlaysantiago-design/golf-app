// Scoring Method (Will Robins) — KPIs y PP Plan
// Configurables por ronda: enterSzYds, downInSzStrokes, onePuttCircleFt, twoPuttCircleYds

export type HoleData = {
  holeNumber: number;
  par: number;
  strokesToEnterSz: number | null;
  distanceInRegYds: number | null;
  strokesInsideSz: number | null;
  putts: number | null;
  firstPuttDistanceFt: number | null;
  puttMadeDistanceFt: number | null;
  puttsInside1PuttCircle: number | null;
  score: number | null;
};

export type RoundConfig = {
  enterSzYds: number;
  downInSzStrokes: number;
  onePuttCircleFt: number;
  twoPuttCircleYds: number;
};

export type HoleFlags = {
  enterSz: boolean | null;
  downInSz: boolean | null;
  threePutts: boolean | null;
  missedIn1PuttCircle: boolean | null;
};

export function computeHoleFlags(
  hole: HoleData,
  config: RoundConfig,
): HoleFlags {
  const { distanceInRegYds, strokesInsideSz, putts, puttsInside1PuttCircle } = hole;

  // Enter SZ: la distancia al hoyo cuando entras a SZ <= enterSzYds
  // Si distanceInRegYds es null pero hay datos, no se puede determinar
  const enterSz =
    distanceInRegYds == null ? null : distanceInRegYds <= config.enterSzYds;

  // Down in SZ: strokesInsideSz <= downInSzStrokes
  const downInSz =
    strokesInsideSz == null ? null : strokesInsideSz <= config.downInSzStrokes;

  // 3 putts: NO terminar con 3+ putts (✅ = bueno = menos de 3 putts)
  const threePutts = putts == null ? null : putts < 3;

  // Missed in 1 putt circle: ¿tuvo putts dentro del 1-putt circle pero no embocó?
  // Si puttsInside1PuttCircle === 1 y se embocó (made == 1) → ok (✅)
  // Si puttsInside1PuttCircle > 1 → falló adentro del círculo (❌)
  const missedIn1PuttCircle =
    puttsInside1PuttCircle == null ? null : puttsInside1PuttCircle <= 1;

  return { enterSz, downInSz, threePutts, missedIn1PuttCircle };
}

export type RoundKPIs = {
  totalScore: number;
  totalPar: number;
  scoreVsPar: number;
  totalPutts: number;
  avgPuttsPerHole: number;
  // Enter SZ buckets (cantidad de hoyos donde entró desde X yds)
  enterSzBuckets: {
    over100: number;
    under100: number;
    under50: number;
    under25: number;
    gir: number; // distanceInRegYds === 0
  };
  // Down in SZ buckets (cantidad de hoyos terminados en N golpes desde SZ)
  downInSzBuckets: {
    over5: number;
    s4: number;
    s3: number;
    s2: number;
    s1: number;
    s0: number;
  };
  // Distribución 1st putt
  firstPuttBuckets: {
    over20: number;
    under20: number;
    under15: number;
    under10: number;
    under5: number;
    under3: number;
    under1: number;
  };
  // Made puts en cada bucket
  firstPuttMadeBuckets: {
    over20: number;
    under20: number;
    under15: number;
    under10: number;
    under5: number;
    under3: number;
    under1: number;
  };
  // % de hoyos sin doble bogey (KPI #1 Scoring Method)
  pctNoDoubleBogey: number;
  holesWithDoubleOrWorse: number;
  // Counts de flags (numerador = cumplen criterio)
  enterSzCount: number;
  downInSzCount: number;
  threePuttsHoles: number; // hoyos con 3+ putts
  missedIn1PuttCircleHoles: number;
  // Denominadores por métrica (hoyos con datos cargados — distintos por métrica)
  enterSzDataHoles: number;       // hoyos con distanceInRegYds cargado
  downInSzDataHoles: number;      // hoyos con strokesInsideSz cargado
  puttsDataHoles: number;         // hoyos con putts cargado
  firstPuttDataHoles: number;     // hoyos con firstPuttDistanceFt cargado
  onePuttCircleDataHoles: number; // hoyos con puttsInside1PuttCircle cargado
  holesPlayed: number;            // hoyos con score > 0
};

export function computeRoundKPIs(
  holes: HoleData[],
  config: RoundConfig,
): RoundKPIs {
  const played = holes.filter((h) => h.score != null && h.score > 0);
  const totalScore = played.reduce((s, h) => s + (h.score ?? 0), 0);
  const totalPar = played.reduce((s, h) => s + h.par, 0);
  const totalPutts = holes.reduce((s, h) => s + (h.putts ?? 0), 0);
  const playedWithPutts = holes.filter((h) => h.putts != null);
  const avgPuttsPerHole =
    playedWithPutts.length > 0 ? totalPutts / playedWithPutts.length : 0;

  const enterSzBuckets = {
    over100: 0,
    under100: 0,
    under50: 0,
    under25: 0,
    gir: 0,
  };
  const downInSzBuckets = { over5: 0, s4: 0, s3: 0, s2: 0, s1: 0, s0: 0 };
  const firstPuttBuckets = {
    over20: 0,
    under20: 0,
    under15: 0,
    under10: 0,
    under5: 0,
    under3: 0,
    under1: 0,
  };
  const firstPuttMadeBuckets = {
    over20: 0,
    under20: 0,
    under15: 0,
    under10: 0,
    under5: 0,
    under3: 0,
    under1: 0,
  };

  let enterSzCount = 0;
  let downInSzCount = 0;
  let threePuttsHoles = 0;
  let missedIn1PuttCircleHoles = 0;
  let holesWithDoubleOrWorse = 0;
  let enterSzDataHoles = 0;
  let downInSzDataHoles = 0;
  let puttsDataHoles = 0;
  let firstPuttDataHoles = 0;
  let onePuttCircleDataHoles = 0;

  for (const h of holes) {
    if (h.score == null || h.score === 0) continue;

    // Score vs par
    if (h.score - h.par >= 2) holesWithDoubleOrWorse++;

    // Enter SZ buckets
    if (h.distanceInRegYds != null) {
      enterSzDataHoles++;
      const d = h.distanceInRegYds;
      if (d > 100) enterSzBuckets.over100++;
      else if (d > 50) enterSzBuckets.under100++;
      else if (d > 25) enterSzBuckets.under50++;
      else if (d > 0) enterSzBuckets.under25++;
      else enterSzBuckets.gir++;

      if (d <= config.enterSzYds) enterSzCount++;
    }

    // Down in SZ buckets
    if (h.strokesInsideSz != null) {
      downInSzDataHoles++;
      const s = h.strokesInsideSz;
      if (s >= 5) downInSzBuckets.over5++;
      else if (s === 4) downInSzBuckets.s4++;
      else if (s === 3) downInSzBuckets.s3++;
      else if (s === 2) downInSzBuckets.s2++;
      else if (s === 1) downInSzBuckets.s1++;
      else downInSzBuckets.s0++;

      if (s <= config.downInSzStrokes) downInSzCount++;
    }

    // 1st putt buckets (en ft)
    if (h.firstPuttDistanceFt != null) {
      firstPuttDataHoles++;
      const d = h.firstPuttDistanceFt;
      // Cada bucket es excluyente — el shot cae en UN bucket
      if (d > 20) firstPuttBuckets.over20++;
      else if (d > 15) firstPuttBuckets.under20++;
      else if (d > 10) firstPuttBuckets.under15++;
      else if (d > 5) firstPuttBuckets.under10++;
      else if (d > 3) firstPuttBuckets.under5++;
      else if (d > 1) firstPuttBuckets.under3++;
      else firstPuttBuckets.under1++;

      // Made buckets: ¿lo embocó? (puttsInside1PuttCircle === 1 sugiere lo embocó al 1er intento adentro del círculo)
      // Heurística: si putts === 1 → embocó el 1er putt
      if (h.putts === 1) {
        if (d > 20) firstPuttMadeBuckets.over20++;
        else if (d > 15) firstPuttMadeBuckets.under20++;
        else if (d > 10) firstPuttMadeBuckets.under15++;
        else if (d > 5) firstPuttMadeBuckets.under10++;
        else if (d > 3) firstPuttMadeBuckets.under5++;
        else if (d > 1) firstPuttMadeBuckets.under3++;
        else firstPuttMadeBuckets.under1++;
      }
    }

    if (h.putts != null) {
      puttsDataHoles++;
      if (h.putts >= 3) threePuttsHoles++;
    }
    if (h.puttsInside1PuttCircle != null) {
      onePuttCircleDataHoles++;
      if (h.puttsInside1PuttCircle > 1) missedIn1PuttCircleHoles++;
    }
  }

  const pctNoDoubleBogey =
    played.length > 0
      ? ((played.length - holesWithDoubleOrWorse) / played.length) * 100
      : 0;

  return {
    totalScore,
    totalPar,
    scoreVsPar: totalScore - totalPar,
    totalPutts,
    avgPuttsPerHole,
    enterSzBuckets,
    downInSzBuckets,
    firstPuttBuckets,
    firstPuttMadeBuckets,
    pctNoDoubleBogey,
    holesWithDoubleOrWorse,
    enterSzCount,
    downInSzCount,
    threePuttsHoles,
    missedIn1PuttCircleHoles,
    enterSzDataHoles,
    downInSzDataHoles,
    puttsDataHoles,
    firstPuttDataHoles,
    onePuttCircleDataHoles,
    holesPlayed: played.length,
  };
}

// PP Plan codes (A/B/1/2) — qué practicar próxima sesión
export type PPPlanCode = "A" | "B" | "1" | "2";

export type PPPlan = {
  code: PPPlanCode;
  label: string;
  count: number;
  reason: string;
}[];

export function computePPPlan(
  holes: HoleData[],
  config: RoundConfig,
  kpis: RoundKPIs,
): PPPlan {
  // Cuenta solo los hoyos donde efectivamente se cargó el dato
  const aNotInSz =
    kpis.enterSzDataHoles > 0 ? kpis.enterSzDataHoles - kpis.enterSzCount : 0;
  const bNotDownIn3 =
    kpis.downInSzDataHoles > 0 ? kpis.downInSzDataHoles - kpis.downInSzCount : 0;

  // Putts missed inside 6ft (1-putt circle) — hoyos con puttsInside1PuttCircle > 1
  const puttsMissed6 = kpis.missedIn1PuttCircleHoles;

  return [
    {
      code: "A",
      label: `A · No entró en SZ (${config.enterSzYds} yds)`,
      count: aNotInSz,
      reason: "Trabajar drives/aproximación para llegar más cerca del green",
    },
    {
      code: "B",
      label: `B · No bajó en ${config.downInSzStrokes} desde SZ`,
      count: bNotDownIn3,
      reason: "Trabajar chip/pitch desde 50 yds hacia adentro",
    },
    {
      code: "1",
      label: `1 · Putts errados dentro del 1-putt circle (${config.onePuttCircleFt}ft)`,
      count: puttsMissed6,
      reason: "Trabajar putts cortos — drill 6ft circle",
    },
    {
      code: "2",
      label: "2 · Hoyos con 3+ putts",
      count: kpis.threePuttsHoles,
      reason: "Trabajar lag putts (15-30 ft) para evitar 3-puttear",
    },
  ];
}
