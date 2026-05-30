import "./globals.css";
import Link from "next/link";
export const metadata = { title: "Okazje" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen">
        <header className="border-b border-white/10 bg-black/40 backdrop-blur">
          <nav className="mx-auto max-w-screen-2xl flex items-center gap-1 px-4 py-2">
            <span className="font-semibold mr-4">🎯 Okazje</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-500 px-2">🇵🇱</span>
              <Link href="/" className="text-sm text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5">
                Tabela ofert
              </Link>
              <Link href="/settings" className="text-sm text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5">
                Ustawienia
              </Link>
            </div>
            <div className="w-px h-5 bg-white/10 mx-2" />
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-500 px-2">🇩🇪</span>
              <Link href="/de" className="text-sm text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5">
                Angebote
              </Link>
              <Link href="/de/settings" className="text-sm text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5">
                Einstellungen
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-screen-2xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
