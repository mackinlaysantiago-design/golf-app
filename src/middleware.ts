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
