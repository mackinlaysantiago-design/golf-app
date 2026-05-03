import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const LOGIN_URL = "https://www.lalucilapoloclub.com/golf/login.php";
const SOCIOS_URL = "https://www.lalucilapoloclub.com/golf/handicapindex_socios.php";

type SocioRow = {
  matricula: string;
  name: string;
  cat: "CAB" | "DAM";
  hcpIndex: number;
};

function parseSocios(html: string): SocioRow[] {
  const rows: SocioRow[] = [];
  // Match TR rows
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRegex.exec(html))) {
    const inner = m[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let mt: RegExpExecArray | null;
    while ((mt = tdRegex.exec(inner))) {
      cells.push(mt[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
    }
    if (cells.length < 4) continue;
    // cells: [#, "NAME (matricula)", cat, hcp, hcpAnterior, variacion]
    const nameRaw = cells[1];
    const cat = cells[2];
    const hcpStr = cells[3].replace(",", ".");
    const matMatch = nameRaw.match(/\((\d+)\)\s*$/);
    if (!matMatch) continue;
    const matricula = matMatch[1];
    const name = nameRaw.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
    const hcp = parseFloat(hcpStr);
    if (isNaN(hcp)) continue;
    if (cat !== "CAB" && cat !== "DAM") continue;
    rows.push({ matricula, name, cat: cat as "CAB" | "DAM", hcpIndex: hcp });
  }
  return rows;
}

// Helper: parsea response cookies y retorna como header Cookie
function extractCookies(setCookieHeader: string[]): string {
  return setCookieHeader
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function loginAndScrape(): Promise<SocioRow[]> {
  const user = process.env.LUCILA_USER;
  const pass = process.env.LUCILA_PASS;
  if (!user || !pass) {
    throw new Error("Faltan LUCILA_USER / LUCILA_PASS en env vars");
  }

  // 1) GET login para obtener cookies iniciales
  const r1 = await fetch(LOGIN_URL, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0 (golf-app sync)" },
    redirect: "manual",
  });
  const cookies1 = r1.headers.getSetCookie?.() ?? [];

  // 2) POST login
  const body = new URLSearchParams({
    username: user,
    password: pass,
    autologin: "1",
    submit: "Ingresar",
  });
  const r2 = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (golf-app sync)",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: extractCookies(cookies1),
    },
    body,
    redirect: "manual",
  });
  const cookies2 = [...cookies1, ...(r2.headers.getSetCookie?.() ?? [])];

  // 3) POST a página de socios con filtro TODOS
  const filterBody = new URLSearchParams({
    filtroBuscar: "",
    filtroTee: "",
    filtroSexo: "TODOS",
    filtroSemana: "TODOS",
  });
  const r3 = await fetch(SOCIOS_URL, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (golf-app sync)",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: extractCookies(cookies2),
    },
    body: filterBody,
    redirect: "manual",
  });
  if (!r3.ok) {
    throw new Error(`Sociospage status ${r3.status}`);
  }
  // El HTML viene en latin-1 (Argentina), pero la página de socios es UTF-8 según meta tag
  // Probamos UTF-8 primero, fallback latin-1
  const buf = await r3.arrayBuffer();
  let html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  // Si vemos caracteres rotos típicos, fallback
  if (html.includes("�") || /[ÃÂ]/.test(html)) {
    html = new TextDecoder("latin1").decode(buf);
  }
  return parseSocios(html);
}

// Normalizar nombre para fuzzy match (sin acentos, mayúsculas, espacios simples)
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Tokens ordenados para match agnóstico al orden ("MACKINLAY SANTIAGO" == "SANTIAGO MACKINLAY")
function nameTokens(s: string): string {
  return normalizeName(s)
    .split(" ")
    .filter((t) => t.length > 0)
    .sort()
    .join(" ");
}

async function sync(): Promise<{ scraped: number; updated: number; created: number; errors: string[] }> {
  const socios = await loginAndScrape();
  const errors: string[] = [];
  let updated = 0;
  let created = 0;

  // Cargar todos los players para match por nombre
  const allPlayers = await prisma.player.findMany();
  const byMatricula = new Map(allPlayers.filter((p) => p.lucilaMatricula).map((p) => [p.lucilaMatricula!, p]));
  const byNormName = new Map(allPlayers.map((p) => [normalizeName(p.name), p]));
  // Match agnóstico al orden de palabras (ej: "Santiago Mackinlay" == "MACKINLAY SANTIAGO")
  const byTokens = new Map(allPlayers.map((p) => [nameTokens(p.name), p]));

  const now = new Date();

  for (const s of socios) {
    try {
      // Match prioridad: matricula > nombre exacto > tokens ordenados
      let target = byMatricula.get(s.matricula);
      if (!target) {
        target = byNormName.get(normalizeName(s.name));
      }
      if (!target) {
        target = byTokens.get(nameTokens(s.name));
      }

      if (target) {
        // Update si cambió HCP o si falta matricula
        const needsUpdate =
          target.hcpIndex !== s.hcpIndex ||
          target.lucilaMatricula !== s.matricula;
        if (needsUpdate) {
          await prisma.player.update({
            where: { id: target.id },
            data: {
              hcpIndex: s.hcpIndex,
              lucilaMatricula: s.matricula,
              lastHcpUpdate: now,
            },
          });
          updated++;
        }
      } else {
        // Crear nuevo
        // Convertir nombre a Title Case para no romper UI: "MASSA ALEJANDRO" → "Massa Alejandro"
        const titleName = s.name
          .split(" ")
          .map((w) => (w.length > 0 ? w[0] + w.slice(1).toLowerCase() : w))
          .join(" ");
        await prisma.player.create({
          data: {
            name: titleName,
            hcpIndex: s.hcpIndex,
            lucilaMatricula: s.matricula,
            lastHcpUpdate: now,
          },
        });
        created++;
      }
    } catch (e) {
      errors.push(`${s.matricula} ${s.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { scraped: socios.length, updated, created, errors };
}

export async function POST() {
  try {
    const result = await sync();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

// Permitir GET para Vercel Cron (que solo soporta GET por default)
export async function GET(req: NextRequest) {
  // Si tiene header de Cron de Vercel o si tiene secret, OK
  const cronHeader = req.headers.get("x-vercel-cron");
  const secret = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!cronHeader && (!expectedSecret || secret !== expectedSecret)) {
    // Si no es cron ni hay secret válido, requiere auth normal (que el middleware ya valida)
  }

  try {
    const result = await sync();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
