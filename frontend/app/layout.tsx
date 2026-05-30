import "./globals.css";
import Link from "next/link";
import { headers } from "next/headers";

export const metadata = { title: "Okazje" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-zinc-950 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-emerald-950/10 pointer-events-none" />
        <header className="relative border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-40">
          <nav className="mx-auto max-w-screen-2xl flex items-center gap-2 px-6 py-3">
            <Link href="/" className="flex items-center gap-2 mr-6">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xs shadow-lg shadow-blue-500/20">
                🎯
              </div>
              <span className="font-bold text-white">Okazje</span>
            </Link>
            <div className="flex items-center gap-1 bg-zinc-900/50 rounded-xl p-1 border border-white/5">
              <span className="text-xs px-2 text-zinc-500">🇵🇱</span>
              <NavLink href="/pl">Oferty</NavLink>
              <NavLink href="/settings">Ustawienia</NavLink>
            </div>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <div className="flex items-center gap-1 bg-zinc-900/50 rounded-xl p-1 border border-white/5">
              <span className="text-xs px-2 text-zinc-500">🇩🇪</span>
              <NavLink href="/de">Angebote</NavLink>
              <NavLink href="/de/settings">Einstellungen</NavLink>
            </div>
          </nav>
        </header>
        <main className="relative mx-auto max-w-screen-2xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
    >
      {children}
    </Link>
  );
}
