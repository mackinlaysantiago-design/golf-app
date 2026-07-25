// One-shot: completa roundId/roundPlayerId en RoundShot donde quedaron null
// (bug: el cliente solo mandaba roundHoleId; fixeado en las routes el 25/07).
// Correr con: node scripts/backfill-roundshot-roundid.js  (lee .env.production.local)
require("dotenv").config({ path: ".env.production.local" });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const orphans = await p.roundShot.findMany({
    where: { roundId: null },
    select: { id: true, roundHole: { select: { roundId: true, roundPlayerId: true } } },
  });
  let fixed = 0;
  for (const s of orphans) {
    if (!s.roundHole) continue;
    await p.roundShot.update({
      where: { id: s.id },
      data: { roundId: s.roundHole.roundId, roundPlayerId: s.roundHole.roundPlayerId },
    });
    fixed++;
  }
  const remaining = await p.roundShot.count({ where: { roundId: null } });
  console.log("backfilled:", fixed, "| quedan con null:", remaining);
  await p.$disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
