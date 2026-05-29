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
  const [platform, setPlatform] = useState<"all" | "olx" | "allegro" | "vinted">("all");
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
                <Td className="max-w-[40ch] truncate text-zinc-300" title={r.short_description || ""}>
                  {r.short_description || "—"}
                </Td>
              </tr>
            ))}
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
