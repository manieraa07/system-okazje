"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser, Offer } from "@/lib/supabase";
import { Star, EyeOff, Eye, Pencil, X } from "lucide-react";

const ROW_COLOR: Record<Offer["deal_color"], string> = {
  green:  "bg-emerald-900/30 hover:bg-emerald-900/40",
  yellow: "bg-amber-900/20 hover:bg-amber-900/30",
  gray:   "bg-zinc-800/40 hover:bg-zinc-800/60",
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Notatka do ulubionej</h2>
              <button onClick={() => setEditingNote(null)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
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
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-lg text-sm transition-colors">
                Pomiń
              </button>
              <button onClick={() => saveNote(editingNote)}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
          className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:border-zinc-500"
        />
        <select value={platform} onChange={e => setPlatform(e.target.value as any)}
                className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="all">Wszystkie platformy</option>
          <option value="olx">OLX</option>
          <option value="allegro">Allegro</option>
          <option value="vinted">Vinted</option>
        </select>
        <select value={color} onChange={e => setColor(e.target.value as any)}
                className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="all">Wszystkie kolory</option>
          <option value="green">🟢 Dobra okazja</option>
          <option value="yellow">🟡 Średnia</option>
          <option value="gray">⚪ Słaba</option>
        </select>
        <input
          value={minMargin} onChange={e => setMinMargin(e.target.value)}
          placeholder="Min marża %" type="number"
          className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:border-zinc-500"
        />
        <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-white/10 cursor-pointer hover:border-zinc-500 select-none">
          <input type="checkbox" checked={onlyUrgent} onChange={e => setOnlyUrgent(e.target.checked)} />
          Pilne
        </label>
        <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-white/10 cursor-pointer hover:border-zinc-500 select-none">
          <input type="checkbox" checked={onlyBundle} onChange={e => setOnlyBundle(e.target.checked)} />
          Bundle
        </label>
        <button
          onClick={() => { setShowFavorites(f => !f); setShowHidden(false); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
            showFavorites
              ? "bg-yellow-700/30 border-yellow-500/50 text-yellow-200"
              : "border-white/10 text-zinc-400 hover:border-zinc-500 hover:text-white"
          }`}
        >
          <Star size={15} className={showFavorites ? "fill-yellow-400 text-yellow-400" : ""} />
          Ulubione
          <span className="bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded-full">{favorites.length}</span>
        </button>
        <button
          onClick={() => { setShowHidden(h => !h); setShowFavorites(false); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
            showHidden
              ? "bg-zinc-700 border-zinc-500 text-white"
              : "border-white/10 text-zinc-400 hover:border-zinc-500 hover:text-white"
          }`}
        >
          <EyeOff size={15} />
          Ukryte
          <span className="bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded-full">{hidden.length}</span>
        </button>
        <span className="text-xs text-zinc-500 ml-auto">{filtered.length} / {activeSource.length}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-400 text-xs uppercase tracking-wide">
            <tr>
              <Th>Tytuł</Th>
              <Th>Przedmiot</Th>
              <Th>Cena</Th>
              <Th>Rynkowa</Th>
              <Th>Marża</Th>
              <Th>Platforma</Th>
              <Th>Tagi</Th>
              <Th>Dodano</Th>
              <Th>Opis / Notatka</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="p-8 text-center text-zinc-500">Ładowanie…</td></tr>
            )}
            {!loading && filtered.map(r => (
              <tr
                key={r.id}
                onClick={() => window.open(r.url, "_blank", "noopener")}
                className={`cursor-pointer border-t border-white/5 transition-colors ${ROW_COLOR[r.deal_color]}`}
              >
                <Td className="max-w-xs">
                  <span className="font-medium truncate block max-w-[26ch]" title={r.title}>{r.title}</span>
                </Td>
                <Td className="text-zinc-300 whitespace-nowrap">{r.matched_item || r.watchlist_name}</Td>
                <Td className="font-mono font-semibold whitespace-nowrap">{fmt(r.price)} zł</Td>
                <Td className="font-mono text-zinc-400 whitespace-nowrap">{r.market_value ? `${fmt(r.market_value)} zł` : "—"}</Td>
                <Td>
                  <span className={`font-mono font-semibold ${
                    r.deal_color === "green" ? "text-emerald-400" :
                    r.deal_color === "yellow" ? "text-amber-400" : "text-zinc-400"
                  }`}>
                    {r.margin_pct != null ? `${r.margin_pct.toFixed(0)}%` : "—"}
                  </span>
                </Td>
                <Td>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    r.platform === "olx" ? "bg-green-900/50 text-green-300" :
                    r.platform === "vinted" ? "bg-teal-900/50 text-teal-300" :
                    "bg-orange-900/50 text-orange-300"
                  }`}>
                    {r.platform.toUpperCase()}
                  </span>
                </Td>
                <Td>
                  <div className="flex gap-1 flex-wrap">
                    {r.is_new && <span className="px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-200 text-xs font-medium">Nowe</span>}
                    {r.is_urgent && <span className="px-2 py-0.5 rounded-full bg-red-900/60 text-red-200 text-xs font-medium">Pilne</span>}
                    {r.is_bundle && <span className="px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 text-xs font-medium">Bundle</span>}
                  </div>
                </Td>
                <Td className="text-xs text-zinc-500 whitespace-nowrap">
                  {new Date(r.scraped_at).toLocaleString("pl-PL")}
                </Td>
                <Td className="max-w-sm">
                  {r.note
                    ? <span className="text-yellow-300 text-xs block" title={r.note}>{r.note}</span>
                    : <span className="text-zinc-500 text-xs truncate block max-w-[40ch]" title={r.short_description || ""}>{r.short_description || "—"}</span>
                  }
                </Td>
                <Td>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <ActionBtn
                      onClick={e => toggleFavorite(r.id, r.is_favorite, e)}
                      tooltip={r.is_favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                      active={r.is_favorite}
                      activeClass="text-yellow-400"
                    >
                      <Star size={16} className={r.is_favorite ? "fill-yellow-400" : ""} />
                    </ActionBtn>
                    {r.is_favorite && (
                      <ActionBtn
                        onClick={e => { e.stopPropagation(); setEditingNote(r.id); setNoteText(r.note || ""); }}
                        tooltip="Edytuj notatkę"
                      >
                        <Pencil size={15} />
                      </ActionBtn>
                    )}
                    {r.status === "hidden" ? (
                      <ActionBtn onClick={e => restoreOffer(r.id, e)} tooltip="Przywróć ofertę">
                        <Eye size={16} />
                      </ActionBtn>
                    ) : (
                      <ActionBtn onClick={e => hideOffer(r.id, e)} tooltip="Ukryj ofertę">
                        <EyeOff size={16} />
                      </ActionBtn>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-zinc-500">
                  {showHidden ? "Brak ukrytych ofert." : showFavorites ? "Brak ulubionych ofert." : "Brak ofert."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionBtn({
  children, onClick, tooltip, active, activeClass,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  tooltip: string;
  active?: boolean;
  activeClass?: string;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`p-1.5 rounded-lg transition-colors ${
          active && activeClass ? activeClass : "text-zinc-600 hover:text-zinc-200 hover:bg-white/10"
        }`}
      >
        {children}
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-zinc-800 text-zinc-200 text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
        {tooltip}
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left px-4 py-3">{children}</th>;
}
function Td({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`} title={title}>{children}</td>;
}
function fmt(n: number) { return new Intl.NumberFormat("pl-PL").format(n); }
