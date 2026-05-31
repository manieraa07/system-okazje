import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Okazje" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-[#0b0f17] text-white antialiased">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
        <header className="relative border-b border-white/[0.06] bg-[#0b0f17]/80 backdrop-blur-xl sticky top-0 z-40">
          <nav className="mx-auto max-w-screen-2xl flex items-center gap-3 px-6 py-3">
            <Link href="/" className="flex items-center gap-2.5 mr-6 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center group-hover:border-white/20 transition-colors">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeWidth="2" d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
              </div>
              <span className="font-semibold text-white text-sm tracking-tight">Okazje</span>
            </Link>

            <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-600 px-2 font-mono">PL</span>
              <NavLink href="/pl">Oferty</NavLink>
              <NavLink href="/settings">Ustawienia</NavLink>
            </div>

            <div className="w-px h-4 bg-white/10" />

            <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
              <span className="text-[10px] text-zinc-600 px-2 font-mono">DE</span>
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
      className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all duration-150"
    >
      {children}
    </Link>
  );
}
