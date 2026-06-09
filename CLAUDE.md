# Golf Performance App — Contexto

Plataforma personal de golf performance basada en **The Scoring Method de Will Robins**.
Stack: Next.js 14, Prisma, SQLite (dev) / PostgreSQL (prod), TypeScript.

## Branching
Trabajar derecho en `main` (uso personal, sin PR review). Auto-deploy Vercel desde push.

## Knowledge Base — The Scoring Method
Toda la teoría del curso (82 video lessons transcritos) está en `docs/knowledge-base/`.

**Antes de implementar cualquier feature**, consultar:
- `docs/knowledge-base/02_schema_mapping.md` — qué del método ya tenés en el schema
- `docs/knowledge-base/03_gaps.md` — qué te falta con propuesta Prisma
- `docs/knowledge-base/04_roadmap.md` — features priorizadas (P0/P1/P2)
- `docs/knowledge-base/05_drills_catalog.md` — drills con parámetros exactos
- `docs/knowledge-base/06_journaling_prompts.md` — preguntas a capturar
- `docs/knowledge-base/10_pre_game_routine.md` — Personal Par, warm-up, calibration, stupid holes (Workshop 5/6/26)
- `docs/knowledge-base/11_round_assessment_card.md` — Round Assessment Card oficial (11 secciones, schema completo)
- `docs/knowledge-base/12_drill_test_taxonomy.md` — Drill vs Test, Block vs Random, 5 Areas
- `docs/knowledge-base/13_wedge_distance_mastery.md` — wedge gapping: Wedge Matrix, Clock System, proximity-to-hole, números reales TrackMan

PDFs oficiales del método en `docs/knowledge-base/resources/`.

Para deep-dive teórico: `docs/knowledge-base/00_method_overview.md` y `01_concepts_by_module.md`.

Para ver una lección original: `~/golf-app/scoring-method-analysis/transcripts/{lesson_id}.txt`

## Schema actual
Ver `prisma/schema.prisma`. Modelos clave:
- `Player`, `Round`, `RoundPlayer`, `RoundHole` — datos de ronda
- `PracticeSession`, `PracticeDrill`, `PracticeTask` — práctica + homework
- `RangeSession`, `RangeShot` — datos FlightScope
- `Course`, `CourseTee`, `CourseHcpRange`, `CourseHole` — configuración cancha
