import { createClient, SupabaseClient } from "@supabase/supabase-js";
let _browser: SupabaseClient | null = null;
export function supabaseBrowser(): SupabaseClient {
  if (_browser) return _browser;
  _browser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  return _browser;
}
export type Offer = {
  id: string;
  platform: "olx" | "allegro" | "vinted";
  url: string;
  title: string;
  price: number;
  market_value: number | null;
  margin_pct: number | null;
  watchlist_name: string | null;
  matched_item: string | null;
  is_urgent: boolean;
  is_bundle: boolean;
  is_new: boolean;
  status: string;
  short_description: string | null;
  scraped_at: string;
  deal_color: "green" | "yellow" | "gray";
  active: boolean;
};
export type WatchItem = {
  id: string;
  name: string;
  keywords: string[];
  exclude_terms: string[];
  market_value: number;
  max_buy_price: number;
  good_margin_pct: number;
  ok_margin_pct: number;
  active: boolean;
};
