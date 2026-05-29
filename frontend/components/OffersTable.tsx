"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser, Offer } from "@/lib/supabase";

const ROW_COLOR: Record<Offer["deal_color"], string> = {
  green:  "bg-emerald-900/30 hover:bg-emerald-900/50",
  yellow: "bg-amber-900/20 hover:bg-amber-900/40",
  gray:   "bg-zinc-800/40 hover:bg-zinc-800/70",
};

export default function OffersTable() {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

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

  useEffect(() => { loadRows(); }, []);

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
    await sb.from("offers").update({ is_favorite: !current }).eq("id", id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, is_favorite: !current } : r));
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
    return activeSource.filter(r => {
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
  }, [activeSource, q, platform, color, onlyUrgent, onlyBundle, minMargin]);

  return (
    <div className="space-y-4">

      {editingNote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h2 className="text-lg font-semibold">📝 Notatka do ulubionej</h2>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={4}
              className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
              placeholder="Wpisz notatkę… (opcjonalne)"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingNote(null)}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm">
                Pomiń
              </button>
              <button onClick={() => saveNote(editingNote)}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-medium">
                Zapisz notatkę
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Szukaj w tytule / opisie…"
          className="bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm w-64"
        />
        <select value={platform} onChange={e => setPlatform(e.target.value as any)}
                className="bg-zinc-900 border border-white/10 rounded px-2 py-2 text-sm">
          <option value="all">Wszystkie platformy</option>
          <option value="olx">OLX</option>
          <option value="allegro">Allegro</option>
          <option value="vinted">Vinted</option>
        </select>
        <select value={color} onChange={e => setColor(e.target.value as any)}
                className="bg-zinc-900 border border-white/10 rounded px-2 py-2 text-sm">
          <option value="all">Wszystkie kolory</option>
          <option value="green">🟢 Dobra okazja</option>
          <option value="yellow">🟡 Średnia</option>
          <option value="gray">⚪ Słaba</option>
        </select>
        <input
          value={minMargin} onChange={e => setMinMargin(e.target.value)}
          placeholder="Min marża %" type="number"
          className="bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm w-28"
        />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={onlyUrgent} onChange={e => setOnlyUrgent(e.target.checked)} />
          Pilne
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={onlyBundle} onChange={e => setOnlyBundle(e.target.checked)} />
          Bundle
        </label>
        <button
          onClick={() => { setShowFavorites(f => !f); setShowHidden(false); }}
          className={`px-3 py-2 rounded text-sm border ${showFavorites ? "bg-yellow-700/40 border-yellow-500/50 text-yellow-200" : "border-white/10 text-zinc-400 hover:text-white"}`}
        >
          ⭐ Ulubione ({favorites.length})
        </button>
        <button
          onClick={() => { setShowHidden(h => !h); setShowFavorites(false); }}
          className={`px-3 py-2 rounded text-sm border ${showHidden ? "bg-zinc-700 border-zinc-500 text-white" : "border-white/10 text-zinc-400 hover:text-white"}`}
        >
          👁 Ukryte ({hidden.length})
        </button>
        <span className="text-xs text-zinc-400 ml-auto">{filtered.length} / {activeSource.length}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-300">
            <tr>
              <Th>Tytuł</Th><Th>Przedmiot</Th><Th>Cena</Th><Th>Rynkowa</Th>
              <Th>Marża</Th><Th>Platforma</Th><Th>Pilność</Th><Th>Dodano</Th><Th>Opis</Th><Th></Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} className="p-6 text-center text-zinc-400">Ładowanie…</td></tr>}
            {!loading && filtered.map(r => (
              <tr key={r.id}
                  onClick={() => window.open(r.url, "_blank", "noopener")}
                  className={`cursor-pointer border-t border-white/5 ${ROW_COLOR[r.deal_color]}`}>
                <Td className="max-w-[28ch] truncate" title={r.title}>{r.title}</Td>
                <Td>{r.matched_item || r.watchlist_name}</Td>
                <Td className="font-mono">{fmt(r.price)} zł</Td>
                <Td className="font-mono text-zinc-400">{r.market_value ? `${fmt(r.market_value)} zł` : "—"}</Td>
                <Td className="font-mono">{r.margin_pct != null ? `${r.margin_pct.toFixed(0)}%` : "—"}</Td>
                <Td className="uppercase text-xs">{r.platform}</Td>
                <Td>
                  {r.is_new && <span className="px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-200 text-xs mr-1">🆕 nowe</span>}
                  {r.is_urgent && <span className="px-1.5 py-0.5 rounded bg-red-900/60 text-red-200 text-xs mr-1">🔥 pilne</span>}
                  {r.is_bundle && <span className="px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200 text-xs">📦 bundle</span>}
                </Td>
                <Td className="text-xs text-zinc-400">{new Date(r.scraped_at).toLocaleString("pl-PL")}</Td>
                <Td className="max-w-[40ch] truncate text-zinc-300" title={r.note || r.short_description || ""}>
                  {r.note
                    ? <span className="text-yellow-300">📝 {r.note}</span>
                    : r.short_description || "—"}
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <button
                      onClick={e => toggleFavorite(r.id, r.is_favorite, e)}
                      className={`text-lg ${r.is_favorite ? "text-yellow-400" : "text-zinc-600 hover:text-yellow-400"}`}
                      title={r.is_favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                    >⭐</button>
                    {r.is_favorite && (
                      <button
                        onClick={e => { e.stopPropagation(); setEditingNote(r.id); setNoteText(r.note || ""); }}
                        className="text-lg text-zinc-500 hover:text-yellow-300"
                        title="Edytuj notatkę"
                      >📝</button>
                    )}
                  </div>
                </Td>
                <Td>
                  {r.status === "hidden" ? (
                    <button onClick={e => restoreOffer(r.id, e)}
                      className="text-zinc-400 hover:text-white text-lg" title="Przywróć">👁</button>
                  ) : (
                    <button onClick={e => hideOffer(r.id, e)}
                      className="text-zinc-600 hover:text-zinc-300 text-lg" title="Ukryj">🙈</button>
                  )}
                </Td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={11} className="p-6 text-center text-zinc-500">
                {showHidden ? "Brak ukrytych ofert." : showFavorites ? "Brak ulubionych ofert." : "Brak ofert."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2">{children}</th>;
}
function Td({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`} title={title}>{children}</td>;
}
function fmt(n: number) { return new Intl.NumberFormat("pl-PL").format(n); }
