import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/canchas/:id/hcp?index=8.9&modality=MEDAL&tee=BLANCO&category=CAB
//
// Estrategia de cálculo (en orden):
//  1. Lookup en CourseHcpRange (pre-calculado, ej Lucila importado de Excel) — match exacto por modalidad
//  2. Fallback: fórmula WHS sobre CourseTee → CH = round(idx × slope/113 + (CR − Par))
//     - Para MEDAL_IDA / MEDAL_VUELTA / STABLEFORD_IDA / VUELTA usa los CR/Slope/Par de 9 hoyos si están cargados, sino la mitad del Total
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const idxStr = sp.get("index");
  const modality = sp.get("modality") ?? "MEDAL";
  const tee = sp.get("tee") ?? "BLANCO";
  const category = sp.get("category") ?? "CAB";

  if (idxStr == null) {
    return NextResponse.json({ error: "missing index" }, { status: 400 });
  }
  const idx = parseFloat(idxStr);
  if (isNaN(idx)) return NextResponse.json({ error: "invalid index" }, { status: 400 });

  // 1. Tabla pre-cargada
  const range = await prisma.courseHcpRange.findFirst({
    where: {
      courseId: id,
      modality,
      tee,
      category,
      indexFrom: { lte: idx },
      indexTo: { gte: idx },
    },
  });

  if (range) {
    return NextResponse.json({ courseHcp: range.courseHcp, found: true, source: "TABLE", range });
  }

  // 2. Fallback fórmula WHS via CourseTee
  const courseTee = await prisma.courseTee.findFirst({
    where: { courseId: id, name: tee, category },
  });
  if (courseTee) {
    let slope: number;
    let cr: number;
    let par: number;
    const isIda = modality.endsWith("_IDA");
    const isVuelta = modality.endsWith("_VUELTA");
    if (isIda && courseTee.slopeIda && courseTee.courseRatingIda && courseTee.parIda) {
      slope = courseTee.slopeIda;
      cr = courseTee.courseRatingIda;
      par = courseTee.parIda;
    } else if (isVuelta && courseTee.slopeVuelta && courseTee.courseRatingVuelta && courseTee.parVuelta) {
      slope = courseTee.slopeVuelta;
      cr = courseTee.courseRatingVuelta;
      par = courseTee.parVuelta;
    } else if (isIda || isVuelta) {
      // Sin datos de 9 hoyos cargados: aproximación = mitad del 18-hoyo
      slope = courseTee.slopeRating;
      cr = courseTee.courseRating / 2;
      par = courseTee.parTotal / 2;
    } else {
      slope = courseTee.slopeRating;
      cr = courseTee.courseRating;
      par = courseTee.parTotal;
    }
    // Fórmula WHS estándar: CH = round(idx × slope/113 + (CR − par))
    const courseHcp = Math.round(idx * (slope / 113) + (cr - par));
    return NextResponse.json({
      courseHcp,
      found: true,
      source: "WHS_FORMULA",
      formula: { slope, cr, par, calculation: `${idx} × ${slope}/113 + (${cr} − ${par}) = ${courseHcp}` },
    });
  }

  return NextResponse.json({ courseHcp: null, found: false });
}
