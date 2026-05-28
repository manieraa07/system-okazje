"""Klient Supabase. Używa service_role key (omija RLS)."""
import os
from supabase import create_client, Client

def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)

def get_active_watchlist(sb: Client) -> list[dict]:
    res = sb.table("watchlist").select("*").eq("active", True).execute()
    return res.data or []

def offer_exists(sb: Client, platform: str, external_id: str) -> bool:
    res = (
        sb.table("offers")
        .select("id")
        .eq("platform", platform)
        .eq("external_id", external_id)
        .limit(1)
        .execute()
    )
    return bool(res.data)

def insert_offer(sb: Client, row: dict) -> dict | None:
    try:
        res = sb.table("offers").insert(row).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        # konflikt unique (platform, external_id) — ignorujemy
        if "duplicate" in str(e).lower() or "23505" in str(e):
            return None
        raise

def update_offer(sb: Client, offer_id: str, patch: dict) -> None:
    sb.table("offers").update(patch).eq("id", offer_id).execute()

def log_run(sb: Client, **kwargs) -> str:
    res = sb.table("scraper_runs").insert(kwargs).execute()
    return res.data[0]["id"]

def finish_run(sb: Client, run_id: str, **patch) -> None:
    from datetime import datetime, timezone
    patch["finished_at"] = datetime.now(timezone.utc).isoformat()
    sb.table("scraper_runs").update(patch).eq("id", run_id).execute()
