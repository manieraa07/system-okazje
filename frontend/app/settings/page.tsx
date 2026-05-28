"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser, WatchItem } from "@/lib/supabase";

const EMPTY: Omit<WatchItem, "id"> = {
  name: "", keywords: [], exclude_terms: [],
  market_value: 0, max_buy_price: 0,
  good_margin_pct: 30, ok_margin_pct: 15, active: true,
};

interface RunInfo {
  started_at: string;
  finished_at: string | null;
  offers_new: number;
  error: string | null;
}

export default function SettingsPage() {
  const sb = supabaseBrowser();
  const [items, setItems] = useState<WatchItem[]>([]);
  const [draft, setDraft] = useState<Omit<WatchItem, "id">>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [popupDone, setPopupDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  async function load() {
    const { data } = await sb.from("watchlist").select("*").order("name");
    setItems((data || []) as WatchItem[]);
    setLoading(false);
  }

  async function loadLastRun() {
    const { data } = await sb
      .from("scraper_runs")
      .select("started_at, finished_at, offers_new, error")
      .order("started_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) setRunInfo(data[0] as RunInfo);
  }

  useEffect(() => {
    load();
    loadLastRun();
  }, []);

  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  async function runScraper() {
    if (running) return;
    if (lastRun && Date.now() - lastRun < 60_000) {
      alert("Poczekaj 60 sekund przed kolejnym uruchomieniem.");
      return;
    }
    setRunning(true);
    setElapsed(0);
    setShowPopup(true);
    setPopupDone(false);
    try {
      const res = await fetch("/api/run-scraper", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setLastRun(Date.now());
        const startTime = Date.now();
        const poll = setInterval(async () => {
          const { data: pollData } = await sb
            .from("scraper_runs")
            .select("started_at, finished_at, offers_new, error")
            .order("started_at", { ascending: false })
            .limit(1);
          if (pollData && pollData.length > 0) {
            const latest = pollData[0] as RunInfo;
            setRunInfo(latest);
          const isNew = new Date(latest.started_at).getTime() > startTime - 10_000;
            if (isNew && latest.finished_at) {
              clearInterval(poll);
              setRunning(false);
              setPopupDone(true);
              if (latest.error) {
                setDoneMsg(`❌ Błąd: ${latest.error}`);
              } else {
                setDoneMsg(`✅ Gotowe! Znaleziono ${latest.offers_new} nowych ofert.`);
              }
            }
          }
          if (Date.now() - startTime > 300_000) {
            clearInterval(poll);
            setRunning(false);
            setPopupDone(true);
            setDoneMsg("⏱️ Timeout — sprawdź Actions na GitHubie.");
          }
        }, 5_000);
      } else {
        alert("Błąd: " + data.error);
        setRunning(false);
        setShowPopup(false);
      }
    } catch {
      alert("Błąd połączenia");
      setRunning(false);
      setShowPopup(false);
    }
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  function runStatus() {
    if (running) return `⏳ Scraper działa… ${fmt(elapsed)}`;
    if (!runInfo) return "Brak danych o ostatnim runie.";
    const start = new Date(runInfo.started_at).toLocaleString("pl-PL");
    if (!runInfo.finished_at) return `⏳ Trwa od ${start}…`;
    if (runInfo.error) return `❌ Błąd (${start}): ${runInfo.error}`;
    return `✅ ${start} — ${runInfo.offers_new} nowych ofert`;
  }

  async function add() {
    if (!draft.name.trim() || !draft.market_value) return;
    const payload = {
      ...draft,
      keywords: typeof draft.keywords === "string"
        ? (draft.keywords as unknown as string).split(",").map(s => s.trim()).filter(Boolean)
        : draft.keywords,
      exclude_terms: typeof draft.exclude_terms === "string"
        ? (draft.exclude_terms as unknown as string).split(",").map(s => s.trim()).filter(Boolean)
        : draft.exclude_terms,
    };
    const { error } = await sb.from("watchlist").insert(payload);
    if (error) { alert(error.message); return; }
    setDraft(EMPTY);
    load();
  }

  async function patch(id: string, p: Partial<WatchItem>) {
    await sb.from("watchlist").update(p).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Usunąć?")) return;
    await sb.from("watchlist").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-8">

      {showPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
            {!popupDone ? (
              <>
                <div className="text-5xl font-mono font-bold text-blue-400">{fmt(elapsed)}</div>
                <p className="text-zinc-300 text-sm">Scraper działa… sprawdzam co 5 sekund.</p>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((elapsed / 120) * 100, 95)}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500">Nie zamykaj tego okna.</p>
              </>
            ) : (
              <>
                <div className="text-4xl">{doneMsg.startsWith("✅") ? "✅" : doneMsg.startsWith("❌") ? "❌" : "⏱️"}</div>
                <p className="text-zinc-100 font-semibold">{doneMsg.replace(/^[✅❌⏱️]\s*/, "")}</p>
                <p className="text-xs text-zinc-400">Czas: {fmt(elapsed)}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setShowPopup(false); window.location.href = "/"; }}
                    className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2 rounded-lg text-sm font-medium"
                  >
                    Zobacz oferty →
                  </button>
                  <button
                    onClick={() => setShowPopup(false)}
                    className="bg-zinc-700 hover:bg-zinc-600 px-5 py-2 rounded-lg text-sm"
                  >
                    Zostań
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Ustawienia</h1>
          <p className="text-xs text-zinc-400 mt-1">{runStatus()}</p>
        </div>
        <button
          onClick={runScraper}
          disabled={running}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
        >
          {running ? `⏳ ${fmt(elapsed)}` : "▶ Odpal teraz"}
        </button>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Dodaj przedmiot</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-zinc-900/50 border border-white/10 rounded-lg p-4">
          <Input label="Nazwa (np. PS5)" value={draft.name}
                 onChange={v => setDraft({ ...draft, name: v })} />
          <Input label="Słowa kluczowe (po przecinku)" value={(draft.keywords as any) || ""}
                 onChange={v => setDraft({ ...draft, keywords: v as any })}
                 placeholder="ps5, playstation 5, sony ps 5" />
          <Input label="Wyklucz (po przecinku)" value={(draft.exclude_terms as any) || ""}
                 onChange={v => setDraft({ ...draft, exclude_terms: v as any })}
                 placeholder="pad, kabel, etui, uszkodzona" />
          <NumberInput label="Wartość rynkowa (zł)" value={draft.market_value}
                       onChange={v => setDraft({ ...draft, market_value: v })} />
          <NumberInput label="Max cena zakupu (zł)" value={draft.max_buy_price}
                       onChange={v => setDraft({ ...draft, max_buy_price: v })} />
          <div className="flex gap-2">
            <NumberInput label="🟢 Dobra ≥ % marży" value={draft.good_margin_pct}
                         onChange={v => setDraft({ ...draft, good_margin_pct: v })} />
            <NumberInput label="🟡 Średnia ≥ %" value={draft.ok_margin_pct}
                         onChange={v => setDraft({ ...draft, ok_margin_pct: v })} />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button onClick={add}
                    className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm">
              Dodaj do watchlist
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Watchlist</h2>
        {loading ? <p className="text-zinc-400">Ładowanie…</p> : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-900/80 text-zinc-300">
                <tr>
                  <Th>Nazwa</Th><Th>Słowa kluczowe</Th><Th>Wyklucz</Th>
                  <Th>Rynkowa</Th><Th>Max zakup</Th>
                  <Th>🟢 ≥%</Th><Th>🟡 ≥%</Th><Th>Aktywny</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="border-t border-white/5">
                    <Td>{it.name}</Td>
                    <Td className="text-xs text-zinc-400">{(it.keywords || []).join(", ")}</Td>
                    <Td className="text-xs text-zinc-400">{(it.exclude_terms || []).join(", ")}</Td>
                    <Td>
                      <EditNum value={it.market_value}
                               onSave={v => patch(it.id, { market_value: v })} />
                    </Td>
                    <Td>
                      <EditNum value={it.max_buy_price}
                               onSave={v => patch(it.id, { max_buy_price: v })} />
                    </Td>
                    <Td>
                      <EditNum value={it.good_margin_pct}
                               onSave={v => patch(it.id, { good_margin_pct: v })} />
                    </Td>
                    <Td>
                      <EditNum value={it.ok_margin_pct}
                               onSave={v => patch(it.id, { ok_margin_pct: v })} />
                    </Td>
                    <Td>
                      <input type="checkbox" checked={it.active}
                             onChange={e => patch(it.id, { active: e.target.checked })} />
                    </Td>
                    <Td>
                      <button onClick={() => remove(it.id)}
                              className="text-red-400 hover:text-red-300 text-xs">usuń</button>
                    </Td>
                  </tr>
                ))}
                {!items.length && (
                  <tr><td colSpan={9} className="p-6 text-center text-zinc-500">
                    Brak pozycji. Dodaj pierwszy przedmiot powyżej.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
function Input(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-sm space-y-1 block">
      <span className="text-zinc-400">{props.label}</span>
      <input className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1.5"
             value={props.value} placeholder={props.placeholder}
             onChange={e => props.onChange(e.target.value)} />
    </label>
  );
}
function NumberInput(props: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-sm space-y-1 block">
      <span className="text-zinc-400">{props.label}</span>
      <input type="number" className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1.5"
             value={props.value}
             onChange={e => props.onChange(parseFloat(e.target.value) || 0)} />
    </label>
  );
}
function EditNum({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <input type="number"
           className="w-24 bg-zinc-950 border border-white/10 rounded px-2 py-1 text-right"
           value={v}
           onChange={e => setV(e.target.value)}
           onBlur={() => { const n = parseFloat(v); if (!isNaN(n) && n !== value) onSave(n); }} />
  );
}
