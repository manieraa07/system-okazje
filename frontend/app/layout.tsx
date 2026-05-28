import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Okazje OLX + Allegro" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen">
        <header className="border-b border-white/10 bg-black/40 backdrop-blur">
          <nav className="mx-auto max-w-7xl flex items-center gap-6 px-4 py-3">
            <span className="font-semibold">🎯 Okazje</span>
            <Link href="/" className="text-sm text-zinc-300 hover:text-white">Tabela ofert</Link>
            <Link href="/settings" className="text-sm text-zinc-300 hover:text-white">Settings</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
