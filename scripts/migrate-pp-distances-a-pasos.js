// One-shot: convierte las distancias de PracticeDrill de FT a PASOS (1 paso = 3 ft)
// para los drills que eran ft. Los drills en yds (chipping/wedges) ya equivalen 1:1
// y GREEN_READING usa grados — no se tocan. Correr con OK de Santi:
//   node scripts/migrate-pp-distances-a-pasos.js
require("dotenv").config({ path: ".env.production.local" });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const FT_DRILLS = new Set([
  "ONE_PUTT_CIRCLE",
  "TWO_PUTT_CIRCLE",
  "PUTTING_LAG_STAKES",
  "SHORT_PUTTING_STREAK",
  "CHIPPING_ONE_HAND",
  "CHIPPING_CLUB_FRONT",
  "PUTTING_START_LINE",
  "PUTTING_SWORD",
]);

const ftAPasos = (ft) => Math.max(1, Math.round(ft / 3));

(async () => {
  const drills = await p.practiceDrill.findMany();
  let updated = 0;
  for (const d of drills) {
    if (!FT_DRILLS.has(d.drillType)) continue;
    const data = {};
    if (typeof d.distance === "number" && d.distance > 0) data.distance = ftAPasos(d.distance);
    const aj = d.attemptsJson;
    if (aj && typeof aj === "object" && !Array.isArray(aj) && Array.isArray(aj.attempts)) {
      data.attemptsJson = {
        ...aj,
        attempts: aj.attempts.map((a) =>
          a && typeof a === "object" && typeof a.distance === "number" && a.distance > 0
            ? { ...a, distance: ftAPasos(a.distance) }
            : a,
        ),
      };
    }
    if (Object.keys(data).length === 0) continue;
    await p.practiceDrill.update({ where: { id: d.id }, data });
    updated++;
  }
  console.log("PracticeDrill migrados a pasos:", updated, "de", drills.length);
  await p.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
