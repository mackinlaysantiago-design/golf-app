# DECADE — Course Management System (Scott Fawcett)

DECADE es un sistema complementario a The Scoring Method. Mientras SM
define los OBJETIVOS de scoring (100/3, 100/2, etc.), DECADE define
las DECISIONES estratégicas para lograrlos.

## Acrónimo
- **D**istance
- **E**xpectation
- **C**orrect Target
- **A**nalyze
- **D**iscipline
- **E**xecute

## 6 Pasos del sistema

### Paso 1 — Patrón de dispersión
- "Disparamos escopetas, no rifles". Cada golpe tiene un cono de dispersión.
- Scratch con hierro 7: ~18 yds profundidad × 26 yds ancho.
- HCP 15: ~43 ancho × 46 profundidad.
- Medirlo: 20 bolas en range, identificar el CENTRO real (no los mejores).
- Error común: calcular distancia promedio solo con golpes sólidos.

### Paso 2 — Semáforo de pin location
- 🟢 Verde: bandera al centro, sin obstáculos cerca → agresivo OK
- 🟡 Amarillo: cerca de borde o bunker
- 🔴 Rojo: bandera trampa (escondida, agua, saliente)
- En 🟡 y 🔴: apuntar al CENTRO del green, no a la bandera.

### Paso 3 — Más palo, swing más suave
- Hierro 7 en vez de 8 para 150 yds.
- Reduce dispersión + mayor control = parte fundamental.

### Paso 4 — Estrategia desde el tee
- Jerarquía de peligros: OB > agua > obstáculos menores.
- Identificar lado "peor" del hoyo, apuntar al CENTRO de la mitad opuesta.
- "Mantener la bola en juego" = evitar números grandes.

### Paso 5 — Control de daños (recovery)
- En problemas: único objetivo = volver al juego.
- "Golf impulsado por ego = 8s en marcador".
- No intentar milagros desde malos lies.

### Paso 6 — Tiger 5 (métricas post-ronda)
Las 5 métricas que más correlacionan con score alto:
1. **3-putts por ronda**
2. **Doble bogeys por ronda**
3. **Bogeys en par 5s**
4. **Bogeys desde <150 yardas**
5. **Double chips por ronda**

## Mapeo al schema actual

| Concepto DECADE | Status | Schema |
|---|---|---|
| Patrón dispersión por palo | ✅ | RangeShot agregado en /range/stats |
| Pin location color (semáforo) | ❌ | Falta `RoundHole.pinColor` |
| Tomar más palo (intención) | ❌ | Falta `RoundHole.clubChoice` (UP/DOWN/STD) |
| Hazard side desde tee | ❌ | Falta `RoundHole.dangerSide` |
| Recovery mode (modo) | ❌ | Falta `RoundHole.recoveryMode` |
| 3-putts | ✅ | derivable de RoundHole.putts |
| Doble bogeys | ✅ | derivable de RoundHole.score - par |
| Bogeys en par 5 | ❌ | derivable, falta agregación |
| Bogeys desde <150 yds | ❌ | requiere trackear distancia approach |
| Double chips/ronda | ❌ | requiere trackear chips |

## Roadmap propuesto

### Fase D1 — Pre-shot decisions (~3 hs)
- Schema: `RoundHole.pinColor` (G/Y/R), `RoundHole.dangerSide` (L/R/N),
  `RoundHole.aimedAtCenter` (bool), `RoundHole.recoveryMode` (bool)
- UI tracker: 4 chips/toggles por hoyo en bloque expandido
- Stats: % decisiones tomadas vs. resultado

### Fase D2 — Tiger 5 dashboard (~2 hs)
- Sección nueva en /stats con las 5 métricas
- Tendencia última ronda vs últimas 5
- Color rojo/verde por umbral

### Fase D3 — Dispersion testing protocol (~3 hs)
- Drill PP nuevo: "Test dispersión" - 20 bolas/palo
- Vista de "elipse 80%" cross-sesión por palo
- Ancho × profundidad (no solo lateral, también long/short)

### Fase D4 — Pre-round briefing (~2 hs)
- Pantalla pre-ronda: goal SM + dispersión recordatoria + tip DECADE del día
- Recordatorio "centro del green en 🟡/🔴"
- Lectura de 30 segundos antes de empezar

**Total ~10 hs**, distribuible en 2-3 sesiones.
