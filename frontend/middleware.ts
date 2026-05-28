import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const password = process.env.SITE_PASSWORD;

  if (!password) return NextResponse.next();

  if (auth) {
    const [, encoded] = auth.split(" ");
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const [, pass] = decoded.split(":");
    if (pass === password) return NextResponse.next();
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Okazje"' },
  });
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
