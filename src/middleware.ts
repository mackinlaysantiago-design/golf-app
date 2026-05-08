import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir login y assets sin auth
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/front-assets") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Vercel Cron: header x-vercel-cron viene seteado en cron jobs
  if (req.headers.get("x-vercel-cron")) {
    return NextResponse.next();
  }
  // keep-warm es público (no expone datos, solo SELECT 1) — UptimeRobot u otro pinger lo puede dispararsin secret
  if (pathname === "/api/keep-warm") {
    return NextResponse.next();
  }
  // Endpoints admin de migración one-shot (idempotentes, ALTER TABLE IF NOT EXISTS)
  if (pathname.startsWith("/api/labs/admin/")) {
    return NextResponse.next();
  }
  // Cron secret manual (para dispararlo desde fuera)
  const cronSecret = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;
  if (
    expectedSecret &&
    cronSecret === expectedSecret &&
    pathname.startsWith("/api/lucila/sync")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("gf-auth");
  if (cookie?.value === "ok") {
    return NextResponse.next();
  }

  // No auth: redirigir a login (preservar destino para volver después)
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
