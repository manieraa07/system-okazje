"use client";

import { useState } from "react";
import Link from "next/link";

interface EvaluatedOffer {
  title: string;
  price: number;
  url?: string;
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
  const [sortByPrice, setSortByPrice] = useState(false); // Stan sortowania cenowego

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
      if (!response.ok) throw new Error(data.error || "Błąd podczas analizy");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSourceBadge = (url?: string) => {
    if (!url) return null;
    if (url.includes("olx.pl")) return <span className="text-[9px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded font-bold uppercase">OLX</span>;
    if (url.includes("allegro")) return <span className="text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded font-bold uppercase">Allegro</span>;
    if (url.includes("ebay")) return <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-bold uppercase">eBay</span>;
    return <span className="text-[9px] bg-gray-500/10 text-gray-400 border border-gray-500/20 px-1.5 py-0.5 rounded font-bold uppercase">Link</span>;
  };

  // Logika sortowania ofert
  const getProcessedOffers = () => {
    if (!result?.analyzed_offers) return [];
    const offersCopy = [...result.analyzed_offers];
    if (sortByPrice) {
      return offersCopy.sort((a, b) => a.price - b.price); // Sortowanie od najtańszych
    }
    return offersCopy;
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center justify-between mb-8 border-b border-[#30363d] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Market Analyzer (PLN)</h1>
              <p className="text-xs text-gray-400">Precyzyjna wycena bazowa z odsiewem wartości zestawów</p>
            </div>
          </div>
          <Link href="/pl" className="bg-[#161b22] hover:bg-[#21262d] text-gray-300 border border-[#30363d] rounded-lg px-4 py-2 text-xs font-semibold transition-colors">
            ← Wróć do ofert
          </Link>
        </div>

        <form onSubmit={handleAnalyze} className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Szukany przedmiot (PL)</label>
              <input
                type="text"
                placeholder="Wpisz np. PS5, Dyson..."
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors shadow-lg">
              {loading ? "Przetwarzanie..." : "Analizuj rynek"}
            </button>
          </div>
        </form>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-xs mb-6">{error}</div>}

        {result && (
          <div className="space-y-6">
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-xl">
              <div className="mb-4">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Skorygowana cena rynkowa</span>
                <h2 className="text-xl font-bold text-white mt-2">{result.main_product_name}</h2>
              </div>

              <div className="bg-[#0d1117] border border-emerald-500/20 p-5 rounded-lg text-center mb-4">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Szacowana Wartość Bazowa (Bez drogich zestawów)</span>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">{result.estimated_market_value_pln} PLN</div>
              </div>

              {result.tips && <div className="text-xs text-gray-400 bg-[#0d1117] p-3 border border-[#30363d] rounded-lg"><span className="font-semibold text-gray-200">Uzasadnienie kalkulacji:</span> {result.tips}</div>}
            </div>

            {/* Lista Ofert z Linkami i Sortowaniem */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block"></span>
                  Uwzględnione w kalkulacji ({result.analyzed_offers?.length || 0})
                </h3>
                
                {/* Przyciski sortowania */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSortByPrice(false)}
                    className={`px-3 py-1 text-[11px] font-semibold rounded border transition-colors ${!sortByPrice ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-[#0d1117] text-gray-400 border-[#30363d] hover:bg-[#21262d]'}`}
                  >
                    Domyślne
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortByPrice(true)}
                    className={`px-3 py-1 text-[11px] font-semibold rounded border transition-colors ${sortByPrice ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-[#0d1117] text-gray-400 border-[#30363d] hover:bg-[#21262d]'}`}
                  >
                    Najniższa cena ↑
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 border border-[#30363d] rounded-lg p-3 bg-[#0d1117]">
                {getProcessedOffers().map((offer, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs py-2 border-b border-[#21262d] last:border-0 gap-4 hover:bg-[#161b22]/50 px-1 rounded transition-colors">
                    <div className="flex items-center gap-2 truncate">
                      {getSourceBadge(offer.url)}
                      {offer.url ? (
                        <a href={offer.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-emerald-400 hover:underline truncate font-medium">
                          {offer.title} ↗
                        </a>
                      ) : (
                        <span className="text-gray-300 truncate">{offer.title}</span>
                      )}
                    </div>
                    <span className="font-semibold text-emerald-400 shrink-0">{offer.price} PLN</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Harmonijka dla szumu */}
            {result.rejected_offers && result.rejected_offers.length > 0 && (
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xl">
                <button type="button" onClick={() => setShowNoise(!showNoise)} className="w-full flex items-center justify-between p-4 text-sm font-semibold text-gray-400 hover:bg-[#21262d] transition-colors">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-400/50 inline-block"></span>
                    Ukryty czysty szum / Odrzuty ({result.rejected_offers.length})
                  </span>
                  <span>{showNoise ? "▲ Ukryj" : "▼ Rozwiń szczegóły"}</span>
                </button>
                {showNoise && (
                  <div className="p-4 bg-[#0d1117] border-t border-[#30363d] max-h-64 overflow-y-auto space-y-2">
                    {result.rejected_offers.map((offer, idx) => (
                      <div key={idx} className="text-xs py-1.5 border-b border-[#21262d] last:border-0 flex justify-between gap-4">
                        <span className="text-gray-500 truncate">{offer.title}</span>
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 shrink-0 font-mono">{offer.reason}</span>
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
