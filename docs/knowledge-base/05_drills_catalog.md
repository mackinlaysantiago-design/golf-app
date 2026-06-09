## 6. Drills y protocolos a digitalizar

### Drills de Putting

1.  **Nombre**: 1-Putt Circle Test (Fundacional)
    *   **Módulo**: `level-1`
    *   **Lección**: `[level-1__sec108298_les360926]`
    *   **Parámetros**:
        *   **Distancia**: 4 pies (1.22 metros)
        *   **Cantidad de bolas/intentos**: 10 putts (2 rondas de 5 putts desde diferentes tees)
        *   **Criterio de éxito**: 9 de 10 putts embocados.
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: 5 tees colocados en círculo a 4 pies del hoyo. Se recomienda variar la pendiente (izquierda a derecha, derecha a izquierda, cuesta arriba, cuesta abajo).
    *   **Output a trackear**:
        *   `totalAttempts`: 10
        *   `successfulAttempts`: Número de putts embocados (0-10)
        *   `targetScore`: 9
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: ONE_PUTT_CIRCLE_TEST_FUNDAMENTAL
            date               DateTime @default(now())
            distanceFeet       Float    @default(4)
            totalAttempts      Int      @default(10)
            successfulAttempts Int
            targetScore        Int      @default(9)
            notes              String?
        }
        ```

2.  **Nombre**: 2-Putt Circle Drill
    *   **Módulo**: `level-1`
    *   **Lección**: `[level-1__sec108298_les360925]`
    *   **Parámetros**:
        *   **Distancia**: 10 putts desde 10 posiciones diferentes, variando entre 20 y 50 pies (6.1 a 15.24 metros).
        *   **Cantidad de bolas/intentos**: 10 putts (1 bola por intento).
        *   **Criterio de éxito**: Dejar la bola dentro del "1-Putt Circle" (círculo de 4 pies de diámetro alrededor del hoyo).
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: Hoyo de golf. No se requieren tees adicionales, pero se puede marcar el "1-Putt Circle" con una cuerda o tiza.
    *   **Output a trackear**:
        *   `totalAttempts`: 10
        *   `successfulAttempts`: Número de putts que quedaron dentro del 1-Putt Circle (0-10)
        *   `attemptDetails`: Lista de distancias iniciales y proximidades finales.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: TWO_PUTT_CIRCLE_DRILL
            date               DateTime @default(now())
            totalAttempts      Int      @default(10)
            successfulAttempts Int
            notes              String?
            attempts           DrillAttempt[]
        }

        model DrillAttempt {
            id          String @id @default(uuid())
            sessionId   String
            session     DrillSession @relation(fields: [sessionId], references: [id])
            distanceFeet Float // Distancia inicial del putt (20-50 pies)
            finalProximityFeet Float // Proximidad final al hoyo
            isSuccess   Boolean // true si finalProximityFeet <= 2 (radio del 1-Putt Circle)
        }
        ```

3.  **Nombre**: Short Putting 10-in-a-Row (Pendiente)
    *   **Módulo**: `the-scoring-method-level-2`
    *   **Lección**: `[the-scoring-method-level-2__sec117054_les393077]`
    *   **Parámetros**:
        *   **Distancia**: Putts variados entre 3 y 6 pies (0.91 a 1.83 metros).
        *   **Cantidad de bolas/intentos**: Se busca hacer 10 putts consecutivos. El conteo se reinicia al fallar.
        *   **Criterio de éxito**: 10 putts embocados de forma consecutiva.
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: 5 tees colocados en círculo alrededor del hoyo, en una pendiente de 2 grados (aprox. 3.6%). Las distancias de los tees deben variar (ej. 3, 5, 6, 4, 5 pies).
    *   **Output a trackear**:
        *   `longestStreak`: La racha más larga de putts consecutivos embocados.
        *   `totalAttemptsToReachStreak`: Número total de putts intentados hasta lograr la racha de 10.
        *   `targetStreak`: 10
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: SHORT_PUTTING_10_IN_A_ROW
            date               DateTime @default(now())
            slopeDegrees       Float    @default(2)
            longestStreak      Int
            totalAttempts      Int
            targetStreak       Int      @default(10)
            notes              String?
        }
        ```

4.  **Nombre**: Putting Mano Derecha (Chipping Protocol)
    *   **Módulo**: `chipping-protocol`
    *   **Lección**: `[chipping-protocol__sec311104_les1150183]`
    *   **Parámetros**:
        *   **Distancia**: 30-40 pies (9.14 a 12.19 metros).
        *   **Cantidad de bolas/intentos**: 3 bolas.
        *   **Criterio de éxito**: Mantener el ángulo de la muñeca derecha ("tocar el clavo") durante el stroke. Es un criterio cualitativo/sensorial.
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: Hoyo de golf. Se practica con una sola mano (derecha).
    *   **Output a trackear**:
        *   `totalAttempts`: 3
        *   `subjectiveSuccessRating`: Calificación subjetiva (ej. 1-5) sobre la sensación de mantener el ángulo de la muñeca.
        *   `notes`: Observaciones sobre la sensación y el resultado.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                     String @id @default(uuid())
            userId                 String
            drillType              DrillType // Enum: PUTTING_ONE_HANDED
            date                   DateTime @default(now())
            distanceFeetMin        Float    @default(30)
            distanceFeetMax        Float    @default(40)
            totalAttempts          Int      @default(3)
            subjectiveSuccessRating Int? // 1-5, 5 being best
            notes                  String?
        }
        ```

5.  **Nombre**: 7-Day Putting Challenge: 1-Putt Circle Test
    *   **Módulo**: `7-day-putting-challenge`
    *   **Lección**: `[7-day-putting-challenge__sec177099_les658757]`
    *   **Parámetros**:
        *   **Distancia**: 5 tees a 4, 5, 6, 4, 6 pies (1.22, 1.52, 1.83, 1.22, 1.83 metros).
        *   **Cantidad de bolas/intentos**: 10 putts (2 rondas de 5 putts desde los tees).
        *   **Criterio de éxito**: 9 de 10 putts embocados.
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: 5 tees colocados en círculo a las distancias especificadas.
    *   **Output a trackear**:
        *   `totalAttempts`: 10
        *   `successfulAttempts`: Número de putts embocados (0-10)
        *   `targetScore`: 9
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: SEVEN_DAY_ONE_PUTT_CIRCLE_TEST
            date               DateTime @default(now())
            distancesFeet      Float[]  // [4, 5, 6, 4, 6]
            totalAttempts      Int      @default(10)
            successfulAttempts Int
            targetScore        Int      @default(9)
            notes              String?
        }
        ```

6.  **Nombre**: 7-Day Putting Challenge: Start Line Drill
    *   **Módulo**: `7-day-putting-challenge`
    *   **Lección**: `[7-day-putting-challenge__sec177099_les658758]`
    *   **Parámetros**:
        *   **Distancia**: Putt recto (distancia no especificada, pero implícitamente corta para observar la línea).
        *   **Cantidad de bolas/intentos**: No especificado, se sugiere práctica continua.
        *   **Criterio de éxito**: La bola rueda "end over end" sobre la línea de tiza.
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: Línea de tiza en el green, bola marcada con una línea, nivel digital para asegurar un putt recto.
    *   **Output a trackear**:
        *   `notes`: Observaciones cualitativas sobre la capacidad de rodar la bola en línea recta.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: SEVEN_DAY_START_LINE_DRILL
            date               DateTime @default(now())
            notes              String? // "Bola rodó end over end", "Dificultad para mantener la línea"
        }
        ```

7.  **Nombre**: 7-Day Putting Challenge: Putting Sword Drill
    *   **Módulo**: `7-day-putting-challenge`
    *   **Lección**: `[7-day-putting-challenge__sec177099_les658759]`
    *   **Parámetros**:
        *   **Distancia**: Corta, sobre la regla.
        *   **Cantidad de bolas/intentos**: No especificado, práctica continua.
        *   **Criterio de éxito**: La bola rueda sobre la regla metálica sin caerse.
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: Regla metálica en el green, bola colocada sobre la regla.
    *   **Output a trackear**:
        *   `notes`: Observaciones cualitativas sobre la capacidad de mantener la bola en la regla.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: SEVEN_DAY_PUTTING_SWORD_DRILL
            date               DateTime @default(now())
            notes              String? // "Bola se mantuvo en la regla", "Bola se cayó rápidamente"
        }
        ```

8.  **Nombre**: 7-Day Putting Challenge: Green Reading Drill
    *   **Módulo**: `7-day-putting-challenge`
    *   **Lección**: `[7-day-putting-challenge__sec177099_les658760]`
    *   **Parámetros**:
        *   **Distancia**: Putts con 1, 2, 3 grados de pendiente (izquierda-derecha, derecha-izquierda).
        *   **Cantidad de bolas/intentos**: 3 putts por tipo de pendiente.
        *   **Criterio de éxito**: Embocar 3 putts consecutivos para cada tipo de pendiente.
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: Nivel digital para identificar pendientes de 1, 2, 3 grados. Se puede usar Aimpoint Express para la lectura.
    *   **Output a trackear**:
        *   `slopeDegrees`: Grados de pendiente (1, 2, 3).
        *   `breakDirection`: Dirección de la caída (LeftToRight, RightToLeft).
        *   `successfulStreaks`: Booleano, si se logró la racha de 3.
        *   `totalAttempts`: Número de putts intentados para cada tipo de pendiente.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: SEVEN_DAY_GREEN_READING_DRILL
            date               DateTime @default(now())
            attempts           GreenReadingAttempt[]
            notes              String?
        }

        model GreenReadingAttempt {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            slopeDegrees       Float
            breakDirection     String // "LeftToRight", "RightToLeft"
            totalPutts         Int
            consecutiveMakes   Int
            targetConsecutive  Int      @default(3)
            isSuccess          Boolean  // true if consecutiveMakes >= targetConsecutive
        }
        ```

9.  **Nombre**: 7-Day Putting Challenge: Lag Putting Pace Drill
    *   **Módulo**: `7-day-putting-challenge`
    *   **Lección**: `[7-day-putting-challenge__sec177099_les658761]`
    *   **Parámetros**:
        *   **Distancia**: 15, 20, 30 pies (4.57, 6.1, 9.14 metros), cuesta arriba y cuesta abajo.
        *   **Cantidad de bolas/intentos**: 3 bolas por distancia y condición (total 18 putts si se hacen todas las combinaciones).
        *   **Criterio de éxito**: La bola debe pasar el hoyo (marcado con un tee) pero no la estaca naranja (colocada a 12 pulgadas/30 cm detrás del hoyo).
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: Tee en el hoyo, estaca naranja a 12 pulgadas detrás del hoyo. Se buscan pendientes cuesta arriba y cuesta abajo.
    *   **Output a trackear**:
        *   `distanceFeet`: Distancia del putt.
        *   `slopeCondition`: "Uphill", "Downhill".
        *   `totalAttempts`: 3
        *   `successfulAttempts`: Número de putts que cumplen el criterio.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: SEVEN_DAY_LAG_PUTTING_PACE_DRILL
            date               DateTime @default(now())
            attempts           LagPuttingAttempt[]
            notes              String?
        }

        model LagPuttingAttempt {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            distanceFeet       Float
            slopeCondition     String // "Uphill", "Downhill"
            totalPutts         Int      @default(3)
            successfulPutts    Int      // Putts que pasaron el tee pero no la estaca
        }
        ```

10. **Nombre**: 7-Day Putting Challenge: Lag Putting Avanzado
    *   **Módulo**: `7-day-putting-challenge`
    *   **Lección**: `[7-day-putting-challenge__sec177099_les658762]`
    *   **Parámetros**:
        *   **Distancia**: Mismas distancias y condiciones que el Lag Putting Pace Drill (15, 20, 30 pies, cuesta arriba/abajo).
        *   **Cantidad de bolas/intentos**: 3 bolas por distancia y condición.
        *   **Criterio de éxito**: Mismo criterio que el Lag Putting Pace Drill.
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: Mismo setup. Se realizan variaciones: ojos en el objetivo, una mano, ojos cerrados.
    *   **Output a trackear**:
        *   `distanceFeet`: Distancia del putt.
        *   `slopeCondition`: "Uphill", "Downhill".
        *   `variation`: "EyesOnTarget", "OneHanded", "EyesClosed".
        *   `totalAttempts`: 3
        *   `successfulAttempts`: Número de putts que cumplen el criterio.
    *   **Modelo Prisma sugerido**: (Se puede extender el modelo `LagPuttingAttempt` o crear uno nuevo)
        ```prisma
        model LagPuttingAttempt {
            // ... existing fields ...
            variation          String? // "EyesOnTarget", "OneHanded", "EyesClosed"
        }
        ```

11. **Nombre**: 7-Day Putting Challenge: 9 Holes Putting Test
    *   **Módulo**: `7-day-putting-challenge`
    *   **Lección**: `[7-day-putting-challenge__sec177099_les658763]`
    *   **Parámetros**:
        *   **Distancia**: 9 putts diferentes, variando entre 10 y 50 pies (3.05 a 15.24 metros).
        *   **Cantidad de bolas/intentos**: 1 bola por putt, completando la rutina pre-shot.
        *   **Criterio de éxito**: 0 "3-putts" (todos los putts deben ser de 2 o 1 putt).
        *   **Palos involucrados**: Putter.
        *   **Setup físico**: 9 posiciones diferentes en el green, simulando un recorrido de 9 hoyos.
    *   **Output a trackear**:
        *   `totalPutts`: Suma de putts para los 9 hoyos.
        *   `threePuttsCount`: Número de 3-putts.
        *   `onePuttsCount`: Número de 1-putts.
        *   `twoPuttsCount`: Número de 2-putts.
        *   `targetThreePutts`: 0
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: SEVEN_DAY_9_HOLES_PUTTING_TEST
            date               DateTime @default(now())
            totalPutts         Int
            threePuttsCount    Int
            onePuttsCount      Int
            twoPuttsCount      Int
            targetThreePutts   Int      @default(0)
            notes              String?
            attempts           PuttingHoleAttempt[]
        }

        model PuttingHoleAttempt {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            holeNumber         Int
            distanceFeet       Float // Distancia inicial del putt
            puttsTaken         Int   // 1, 2 o 3
        }
        ```

### Drills de Chipping y Pitching

12. **Nombre**: Chipping to 2-Putt Circle
    *   **Módulo**: `level-1`
    *   **Lección**: `[level-1__sec108298_les360923]`
    *   **Parámetros**:
        *   **Distancia**: Desde el borde del green (fringe), variando lies y situaciones.
        *   **Cantidad de bolas/intentos**: 10 chips.
        *   **Criterio de éxito**: Dejar la bola dentro del "2-Putt Circle" (círculo de 8 pies de diámetro alrededor del hoyo, asumiendo 4 pies de radio para el 1-Putt Circle). Para avanzado, dentro del "1-Putt Circle".
        *   **Palos involucrados**: Cualquier palo (putter, híbrido, wedge, etc.), se fomenta la elección del más simple.
        *   **Setup físico**: Borde del green, dejando caer la bola desde la altura de la rodilla para simular lies reales.
    *   **Output a trackear**:
        *   `totalAttempts`: 10
        *   `successfulAttempts`: Número de chips que quedaron dentro del 2-Putt Circle.
        *   `advancedSuccessAttempts`: Número de chips que quedaron dentro del 1-Putt Circle (opcional).
        *   `attempts`: Proximidad final de cada chip.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: CHIPPING_TO_TWO_PUTT_CIRCLE
            date               DateTime @default(now())
            totalAttempts      Int      @default(10)
            successfulAttempts Int
            advancedSuccessAttempts Int? // For 1-Putt Circle
            notes              String?
            attempts           ChipAttempt[]
        }

        model ChipAttempt {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            clubUsed           String?
            lieType            String? // "Fringe", "LightRough", "HeavyRough"
            finalProximityFeet Float
            isTwoPuttCircle    Boolean // true if finalProximityFeet <= 4
            isOnePuttCircle    Boolean // true if finalProximityFeet <= 2
        }
        ```

13. **Nombre**: Chipping Stick Drill (Mano Derecha)
    *   **Módulo**: `chipping-protocol`
    *   **Lección**: `[chipping-protocol__sec311104_les1150184]`
    *   **Parámetros**:
        *   **Distancia**: No especificada, implícitamente corta para el chipping.
        *   **Cantidad de bolas/intentos**: 3 bolas.
        *   **Criterio de éxito**: Lograr un ángulo de ataque pronunciado y mantener el ángulo de la muñeca derecha, sin golpear el palo en el suelo.
        *   **Palos involucrados**: Cualquier palo de chipping (wedge).
        *   **Setup físico**: Palo en el suelo 8-12 pulgadas (20-30 cm) delante de la bola. Se practica con una sola mano (derecha).
    *   **Output a trackear**:
        *   `totalAttempts`: 3
        *   `subjectiveSuccessRating`: Calificación subjetiva (ej. 1-5) sobre la sensación de lograr el ángulo de ataque y mantener la muñeca.
        *   `notes`: Observaciones sobre la técnica y el resultado.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                     String @id @default(uuid())
            userId                 String
            drillType              DrillType // Enum: CHIPPING_STICK_DRILL
            date                   DateTime @default(now())
            stickDistanceInches    Float    @default(8) // Or 12
            totalAttempts          Int      @default(3)
            subjectiveSuccessRating Int? // 1-5, 5 being best
            notes                  String?
        }
        ```

14. **Nombre**: Chipping 9 Holes Around the Green
    *   **Módulo**: `the-scoring-method-level-2`
    *   **Lección**: `[the-scoring-method-level-2__sec117054_les393077]`
    *   **Parámetros**:
        *   **Distancia**: 9 tiros desde diferentes lies y distancias alrededor del green (3 lob shots, 3 chip shots, 3 bump & runs).
        *   **Cantidad de bolas/intentos**: 9 tiros (1 bola por tiro). Cada tiro se juega hasta embocar.
        *   **Criterio de éxito**: Score total de 20 golpes o menos para los 9 hoyos (implica 7 "up and downs").
        *   **Palos involucrados**: Variedad de wedges (lob, sand, pitching), putter, híbrido.
        *   **Setup físico**: 9 posiciones diferentes alrededor del green, dejando caer la bola desde la altura del hombro para simular lies variados.
    *   **Output a trackear**:
        *   `totalScore`: Suma de golpes para los 9 hoyos.
        *   `upAndDownsCount`: Número de veces que se logró "up and down" (2 golpes o menos).
        *   `targetScore`: 20
        *   `attempts`: Detalles de cada tiro (club, lie, proximidad, putts).
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: CHIPPING_9_HOLES_AROUND_GREEN
            date               DateTime @default(now())
            totalScore         Int
            upAndDownsCount    Int
            targetScore        Int      @default(20)
            notes              String?
            attempts           ChippingHoleAttempt[]
        }

        model ChippingHoleAttempt {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            holeNumber         Int
            lieType            String // "Lob", "Chip", "BumpAndRun"
            clubUsed           String?
            initialDistanceFeet Float?
            chipProximityFeet  Float
            puttsTaken         Int
            totalStrokes       Int
            isUpAndDown        Boolean
        }
        ```

### Drills de Wedges

15. **Nombre**: Wedge Proximity Drill (30 pies)
    *   **Módulo**: `level-1`
    *   **Lección**: `[level-1__sec108298_les360922]`
    *   **Parámetros**:
        *   **Distancia**: 10 tiros desde 50, 75 y 100 yardas (45.72, 68.58, 91.44 metros).
        *   **Cantidad de bolas/intentos**: 10 tiros por distancia.
        *   **Criterio de éxito**: Dejar la bola dentro de un círculo de 30 pies (9.14 metros) de diámetro.
        *   **Palos involucrados**: Wedges (sand wedge, pitching wedge, gap wedge, lob wedge).
        *   **Setup físico**: Campo de práctica con marcadores de distancia. Se puede usar un círculo imaginario de 30 pies.
    *   **Output a trackear**:
        *   `distanceYards`: Distancia de la que se tira (50, 75, 100).
        *   `totalAttempts`: 10
        *   `successfulAttempts`: Número de tiros que cayeron dentro del círculo de 30 pies.
        *   `attempts`: Proximidad final de cada tiro.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: WEDGE_PROXIMITY_30FT
            date               DateTime @default(now())
            distanceYards      Int      // 50, 75, 100
            totalAttempts      Int      @default(10)
            successfulAttempts Int
            targetProximityFeet Float   @default(15) // Radio del círculo de 30 pies
            notes              String?
            attempts           WedgeAttempt[]
        }

        model WedgeAttempt {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            clubUsed           String?
            finalProximityFeet Float
            isSuccess          Boolean // true if finalProximityFeet <= targetProximityFeet
        }
        ```

16. **Nombre**: Wedge Yardage Gapping (Clock System)
    *   **Módulo**: `the-scoring-method-level-2`
    *   **Lección**: `[the-scoring-method-level-2__sec117054_les393077]`
    *   **Parámetros**:
        *   **Distancia**: Varias distancias entre 30 y 100 yardas.
        *   **Cantidad de bolas/intentos**: 10 tiros por combinación de wedge y "posición de reloj" (ej. 9 o'clock, 10:30, full swing).
        *   **Criterio de éxito**: 9 de 10 tiros dentro de un círculo de 10 pies (3.05 metros) de diámetro.
        *   **Palos involucrados**: Wedges (sand wedge, pitching wedge, gap wedge, lob wedge).
        *   **Setup físico**: Campo de práctica con marcadores de distancia. Se usa el "sistema de reloj" para controlar la longitud del backswing.
    *   **Output a trackear**:
        *   `clubUsed`: Wedge utilizado.
        *   `swingPosition`: "9 o'clock", "10:30", "Full Swing".
        *   `totalAttempts`: 10
        *   `successfulAttempts`: Número de tiros que cayeron dentro del círculo de 10 pies.
        *   `averageDistanceYards`: Distancia promedio de los tiros.
        *   `distanceRangeYards`: Rango de distancias (max - min).
        *   `targetProximityFeet`: 5 (radio del círculo de 10 pies).
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: WEDGE_YARDAGE_GAPPING
            date               DateTime @default(now())
            clubUsed           String
            swingPosition      String // "9_OCLOCK", "10_30", "FULL_SWING"
            totalAttempts      Int      @default(10)
            successfulAttempts Int
            averageDistanceYards Float
            distanceRangeYards Float
            targetProximityFeet Float   @default(5)
            notes              String?
            attempts           WedgeAttempt[] // Reutiliza WedgeAttempt, añadiendo clubUsed y swingPosition
        }
        ```

### Drills de Juego Largo (Go-To Club)

17. **Nombre**: Go-To Club Fairway Accuracy (Fundacional)
    *   **Módulo**: `level-1`
    *   **Lección**: `[level-1__sec108298_les360922]`
    *   **Parámetros**:
        *   **Distancia**: 10 tiros con el club de confianza a un objetivo de 165 yardas (150.88 metros).
        *   **Cantidad de bolas/intentos**: 10 tiros.
        *   **Criterio de éxito**: 8 de 10 tiros en un fairway de 30 yardas (27.43 metros) de ancho.
        *   **Palos involucrados**: Club de confianza (híbrido, madera 5, etc.).
        *   **Setup físico**: Campo de práctica con un fairway simulado de 30 yardas de ancho (marcado con postes o banderas).
    *   **Output a trackear**:
        *   `clubUsed`: Club utilizado.
        *   `targetDistanceYards`: 165
        *   `fairwayWidthYards`: 30
        *   `totalAttempts`: 10
        *   `successfulAttempts`: Número de tiros que cayeron en el fairway.
        *   `targetSuccessRate`: 0.8 (80%)
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: GO_TO_CLUB_FAIRWAY_ACCURACY_FUNDAMENTAL
            date               DateTime @default(now())
            clubUsed           String
            targetDistanceYards Int      @default(165)
            fairwayWidthYards  Int      @default(30)
            totalAttempts      Int      @default(10)
            successfulAttempts Int
            targetSuccessRate  Float    @default(0.8)
            notes              String?
            attempts           LongGameAttempt[]
        }

        model LongGameAttempt {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            isFairwayHit       Boolean
            distanceYards      Float? // Distancia real del tiro
            dispersionYards    Float? // Desviación lateral del centro del fairway
        }
        ```

18. **Nombre**: Go-To Club Tight Fairway (Avanzado)
    *   **Módulo**: `the-scoring-method-level-2`
    *   **Lección**: `[the-scoring-method-level-2__sec117054_les393077]`
    *   **Parámetros**:
        *   **Distancia**: No especificada, se asume la distancia normal del club.
        *   **Cantidad de bolas/intentos**: 9 tiros.
        *   **Criterio de éxito**: 5 de 9 tiros en un fairway de 10 yardas (9.14 metros) de ancho.
        *   **Palos involucrados**: Club de confianza (driver, madera 3, etc.).
        *   **Setup físico**: Campo de práctica con un fairway simulado de 10 yardas de ancho.
    *   **Output a trackear**:
        *   `clubUsed`: Club utilizado.
        *   `fairwayWidthYards`: 10
        *   `totalAttempts`: 9
        *   `successfulAttempts`: Número de tiros que cayeron en el fairway.
        *   `targetSuccessRate`: 0.55 (5/9)
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: GO_TO_CLUB_TIGHT_FAIRWAY_ADVANCED
            date               DateTime @default(now())
            clubUsed           String
            fairwayWidthYards  Int      @default(10)
            totalAttempts      Int      @default(9)
            successfulAttempts Int
            targetSuccessRate  Float    @default(0.55)
            notes              String?
            attempts           LongGameAttempt[] // Reutiliza LongGameAttempt
        }
        ```

### Drills de Pre-Round / Range Routine

21. **Nombre**: Calibration Drill (Range Pre-Round)
    *   **Módulo**: `live-call-recordings` — `[live-call-recordings__workshop_2026-05-06_10-keys-to-scoring]`
    *   **Filosofía**: No estás trabajando técnica, estás midiendo qué hace tu cuerpo HOY. Los misses son data.
    *   **Parámetros**:
        *   **Setup físico**:
            *   Alignment stick apuntando al objetivo (ej. cartel 150 yds), bola justo detrás del stick.
            *   **Importante**: alineás la bola al target, NO los pies. Los pies pueden estar "naturales".
            *   La cara del palo determina dónde va la bola, no los pies.
        *   **Cantidad de bolas/intentos**: 13-23 bolas total (3 + 10 + 0-10 según resultado).
        *   **Palos involucrados**: 1 mid-iron (5/6/7) para fase de calibración, después rotación de clubs.
        *   **Protocolo (3 fases)**:
            1.  **Test #1 — 3 swings sin pensar**: tirá 3 bolas tratando de pegar derecho al target. Sin trabajar técnica. Si las 3 caen a ±2 yds del target → estás calibrado, pasá a target practice. Si las 3 caen 30 yds left → tu offset del día es 30 yds left.
            2.  **Test #2 — "30 yds right" (10 bolas)**: pickeá un target y deliberadamente tratá de pegar 30 yds a la derecha (o el offset que hayas medido). Lo que tu cuerpo necesita "sentir" para hacerlo va a ser tu swing recto del día.
            3.  **Test #3 — Target practice variado**: ahora sí hit a distintos targets con distintos clubs. **Nunca el mismo club 2 veces seguidas.**
    *   **Output a trackear**:
        *   `calibrationOffsetYards`: offset detectado (negativo = left, positivo = right).
        *   `offsetDirection`: `LEFT` | `RIGHT` | `STRAIGHT`.
        *   `phase1AvgDispersion`: dispersión promedio de las 3 primeras bolas (yds del target).
        *   `phase2SuccessRate`: % de bolas que cayeron a ±5 yds del target después de aplicar el offset.
        *   `clubsRotated`: lista de clubs usados en fase 3, en orden.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                       String @id @default(uuid())
            userId                   String
            drillType                DrillType // Enum: CALIBRATION_DRILL
            date                     DateTime @default(now())
            calibrationOffsetYards   Float    // negativo = left, positivo = right
            offsetDirection          String   // "LEFT" | "RIGHT" | "STRAIGHT"
            phase1AvgDispersion      Float?   // yds promedio del target
            phase2SuccessRate        Float?   // 0-1
            clubsRotated             String[] // ["driver", "7-iron", "wedge", "hybrid"]
            notes                    String?
            roundId                  String?  // si fue calibración pre-ronda, link al round
        }
        ```

22. **Nombre**: Wedge Matrix (Yardage Gapping Session)
    *   **Módulo**: `live-call-recordings` — `[live-call-recordings__workshop_2026-05-06_10-keys-to-scoring]` + template oficial PDF (`docs/knowledge-base/resources/wedge_matrix_template.pdf`).
    *   **Filosofía**: "Estás tratando de angostar el gap, no extender el tiro." 80-90% de tus tiros consistentes definen tu gap real. "Better players know their exact wedge distances" (Short Game Best Drills doc).
    *   **Estructura de la matriz oficial** (template TSM):
        *   **Eje horizontal (CLUB)**: 4 columnas — `LW` (lob wedge), `SW` (sand wedge), `GW` (gap wedge), `PW` (pitching wedge).
        *   **Eje vertical (SWING)**: 4 filas — `PITCH` (rojo), `1/2` (verde), `3/4` (azul), `FULL` (amarillo).
        *   **Total de combinaciones**: 16 celdas (4 wedges × 4 swing types).
        *   **Dentro de cada celda**: mini-grid tic-tac-toe 3×3:
            -   8 cuadrados se llenan con las distancias de los 8 tiros (en yds).
            -   El cuadrado central muestra el `YD` (average) calculado.
    *   **Parámetros**:
        *   **Cantidad de bolas/intentos**: 8 tiros por celda × 16 celdas = 128 bolas para matriz completa. En la práctica, 3-4 wedges activos × 4 swing types = 12-16 combos × 8 = 96-128 bolas. Sesión de ~2 hs.
        *   **Setup físico**: range con marcadores de yds (idealmente FlightScope/launch monitor). Imprimir el template PDF.
        *   **Palos involucrados**: hasta 4 wedges + 4 swing types (PITCH = swing corto tipo chip, 1/2 = medio swing, 3/4 = tres cuartos, FULL = swing completo).
        *   **Ejemplo del workshop (jugador "Ben")** — combinaciones que él usaba en el campo:
            -   LW PITCH: ~25 yds | LW 1/2: 35 yds | LW 3/4: 45 yds | LW FULL: 56 yds
            -   SW: 65 / 75 / 85 / 90 yds
            -   GW: 95 / 100 / 105 / 110 yds
            -   PW: 115 / 125 / 130 / 135 yds
        *   **Ejemplo del curso dedicado (jugador "John", TrackMan)** — ver `13_wedge_distance_mastery.md`:
            -   LW PITCH: ~41 | LW FULL: 91 (**alta**, descartó chunk 76* y skull 112*)
            -   SW 3/4: 95 (avg 94.7) | SW FULL: ~105
            -   GW 1/2: 96 (**baja**) | GW 3/4: 120 | GW FULL: 128 (descartó 129.3*)
            -   PW FULL: ~135-140
            -   **Nota**: 91/95/96 = casi mismo yardaje, trayectoria alta/media/baja → distinta función (back pin vs. frenar vs. correr). Sugerido agregar `ballFlight (HIGH|MID|LOW)` y `loftDegrees` a `WedgeMatrixEntry`.
        *   **Posiciones por parte del cuerpo** (referencia de feel del curso): 3/4 = hasta el hombro; HALF = al pecho. Mantené **mismo tempo**, cambiá solo el largo del backswing.
        *   **Criterios**:
            *   **Descartar del average**: chunks (corta 15+ yds del esperado) y blades (long 30+ yds del esperado). No entran en el `avgYards`.
            *   **Goal por celda**: 8 de 9 tiros entre `avg - 2` y `avg + 2` yds (dispersion ≤ 4 yds total). Ejemplo: avg = 86 → goal es 8/9 entre 84-88.
            *   **Goal de matriz completa**: gaps progresivos sin "huecos" (ej. SW FULL = 90 y GW 1/2 = 90 → un palo redundante, hay overlap).
    *   **Output a trackear** (por celda):
        *   `wedgeType`: `LW | SW | GW | PW`.
        *   `swingType`: `PITCH | HALF | THREE_QUARTER | FULL`.
        *   `shots`: array de 8 distancias en yds.
        *   `avgYards`: promedio de los 8 (descartando outliers).
        *   `dispersionYards`: max - min de los 8 buenos.
        *   `goalDispersion`: 4 yds.
        *   `chunksOrBladesRejected`: cantidad descartada.
        *   `isLockedIn`: true cuando 8/9 caen en el goal.
    *   **Modelo Prisma sugerido**:
        ```prisma
        enum WedgeType {
            LW   // Lob Wedge
            SW   // Sand Wedge
            GW   // Gap Wedge
            PW   // Pitching Wedge
        }

        enum WedgeSwingType {
            PITCH         // swing corto tipo chip
            HALF          // 1/2
            THREE_QUARTER // 3/4
            FULL          // full swing
        }

        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: WEDGE_MATRIX
            date               DateTime @default(now())
            notes              String?
            entries            WedgeMatrixEntry[]
        }

        model WedgeMatrixEntry {
            id                       String @id @default(uuid())
            sessionId                String
            session                  DrillSession @relation(fields: [sessionId], references: [id])
            wedgeType                WedgeType
            swingType                WedgeSwingType
            shots                    Float[]  // 8 distancias en yds
            avgYards                 Float
            dispersionYards          Float
            goalDispersionYards      Float    @default(4)
            chunksOrBladesRejected   Int      @default(0)
            isLockedIn               Boolean  @default(false)
            @@unique([sessionId, wedgeType, swingType])
        }
        ```
    *   **UI/UX sugerido**: replicar visualmente el template oficial (matriz 4×4 con colores rojo/verde/azul/amarillo por swing type). Cada celda es tappable; al tocarla se abre el tic-tac-toe interno para registrar los 8 tiros uno por uno con teclado numérico. Auto-detect chunks/blades (preguntar "¿Descartar este tiro?" si está más de 15 yds del avg parcial).
    *   **Integración con Round**: el `WedgeMatrix` del jugador alimenta el Smart Club Selector durante el round. Si el sistema sabe "GW HALF = 95 yds, dispersion 3 yds", al detectar tiro de 95 yds sugiere "GW HALF" como primera opción.

23. **Nombre**: Full Bag Yardage Gapping Session
    *   **Módulo**: extensión del Drill #16 (Wedge Yardage Gapping con Clock System).
    *   **Diferencia**: el #16 es solo wedges con clock system (9, 10:30, full). Este es **bag completo**: cada palo del bolso, con 1-3 swing intensities según corresponda, en una sola sesión.
    *   **Filosofía**: "Un buen wedge player es alguien que pega adentro de 10 ft seguido. Esa es la diferencia entre breaking 80 y subpar."
    *   **Parámetros**:
        *   **Cantidad de bolas/intentos**: 5-8 tiros por palo × ~14 palos = 70-112 bolas. Sesión larga (1-2 hs).
        *   **Setup físico**: range con marcadores de distancia (idealmente con FlightScope/launch monitor para precisión).
        *   **Output por palo**:
            -   Full swing: avg yds + dispersion.
            -   ¾ swing (opcional para irons largos): avg yds.
            -   ½ swing (opcional para wedges): avg yds.
        *   **Goal**: tener una **tabla matriz personal** que muestra:
            ```
            Club        | Full   | 3/4   | 1/2
            -------------+--------+-------+------
            Driver      | 245 yd | -     | -
            3-wood      | 220    | -     | -
            4-hybrid    | 195    | 175   | -
            5-iron      | 180    | 160   | -
            ...
            56° wedge   | 90     | 70    | 50
            ```
    *   **Output a trackear**:
        *   `entries`: array de `BagGapEntry` (un row por palo + intensity).
        *   `gapsIdentified`: lista de "huecos" entre palos (ej. si 8-iron = 150 y 9-iron = 130, hay un gap de 20 yds; ¿se cubre con ¾ 8-iron o pitching ¾?).
    *   **Modelo Prisma sugerido**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // Enum: FULL_BAG_YARDAGE_GAPPING
            date               DateTime @default(now())
            notes              String?
            entries            BagGapEntry[]
            gapsIdentified     Json?    // [{ between: ["8-iron", "9-iron"], gapYards: 20, suggestedFill: "8-iron 3/4" }]
        }

        model BagGapEntry {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            club               String
            swingIntensity     String   // "FULL" | "THREE_QUARTER" | "HALF"
            shots              Float[]  // distancias yds
            avgYards           Float
            dispersionYards    Float
            isReliable         Boolean  // true si 6/8 caen en ±5 yds del avg
        }
        ```
    *   **Integración con Round**: alimenta el club selector inteligente. Cuando el jugador está a 165 yds, la app sugiere "5-iron full (avg 180, ajustá por viento) o 4-hybrid 3/4 (avg 175)".

### Drills y Tests del Short Game (Cinco Áreas)

> **Fuente**: `docs/knowledge-base/resources/short_game_best_drills_and_tests.pdf`. Filosofía clave: **Drill First → Test → Track Results**. Drill = build skill (repetition, technique). Test = measure skill (one ball, pressure, high accountability). Train hard → play easy.

#### Área 1 — Short Putting (face control)

24. **Nombre**: Putting Sword / Gate Drill (Short Putting Drill)
    *   **Filosofía**: la mayoría de los putts cortos errados son por mal face control en el impacto.
    *   **Setup físico**: Putting sword o un "gate" (2 tees a la misma distancia que el ancho del putter head + 2-3mm) alrededor de la cabeza del putter.
    *   **Cantidad**: práctica continua hasta sentir face control.
    *   **Criterio de éxito**: rodar putts a través del gate sin tocar los tees. Putter cara cuadrada al impacto.
    *   **Output**: `gateClearedRate` (% de putts limpios), `subjectiveFeedback`.
    *   **Modelo Prisma**: similar a Drill #6 (Start Line). Enum: `PUTTING_SWORD_GATE_DRILL`.

25. **Nombre**: 10-in-a-Row from 4 Feet (Short Putting Test)
    *   **Filosofía**: test de presión con 1 bola.
    *   **Setup físico**: 5 posiciones alrededor del hoyo a 4 ft, en pendiente de ~1 grado.
    *   **Cantidad**: 10 putts consecutivos (al fallar, reiniciar conteo).
    *   **Criterio de éxito**: 10 consecutivos. Si fallás, seguís hasta llegar a 10 y registrás cuántos intentos te llevó.
    *   **Output**: `attemptsToComplete` (cuántos putts totales hasta llegar a 10 seguidos), `longestStreak`.
    *   **Modelo Prisma**: parecido al Drill #3 (Short Putting 10-in-a-Row pendiente). Reusar `SHORT_PUTTING_10_IN_A_ROW`.

#### Área 2 — Long Putting (speed control)

26. **Nombre**: Eyes on Hole + One-Handed Putting (Long Putting Drills)
    *   **Filosofía**: la mayoría de los 3-putts vienen de mal pace control, no de línea.
    *   **Variantes**:
        *   **Eyes on Hole**: putt mirando al hoyo (no a la bola) → mejora feel y control de distancia.
        *   **One-Handed Putting**: putt con una sola mano → mejora contacto y ritmo.
    *   **Cantidad**: 5-10 putts por variante desde 20-50 ft.
    *   **Criterio de éxito**: subjetivo, "mejor feel".
    *   **Modelo Prisma**: enum `LONG_PUTTING_EYES_ON_HOLE` y `LONG_PUTTING_ONE_HANDED`. Subjective rating 1-5.

27. **Nombre**: 50 Point Game (Long Putting Test)
    *   **Filosofía**: test cuantitativo de lag putting con scoring system.
    *   **Setup físico**: putts desde 20-70 ft, distintas pendientes y direcciones.
    *   **Scoring**:
        *   Bola termina **dentro de un círculo de 3 ft** del hoyo = **1 punto**.
        *   Bola **embocada** = **2 puntos**.
    *   **Criterio de éxito**: **50 puntos** por sesión (goal por session, no por número de bolas).
    *   **Output**: `totalPoints`, `puttsAttempted`, `inside3FtCount`, `holedCount`.
    *   **Modelo Prisma**:
        ```prisma
        model DrillSession {
            id                  String @id @default(uuid())
            userId              String
            drillType           DrillType // LONG_PUTTING_50_POINT_GAME
            date                DateTime @default(now())
            puttsAttempted      Int
            inside3FtCount      Int
            holedCount          Int
            totalPoints         Int      // computed: holedCount*2 + inside3FtCount
            targetPoints        Int      @default(50)
            isPassed            Boolean  // true if totalPoints >= 50
            attempts            LongPuttAttempt[]
        }

        model LongPuttAttempt {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            distanceFeet       Float
            slopeNotes         String?
            outcome            String   // "INSIDE_3FT" | "HOLED" | "OUTSIDE"
            pointsScored       Int      // 0 | 1 | 2
        }
        ```

#### Área 3 — Fringe Chipping (landing zone control)

28. **Nombre**: Landing Zone Drill (Chipping Drill)
    *   **Filosofía**: los grandes chippers controlan **el landing spot y el rollout**, no la distancia total.
    *   **Setup físico**: marcá un landing spot **2 paces (pasos) dentro del green**, marcado con un tee.
    *   **Cantidad**: 3 tiros consecutivos con cada club.
    *   **Criterio de éxito**: aterrizar la bola **dentro de 1 ft del landing spot** 3 veces seguidas con cada club. Repetir con distintos clubs (PW, 9-iron, 8-iron, 7-iron, etc).
    *   **Output**: `landingsWithin1Ft` por club, `clubsCompleted` (cuántos clubs lograste 3-en-fila).
    *   **Modelo Prisma**: enum `CHIPPING_LANDING_ZONE`. Por club: `clubUsed`, `attempts`, `consecutive3Achieved: Boolean`.

29. **Nombre**: 10-Hole Up-and-Down Test (Chipping Test)
    *   **Filosofía**: test de presión que simula 10 chip shots reales.
    *   **Setup físico**: 10 chip shots distintos alrededor del green, simulando lies y distancias variadas.
    *   **Scoring**:
        *   **Up & Down** (chip + 1 putt = 2 golpes) = **par** (2).
        *   **2 putts después del chip** (chip + 2 putts = 3 golpes) = **bogey** (3).
        *   Más golpes se cuentan tal cual.
    *   **Criterio de éxito**: **24 o menos** total para los 10 hoyos = score de un jugador que rompe 80.
    *   **Output**: `totalStrokes`, `upAndDownCount`, `bogeyCount`, `worseCount`.
    *   **Modelo Prisma**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // CHIPPING_10_HOLE_UP_AND_DOWN
            date               DateTime @default(now())
            totalStrokes       Int
            upAndDownCount     Int
            bogeyCount         Int
            worseCount         Int
            targetStrokes      Int      @default(24)
            isPassed           Boolean  // totalStrokes <= 24
            attempts           ChipTestAttempt[]
        }

        model ChipTestAttempt {
            id                 String @id @default(uuid())
            sessionId          String
            session            DrillSession @relation(fields: [sessionId], references: [id])
            holeNumber         Int      // 1-10
            clubUsed           String?
            lieType            String?  // "ROUGH" | "FRINGE" | "TIGHT_LIE" | "BUNKER_LIP"
            chipProximityFeet  Float?
            puttsAfterChip     Int
            totalStrokes       Int      // chip + putts
            isUpAndDown        Boolean
        }
        ```

#### Área 4 — Pitching (wedge gapping)

30. **Nombre**: 9-Hole Wedge Course (Pitching Test)
    *   **Filosofía**: test de presión simulando 9 hoyos solo con wedges.
    *   **Setup físico**: 9 distintos pitch shots desde **30-80 yds del hoyo**.
    *   **Scoring** (por hoyo, contando todos los strokes hasta embocar):
        *   **2 strokes = Par**.
        *   **3 strokes = Bogey**.
        *   **4 strokes = Double**.
    *   **Criterio de éxito**: track total score (no goal específico en el doc; típicamente <27 = nivel breaking-80, <22 = scratch).
    *   **Output**: `totalScore`, `parCount`, `bogeyCount`, `doubleOrWorseCount`.
    *   **Drill complementario**: Wedge Matrix (Drill #22) — drill first, then test.
    *   **Modelo Prisma**: similar al Chipping 9-Hole (Drill #14). Enum: `PITCHING_9_HOLE_WEDGE_COURSE`.

31. **Nombre**: Chip-to-Pitch-to-Wedge Progression (Build-up)
    *   **Módulo / fuente**: curso `wedge-distance-mastery` (`sec1033356`). Ver `13_wedge_distance_mastery.md` §4.
    *   **Filosofía**: que el wedge swing se sienta como **una extensión del chip** — mismo tempo, distinto largo de backswing — NO un swing distinto. Produce bola baja y controlable.
    *   **Tipo**: DRILL / BLOCK (mismo movimiento, alargándolo gradualmente).
    *   **Área**: Pitching (Área 4), tributa a Fringe Chipping (Área 3).
    *   **Setup físico**: pitching green. Empezás con un chip básico aterrizando **2-3 pasos dentro del green** y liberando al hoyo (54° o similar).
    *   **Parámetros**:
        *   **Bolas por estación**: 3.
        *   **Progresión**: mover hacia atrás **5-7 pasos** cada vez (chip → pitch ~30-40 → 50 → 75 → ~85 yds). Ball position se atrasa levemente.
        *   **Tempo**: idéntico en todas las estaciones; acelerar a través de la bola ("drive through").
    *   **Criterio de éxito** (cualitativo): trayectoria visualmente igual aunque crezca la distancia, sin deceleración en el impacto.
    *   **Output a trackear**: `stations` (distancia + sensación de aceleración 1-5), `decelFlag` por estación.
    *   **Modelo Prisma**: Enum `CHIP_PITCH_WEDGE_PROGRESSION`. Reusar `DrillSession` con `notes` + array de estaciones.

32. **Nombre**: On-Course Wedge Matrix Validation
    *   **Módulo / fuente**: curso `wedge-distance-mastery` (`sec1033356`). Ver `13_wedge_distance_mastery.md` §8.
    *   **Filosofía**: confirmar que los números del range transfieren a la cancha con tu bola, y **committear** al tiro sin dudar (cierra el loop range→cancha→range).
    *   **Tipo**: TEST / RANDOM (yardajes y lies reales, un tiro real por situación).
    *   **Área**: Pitching (Área 4).
    *   **Setup físico**: hoyos reales con yardajes variados dentro de ~100-130 yds (uphill/downhill/viento), con tu propia bola y la carta de la matriz.
    *   **Parámetros / proceso**: leer yardaja real → ajustar por pendiente/viento → elegir `club × posición` de la matriz → committear a un full turn con tempo.
    *   **Criterio de éxito / medición**: **proximity-to-hole** (`proximityFeet`, pin high / inside X). Benchmark PGA 11 ft @100 yds; meta inside 8-12 → luego inside 10.
    *   **Output a trackear**: por tiro `targetYards`, `playedYards` (ajustado), `cellUsed`, `proximityFeet`, `committed (bool)`.
    *   **Modelo Prisma**: Enum `ON_COURSE_WEDGE_MATRIX_VALIDATION`. Alimenta el KPI rey de proximidad.

33. **Nombre**: Low-Point / Compression Drills (contacto para wedge gapping)
    *   **Fuente**: `live-call-recordings__workshop_wedge-gapping-replay`. Ver `13_wedge_distance_mastery.md` §11. Pre-requisito de la matriz: sin contacto consistente no hay yardaje consistente.
    *   **Tipo**: DRILL / BLOCK (contacto/low-point). Área: Pitching (4) + Fringe Chipping (3).
    *   **Variantes**:
        -   **Divot Board**: pegar sobre la tabla buscando que el divot arranque después de la línea; low-point control. Se puede hacer indoor a diario.
        -   **Tee delante de la bola**: clavar un tee ~1 palmo adelante y "volar el tee" → contacto bola-después-tierra, punto más profundo ~3" DESPUÉS de la bola.
        -   **Fairway bunker rastrillado** (back of the rake): alisar la arena y pegar pitches; medio pulgar atrás = ~15 yds menos → fuerza comprimir hacia abajo.
    *   **Criterio de éxito**: divot que empieza en/después de la bola (nunca antes), contacto seco repetible.
    *   **Output**: `cleanStrikePct` (tiros con contacto bola-primero / total), `drillVariant`.
    *   **Modelo Prisma**: Enum `LOW_POINT_COMPRESSION`. Reusar `DrillSession` con `drillVariant` + `cleanStrikePct`.

34. **Nombre**: On-Course Lies Drill (rough/hardpan/pendiente al mismo target)
    *   **Fuente**: `live-call-recordings__workshop_wedge-gapping-replay`. Ver `13_wedge_distance_mastery.md` §11.
    *   **Tipo**: TEST / RANDOM. Área: Pitching (4).
    *   **Setup**: soltar **3 bolas** desde lies distintos (lie alto/perfecto, normal en rough, hundida en rough espeso) o recorrer hoyos soltando 3 bolas a 75 yds desde thick rough / hardpan / tight lie / downhill / uphill. Pegar las 3 al mismo target.
    *   **Filosofía**: "siempre vas a leer mal el lie — siempre lo pensás mejor de lo que es." Aprender a ajustar club/trayectoria por lie; con bola hundida, "chunk it out and get into position."
    *   **Criterio**: proximity-to-target por lie; reconocer cuándo NO atacar.
    *   **Modelo Prisma**: Enum `ON_COURSE_LIES_DRILL`.

#### Área 5 — Bunker Play (consistent sand strike)

31. **Nombre**: Line Drill (Bunker Drill)
    *   **Filosofía**: los buenos bunker players controlan **el punto de entrada en la arena**.
    *   **Setup físico**: dibujá una línea en la arena (con el dedo o el palo).
    *   **Cantidad**: 3 entradas consecutivas.
    *   **Criterio de éxito**: entrar en la arena **al inicio de la línea** 3 veces seguidas, **acelerando** a través de la arena. La arena debe salpicar al green; la bola sale "con la arena", no antes.
    *   **Output**: `consecutiveEntries`, `subjectiveAcceleration` (1-5).
    *   **Modelo Prisma**: enum `BUNKER_LINE_DRILL`. `consecutiveEntries: Int`, `subjectiveAcceleration: Int`.

32. **Nombre**: 10 Bunker Shots (Bunker Test)
    *   **Filosofía**: test de presión con scoring system específico.
    *   **Setup físico**: 10 bunker shots desde un greenside bunker (varias posiciones).
    *   **Scoring por tiro**:
        *   **Miss green** = 0 puntos.
        *   **Hit green** = 1 punto.
        *   **Inside 10 ft** = 2 puntos.
        *   **Inside 6 ft** = 3 puntos.
    *   **Criterio de éxito**: **12 puntos o más** (goal del doc).
    *   **Output**: `totalPoints`, breakdown por categoría.
    *   **Modelo Prisma**:
        ```prisma
        model DrillSession {
            id                 String @id @default(uuid())
            userId             String
            drillType          DrillType // BUNKER_10_SHOT_TEST
            date               DateTime @default(now())
            totalPoints        Int
            missGreenCount     Int
            hitGreenCount      Int
            inside10FtCount    Int
            inside6FtCount     Int
            targetPoints       Int      @default(12)
            isPassed           Boolean
        }
        ```

### Protocolos Mentales

19. **Nombre**: Protocolo: Rutina Pre-shot
    *   **Módulo**: `mental-mastery`
    *   **Lección**: `[mental-mastery__sec227643_les840381]`
    *   **Parámetros**:
        *   **Pasos**: 7 pasos definidos:
            1.  Lie (evaluar el lie de la bola)
            2.  Target (identificar el objetivo)
            3.  Ground Yardage (distancia al suelo)
            4.  Playing Yardage (distancia de juego, ajustada por factores)
            5.  Shot Shape (forma del golpe deseada)
            6.  Club (seleccionar el palo)
            7.  Visualización, Sentimiento, Ensayo, Compromiso (visualizar el golpe, sentirlo, hacer un ensayo, comprometerse al 100%).
        *   **Cantidad de bolas/intentos**: Se aplica a cada golpe en el campo o en práctica con propósito.
        *   **Criterio de éxito**: Adherencia completa y consciente a los 7 pasos.
        *   **Palos involucrados**: Todos los palos.
        *   **Setup físico**: Ninguno específico, es una rutina mental.
    *   **Output a trackear**:
        *   `adherenceRating`: Calificación subjetiva (ej. 1-10) de la adherencia a la rutina.
        *   `notes`: Observaciones sobre qué pasos fueron difíciles o fáciles de seguir.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model MentalProtocolSession {
            id                 String @id @default(uuid())
            userId             String
            protocolType       ProtocolType // Enum: PRE_SHOT_ROUTINE
            date               DateTime @default(now())
            adherenceRating    Int?     // 1-10
            notes              String?
            // Podría tener un campo para asociar a un golpe específico si se integra con el tracking de rondas
        }
        ```

20. **Nombre**: Protocolo: Rutina Post-shot
    *   **Módulo**: `mental-mastery`
    *   **Lección**: `[mental-mastery__sec227643_les840381]`
    *   **Parámetros**:
        *   **Pasos**: Autoevaluación del compromiso del golpe (10/10):
            1.  Visualizar (3/10 puntos): ¿Visualicé el golpe claramente?
            2.  Sentir (3/10 puntos): ¿Sentí el golpe antes de ejecutarlo?
            3.  Confiar/Soltar (4/10 puntos): ¿Confié plenamente en mi elección y solté el control?
        *   **Cantidad de bolas/intentos**: Se aplica después de cada golpe.
        *   **Criterio de éxito**: Lograr una calificación de 10/10 en el compromiso.
        *   **Palos involucrados**: Todos los palos.
        *   **Setup físico**: Ninguno específico, es una rutina mental.
    *   **Output a trackear**:
        *   `visualizeScore`: Calificación (0-3).
        *   `feelScore`: Calificación (0-3).
        *   `trustReleaseScore`: Calificación (0-4).
        *   `totalCommitmentScore`: Suma de las anteriores (0-10).
        *   `notes`: Observaciones sobre la autoevaluación.
    *   **Modelo Prisma sugerido**:
        ```prisma
        model MentalProtocolSession {
            // ... existing fields ...
            protocolType          ProtocolType // Enum: POST_SHOT_ROUTINE
            visualizeScore        Int?
            feelScore             Int?
            trustReleaseScore     Int?
            totalCommitmentScore  Int?
        }
        ```

---
**Consideraciones Adicionales para la App:**

*   **Progresión**: El método de Will Robins enfatiza la progresión. La app debería permitir al usuario "graduarse" de un nivel de drill (ej. 1-Putt Circle a 4 pies) a uno más difícil (5 pies) o a un drill diferente.
*   **Benchmarking**: La app debería permitir al usuario registrar su "Golfing Thermostat" y sus "scores visualizados" para la Mental Mastery.
*   **Feedback**: La app debe proporcionar feedback claro sobre el rendimiento del usuario en cada drill, comparándolo con el criterio de éxito y mostrando el progreso a lo largo del tiempo.
*   **Personalización**: Permitir al usuario ajustar las distancias o criterios de éxito una vez que domina un nivel, o elegir qué drills priorizar según su "Purposeful Practice Card".
*   **Integración con Scorecard**: Las métricas de Scoring Zone, Down in SZ, putts, etc., deben ser parte del tracking de rondas de golf, y luego usarse para generar recomendaciones de drills.

Este listado proporciona una base sólida para la configuración 1:1 de los drills y protocolos en tu aplicación, siguiendo la metodología de Will Robins con la precisión requerida.



Will Robins enfatiza la importancia de la reflexión y el *journaling* como herramientas fundamentales para el desarrollo del golfista, no solo para la técnica, sino, crucialmente, para el aspecto emocional y mental del juego. A continuación, se listan los *prompts* de reflexión y *journaling* que Will Robins enseña, especialmente en Level 2 y Mental Mastery, complementados con conceptos de Level 1 para una comprensión integral.

---

