/**
 * Shape de datos para la Round Assessment Card oficial (TSM).
 * Replica 1:1 los campos del PDF en `docs/knowledge-base/resources/round_assessment_card.pdf`.
 */

export type AssessmentCardData = {
  // Header
  playerName: string;
  date: string; // "DD/MM/YY"
  course: string;
  yardage: number | null;
  par: number | null;

  // A — PRE ROUND PREPARATION
  practiceRound: boolean;
  yardageBook: boolean;
  writtenPlan: boolean;
  personalParDefined: boolean;

  // B — PREP THAT DAY
  warmUp: string;
  mentalFocus: string;

  // C — ENTERING THE SCORING ZONE
  enterSz100Y: number;
  enterSz50Y: number;
  enterSz25Y: number;
  enterSzGIR: number;
  x100: number | null;
  penalties: number;
  proximityFromGirFt: number | null;
  proximityFrom25YFt: number | null;
  proximityFrom50YFt: number | null;
  proximityFrom100YFt: number | null;

  // D — DOWN IN THE SCORING ZONE (histograma)
  downInSz: [number, number, number, number, number, number]; // [0,1,2,3,4,5]

  // E — PAR BREAKDOWN (avg shots por tipo)
  par5Avg: number | null;
  par4Avg: number | null;
  par3Avg: number | null;

  // F — SCORE BREAKDOWN
  score: number | null;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  others: number;
  firstThree: number | null;
  lastThree: number | null;
  front9: number | null;
  back9: number | null;

  // G — STATS
  bunkerShotsTotal: number;
  bunkerShotsUpAndDown: number;
  greenSideUpDownAttempts: number;
  greenSideUpDownMade: number;
  totalPutts: number;
  total3Putts: number;
  puttsMade0to3: number;
  puttsAttempts0to3: number;
  puttsMade3to6: number;
  puttsAttempts3to6: number;
  puttsMade6to10: number;
  puttsAttempts6to10: number;

  // H — BEST PART
  bestPartOfRound: string;

  // I — SELF ASSESSMENT (% 0-100)
  mentalStrengthPct: number | null;
  positiveSelfTalkPct: number | null;
  fortitudePct: number | null;
  shotSelectionPct: number | null;
  shotExecutionPct: number | null;

  // J — SKILL SETS TO WORK ON
  skillUnder10Putts: string;
  skillLagPutts: string;
  skillChippingProx: string;
  skillWedgesProx: string;
  skillBallStriking: string;
  skillGoToClub: string;

  // K — LESSONS LEARNED
  lessonsLearned: string;
};

/**
 * Data de ejemplo realista para preview/dev.
 * Ronda de 82 en La Lucila (CAB azul, par 72).
 */
export const SAMPLE_CARD_DATA: AssessmentCardData = {
  playerName: "Santiago Mackinlay",
  date: "12/05/26",
  course: "La Lucila Country Club",
  yardage: 6248,
  par: 72,

  practiceRound: false,
  yardageBook: true,
  writtenPlan: true,
  personalParDefined: true,

  warmUp:
    "20 min range (driver, 7i, wedges) + 10 min chipping + 10 min lag putts y 4-footers",
  mentalFocus:
    "Paciencia primeros 3 hoyos · jugar al centro del green · soltar el shot malo en 5 segundos",

  enterSz100Y: 4,
  enterSz50Y: 6,
  enterSz25Y: 3,
  enterSzGIR: 5,
  x100: 2,
  penalties: 1,
  proximityFromGirFt: 22,
  proximityFrom25YFt: 8,
  proximityFrom50YFt: 14,
  proximityFrom100YFt: 19,

  downInSz: [0, 2, 9, 5, 1, 1],

  par5Avg: 5.25,
  par4Avg: 4.6,
  par3Avg: 3.5,

  score: 82,
  eagles: 0,
  birdies: 2,
  pars: 6,
  bogeys: 7,
  doubleBogeys: 2,
  others: 1,
  firstThree: 13, // bogey-bogey-double
  lastThree: 12, // bogey-par-bogey
  front9: 41,
  back9: 41,

  bunkerShotsTotal: 4,
  bunkerShotsUpAndDown: 1,
  greenSideUpDownAttempts: 8,
  greenSideUpDownMade: 3,
  totalPutts: 33,
  total3Putts: 2,
  puttsMade0to3: 5,
  puttsAttempts0to3: 6, // <-- 1 miss, va en rojo
  puttsMade3to6: 3,
  puttsAttempts3to6: 7,
  puttsMade6to10: 1,
  puttsAttempts6to10: 5,

  bestPartOfRound:
    "El putt para birdie en el 14 desde 15 ft después de un wedge a 4 ft. Sentí que solté el shot completo, sin pensar en el score.",

  mentalStrengthPct: 65,
  positiveSelfTalkPct: 70,
  fortitudePct: 55,
  shotSelectionPct: 75,
  shotExecutionPct: 60,

  skillUnder10Putts:
    "Putts de 4-6 ft — fallé 4. Trabajar Putting Sword + gate drill",
  skillLagPutts: "Bien en general, 2 three-putts ambos por mala lectura",
  skillChippingProx: "Promedio 6 ft del hoyo, target debería ser 3 ft",
  skillWedgesProx:
    "Wedges desde 50-75 yds inconsistentes — sesión wedge matrix esta semana",
  skillBallStriking: "Driver OK, hierros largos pegados al ras",
  skillGoToClub: "Híbrido 4 confiable, usar más off the tee en par 4s tight",

  lessonsLearned:
    "El doble del hoyo 3 vino de querer pegar driver con viento en contra. Aprendizaje: en viento >20 km/h, default a híbrido. La paciencia que mantuve después del doble pagó — birdie en el 5 y par en el 6.",
};
