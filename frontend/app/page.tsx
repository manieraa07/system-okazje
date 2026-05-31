"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
    const match = document.cookie.match(/username=([^;]+)/);
    if (match) setUsername(decodeURIComponent(match[1]));
  }, []);

  return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="animate-pulse-slow absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-3xl" />
        <div className="animate-pulse-slow absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-emerald-600/8 blur-3xl" style={{animationDelay:"4s"}} />
      </div>

      <div className={`relative w-full max-w-3xl px-6 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="text-center mb-12">
          {username && (
            <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2 animate-fade-in">
              Witaj z powrotem, {username}
            </p>
          )}
          <h1 className="text-4xl font-bold text-white tracking-tight animate-slide-up delay-100">
            Wybierz rynek
          </h1>
          <p className="text-zinc-500 mt-2 animate-slide-up delay-200">
            Monitoruj oferty na wybranym rynku
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-slide-up delay-300">
          <MarketCard
            flag="PL"
            title="Rynek Polski"
            subtitle="OLX · Allegro · Vinted"
            color="blue"
            onClick={() => router.push("/pl")}
          />
          <MarketCard
            flag="DE"
            title="Rynek Niemiecki"
            subtitle="eBay.de · Kleinanzeigen"
            color="emerald"
            onClick={() => router.push("/de")}
          />
        </div>
      </div>
    </div>
  );
}

function MarketCard({ flag, title, subtitle, color, onClick }: {
  flag: string;
  title: string;
  subtitle: string;
  color: "blue" | "emerald";
  onClick: () => void;
}) {
  const gradient = color === "blue"
    ? "from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40"
    : "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 hover:border-emerald-500/40";
  const dot = color === "blue" ? "bg-blue-400" : "bg-emerald-400";
  const arrow = color === "blue" ? "text-blue-400" : "text-emerald-400";

  return (
    <button
      onClick={onClick}
      className={`group relative bg-gradient-to-br ${gradient} border rounded-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
    >
      <div className="flex items-start justify-between mb-6">
        <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-zinc-300`}>
          {flag}
        </div>
        <div className={`w-2 h-2 rounded-full ${dot} opacity-60 group-hover:opacity-100 transition-opacity mt-1`} />
      </div>
      <h2 className="text-xl font-semibold text-white mb-1">{title}</h2>
      <p className="text-zinc-500 text-sm">{subtitle}</p>
      <div className={`mt-6 flex items-center gap-1 ${arrow} text-sm font-medium`}>
        <span>Przejdź</span>
        <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
      </div>
    </button>
  );
}
