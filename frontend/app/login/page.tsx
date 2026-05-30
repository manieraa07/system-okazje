"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        window.location.href = "/";
      } else {
        setError("Złe hasło. Spróbuj ponownie.");
      }
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 via-zinc-950 to-emerald-950/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="relative w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 mb-4 shadow-lg shadow-blue-500/20">
            <span className="text-2xl">🎯</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Okazje</h1>
          <p className="text-zinc-400 text-sm mt-1">System snajpowania okazji</p>
        </div>
        <div className="bg-zinc-900/80 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 uppercase tracking-wide">Hasło dostępu</label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-zinc-600"
              autoFocus
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <span>⚠</span> {error}
            </div>
          )}
          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 py-3 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Sprawdzam…
              </span>
            ) : "Wejdź →"}
          </button>
        </div>
      </div>
    </div>
  );
}
