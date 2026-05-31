"use client";

import { useState } from "react";
import Link from "next/link";

interface EvaluatedOffer {
  title: string;
  price: number;
}

interface RejectedOffer {
  title: string;
  reason: string;
}

interface AnalysisResult {
  main_product_name: string;
  estimated_market_value_pln: number;
  analyzed_offers?: EvaluatedOffer[];
  rejected_offers?: RejectedOffer[];
  tips?: string;
}

export default function PolishMarketAnalyzerPage() {
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [showNoise, setShowNoise] = useState(false);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setShowNoise(false);

    try {
      const response = await fetch("/api/market-analyzer/pl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase }),
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
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
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
          <Link href="/pl" className="flex items-center gap-2 bg-[#161b22] hover:bg-[#21262d] text-gray-300 border border-[#30363d] rounded-lg px-4 py-2 text-xs font-semibold transition-colors">
            ← Wróć do ofert
          </Link>
        </div>

        {/* Formularz */}
        <form onSubmit={handleAnalyze} className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Szukany przedmiot (PL)</label>
              <input
                type="text"
                placeholder="np. PS5 Slim, Dyson V15..."
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>
            <div className="w-full sm:w-auto">
              <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors shadow-lg">
                {loading ? "Analizuję..." : "Sprawdź wartość"}
              </button>
            </div>
          </div>
        </form>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-xs mb-6">{error}</div>}

        {/* Karta Wyników */}
        {result && (
          <div className="space-y-6">
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-xl">
              <div className="mb-4">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Raport cenowy</span>
                <h2 className="text-xl font-bold text-white mt-2">{result.main_product_name}</h2>
              </div>

              <div className="bg-[#0d1117] border border-emerald-500/20 p-5 rounded-lg text-center mb-4">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Szacowana wartość rynkowa</span>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">{result.estimated_market_value_pln} PLN</div>
              </div>

              {result.tips && <div className="text-xs text-gray-400 bg-[#0d1117] p-3 border border-[#30363d] rounded-lg"><span className="font-semibold text-gray-200">Wskazówka AI:</span> {result.tips}</div>}
            </div>

            {/* Sekcja 1: Przeanalizowane oferty (Zawsze widoczne) */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-2 height-2 h-2 w-2 rounded-full bg-emerald-400 inline-block"></span>
                Przeanalizowane ogłoszenia ({result.analyzed_offers?.length || 0})
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 border border-[#30363d] rounded-lg p-3 bg-[#0d1117]">
                {result.analyzed_offers && result.analyzed_offers.length > 0 ? (
                  result.analyzed_offers.map((offer, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-[#21262d] last:border-0 gap-4">
                      <span className="text-gray-300 truncate">{offer.title}</span>
                      <span className="font-semibold text-emerald-400 shrink-0">{offer.price} PLN</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">Brak ofert w kalkulacji.</p>
                )}
              </div>
            </div>

            {/* Sekcja 2: Szum / Odrzucone (Wysuwane menu / Accordion) */}
            {result.rejected_offers && result.rejected_offers.length > 0 && (
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xl">
                <button 
                  type="button"
                  onClick={() => setShowNoise(!showNoise)}
                  className="w-full flex items-center justify-between p-4 text-sm font-semibold text-gray-400 hover:bg-[#21262d] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-400/70 inline-block"></span>
                    Odrzucone ogłoszenia / Szum ({result.rejected_offers.length})
                  </span>
                  <span>{showNoise ? "▲ Ukryj" : "▼ Rozwiń"}</span>
                </button>
                
                {showNoise && (
                  <div className="p-4 bg-[#0d1117] border-t border-[#30363d] max-h-64 overflow-y-auto space-y-2">
                    {result.rejected_offers.map((offer, idx) => (
                      <div key={idx} className="text-xs py-1.5 border-b border-[#21262d] last:border-0 flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-gray-500 truncate">{offer.title}</span>
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 shrink-0 sm:self-center font-mono">{offer.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
