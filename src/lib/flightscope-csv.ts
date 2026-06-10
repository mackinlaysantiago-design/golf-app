// Parser del CSV de MyFlightScope (export "Export To CSV").
// Formato real: coma-delimitado, decimales con punto, "-"/"N/A" = vacío,
// valores direccionales como "11.4 L" / "34.5 R". Filas Avg/Dev por palo.
// Header: club,Shot,Ball (mph),Club (mph),Smash,Carry (yds),Total (yds),Roll (yds),
//   Spin (rpm),Height (ft),Time (s),AOA (°),Spin Loft (°),Spin Axis (°),Lateral (yds),
//   Shot Type,Launch H (°),Launch V (°),Mode,Location,...

export type CsvShot = {
  shotNumber: number;
  rowType: "SHOT" | "AVG" | "DEV";
  carryYds: number | null;
  totalYds: number | null;
  rollYds: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  smashFactor: number | null;
  spinRpm: number | null;
  heightFt: number | null;
  timeSec: number | null;
  aoaDeg: number | null;
  spinLoftDeg: number | null;
  spinAxisDeg: number | null;
  spinAxisDir: string | null;
  lateralYds: number | null;
  lateralDir: string | null;
  shotType: string | null;
  horizontalAngleDeg: number | null;
  horizontalDir: string | null;
  verticalAngleDeg: number | null;
};

export type CsvClubGroup = {
  rawClub: string; // nombre tal cual viene en el CSV
  shots: CsvShot[]; // solo rowType SHOT
};

function splitLine(line: string): string[] {
  // El CSV de FlightScope no usa comillas → split simple por coma alcanza.
  return line.split(",").map((c) => c.trim());
}

function num(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (t === "" || t === "-" || t.toUpperCase() === "N/A") return null;
  // tomar el primer token numérico (ignora sufijo de dirección "11.4 L")
  const m = t.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return Number.isFinite(v) ? v : null;
}

function dir(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/\b([LR])\b/);
  return m ? m[1] : null;
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z]/g, "").trim();
}

export function parseFlightscopeCsv(text: string): CsvClubGroup[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const header = splitLine(lines[0]).map(normHeader);
  const col = (name: string) => header.indexOf(name);
  const idx = {
    club: col("club"),
    shot: col("shot"),
    ball: col("ball"),
    clubspeed: header.findIndex((h, i) => h === "club" && i !== col("club")), // 2da "club" = club speed
    smash: col("smash"),
    carry: col("carry"),
    total: col("total"),
    roll: col("roll"),
    spin: col("spin"),
    height: col("height"),
    time: col("time"),
    aoa: col("aoa"),
    spinloft: col("spinloft"),
    spinaxis: col("spinaxis"),
    lateral: col("lateral"),
    shottype: col("shottype"),
    launchh: col("launchh"),
    launchv: col("launchv"),
  };

  const groups = new Map<string, CsvClubGroup>();

  for (let i = 1; i < lines.length; i++) {
    const f = splitLine(lines[i]);
    const club = f[idx.club];
    if (!club) continue;
    const shotRaw = (f[idx.shot] ?? "").toLowerCase();
    let rowType: CsvShot["rowType"];
    let shotNumber = 0;
    if (shotRaw === "avg") rowType = "AVG";
    else if (shotRaw === "dev") rowType = "DEV";
    else {
      rowType = "SHOT";
      shotNumber = parseInt(shotRaw, 10) || 0;
    }
    if (rowType !== "SHOT") continue; // para la matriz/sesión usamos solo shots

    const shot: CsvShot = {
      shotNumber,
      rowType,
      carryYds: num(f[idx.carry]),
      totalYds: num(f[idx.total]),
      rollYds: num(f[idx.roll]),
      ballSpeedMph: num(f[idx.ball]),
      clubSpeedMph: idx.clubspeed >= 0 ? num(f[idx.clubspeed]) : null,
      smashFactor: num(f[idx.smash]),
      spinRpm: num(f[idx.spin]) != null ? Math.round(num(f[idx.spin])!) : null,
      heightFt: num(f[idx.height]),
      timeSec: num(f[idx.time]),
      aoaDeg: num(f[idx.aoa]),
      spinLoftDeg: num(f[idx.spinloft]),
      spinAxisDeg: num(f[idx.spinaxis]),
      spinAxisDir: dir(f[idx.spinaxis]),
      lateralYds: num(f[idx.lateral]),
      lateralDir: dir(f[idx.lateral]),
      shotType: f[idx.shottype] && f[idx.shottype] !== "-" ? f[idx.shottype] : null,
      horizontalAngleDeg: num(f[idx.launchh]),
      horizontalDir: dir(f[idx.launchh]),
      verticalAngleDeg: num(f[idx.launchv]),
    };

    if (!groups.has(club)) groups.set(club, { rawClub: club, shots: [] });
    groups.get(club)!.shots.push(shot);
  }

  return Array.from(groups.values());
}
