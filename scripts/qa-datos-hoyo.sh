#!/bin/bash
# QA del panel de datos del hoyo (flow datos-hoyo-autoguardado).
# Hace el ciclo completo solo: crea una ronda de prueba en prod por la API real,
# apunta el flow del tester a esa ronda, corre el tester, verifica contra la DB
# que el putt y el Recovery quedaron guardados, y borra la ronda pase lo que pase.
#
# Uso: bash ~/golf-app/scripts/qa-datos-hoyo.sh
# Sale con 0 si la verificación de DB pasa, 1 si no.

set -u
APP="https://golf-app-puce.vercel.app"
GOLF=~/golf-app
TESTER=~/mind/playwright-tester
COURSE="cmolzbfy30000k104ug0dwhfy"   # La Lucila
PLAYER="cmom0ca020000l704aqp9gppl"   # Santiago (isMe)

FECHA=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

echo "== Creando ronda de prueba en prod =="
RID=$(curl -s -X POST "$APP/api/rondas" \
  -H "Content-Type: application/json" -H "Cookie: gf-auth=ok" \
  -d "{\"courseId\":\"$COURSE\",\"date\":\"$FECHA\",\"mode\":\"SOLO\",\"modality\":\"MEDAL\",\"tee\":\"BLANCO\",\"holesPlayed\":9,\"nineWhich\":\"IDA\",\"enterSzYds\":50,\"downInSzStrokes\":3,\"onePuttCircleFt\":6,\"twoPuttCircleYds\":20,\"notes\":\"QA AUTO — ronda de prueba, borrar\",\"players\":[{\"playerId\":\"$PLAYER\",\"position\":1}]}" \
  | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")

if [ -z "$RID" ]; then
  echo "ERROR: no se pudo crear la ronda de prueba (¿API caída? ¿cambió el schema?)"
  exit 1
fi
echo "Ronda QA: $RID"

# Borrarla siempre, aunque el tester explote o cortes con Ctrl-C.
limpiar() {
  echo "== Borrando ronda de prueba =="
  curl -s -X DELETE "$APP/api/rondas/$RID" -H "Cookie: gf-auth=ok" >/dev/null
}
trap limpiar EXIT

echo "== Apuntando el flow del tester a la ronda nueva =="
python3 - "$RID" <<'EOF'
import json, sys
path = __import__('os').path.expanduser('~/mind/playwright-tester/config.json')
c = json.load(open(path))
c['projects']['golf-app']['flows']['datos-hoyo-autoguardado']['start_path'] = f"/rondas/{sys.argv[1]}/mapa"
json.dump(c, open(path, 'w'), ensure_ascii=False, indent=2)
EOF

echo "== Corriendo el tester =="
python3 "$TESTER/tester.py" golf-app --flow datos-hoyo-autoguardado

echo "== Verificando contra la DB (la prueba dura) =="
cat > "$GOLF/tmp-qa-check.mjs" <<EOF
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const h = await p.roundHole.findFirst({
  where: { roundPlayer: { roundId: "$RID" }, holeNumber: 1 },
  select: { puttDistancesFt: true, recoveryMode: true },
});
await p.\$disconnect();
const putts = Array.isArray(h?.puttDistancesFt) ? h.puttDistancesFt : [];
const ok = putts.length > 0 && h?.recoveryMode === true;
console.log(JSON.stringify({ putts, recovery: h?.recoveryMode ?? null, ok }));
process.exit(ok ? 0 : 1);
EOF
(cd "$GOLF" && node --env-file=.env.local ./tmp-qa-check.mjs)
RC=$?
rm -f "$GOLF/tmp-qa-check.mjs"

if [ $RC -eq 0 ]; then
  echo "PASS: el putt y el Recovery quedaron guardados al salir de la hoja sin tocar Guardar."
else
  echo "FAIL: la DB no tiene lo que la hoja tenía que guardar al salir. Revisar el reporte del tester."
fi
exit $RC
