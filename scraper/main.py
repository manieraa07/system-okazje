"""Orchestrator scrapera."""
from __future__ import annotations
import os
import sys
import traceback
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

from db import (
    get_client, get_active_watchlist, offer_exists,
    insert_offer, update_offer, log_run, finish_run,
)
from sources import olx, allegro
from filters import (
    matches_keywords, is_accessory_by_title,
    is_game_or_peripheral, price_sanity_check,
    detect_urgency, detect_bundle_hint, looks_like_business,
)
load_dotenv()
MAX_OFFERS_PER_ITEM = int(os.environ.get("MAX_OFFERS_PER_ITEM", "40"))

USE_CLAUDE = os.environ.get("USE_CLAUDE", "1") != "0" and bool(os.environ.get("ANTHROPIC_API_KEY"))
if USE_CLAUDE:
    import analyzer
    print("[init] tryb: Claude API")
else:
    import analyzer_stub as analyzer  # type: ignore
    print("[init] tryb: STUB (bez Claude) — analiza regułowa")


def compute_margin(market_value: float, price: float) -> float | None:
    if not market_value or market_value <= 0:
        return None
    return round((market_value - price) / market_value * 100, 2)


def process_watchlist_item(sb, item: dict) -> dict:
    stats = {"seen": 0, "new": 0, "analyzed": 0, "tokens": 0}

    queries = [item["name"]] + (item.get("keywords") or [])
    queries = list(dict.fromkeys(q.strip() for q in queries if q.strip()))[:3]

    raw: list[dict] = []
    for q in queries:
        try:
            raw += olx.search(q, MAX_OFFERS_PER_ITEM)
        except Exception as e:
            print(f"[olx] {q!r}: {e}")
        try:
            raw += allegro.search(q, MAX_OFFERS_PER_ITEM)
        except Exception as e:
            print(f"[allegro] {q!r}: {e}")

    seen_keys: set[tuple[str, str]] = set()
    unique: list[dict] = []
    for o in raw:
        k = (o["platform"], o["external_id"])
        if k in seen_keys:
            continue
        seen_keys.add(k)
        unique.append(o)

    stats["seen"] = len(unique)

    olx_client = httpx.Client(http2=True)
    try:
        for offer in unique:
            if offer_exists(sb, offer["platform"], offer["external_id"]):
                continue

            if offer.get("seller_type") == "business":
                _save_rejected(sb, offer, item, "business_seller")
                continue
            if not offer.get("shipping_available"):
                _save_rejected(sb, offer, item, "no_shipping")
                continue

            if not matches_keywords(offer["title"], queries):
                _save_rejected(sb, offer, item, "title_no_match")
                continue

            if is_accessory_by_title(offer["title"], item.get("exclude_terms") or []):
                _save_rejected(sb, offer, item, "accessory_in_title")
                continue

            # 4a) gra / akcesorium po rozszerzonej liście słów
            if is_game_or_peripheral(offer["title"]):
                _save_rejected(sb, offer, item, "game_or_peripheral")
                continue

            # 4b) sanity-check ceny vs wartość rynkowa
            if not price_sanity_check(offer["price"], float(item.get("market_value") or 0), offer["title"]):
                _save_rejected(sb, offer, item, "price_too_low")
                continue

            if offer["platform"] == "olx" and not offer.get("description"):
                offer["description"] = olx.fetch_description(olx_client, offer["url"])

            if looks_like_business(offer.get("seller_name"), offer.get("description")):
                _save_rejected(sb, offer, item, "business_in_description")
                continue

            try:
                analysis, tokens = analyzer.analyze(
                    title=offer["title"],
                    description=offer.get("description"),
                    price=offer["price"],
                    watchlist_name=item["name"],
                    watchlist_keywords=queries,
                    market_value=float(item["market_value"]),
                )
                stats["tokens"] += tokens
            except Exception as e:
                print(f"[claude] {offer['url']}: {e}")
                continue

            if not analysis.get("is_real_item"):
                _save_rejected(sb, offer, item, "claude_not_real_item", analysis=analysis)
                continue

            urgency_signals = list(set(
                (analysis.get("urgency_signals") or []) +
                detect_urgency(f"{offer['title']} {offer.get('description') or ''}")
            ))
            is_urgent = bool(analysis.get("is_urgent")) or bool(urgency_signals)
            is_bundle = bool(analysis.get("is_bundle")) or detect_bundle_hint(
                f"{offer['title']} {offer.get('description') or ''}"
            )

            row = {
                **_offer_to_row(offer),
                "watchlist_id": item["id"],
                "matched_item": analysis.get("matched_item") or item["name"],
                "is_real_item": True,
                "is_urgent": is_urgent,
                "urgency_signals": urgency_signals,
                "is_bundle": is_bundle,
                "bundle_items": analysis.get("bundle_items") or None,
                "short_description": analysis.get("short_description"),
                "confidence": analysis.get("confidence"),
                "analysis_notes": analysis.get("notes"),
                "market_value": float(item["market_value"]),
                "margin_pct": compute_margin(float(item["market_value"]), offer["price"]),
                "status": "analyzed",
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
            }
            inserted = insert_offer(sb, row)
            if inserted:
                stats["new"] += 1
                stats["analyzed"] += 1
    finally:
        olx_client.close()
    return stats


def _offer_to_row(o: dict) -> dict:
    return {
        "platform": o["platform"],
        "external_id": o["external_id"],
        "url": o["url"],
        "title": o["title"],
        "description": o.get("description"),
        "price": o["price"],
        "currency": o.get("currency", "PLN"),
        "shipping_available": bool(o.get("shipping_available")),
        "seller_type": o.get("seller_type", "unknown"),
        "seller_name": o.get("seller_name"),
        "location": o.get("location"),
        "posted_at": o.get("posted_at"),
    }


def _save_rejected(sb, offer: dict, item: dict, reason: str, analysis: dict | None = None):
    row = {
        **_offer_to_row(offer),
        "watchlist_id": item["id"],
        "status": "rejected",
        "rejection_reason": reason,
        "market_value": float(item["market_value"]),
        "margin_pct": compute_margin(float(item["market_value"]), offer["price"]),
    }
    if analysis:
        row["analysis_notes"] = analysis.get("notes")
        row["short_description"] = analysis.get("short_description")
    insert_offer(sb, row)


def main() -> int:
    sb = get_client()
    watchlist = get_active_watchlist(sb)
    if not watchlist:
        print("Pusta watchlist — nic do roboty.")
        return 0

    total = {"seen": 0, "new": 0, "analyzed": 0, "tokens": 0}
    for item in watchlist:
        run_id = log_run(sb, watchlist_id=item["id"], platform="olx+allegro")
        try:
            s = process_watchlist_item(sb, item)
            finish_run(sb, run_id,
                       offers_seen=s["seen"], offers_new=s["new"],
                       offers_analyzed=s["analyzed"], claude_tokens=s["tokens"])
            for k in total: total[k] += s[k]
            print(f"[{item['name']}] seen={s['seen']} new={s['new']} analyzed={s['analyzed']} tokens={s['tokens']}")
        except Exception as e:
            traceback.print_exc()
            finish_run(sb, run_id, error=str(e))

    print(f"RAZEM: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
