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

  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<"all" | "olx" | "allegro">("all");
  const [color, setColor] = useState<"all" | "green" | "yellow" | "gray">("all");
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [onlyBundle, setOnlyBundle] = useState(false);
  const [minMargin, setMinMargin] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await sb
        .from("offers_view")
        .select("*")
        .eq("active", true)
        .order("scraped_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        if (error) console.error(error);
        setRows((data || []) as Offer[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sb]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const min = parseFloat(minMargin);
    return rows.filter(r => {
      if (platform !== "all" && r.platform !== platform) return false;
      if (color !== "all" && r.deal_color !== color) return false;
      if (onlyUrgent && !r.is_urgent) return false;
      if (onlyBundle && !r.is_bundle) return false;
      if (!isNaN(min) && (r.margin_pct ?? -Infinity) < min) return false;
      if (ql) {
        const hay = `${r.title} ${r.matched_item ?? ""} ${r.watchlist_name ?? ""} ${r.short_description ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, q, platform, color, onlyUrgent, onlyBundle, minMargin]);

  return (
    <div className="space-y-4">
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
        <span className="text-xs text-zinc-400 ml-auto">{filtered.length} / {rows.length}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-300">
            <tr>
              <Th>Tytuł</Th><Th>Przedmiot</Th><Th>Cena</Th><Th>Rynkowa</Th>
              <Th>Marża</Th><Th>Platforma</Th><Th>Pilność</Th><Th>Dodano</Th><Th>Opis</Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="p-6 text-center text-zinc-400">Ładowanie…</td></tr>}
            {!loading && filtered.map(r => (
              <tr key={r.id}
