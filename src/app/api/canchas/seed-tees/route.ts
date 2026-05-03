import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Datos investigados con confianza media-alta. Tee Blanco Caballeros 18 hoyos.
// Notas: confianza varía. Editables después en /jugadores/cancha/[id]
const SEED_TEES: Array<{
  courseName: string;
  createIfMissing: boolean;
  defaultParPerHole?: number;
  tees: Array<{
    name: string;
    category: string;
    slopeRating: number;
    courseRating: number;
    parTotal: number;
    notes?: string;
  }>;
}> = [
  {
    courseName: "La Lucila",
    createIfMissing: false,
    tees: [
      // Datos verificados de la calculadora oficial Lucila: Tee 12 Slope 116, CR 68.2, Par 71
      { name: "BLANCO", category: "CAB", slopeRating: 116, courseRating: 68.2, parTotal: 71, notes: "Datos oficiales Lucila Polo Club" },
    ],
  },
  {
    courseName: "Potrerillo de Larreta",
    createIfMissing: true,
    defaultParPerHole: 4,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 130, courseRating: 74.5, parTotal: 72, notes: "Top100 / where2golf — verificar con tarjeta del club" },
    ],
  },
  {
    courseName: "Yacanto Golf Club",
    createIfMissing: true,
    defaultParPerHole: 4,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 113, courseRating: 67.4, parTotal: 70, notes: "YardasTour — slope estimado 113 (estándar)" },
    ],
  },
  {
    courseName: "Olivos Golf Club",
    createIfMissing: true,
    defaultParPerHole: 4,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 120, courseRating: 69.8, parTotal: 72, notes: "where2golf SSS 69.8 — slope estimado, verificar" },
    ],
  },
  {
    courseName: "Hindú Club",
    createIfMissing: true,
    defaultParPerHole: 4,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 122, courseRating: 71.0, parTotal: 71, notes: "Hole19 — verificar con club" },
    ],
  },
  {
    courseName: "Jockey Club",
    createIfMissing: true,
    defaultParPerHole: 4,
    tees: [
      // Sin datos confiables — usar slope estándar como punto de partida
      { name: "BLANCO", category: "CAB", slopeRating: 125, courseRating: 71.0, parTotal: 72, notes: "ESTIMADO — pedir scorecard al club para verificar" },
    ],
  },
  {
    courseName: "Pilar Golf Club",
    createIfMissing: false, // ya existe Pilar golf A-B
    tees: [],
  },
  {
    courseName: "Pilar golf A-B",
    createIfMissing: false,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 115, courseRating: 70.5, parTotal: 72, notes: "Golfify/Top100 — combinación A-B 18h" },
    ],
  },
  {
    courseName: "San Andrés Golf Club",
    createIfMissing: true,
    defaultParPerHole: 4,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 130, courseRating: 71.5, parTotal: 72, notes: "Golfify — datos consistentes" },
    ],
  },
  {
    courseName: "Hurlingham Club",
    createIfMissing: true,
    defaultParPerHole: 4,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 113, courseRating: 70.0, parTotal: 70, notes: "Golfshake" },
    ],
  },
  {
    courseName: "Ranelagh Golf Club",
    createIfMissing: true,
    defaultParPerHole: 4,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 129, courseRating: 71.9, parTotal: 73, notes: "Golfify — alta confianza" },
    ],
  },
  {
    courseName: "Buenos Aires Golf Club",
    createIfMissing: true,
    defaultParPerHole: 4,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 125, courseRating: 69.8, parTotal: 72, notes: "where2golf — slope estimado" },
    ],
  },
  {
    courseName: "Lagartos",
    createIfMissing: false, // ya existe Lagartos
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 120, courseRating: 70.0, parTotal: 71, notes: "ESTIMADO — pedir scorecard. 18Birdies solo tiene 9h" },
    ],
  },
  {
    courseName: "Media Luna",
    createIfMissing: false, // ya existe
    tees: [
      // Sin datos confiables online — placeholder estimado
      { name: "BLANCO", category: "CAB", slopeRating: 120, courseRating: 70.0, parTotal: 70, notes: "ESTIMADO — verificar" },
    ],
  },
  {
    courseName: "Potrerillo",
    createIfMissing: false, // ya existe (variante de Potrerillo de Larreta)
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 130, courseRating: 74.5, parTotal: 72, notes: "Mismo que Potrerillo de Larreta — Top100" },
    ],
  },
  {
    courseName: "San Miguel plaza hotel",
    createIfMissing: false,
    tees: [
      { name: "BLANCO", category: "CAB", slopeRating: 118, courseRating: 69.5, parTotal: 70, notes: "ESTIMADO — verificar" },
    ],
  },
];

export async function POST() {
  const result = {
    coursesCreated: 0,
    coursesFound: 0,
    teesCreated: 0,
    teesUpdated: 0,
    skipped: [] as string[],
  };

  for (const seed of SEED_TEES) {
    let course = await prisma.course.findUnique({ where: { name: seed.courseName } });
    if (!course && seed.createIfMissing) {
      // Crear cancha con holes default (par por defecto, hcpHoyo 1..18)
      const par = seed.defaultParPerHole ?? 4;
      course = await prisma.course.create({
        data: {
          name: seed.courseName,
          holes: {
            create: Array.from({ length: 18 }, (_, i) => ({
              number: i + 1,
              par,
              hcpHoyo: i + 1, // placeholder — editar después
            })),
          },
        },
      });
      result.coursesCreated++;
    } else if (course) {
      result.coursesFound++;
    } else {
      result.skipped.push(seed.courseName);
      continue;
    }

    for (const tee of seed.tees) {
      const existing = await prisma.courseTee.findFirst({
        where: { courseId: course.id, name: tee.name, category: tee.category },
      });
      if (existing) {
        await prisma.courseTee.update({
          where: { id: existing.id },
          data: tee,
        });
        result.teesUpdated++;
      } else {
        await prisma.courseTee.create({
          data: { ...tee, courseId: course.id },
        });
        result.teesCreated++;
      }
    }
  }

  return NextResponse.json(result);
}
