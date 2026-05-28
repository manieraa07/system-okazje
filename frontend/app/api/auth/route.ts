import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const correct = process.env.SITE_PASSWORD;

  if (!correct || password !== correct) {
    return NextResponse.json({ error: "Złe hasło" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", correct, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, // 30 dni
    path: "/",
  });
  return res;
}
