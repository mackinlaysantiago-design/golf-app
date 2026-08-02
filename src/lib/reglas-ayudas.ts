// Qué ayudas de la app son legales y cuáles no, según la Regla 4.3a de golf.
// Verificado contra randa.org el 02/08/2026.
//
// 4.3a(1) NO permitido: "Measuring elevation changes" · "Interpreting distance or
//   directional information (such as using a device to get a recommended line of play
//   or club selection based on the location of the player's ball)".
// 4.3a(3) SÍ permitido: "información recogida ANTES de la vuelta (rondas previas,
//   tips, recomendaciones de palo)". NO: "procesar o interpretar información de juego
//   de la vuelta".
// Penalidad: general la 1ª infracción, DESCALIFICACIÓN la 2ª.

export type AyudaKey = "clubSuggestion" | "windEnabled" | "distances" | "planCancha" | "registro";

export type Ayuda = {
  key: AyudaKey;
  label: string;
  detalle: string;
  /** false = prohibida en torneo por la Regla 4.3a. */
  legalEnTorneo: boolean;
  regla: string;
  /** true si se puede prender/apagar por ronda; las legales van siempre. */
  configurable: boolean;
};

export const AYUDAS: Ayuda[] = [
  {
    key: "clubSuggestion",
    label: "Sugerencia de palo",
    detalle: "Te propone el palo según la distancia que tenés a la bandera.",
    legalEnTorneo: false,
    regla: "4.3a(1) — club selection based on the location of the player's ball",
    configurable: true,
  },
  {
    key: "windEnabled",
    label: "Viento",
    detalle: "Velocidad y componente en contra / a favor / cruzada.",
    legalEnTorneo: false,
    regla: "4.3a(1) — medir condiciones que afectan el juego",
    configurable: true,
  },
  {
    key: "distances",
    label: "Distancias GPS",
    detalle: "Frente, centro y fondo del green, y al punto que toques.",
    legalEnTorneo: true,
    regla: "4.3a(1) — permitido, salvo Regla Local G-5",
    configurable: false,
  },
  {
    key: "planCancha",
    label: "Plan de cancha",
    detalle: "Tus notas por hoyo, escritas antes de jugar.",
    legalEnTorneo: true,
    regla: "4.3a(3) — información recogida antes de la vuelta",
    configurable: false,
  },
  {
    key: "registro",
    label: "Registrar tiros y score",
    detalle: "Guardar dónde pegaste, con qué palo y cómo terminó el hoyo.",
    legalEnTorneo: true,
    regla: "4.3a(3) — registrar no es interpretar",
    configurable: false,
  },
];

/** Lo que la app NO tiene: no hay datos de elevación, así que no hay plays-like. */
export const NO_IMPLEMENTADO = [
  "Plays like / ajuste por elevación (no tenemos datos de altura, y además es 4.3a(1))",
  "Elipse de dispersión sobre la línea (sería línea de juego recomendada, 4.3a(1))",
];
