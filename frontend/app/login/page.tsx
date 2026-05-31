"use client";
import { useState, useEffect } from "react";

type Phase = "login" | "greeting" | "done";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("login");
  const [displayName, setDisplayName] = useState("");

  async function submit() {
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const n = name.trim() || "Użytkowniku";
        setDisplayName(n);
        document.cookie = `username=${encodeURIComponent(n)};path=/;max-age=${60 * 60 * 24 * 30}`;
        setPhase("greeting");
        setTimeout(() => {
          setPhase("done");
          setTimeout(() => { window.location.href = "/"; }, 400);
        }, 2200);
      } else {
        setError("Nieprawidłowe hasło.");
      }
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-pulse-slow absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-3xl" />
        <div className="animate-pulse-slow absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-3xl" style={{animationDelay:"3s"}} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Login form */}
      {phase === "login" && (
        <div className="relative w-full max-w-sm px-6 animate-fade-in">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-white/10 mb-5 shadow-xl">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Okazje</h1>
            <p className="text-zinc-500 text-sm mt-1">System monitorowania ofert</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 uppercase tracking-widest">Imię</label>
              <input
                type="text"
                placeholder="Jak masz na imię?"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.05] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 uppercase tracking-widest">Hasło</label>
              <input
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.05] transition-all"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading}
              className="w-full mt-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:-translate-y-px active:translate-y-0"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Weryfikacja…
                </span>
              ) : "Wejdź"}
            </button>
          </div>
        </div>
      )}

      {/* Greeting */}
      {(phase === "greeting" || phase === "done") && (
        <div className={`relative text-center ${phase === "done" ? "animate-fade-out" : "animate-fade-in"}`}>
          <p className="text-zinc-500 text-sm uppercase tracking-widest mb-3">Witaj</p>
          <h2 className="text-5xl font-bold text-white tracking-tight">{displayName}</h2>
          <div className="mt-6 flex justify-center">
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-shimmer" />
          </div>
        </div>
      )}
    </div>
  );
}
