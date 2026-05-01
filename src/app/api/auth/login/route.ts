import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "APP_PASSWORD no configurado en server" }, { status: 500 });
  }
  if (password !== expected) {
    return NextResponse.json({ error: "Password incorrecto" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("gf-auth", "ok", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 año
    path: "/",
  });
  return res;
}
