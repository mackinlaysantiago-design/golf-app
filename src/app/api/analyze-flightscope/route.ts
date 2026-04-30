import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, VISION_MODEL } from "@/lib/anthropic";

const EXTRACTION_PROMPT = `Sos un parser experto de tablas FlightScope. Extraé TODOS los shots de esta imagen como JSON.

Estructura por shot esperada (campos opcionales si no están visibles, dejar null):
{
  "shot_number": 1,
  "carry_yds": 239.1,
  "roll_yds": 13.3,
  "total_yds": 252.3,
  "lateral_yds": 21.4,
  "lateral_dir": "L" | "R" | null,
  "club_speed_mph": 116.3,
  "ball_speed_mph": 160.9,
  "spin_rpm": 2983,
  "spin_axis_deg": 17.2,
  "spin_axis_dir": "L" | "R" | null,
  "spin_loft_deg": 6.4,
  "smash_factor": 1.38,
  "vertical_angle_deg": 5.6,
  "horizontal_angle_deg": 1.8,
  "horizontal_dir": "L" | "R" | null,
  "aoa_deg": 4.8,
  "height_ft": 54.3,
  "time_sec": 5.5,
  "shot_type": "Hook" | "Slice" | "Push" | "Pull" | "Straight" | "Draw" | "Fade" | "Unknown" | null
}

Si hay filas AVG y DEV (promedio y desviación estándar), incluilas como objetos extra con shot_number=0 y agregando el campo "row_type": "AVG" o "DEV".

Shots "Unknown" o sin distancia: incluilos pero con los campos sin valor en null.

Respondé SOLO con JSON válido, sin markdown, sin texto extra:
{
  "shots": [...]
}`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "missing image" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  const client = getAnthropic();
  const message = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Extraer JSON (por si vino con ```json``` wrapper)
  let jsonStr = text.trim();
  const fence = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
  if (fence) jsonStr = fence[1];
  else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```\w*\s*/, "").replace(/\s*```$/, "");
  }

  let parsed: { shots: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json(
      { error: "Claude no devolvió JSON válido", raw: text },
      { status: 500 },
    );
  }

  // Normalizar al formato del schema
  const shots = (parsed.shots ?? []).map((s) => {
    const rowType = (s.row_type as string) ?? "SHOT";
    return {
      shotNumber: (s.shot_number as number) ?? 0,
      rowType,
      carryYds: (s.carry_yds as number) ?? null,
      rollYds: (s.roll_yds as number) ?? null,
      totalYds: (s.total_yds as number) ?? null,
      lateralYds: (s.lateral_yds as number) ?? null,
      lateralDir: (s.lateral_dir as string) ?? null,
      clubSpeedMph: (s.club_speed_mph as number) ?? null,
      ballSpeedMph: (s.ball_speed_mph as number) ?? null,
      spinRpm: (s.spin_rpm as number) ?? null,
      spinAxisDeg: (s.spin_axis_deg as number) ?? null,
      spinAxisDir: (s.spin_axis_dir as string) ?? null,
      spinLoftDeg: (s.spin_loft_deg as number) ?? null,
      smashFactor: (s.smash_factor as number) ?? null,
      verticalAngleDeg: (s.vertical_angle_deg as number) ?? null,
      horizontalAngleDeg: (s.horizontal_angle_deg as number) ?? null,
      horizontalDir: (s.horizontal_dir as string) ?? null,
      aoaDeg: (s.aoa_deg as number) ?? null,
      heightFt: (s.height_ft as number) ?? null,
      timeSec: (s.time_sec as number) ?? null,
      shotType: (s.shot_type as string) ?? null,
    };
  });

  return NextResponse.json({ shots });
}
