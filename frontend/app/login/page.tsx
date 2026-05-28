"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        router.push("/");
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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 w-full max-w-sm space-y-6 shadow-2xl">
        <div className="text-center space-y-1">
          <div className="text-3xl">🎯</div>
          <h1 className="text-xl font-semibold">Okazje</h1>
          <p className="text-sm text-zinc-400">Wpisz hasło żeby wejść</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            placeholder="Hasło"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            autoFocus
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 rounded-lg text-sm font-medium"
          >
            {loading ? "Sprawdzam…" : "Wejdź"}
          </button>
        </div>
      </div>
    </div>
  );
}
