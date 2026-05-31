"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser, Offer, WatchItem } from "@/lib/supabase";
import { Star, EyeOff, Eye, Pencil, X, SlidersHorizontal, Play, ChevronRight, Check, Plus } from "lucide-react";
import { getSuggestions } from "@/lib/suggestions";

const DEAL_COLOR = {
  green:  { row: "border-l-2 border-l-emerald-500/50 bg-emerald-950/20 hover:bg-emerald-950/30", badge: "text-emerald-400" },
  yellow: { row: "border-l-2 border-l-amber-500/40 bg-amber-950/10 hover:bg-amber-950/20", badge: "text-amber-400" },
  gray:   { row: "border-l-0 bg-transparent hover:bg-white/[0.02]", badge: "text-zinc-500" },
};

type SortKey = "title" | "price" | "margin_pct" | "posted_at" | null;
type SortDir = "asc" | "desc";

const EMPTY_ITEM: Omit<WatchItem, "id"> = {
  name: "", keywords: [], exclude_terms: [],
  market_value: 0, max_buy_price: 0,
  good_margin_pct: 30, ok_margin_pct: 15, active: true, market: "pl",
};

interface RunInfo {
  started_at: string;
  finished_at: string | null;
  offers_new: number;
  error: string | null;
}

export default function OffersTable() {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Watchlist drawer state
  const [watchItems, setWatchItems] = useState<WatchItem[]>([]);
  const [watchLoading, setWatchLoading] = useState(false);
  const [draft, setDraft] = useState<Omit<WatchItem, "id">>(EMPTY_ITEM);
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Omit<WatchItem, "id">>(EMPTY_ITEM);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [scraperDone, setScraperDone] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<"all" | "olx" | "allegro" | "vinted">("all");
  const [color, setColor] = useState<"all" | "green" | "yellow" | "gray">("all");
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [onlyBundle, setOnlyBundle] = useState(false);
  const [minMargin, setMinMargin] = useState<string>("");

  async function loadRows() {
    const { data, error } = await sb
      .from("offers_view")
      .select("*")
      .eq("active", true)
      .order("scraped_at", { ascending: false })
      .limit(500);
    if (error) console.error(error);
    setRows((data || []) as Offer[]);
    setLoading(false);
  }

  async function loadWatch() {
    setWatchLoading(true);
    const { data } = await sb.from("watchlist").select("*").eq("market", "pl").order("name");
    setWatchItems((data || []) as WatchItem[]);
    setWatchLoading(false);
  }

  async function loadLastRun() {
    const { data } = await sb
      .from("scraper_runs")
      .select("started_at, finished_at, offers_new, error")
      .order("started_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) setRunInfo(data[0] as RunInfo);
  }

  useEffect(() => { loadRows(); loadLastRun(); }, []);

  useEffect(() => {
    if (drawerOpen && watchItems.length === 0) loadWatch();
  }, [drawerOpen]);

  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  function handleSort(key: NonNullable<SortKey>) {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey(null); setSortDir("desc"); }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  async function runScraper() {
    if (running) return;
    if (lastRun && Date.now() - lastRun < 60_000) return;
    setRunning(true);
    setScraperDone(null);
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
              setScraperDone(latest.error ? `Błąd: ${latest.error}` : `Gotowe — ${latest.offers_new} nowych ofert`);
              if (!latest.error) loadRows();
            }
          }
          if (Date.now() - startTime > 300_000) {
            clearInterval(poll);
            setRunning(false);
          }
        }, 5_000);
      } else {
        setRunning(false);
      }
    } catch {
      setRunning(false);
    }
  }

  async function addWatch() {
    if (!draft.name.trim() || !draft.market_value) return;
    const payload = {
      ...draft,
      keywords: typeof draft.keywords === "string"
        ? (draft.keywords as unknown as string).split(",").map((s: string) => s.trim()).filter(Boolean)
        : draft.keywords,
      exclude_terms: typeof draft.exclude_terms === "string"
        ? (draft.exclude_terms as unknown as string).split(",").map((s: string) => s.trim()).filter(Boolean)
        : draft.exclude_terms,
    };
    await sb.from("watchlist").insert(payload);
    setDraft(EMPTY_ITEM);
    setAddingNew(false);
    loadWatch();
  }

  async function saveEdit(id: string) {
    const payload = {
      ...editDraft,
      keywords: typeof editDraft.keywords === "string"
        ? (editDraft.keywords as unknown as string).split(",").map((s: string) => s.trim()).filter(Boolean)
        : editDraft.keywords,
      exclude_terms: typeof editDraft.exclude_terms === "string"
        ? (editDraft.exclude_terms as unknown as string).split(",").map((s: string) => s.trim()).filter(Boolean)
        : editDraft.exclude_terms,
    };
    await sb.from("watchlist").update(payload).eq("id", id);
    setEditingId(null);
    loadWatch();
  }

  async function toggleWatch(id: string, active: boolean) {
    await sb.from("watchlist").update({ active: !active }).eq("id", id);
    setWatchItems(prev => prev.map(w => w.id === id ? { ...w, active: !active } : w));
  }

  async function removeWatch(id: string) {
    if (!confirm("Usunąć?")) return;
    await sb.from("watchlist").delete().eq("id", id);
    loadWatch();
  }

  async function hideOffer(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await sb.from("offers").update({ status: "hidden" }).eq("id", id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: "hidden" } : r));
  }

  async function restoreOffer(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await sb.from("offers").update({ status: "analyzed" }).eq("id", id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: "analyzed" } : r));
  }

  async function toggleFavorite(id: string, current: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    const update: any = { is_favorite: !current };
    if (current) update.note = null;
    await sb.from("offers").update(update).eq("id", id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, is_favorite: !current, note: current ? null : r.note } : r));
    if (!current) {
      const row = rows.find(r => r.id === id);
      setNoteText(row?.note || "");
      setEditingNote(id);
    }
  }

  async function saveNote(id: string) {
    await sb.from("offers").update({ note: noteText || null }).eq("id", id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, note: noteText || null } : r));
    setEditingNote(null);
  }

  const visible = useMemo(() => rows.filter(r => r.status !== "hidden"), [rows]);
  const favorites = useMemo(() => rows.filter(r => r.is_favorite && r.status !== "hidden"), [rows]);
  const hidden = useMemo(() => rows.filter(r => r.status === "hidden"), [rows]);
  const activeSource = showHidden ? hidden : showFavorites ? favorites : visible;

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const min = parseFloat(minMargin);
    let result = activeSource.filter(r => {
      if (platform !== "all" && r.platform !== platform) return false;
      if (color !== "all" && r.deal_color !== color) return false;
      if (onlyUrgent && !r.is_urgent) return false;
      if (onlyBundle && !r.is_bundle) return false;
      if (!isNaN(min) && (r.margin_pct ?? -Infinity) < min) return false;
      if (ql) {
        const hay = `${r.title} ${r.matched_item ?? ""} ${r.watchlist_name ?? ""} ${r.short_description ?? ""} ${r.note ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let av: any = a[sortKey];
        let bv: any = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "string") av = av.toLowerCase();
        if (typeof bv === "string") bv = bv.toLowerCase();
        return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }
    return result;
  }, [activeSource, q, platform, color, onlyUrgent, onlyBundle, minMargin, sortKey, sortDir]);

  function fmtTime(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  function runStatusText() {
    if (running) return `Trwa… ${fmtTime(elapsed)}`;
    if (scraperDone) return scraperDone;
    if (!runInfo) return null;
    if (!runInfo.finished_at) return null;
    const start = new Date(runInfo.started_at).toLocaleString("pl-PL");
    return `Ostatni: ${start} · ${runInfo.offers_new} nowych`;
  }

  return (
    <div className="relative">

      {/* Note modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#0f1419] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Notatka</h2>
              <button onClick={() => setEditingNote(null)} className="text-zinc-600 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={4}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-blue-500/40 transition-all placeholder:text-zinc-600"
              placeholder="Notatka do tej oferty…"
              autoFocus
            />
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={() => setEditingNote(null)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors">Pomiń</button>
              <button onClick={() => saveNote(editingNote)} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600/80 hover:bg-blue-600 transition-colors">Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* Watchlist Drawer */}
      <div className={`fixed top-0 right-0 h-full w-[420px] bg-[#0c1018] border-l border-white/[0.07] z-40 transform transition-transform duration-300 ease-in-out ${drawerOpen ? "translate-x-0" : "translate-x-full"} overflow-y-auto`}>
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0c1018] z-10">
          <div>
            <h2 className="text-sm font-semibold text-white">Watchlist</h2>
            <p className="text-[11px] text-zinc-600 mt-0.5">{watchItems.filter(w => w.active).length} aktywnych</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runScraper}
              disabled={running}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${running ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "bg-blue-600/80 hover:bg-blue-600 text-white"}`}
            >
              {running ? (
                <>
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {fmtTime(elapsed)}
                </>
              ) : (
                <>
                  <Play size={11} />
                  Skanuj
                </>
              )}
            </button>
            <button onClick={() => setDrawerOpen(false)} className="text-zinc-600 hover:text-white transition-colors p-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {runStatusText() && (
          <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs border ${scraperDone && scraperDone.startsWith("Błąd") ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/[0.03] border-white/[0.06] text-zinc-400"}`}>
            {runStatusText()}
          </div>
        )}

        <div className="p-4 space-y-2">
          {watchLoading ? (
            <div className="text-center text-zinc-600 text-sm py-8">Ładowanie…</div>
          ) : (
            <>
              {watchItems.map(it => (
                <div key={it.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                  {editingId === it.id ? (
                    <div className="space-y-2.5">
                      <WatchInput label="Nazwa" value={editDraft.name as string} onChange={v => setEditDraft({...editDraft, name: v})} />
                      <div className="flex gap-2">
                        <WatchInput label="Słowa kluczowe" value={(editDraft.keywords as any) || ""} onChange={v => setEditDraft({...editDraft, keywords: v as any})} placeholder="ps5, playstation 5" />
                        <button
                          onClick={() => {
                            const s = getSuggestions(editDraft.name);
                            if (s) {
                              if (s.keywords.length > 0) setEditDraft(d => ({...d, keywords: s.keywords.join(", ") as any}));
                              setEditDraft(d => ({...d, exclude_terms: s.exclude.join(", ") as any}));
                            }
                          }}
                          className="mt-5 px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-zinc-400 whitespace-nowrap transition-colors"
                        >AI</button>
                      </div>
                      <WatchInput label="Wyklucz" value={(editDraft.exclude_terms as any) || ""} onChange={v => setEditDraft({...editDraft, exclude_terms: v as any})} placeholder="etui, kabel" />
                      <div className="grid grid-cols-2 gap-2">
                        <WatchNumInput label="Rynkowa (zł)" value={editDraft.market_value} onChange={v => setEditDraft({...editDraft, market_value: v})} />
                        <WatchNumInput label="Max zakup (zł)" value={editDraft.max_buy_price} onChange={v => setEditDraft({...editDraft, max_buy_price: v})} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <WatchNumInput label="Dobra marża ≥%" value={editDraft.good_margin_pct} onChange={v => setEditDraft({...editDraft, good_margin_pct: v})} />
                        <WatchNumInput label="Średnia ≥%" value={editDraft.ok_margin_pct} onChange={v => setEditDraft({...editDraft, ok_margin_pct: v})} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-white border border-white/[0.06] transition-colors">Anuluj</button>
                        <button onClick={() => saveEdit(it.id)} className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-blue-600/80 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1">
                          <Check size={11} /> Zapisz
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleWatch(it.id, it.active)}
                            className={`w-7 h-4 rounded-full transition-colors relative flex-shrink-0 ${it.active ? "bg-blue-500" : "bg-zinc-700"}`}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${it.active ? "translate-x-3.5" : "translate-x-0.5"}`} />
                          </button>
                          <span className={`text-sm font-medium truncate ${it.active ? "text-white" : "text-zinc-500"}`}>{it.name}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <span className="text-[10px] text-zinc-600">{it.market_value} zł</span>
                          <span className="text-[10px] text-zinc-700">·</span>
                          <span className="text-[10px] text-emerald-600">{it.good_margin_pct}%</span>
                          {(it.keywords || []).slice(0, 2).map((k, i) => (
                            <span key={i} className="text-[10px] bg-white/[0.04] text-zinc-500 px-1.5 py-0.5 rounded">{k}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setEditingId(it.id); setEditDraft({...it, market: it.market || "pl"}); }}
                          className="p-1.5 text-zinc-600 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => removeWatch(it.id)}
                          className="p-1.5 text-zinc-700 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {addingNew ? (
                <div className="bg-white/[0.02] border border-blue-500/20 rounded-xl p-3 space-y-2.5">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Nowy przedmiot</p>
                  <div className="flex gap-2">
                    <WatchInput label="Nazwa" value={draft.name as string} onChange={v => setDraft({...draft, name: v})} />
                    <button
                      onClick={() => {
                        const s = getSuggestions(draft.name);
                        if (s) {
                          if (s.keywords.length > 0) setDraft(d => ({...d, keywords: s.keywords.join(", ") as any}));
                          setDraft(d => ({...d, exclude_terms: s.exclude.join(", ") as any}));
                        }
                      }}
                      className="mt-5 px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-zinc-400 whitespace-nowrap transition-colors"
                    >AI</button>
                  </div>
                  <WatchInput label="Słowa kluczowe" value={(draft.keywords as any) || ""} onChange={v => setDraft({...draft, keywords: v as any})} placeholder="ps5, playstation 5" />
                  <WatchInput label="Wyklucz" value={(draft.exclude_terms as any) || ""} onChange={v => setDraft({...draft, exclude_terms: v as any})} placeholder="etui, kabel" />
                  <div className="grid grid-cols-2 gap-2">
                    <WatchNumInput label="Rynkowa (zł)" value={draft.market_value} onChange={v => setDraft({...draft, market_value: v})} />
                    <WatchNumInput label="Max zakup (zł)" value={draft.max_buy_price} onChange={v => setDraft({...draft, max_buy_price: v})} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <WatchNumInput label="Dobra marża ≥%" value={draft.good_margin_pct} onChange={v => setDraft({...draft, good_margin_pct: v})} />
                    <WatchNumInput label="Średnia ≥%" value={draft.ok_margin_pct} onChange={v => setDraft({...draft, ok_margin_pct: v})} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setAddingNew(false)} className="flex-1 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-white border border-white/[0.06] transition-colors">Anuluj</button>
                    <button onClick={addWatch} className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/80 hover:bg-emerald-600 text-white transition-colors flex items-center justify-center gap-1">
                      <Plus size={11} /> Dodaj
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingNew(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-white/[0.08] text-xs text-zinc-600 hover:text-zinc-400 hover:border-white/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={12} /> Dodaj przedmiot
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/20 z-30 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Szukaj…"
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/30 transition-all"
          />
        </div>

        <FilterChip active={platform !== "all"}>
          <select value={platform} onChange={e => setPlatform(e.target.value as any)} className="bg-transparent text-xs text-current outline-none cursor-pointer">
            <option value="all">Platforma</option>
            <option value="olx">OLX</option>
            <option value="allegro">Allegro</option>
            <option value="vinted">Vinted</option>
          </select>
        </FilterChip>

        <FilterChip active={color !== "all"}>
          <select value={color} onChange={e => setColor(e.target.value as any)} className="bg-transparent text-xs text-current outline-none cursor-pointer">
            <option value="all">Kolor</option>
            <option value="green">Dobra</option>
            <option value="yellow">Średnia</option>
            <option value="gray">Słaba</option>
          </select>
        </FilterChip>

        <FilterChip active={!!minMargin}>
          <input
            value={minMargin} onChange={e => setMinMargin(e.target.value)}
            placeholder="Min marża %"
            type="number"
            className="bg-transparent text-xs text-current outline-none w-20 placeholder:text-current"
          />
        </FilterChip>

        <FilterToggle active={onlyUrgent} onClick={() => setOnlyUrgent(v => !v)}>Pilne</FilterToggle>
        <FilterToggle active={onlyBundle} onClick={() => setOnlyBundle(v => !v)}>Bundle</FilterToggle>

        <div className="w-px h-4 bg-white/10" />

        <FilterToggle
          active={showFavorites}
          onClick={() => { setShowFavorites(f => !f); setShowHidden(false); }}
          color="yellow"
        >
          <Star size={12} className={showFavorites ? "fill-current" : ""} />
          <span>{favorites.length}</span>
        </FilterToggle>

        <FilterToggle
          active={showHidden}
          onClick={() => { setShowHidden(h => !h); setShowFavorites(false); }}
        >
          <EyeOff size={12} />
          <span>{hidden.length}</span>
        </FilterToggle>

        <span className="text-[11px] text-zinc-600 ml-auto">{filtered.length} ofert</span>

        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all"
        >
          <SlidersHorizontal size={13} />
          Watchlist
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.07] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] border-b border-white/[0.05]">
            <tr>
              <SortTh label="Tytuł" sortKey="title" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Cena" sortKey="price" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Marża" sortKey="margin_pct" current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th>Platforma</Th>
              <Th>Tagi</Th>
              <SortTh label="Dodano" sortKey="posted_at" current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th>Opis</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="py-16 text-center text-zinc-600 text-sm">Ładowanie…</td></tr>
            )}
            {!loading && filtered.map(r => {
              const dc = DEAL_COLOR[r.deal_color];
              return (
                <tr
                  key={r.id}
                  onClick={() => window.open(r.url, "_blank", "noopener")}
                  className={`group cursor-pointer border-b border-white/[0.04] transition-colors ${dc.row}`}
                >
                  <td className="px-4 py-3 max-w-[280px]">
                    <div className="font-medium text-white text-sm truncate group-hover:whitespace-normal group-hover:overflow-visible" title={r.title}>
                      {r.title}
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-0.5 truncate">{r.matched_item || r.watchlist_name}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-mono font-semibold text-white">{fmt(r.price)} zł</div>
                    {r.market_value && <div className="text-[11px] text-zinc-600 font-mono">{fmt(r.market_value)} zł</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono font-bold text-base ${dc.badge}`}>
                      {r.margin_pct != null ? `${r.margin_pct.toFixed(0)}%` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                      r.platform === "olx" ? "bg-emerald-500/10 text-emerald-400" :
                      r.platform === "vinted" ? "bg-teal-500/10 text-teal-400" :
                      "bg-orange-500/10 text-orange-400"
                    }`}>
                      {r.platform.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {r.is_new && <Tag color="blue">Nowe</Tag>}
                      {r.is_urgent && <Tag color="red">Pilne</Tag>}
                      {r.is_bundle && <Tag color="purple">Bundle</Tag>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-zinc-600 whitespace-nowrap">
                    {r.posted_at ? new Date(r.posted_at).toLocaleDateString("pl-PL") : "—"}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {r.note ? (
                      <span className="text-amber-300/80 text-xs truncate block group-hover:whitespace-normal" title={r.note}>{r.note}</span>
                    ) : (
                      <span className="text-zinc-600 text-xs truncate block group-hover:whitespace-normal" title={r.short_description || ""}>{r.short_description || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ActionBtn onClick={e => toggleFavorite(r.id, r.is_favorite, e)} tooltip={r.is_favorite ? "Usuń z ulubionych" : "Ulubione"} active={r.is_favorite} activeClass="text-amber-400">
                        <Star size={13} className={r.is_favorite ? "fill-current" : ""} />
                      </ActionBtn>
                      {r.is_favorite && (
                        <ActionBtn onClick={e => { e.stopPropagation(); setEditingNote(r.id); setNoteText(r.note || ""); }} tooltip="Notatka">
                          <Pencil size={13} />
                        </ActionBtn>
                      )}
                      {r.status === "hidden" ? (
                        <ActionBtn onClick={e => restoreOffer(r.id, e)} tooltip="Przywróć">
                          <Eye size={13} />
                        </ActionBtn>
                      ) : (
                        <ActionBtn onClick={e => hideOffer(r.id, e)} tooltip="Ukryj">
                          <EyeOff size={13} />
                        </ActionBtn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="py-16 text-center text-zinc-600 text-sm">
                {showHidden ? "Brak ukrytych ofert." : showFavorites ? "Brak ulubionych." : "Brak ofert."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <div className={`flex items-center px-3 py-2 rounded-xl border text-xs transition-all cursor-pointer ${active ? "bg-blue-500/10 border-blue-500/30 text-blue-300" : "bg-white/[0.03] border-white/[0.07] text-zinc-400"}`}>
      {children}
    </div>
  );
}

function FilterToggle({ children, active, onClick, color }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) {
  const activeClass = color === "yellow"
    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
    : "bg-blue-500/10 border-blue-500/30 text-blue-300";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-all ${active ? activeClass : "bg-white/[0.03] border-white/[0.07] text-zinc-500 hover:text-zinc-300"}`}
    >
      {children}
    </button>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  const c = {
    blue: "bg-blue-500/10 text-blue-400",
    red: "bg-red-500/10 text-red-400",
    purple: "bg-purple-500/10 text-purple-400",
  }[color] || "bg-zinc-500/10 text-zinc-400";
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${c}`}>{children}</span>;
}

function SortTh({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: NonNullable<SortKey>; current: SortKey; dir: SortDir; onSort: (k: NonNullable<SortKey>) => void;
}) {
  const active = current === sortKey;
  return (
    <th className="text-left px-4 py-2.5 text-[11px] text-zinc-600 uppercase tracking-widest font-medium cursor-pointer hover:text-zinc-400 transition-colors select-none" onClick={() => onSort(sortKey)}>
      <span className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? "opacity-100 text-blue-400" : "opacity-0 group-hover:opacity-40"}`}>
          {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </span>
    </th>
  );
}

function ActionBtn({ children, onClick, tooltip, active, activeClass }: {
  children: React.ReactNode; onClick: (e: React.MouseEvent) => void; tooltip: string; active?: boolean; activeClass?: string;
}) {
  return (
    <div className="relative group/btn">
      <button onClick={onClick} className={`p-1.5 rounded-lg transition-colors ${active && activeClass ? activeClass : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5"}`}>
        {children}
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-zinc-900 text-zinc-200 text-[11px] rounded-lg whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
        {tooltip}
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5 text-[11px] text-zinc-600 uppercase tracking-widest font-medium">{children}</th>;
}

function WatchInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block flex-1">
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest block mb-1">{label}</span>
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/30 transition-all"
      />
    </label>
  );
}

function WatchNumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest block mb-1">{label}</span>
      <input
        type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/30 transition-all"
      />
    </label>
  );
}

function fmt(n: number) { return new Intl.NumberFormat("pl-PL").format(n); }
