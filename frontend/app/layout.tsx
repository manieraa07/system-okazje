import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Okazje" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-[#0b0f17] text-white antialiased">
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
        <header className="relative border-b border-white/[0.05] bg-[#0b0f17]/90 backdrop-blur-xl sticky top-0 z-40">
          <div className="mx-auto max-w-screen-2xl px-6 py-3 flex items-center justify-center">
            <Link href="/" className="group flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center group-hover:border-white/20 transition-all duration-200">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeWidth="2" d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-zinc-200 transition-colors">
                Okazje
              </span>
            </Link>
          </div>
        </header>
        <main className="relative mx-auto max-w-screen-2xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
