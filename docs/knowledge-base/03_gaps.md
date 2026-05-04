## 4. Gaps críticos
A continuación, se listan los conceptos del método de Will Robins que no están completamente cubiertos por el esquema actual, priorizados por su impacto en la implementación de las funcionalidades clave.

- **Concepto**: Golfing Thermostat (Rango de Score Habitual)
- **Lección de origen**: `the-scoring-method-level-2__sec117056_les393095`
- **Por qué importa**: Permite al jugador establecer expectativas realistas sobre su score, reduciendo la frustración y la tensión, un pilar del método.
- **Propuesta**:
    ```prisma
    // En el modelo Player
    scoreThermostatMin Int? // ej. 80
    scoreThermostatMax Int? // ej. 88
    ```

- **Concepto**: Gears of the Game - Target para Entrar a SZ
- **Lección de origen**: `the-scoring-method-level-2__sec117049_les393056`
- **Por qué importa**: Es fundamental registrar la "marcha" o distancia *intencionada* para cada golpe de entrada a la Scoring Zone, permitiendo un análisis estratégico del juego.
- **Propuesta**:
    ```prisma
    // En el modelo RoundHole
    targetEnterSzGear String? // '100_YDS', '50_YDS', '25_YDS', 'GIR'
    ```

- **Concepto**: Gears of the Game - Target para Down in SZ
- **Lección de origen**: `the-scoring-method-level-2__sec117049_les393059`
- **Por qué importa**: Permite al jugador evaluar si logró el objetivo de "Down in SZ" desde la distancia específica que lo intentó, clave para la estrategia avanzada.
- **Propuesta**:
    ```prisma
    // En el modelo RoundHole
    targetDownInSzType String? // 'DOWN_IN_3', 'DOWN_IN_2_125YDS', 'DOWN_IN_2_150YDS'
    ```

- **Concepto**: Visualización de Rondas Perfectas
- **Lección de origen**: `the-scoring-method-level-2__sec117056_les393096`
- **Por qué importa**: La visualización es una herramienta mental poderosa para la confianza y la preparación. Registrar estas sesiones puede reforzar el hábito y su impacto.
- **Propuesta**:
    ```prisma
    model VisualizationSession {
      id        String   @id @default(cuid())
      playerId  String
      player    Player   @relation(fields: [playerId], references: [id])
      date      DateTime @default(now())
      score     Int?     // Score visualizado
      notes     String?  // Detalles de la ronda visualizada
      createdAt DateTime @default(now())
    }
    ```

- **Concepto**: Seguimiento de Creencias / Self-Talk
- **Lección de origen**: `the-scoring-method-level-2__sec117056_les393097`, `mental-mastery__sec227643_les840378`
- **Por qué importa**: Identificar y trabajar sobre patrones de pensamiento (positivos o negativos) es crucial para la maestría mental y la reducción de la tensión en el campo.
- **Propuesta**:
    ```prisma
    model MentalNote {
      id        String   @id @default(cuid())
      playerId  String
      player    Player   @relation(fields: [playerId], references: [id])
      date      DateTime @default(now())
      type      String   // 'BELIEF', 'SELF_TALK', 'EMOTION'
      context   String?  // 'ROUND', 'PRACTICE', 'GENERAL'
      contextId String?  // ID de la ronda o sesión de práctica si aplica
      content   String   // El pensamiento/creencia
      positive  Boolean? // true si es positivo, false si es negativo
      createdAt DateTime @default(now())
    }
    ```

- **Concepto**: Adherencia a Rutinas Pre-shot / Post-shot
- **Lección de origen**: `mental-mastery__sec227643_les840381`
- **Por qué importa**: La consistencia en las rutinas es clave para el rendimiento bajo presión. Registrar la adherencia permite al jugador autoevaluarse y mejorar.
- **Propuesta**:
    ```prisma
    // En el modelo RoundHole
    preShotRoutineAdherence Int? // 1-10, nivel de compromiso
    postShotRoutineAdherence Int? // 1-10, nivel de compromiso
    // En el modelo Player (para definir la rutina)
    preShotRoutineDescription String?
    postShotRoutineDescription String?
    ```

- **Concepto**: Drills Específicos del Chipping Protocol
- **Lección de origen**: `chipping-protocol__sec311104_les1150183`, `chipping-protocol__sec311104_les1150184`
- **Por qué importa**: Estos drills son muy específicos y requieren un seguimiento detallado para asegurar su correcta ejecución y progreso en el chipping.
- **Propuesta**:
    ```prisma
    // Extender el enum drillType en PracticeDrill
    // Nuevos tipos: 'CHIPPING_ONE_HAND', 'CHIPPING_CLUB_FRONT'
    // El campo `notes` en PracticeDrill puede usarse para detalles adicionales si es necesario.
    ```

- **Concepto**: Drills Específicos del 7-Day Putting Challenge
- **Lección de origen**: `7-day-putting-challenge__sec177099_les658758`, `7-day-putting-challenge__sec177099_les658759`, `7-day-putting-challenge__sec177099_les658761`
- **Por qué importa**: Son fundamentales para el desafío de putting y requieren seguimiento de su ejecución y resultados para una mejora efectiva.
- **Propuesta**:
    ```prisma
    // Extender el enum drillType en PracticeDrill
    // Nuevos tipos: 'PUTTING_START_LINE', 'PUTTING_SWORD', 'PUTTING_LAG_STAKES'
    // El campo `notes` o `drillDetails` (Json) en PracticeDrill puede usarse para parámetros como pendiente o distancias de estacas.
    ```

- **Concepto**: Drills de Yardage Gapping
- **Lección de origen**: `the-scoring-method-level-2__sec117054_les393077`
- **Por qué importa**: Conocer las distancias exactas de cada palo y tipo de swing es crucial para la toma de decisiones en el campo y la estrategia de Gears.
- **Propuesta**:
    ```prisma
    // Extender el enum drillType en PracticeDrill
    // Nuevo tipo: 'YARDAGE_GAPPING'
    // En el modelo PracticeDrill
    swingType  String? // 'FULL', '10_30', '9_OCLOCK' (para diferenciar tipos de swing en el gapping)
    ```

