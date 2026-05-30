"use client";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-3">
          Wybierz rynek
        </h1>
        <p className="text-zinc-400">Przejdź do wybranego rynku aby przeglądać oferty</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-4">
        <button
          onClick={() => router.push("/pl")}
          className="group relative bg-zinc-900/80 hover:bg-zinc-800/80 border border-white/10 hover:border-white/20 rounded-2xl p-8 text-left transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="text-5xl mb-4">🇵🇱</div>
            <h2 className="text-xl font-bold text-white mb-2">Rynek Polski</h2>
            <p className="text-zinc-400 text-sm">OLX · Allegro · Vinted</p>
            <div className="mt-6 flex items-center gap-2 text-blue-400 text-sm font-medium">
              Przejdź do ofert
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </button>
        <button
          onClick={() => router.push("/de")}
          className="group relative bg-zinc-900/80 hover:bg-zinc-800/80 border border-white/10 hover:border-white/20 rounded-2xl p-8 text-left transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="text-5xl mb-4">🇩🇪</div>
            <h2 className="text-xl font-bold text-white mb-2">Rynek Niemiecki</h2>
            <p className="text-zinc-400 text-sm">eBay.de · Kleinanzeigen</p>
            <div className="mt-6 flex items-center gap-2 text-blue-400 text-sm font-medium">
              Zu den Angeboten
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
