## Frontend (Next.js 14 + Tailwind) — Vercel

### Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local   # uzupełnij URL + ANON KEY z Supabase
npm run dev
```

### Deploy
1. Push do GitHub.
2. Na Vercel → Import Project → folder `frontend`.
3. Zmienne środowiskowe: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Strona aktualizuje się natychmiast po każdym scrapingu (każdy F5 czyta świeże dane z bazy).

### Strony
- `/` — tabela ofert. Filtry: tekst, platforma, kolor, min. marża, pilne, bundle. Klik = nowa karta.
- `/settings` — CRUD na watchlist. Edycja market_value / progów % zmienia się natychmiast w UI; **scraper przy następnym runie używa nowych wartości** (czyta `watchlist` na starcie).

> Uwaga: dla MVP używamy `anon key` i otwartych policy RLS (zakładamy: jedna osoba). Jeśli zechcesz to udostępnić → dorzuć Supabase Auth + zaktualizuj policy.
