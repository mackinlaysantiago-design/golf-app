import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { splitCourseHcpIdaVuelta } from "@/lib/handicap";

// GET /api/canchas/:id/hcp?index=8.9&modality=MEDAL&tee=BLANCO&category=CAB
//
// Estrategia de cálculo (en orden):
//  1. Lookup en CourseHcpRange (pre-calculado, ej Lucila importado de Excel) — match exacto por modalidad TOTAL
//  2. Fallback: fórmula WHS sobre CourseTee → CH = round(idx × slope/113 + (CR − Par))
// Para modalidad _IDA / _VUELTA: NUNCA se busca en la tabla ni se usa CR/Slope de 9 hoyos.
// Se calcula el CH total (18 hoyos) y se parte con splitCourseHcpIdaVuelta (÷2, impar a la ida).
// Las columnas _IDA/_VUELTA de la tabla de club son una guía redondeada, no la fórmula oficial,
// y con índices finos dan splits erróneos (confirmado con Ale Massa/AAG, 19/09/2026).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const idxStr = sp.get("index");
  const modalityParam = sp.get("modality") ?? "MEDAL";
  const tee = sp.get("tee") ?? "BLANCO";
  const category = sp.get("category") ?? "CAB";

  if (idxStr == null) {
    return NextResponse.json({ error: "missing index" }, { status: 400 });
  }
  const idx = parseFloat(idxStr);
  if (isNaN(idx)) return NextResponse.json({ error: "invalid index" }, { status: 400 });

  const isIda = modalityParam.endsWith("_IDA");
  const isVuelta = modalityParam.endsWith("_VUELTA");
  const baseModality = isIda || isVuelta
    ? modalityParam.replace(/_(IDA|VUELTA)$/, "")
    : modalityParam;

  const total = await getCourseHcpTotal(id, baseModality, idx, tee, category);
  if (total == null) return NextResponse.json({ courseHcp: null, found: false });

  if (isIda || isVuelta) {
    const split = splitCourseHcpIdaVuelta(total.courseHcp);
    const courseHcp = isIda ? split.ida : split.vuelta;
    return NextResponse.json({ courseHcp, found: true, source: "SPLIT_FROM_TOTAL", total: total.courseHcp });
  }

  return NextResponse.json(total);
}

async function getCourseHcpTotal(
  courseId: string,
  modality: string,
  idx: number,
  tee: string,
  category: string,
) {
  // 1. Tabla pre-cargada
  const range = await prisma.courseHcpRange.findFirst({
    where: {
      courseId,
      modality,
      tee,
      category,
      indexFrom: { lte: idx },
      indexTo: { gte: idx },
    },
  });

  if (range) {
    return { courseHcp: range.courseHcp, found: true, source: "TABLE", range };
  }

  // 2. Fallback fórmula WHS via CourseTee
  const courseTee = await prisma.courseTee.findFirst({
    where: { courseId, name: tee, category },
  });
  if (courseTee) {
    const slope = courseTee.slopeRating;
    const cr = courseTee.courseRating;
    const par = courseTee.parTotal;
    // Fórmula WHS estándar: CH = round(idx × slope/113 + (CR − par))
    const courseHcp = Math.round(idx * (slope / 113) + (cr - par));
    return {
      courseHcp,
      found: true,
      source: "WHS_FORMULA",
      formula: { slope, cr, par, calculation: `${idx} × ${slope}/113 + (${cr} − ${par}) = ${courseHcp}` },
    };
  }

  return null;
}
