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

