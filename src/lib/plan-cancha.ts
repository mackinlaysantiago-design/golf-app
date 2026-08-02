// Plan de cancha de La Lucila — lectura pura, cero inputs.
//
// Transcripción de ~/golf-coach/plan-cancha-la-lucila.md (v2, 17/07/2026), el archivo
// donde Santi eligió el palo de tee hoyo por hoyo con el coach. Esto es lo que ninguna
// app comercial puede tener: en el tee, el plan le gana al cálculo automático por
// distancia (en el 1 el automático diría Driver y el plan dice 4i porque te pasás).
//
// Reglas madre: fairway > distancia · centro del green / entre dos palos, el corto ·
// sangre fría en índice 1-6 (4-16-1-11-3-12): par o bogey, jamás doble.

export type DangerSide = "L" | "R" | null;

export type HolePlan = {
  hole: number;
  /** Palo de tee del plan. Manda sobre la sugerencia por distancia. */
  teeClub: string;
  /** Lado malo (OB / hazard). Determina hacia dónde conviene errar. */
  danger: DangerSide;
  /** Una línea, lo que importa acordarse parado en el tee. */
  note: string;
  /** true si el plan admite driver "si venís pegándolo bien" — no es orden fija. */
  teeClubIsConditional?: boolean;
};

// Peligros según el perfil de juego de Santi: OB a la DERECHA en 1, 4, 9 y 18 (por eso
// erra a la izquierda a propósito ahí) y hazard a la IZQUIERDA en 6 y 15.
// NOTA: La Lucila son 9 hoyos jugados dos veces con tees distintos. El perfil nombra
// "1/4/9(18)" y "6/15" y no dice qué pasa en 10 y 13, así que ahí no se marca peligro
// en vez de suponerlo.
export const PLAN_LA_LUCILA: HolePlan[] = [
  { hole: 1, teeClub: "4i", danger: "R", note: "Con driver te pasás (FIR 31%). Approach 5i/6i al centro. Warmup antes es obligatorio." },
  { hole: 2, teeClub: "4i", danger: null, note: "El driver corre de largo. Te deja ~80 yd de wedge: buscá birdie." },
  { hole: 3, teeClub: "Driver", danger: null, note: "Driver al fairway, después 8i/9i al centro." },
  { hole: 4, teeClub: "Driver", danger: "R", note: "FIR 77%, el tee anda. Approach al LADO LARGO de la bandera, nunca short-side." },
  { hole: 5, teeClub: "6i", danger: null, note: "Par 3 de 166 al centro. Hoyo arreglado, no lo compliques." },
  { hole: 6, teeClub: "4i", danger: "L", note: "FIR 20%: el tee es la raíz del problema acá. Después 8i/9i." },
  { hole: 7, teeClub: "Driver", danger: null, note: "Driver + 7i + wedge. Disciplina: NO madera al green (el colapso 7-5-6-6 de julio salió de acá)." },
  { hole: 8, teeClub: "9i", danger: null, note: "9i pleno al centro. Aceptá el frente del green." },
  { hole: 9, teeClub: "Driver", danger: "R", note: "Driver + layup + wedge. Cero heroísmo." },
  { hole: 10, teeClub: "4i", danger: null, teeClubIsConditional: true, note: "4i, o driver si venís pegándolo bien. Approach con palo corto: no te pases." },
  { hole: 11, teeClub: "4i", danger: null, note: "Tu peor hoyo (+1,29). El socket sale de apurarte. Primer putt = lag de ritmo, moría al hoyo." },
  { hole: 12, teeClub: "4i", danger: null, note: "4i al fairway (FIR 43%). Approach largo → centro del green. Par o bogey, jamás doble." },
  { hole: 13, teeClub: "Driver", danger: null, teeClubIsConditional: true, note: "Driver si lo estás pegando bien; si no, 4i. Fairway → green → 2 putts." },
  { hole: 14, teeClub: "4i", danger: null, note: "4i SUAVE. Nunca 5i: no llega al frente (181, frente a 172). Regla fija." },
  { hole: 15, teeClub: "Driver", danger: "L", note: "Agresivo. Green en 2 si el drive queda bien. Tu hoyo de birdie." },
  { hole: 16, teeClub: "Driver", danger: null, teeClubIsConditional: true, note: "Driver si venís bien, si no 3W. Después palo de más al centro, swing suave. Índice 2." },
  { hole: 17, teeClub: "W full", danger: null, note: "PW al centro. Hoyo sólido, no lo regales." },
  { hole: 18, teeClub: "Driver", danger: "R", note: "Driver + 7i + W pleno (~113). NO madera desde 260 (error conocido)." },
];

/** Hoyos donde el plan pide sangre fría: par o bogey, jamás doble. */
export const HOLES_SANGRE_FRIA = new Set([4, 16, 1, 11, 3, 12]);

const BY_COURSE: Record<string, HolePlan[]> = {
  "La Lucila": PLAN_LA_LUCILA,
};

/** Plan del hoyo, o null si la cancha no tiene plan cargado (todas menos La Lucila). */
export function holePlan(courseName: string, hole: number): HolePlan | null {
  return BY_COURSE[courseName]?.find((h) => h.hole === hole) ?? null;
}

export function coursePlan(courseName: string): HolePlan[] | null {
  return BY_COURSE[courseName] ?? null;
}
