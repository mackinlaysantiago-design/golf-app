// SM Challenges — secuencias guiadas de drills (7-Day Putting Challenge, Chipping Protocol)
import type { DrillType } from "@/lib/pp-drills";

export type ChallengeDay = {
  day: number;
  title: string;
  description: string;
  drills: DrillType[];
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  days: ChallengeDay[];
};

export const SEVEN_DAY_PUTTING: Challenge = {
  id: "7DAY_PUTTING",
  title: "7-Day Putting Challenge",
  description:
    "Una semana enfocada solo en putting. Cada día un set de drills específicos. Day 1 baseline, Day 7 test final.",
  days: [
    {
      day: 1,
      title: "Día 1 — Test inicial",
      description:
        "Test del 1-Putt circle (5 tees a 4-6 ft). Establecé tu baseline. Anotá cuántos metés de 10.",
      drills: ["ONE_PUTT_CIRCLE"],
    },
    {
      day: 2,
      title: "Día 2 — Start line",
      description:
        "Línea de tiza + bola marcada. Trabajá rodar la bola 'end over end' en putts rectos cortos.",
      drills: ["PUTTING_START_LINE"],
    },
    {
      day: 3,
      title: "Día 3 — Putting sword",
      description:
        "Bola sobre regla metálica. Asegurá un stroke recto. La bola tiene que rodar sin caerse.",
      drills: ["PUTTING_SWORD"],
    },
    {
      day: 4,
      title: "Día 4 — Lectura de greens",
      description:
        "Putts con pendiente 1°, 2°, 3° (L-R y R-L). Objetivo: 3 seguidos por pendiente.",
      drills: ["GREEN_READING"],
    },
    {
      day: 5,
      title: "Día 5 — Lag putting (pace)",
      description:
        "Lag putting con estacas. 15/20/30 ft cuesta arriba/abajo. Pasá el tee pero no la estaca.",
      drills: ["PUTTING_LAG_STAKES"],
    },
    {
      day: 6,
      title: "Día 6 — Lag putting avanzado",
      description:
        "Mismas distancias del Día 5 pero con ojos en el objetivo, una mano, ojos cerrados.",
      drills: ["PUTTING_LAG_STAKES"],
    },
    {
      day: 7,
      title: "Día 7 — Test final",
      description:
        "Test 9 holes de putting (10-50 ft). 1 bola, rutina completa. Objetivo: 0 three-putts.",
      drills: ["TWO_PUTT_CIRCLE", "SHORT_PUTTING_STREAK"],
    },
  ],
};

export const CHIPPING_PROTOCOL: Challenge = {
  id: "CHIPPING_PROTOCOL",
  title: "Chipping Protocol",
  description:
    "3 drills enfocados en compresión y ángulo de ataque. Mejorá tu chipping desde la mecánica.",
  days: [
    {
      day: 1,
      title: "Día 1 — Una mano",
      description:
        "3 bolas con solo la mano derecha. Sentí el ángulo de muñeca durante el stroke.",
      drills: ["CHIPPING_ONE_HAND"],
    },
    {
      day: 2,
      title: "Día 2 — Palo delante",
      description:
        "3 bolas con palo en el suelo 8-12 pulgadas delante de la bola. Mano derecha. Ángulo de ataque pronunciado.",
      drills: ["CHIPPING_CLUB_FRONT"],
    },
    {
      day: 3,
      title: "Día 3 — Aplicación",
      description:
        "Aplicá lo aprendido al chipping circle estándar. Comparalo con tu mejor previo.",
      drills: ["CHIPPING"],
    },
  ],
};

export const ALL_CHALLENGES: Challenge[] = [SEVEN_DAY_PUTTING, CHIPPING_PROTOCOL];
