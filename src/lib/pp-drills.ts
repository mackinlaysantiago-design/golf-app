// Definición de drills PP (Will Robins method)

export type DrillType =
  | "ONE_PUTT_CIRCLE"
  | "TWO_PUTT_CIRCLE"
  | "CHIPPING"
  | "WEDGES_50"
  | "WEDGES_70"
  | "WEDGES_100"
  | "GO_TO_CLUB";

export type DrillDef = {
  type: DrillType;
  label: string;
  description: string;
  defaultDistance: number;
  distanceUnit: "ft" | "yds";
  scoreLabel: string; // qué se mide (ej "embocados", "dentro 2PC", etc)
  defaultAttempts: number;
};

export const DRILLS: DrillDef[] = [
  {
    type: "ONE_PUTT_CIRCLE",
    label: "1-putt circle (short putts)",
    description: "10 putts cortos. Cuenta cuántos embocás",
    defaultDistance: 6,
    distanceUnit: "ft",
    scoreLabel: "embocados de 10",
    defaultAttempts: 10,
  },
  {
    type: "TWO_PUTT_CIRCLE",
    label: "2-putt circle (lag putts)",
    description: "10 putts largos. Cuenta cuántos quedan dentro del 2-putt circle",
    defaultDistance: 30,
    distanceUnit: "ft",
    scoreLabel: "dentro 2PC de 10",
    defaultAttempts: 10,
  },
  {
    type: "CHIPPING",
    label: "Chipping circle (3 shots)",
    description: "9 hoyos chipping. Suma de golpes para terminar (objetivo: ≤27)",
    defaultDistance: 20,
    distanceUnit: "yds",
    scoreLabel: "suma golpes (9 hoyos)",
    defaultAttempts: 9,
  },
  {
    type: "WEDGES_50",
    label: "Wedges 50 yds",
    description: "10 wedges desde 50 yds. Cuenta cuántos quedan dentro 2-putt circle",
    defaultDistance: 50,
    distanceUnit: "yds",
    scoreLabel: "dentro 2PC de 10",
    defaultAttempts: 10,
  },
  {
    type: "WEDGES_70",
    label: "Wedges 70 yds",
    description: "10 wedges desde 70 yds. Cuenta cuántos quedan dentro 2-putt circle",
    defaultDistance: 70,
    distanceUnit: "yds",
    scoreLabel: "dentro 2PC de 10",
    defaultAttempts: 10,
  },
  {
    type: "WEDGES_100",
    label: "Wedges 100 yds",
    description: "10 wedges desde 100 yds. Cuenta cuántos quedan dentro 2-putt circle",
    defaultDistance: 100,
    distanceUnit: "yds",
    scoreLabel: "dentro 2PC de 10",
    defaultAttempts: 10,
  },
  {
    type: "GO_TO_CLUB",
    label: "Go-To Club (driver/madera)",
    description: "10 tiros con palo de salida. Cuenta cuántos quedan en fairway",
    defaultDistance: 200,
    distanceUnit: "yds",
    scoreLabel: "en FW de 10",
    defaultAttempts: 10,
  },
];

export const DRILL_BY_TYPE: Record<DrillType, DrillDef> = Object.fromEntries(
  DRILLS.map((d) => [d.type, d]),
) as Record<DrillType, DrillDef>;
