import type { ClubCarry } from "./shot-gps";

// Carries reales de Santi (FlightScope, 8 sesiones recientes). Full-swing por palo.
// TODO: cablear a datos vivos (RangeShot / ClubDispersion) en vez de esta constante.
export const SANTI_CARRIES: ClubCarry[] = [
  { club: "Driver", carryYds: 249.5 },
  { club: "3W", carryYds: 211.0 },
  { club: "4i", carryYds: 194.2 },
  { club: "5i", carryYds: 170.1 },
  { club: "6i", carryYds: 169.6 },
  { club: "7i", carryYds: 149.3 },
  { club: "8i", carryYds: 140.6 },
  { club: "LW", carryYds: 123.1 },
  { club: "PW", carryYds: 111.6 },
  { club: "9i", carryYds: 109.1 },
  { club: "52", carryYds: 94.7 },
];
