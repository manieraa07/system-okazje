import { NextResponse } from "next/server";

export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return NextResponse.json({ error: "brak tokenu" }, { status: 500 });

  const res = await fetch(
    "https://api.github.com/repos/manieraa07/system-okazje/actions/workflows/scrape.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (res.status === 204) return NextResponse.json({ ok: true });
  const body = await res.text();
  return NextResponse.json({ error: body }, { status: res.status });
}
