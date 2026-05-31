"use client";

import { useState } from "react";
import Link from "next/link";

interface AnalysisResult {
  main_product_name: string;
  estimated_market_value_pln: number;
  max_buy_price_pln: number;
  sample_size_evaluated: number;
  detected_noise?: string[];
  tips?: string;
}

export default function PolishMarketAnalyzerPage() {
  const [phrase, setPhrase] = useState("");
  const [roi, setRoi] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/market-analyzer/pl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase, targetRoi: roi }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Błąd podczas analizy rynku");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        
        <div className="flex items-center justify-between mb-8 border-b border-[#30363d] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Market Analyzer (PLN)</h1>
              <p className="text-xs text-gray-400">Analiza cen na polskim rynku przez Groq AI</p>
            </div>
          </div>
          
          <Link 
            href="/pl" 
            className="flex items-center gap-2 bg-[#161b22] hover:bg-[#21262d] text-gray-300 border border-[#30363d] rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
          >
            ← Wróć do ofert
          </Link>
        </div>

        <form onSubmit={handleAnalyze} className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mb-6 shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Przedmiot (PL)</label>
              <input
                type="text"
                placeholder="np. PS5 Slim, Dyson..."
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Marża / ROI %</label>
              <input
                type="number"
                value={roi}
                onChange={(e) => setRoi(Number(e.target.value))}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                min="5"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg"
              >
                {loading ? "Analizuję..." : "Sprawdź cenę (zł)"}
              </button>
            </div>
          </div>
        </form>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-xs mb-6">{error}</div>}

        {result && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-xl">
            <div className="mb-4">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Raport PL</span>
              <h2 className="text-lg font-bold text-white mt-2">{result.main_product_name}</h2>
              <p className="text-[11px] text-gray-400">Wyliczono z {result.sample_size_evaluated} ostatnich ogłoszeń.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-[#0d1117] border border-[#30363d] p-4 rounded-lg">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Wartość rynkowa</span>
                <div className="text-xl font-bold text-white mt-1">{result.estimated_market_value_pln} PLN</div>
              </div>
              <div className="bg-[#0d1117] border border-emerald-500/30 p-4 rounded-lg">
                <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Max zakup (Próg)</span>
                <div className="text-xl font-bold text-emerald-400 mt-1">{result.max_buy_price_pln} PLN</div>
              </div>
            </div>

            {result.detected_noise && result.detected_noise.length > 0 && (
              <div className="mb-4 bg-[#0d1117] p-3 rounded-lg border border-[#30363d]">
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Odrzucony szum rynkowy:</h4>
                <ul className="list-disc pl-4 text-[11px] text-gray-500 space-y-0.5">
                  {result.detected_noise.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            {result.tips && <div className="border-t border-[#30363d] pt-3 text-[11px] text-gray-400"><span className="font-semibold text-gray-300">Wskazówka:</span> {result.tips}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
