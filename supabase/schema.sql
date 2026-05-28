-- ============================================================
--  OKAZJE — schemat bazy Supabase (PostgreSQL)
--  Uruchom w SQL Editor na supabase.com
-- ============================================================

-- ---------- 1) WATCHLIST (settings) ----------
-- Przedmioty, których szukamy. Edytujesz z /settings w UI.
create table if not exists watchlist (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,              -- "PS5", "iPhone 13", "MacBook Air M1"
  -- Aliasy/keywords (np. ["ps5","playstation 5","sony ps 5"]) – wykorzystywane przez scraper
  keywords        text[] not null default '{}',
  -- Czego NIE chcemy zobaczyć w tytule/opisie (np. ["pad","kabel","etui","część","akcesoria"])
  exclude_terms   text[] not null default '{}',
  market_value    numeric(10,2) not null,     -- moja szacowana wartość rynkowa (PLN)
  max_buy_price   numeric(10,2) not null,     -- maksymalna cena zakupu żeby się opłacało
  -- Progi marży decydujące o kolorze w UI
  good_margin_pct numeric(5,2) not null default 30,  -- zielony  >= 30%
  ok_margin_pct   numeric(5,2) not null default 15,  -- żółty    15–30%
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists watchlist_active_idx on watchlist(active);

-- ---------- 2) OFERTY ----------
create table if not exists offers (
  id                uuid primary key default gen_random_uuid(),
  -- Identyfikacja na platformie (do deduplikacji)
  platform          text not null check (platform in ('olx','allegro')),
  external_id       text not null,            -- ID oferty u źródła
  url               text not null,
  -- Surowe dane z listingu
  title             text not null,
  description       text,
  price             numeric(10,2) not null,
  currency          text not null default 'PLN',
  shipping_available boolean not null default false,
  seller_type       text check (seller_type in ('private','business','unknown')) default 'unknown',
  seller_name       text,
  location          text,
  posted_at         timestamptz,              -- data dodania na platformie
  -- Analiza Claude
  watchlist_id      uuid references watchlist(id) on delete set null,
  matched_item      text,                     -- "PS5" (co Claude rozpoznał)
  is_real_item      boolean,                  -- false = akcesorium/część
  is_urgent         boolean default false,    -- "wyprowadzka", "pilne", "na dziś"
  urgency_signals   text[] default '{}',
  is_bundle         boolean default false,    -- "sprzedam wszystko razem"
  bundle_items      jsonb,                    -- [{name, est_value}, ...]
  short_description text,                     -- 1-2 zdania od Claude
  confidence        numeric(3,2),             -- 0.00–1.00
  analysis_notes    text,
  -- Obliczone
  market_value      numeric(10,2),            -- skopiowane z watchlist w chwili analizy
  margin_pct        numeric(6,2),             -- (market_value - price) / market_value * 100
  -- Status w pipeline
  status            text not null default 'new'
                    check (status in ('new','analyzed','rejected','hidden')),
  rejection_reason  text,                     -- np. "business_seller", "no_shipping", "accessory"
  -- Audyt
  scraped_at        timestamptz not null default now(),
  analyzed_at       timestamptz,
  unique (platform, external_id)
);

create index if not exists offers_status_idx       on offers(status);
create index if not exists offers_platform_idx     on offers(platform);
create index if not exists offers_scraped_at_idx   on offers(scraped_at desc);
create index if not exists offers_margin_idx       on offers(margin_pct desc);
create index if not exists offers_matched_item_idx on offers(matched_item);

-- ---------- 3) LOGI SCRAPERA (debug / monitoring darmowych limitów) ----------
create table if not exists scraper_runs (
  id              uuid primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  platform        text,
  watchlist_id    uuid references watchlist(id) on delete set null,
  offers_seen     int default 0,
  offers_new      int default 0,
  offers_analyzed int default 0,
  claude_tokens   int default 0,
  error           text
);

-- ---------- 4) Trigger: updated_at ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists watchlist_touch on watchlist;
create trigger watchlist_touch before update on watchlist
  for each row execute function touch_updated_at();

-- ---------- 5) RLS (Row Level Security) ----------
-- MVP: jedna osoba (Ty). Włączamy RLS i dajemy pełny dostęp dla service_role.
alter table watchlist    enable row level security;
alter table offers       enable row level security;
alter table scraper_runs enable row level security;

-- Frontend (anon key) — tylko SELECT na offers + pełny CRUD na watchlist
drop policy if exists "anon read offers"        on offers;
create policy "anon read offers" on offers
  for select using (true);

drop policy if exists "anon manage watchlist"   on watchlist;
create policy "anon manage watchlist" on watchlist
  for all using (true) with check (true);

-- Scraper używa SERVICE_ROLE key, który omija RLS — nie potrzebuje policy.

-- ---------- 6) Widok dla frontendu (już z kolorem) ----------
create or replace view offers_view as
select
  o.*,
  w.name           as watchlist_name,
  w.good_margin_pct,
  w.ok_margin_pct,
  case
    when o.margin_pct is null                  then 'gray'
    when o.margin_pct >= w.good_margin_pct     then 'green'
    when o.margin_pct >= w.ok_margin_pct       then 'yellow'
    else 'gray'
  end as deal_color
from offers o
left join watchlist w on w.id = o.watchlist_id
where o.status = 'analyzed';
