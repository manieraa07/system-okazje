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
from sources import olx, allegro, vinted
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


def send_email_notifications(good_offers: list[dict]) -> None:
    api_key = os.environ.get("RESEND_API_KEY")
    recipients_raw = os.environ.get("NOTIFY_EMAIL", "")
    if not api_key or not recipients_raw or not good_offers:
        return
    recipients = [e.strip() for e in recipients_raw.split(",") if e.strip()]
    if not recipients:
        return
    try:
        import resend
        resend.api_key = api_key

        rows = ""
        for o in good_offers:
            margin = f"{o['margin_pct']:.0f}%" if o.get("margin_pct") is not None else "—"
            urgent = " 🔥" if o.get("is_urgent") else ""
            bundle = " 📦" if o.get("is_bundle") else ""
            rows += f"""
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #333;">{o['title']}{urgent}{bundle}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #333;font-weight:bold;color:#34d399;">{margin}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #333;">{o['price']} zł</td>
              <td style="padding:8px 12px;border-bottom:1px solid #333;">{o.get('platform','').upper()}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #333;"><a href="{o['url']}" style="color:#60a5fa;">Zobacz →</a></td>
            </tr>"""

        html = f"""
        <div style="font-family:sans-serif;background:#0a0a0a;color:#e4e4e7;padding:24px;max-width:700px;">
          <h2 style="color:#34d399;margin-bottom:4px;">🎯 Okazje — {len(good_offers)} nowych ofert</h2>
          <p style="color:#71717a;margin-bottom:20px;">Znaleziono nowe oferty spełniające twoje kryteria.</p>
          <table style="width:100%;border-collapse:collapse;background:#18181b;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#27272a;color:#a1a1aa;font-size:12px;text-transform:uppercase;">
                <th style="padding:10px 12px;text-align:left;">Tytuł</th>
                <th style="padding:10px 12px;text-align:left;">Marża</th>
                <th style="padding:10px 12px;text-align:left;">Cena</th>
                <th style="padding:10px 12px;text-align:left;">Platforma</th>
                <th style="padding:10px 12px;text-align:left;">Link</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
          <p style="color:#52525b;font-size:12px;margin-top:16px;">Okazje System — automatyczne powiadomienie</p>
        </div>"""

        resend.Emails.send({
            "from": "Okazje <onboarding@resend.dev>",
            "to": recipients,
            "subject": f"🎯 {len(good_offers)} nowych okazji",
            "html": html,
        })
        print(f"[email] wysłano do {recipients}")
    except Exception as e:
        print(f"[email] błąd: {e}")


def process_watchlist_item(sb, item: dict) -> dict:
    stats = {"seen": 0, "new": 0, "analyzed": 0, "tokens": 0}
    run_started_at = datetime.now(timezone.utc)

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
        try:
            raw += vinted.search(q, MAX_OFFERS_PER_ITEM)
        except Exception as e:
            print(f"[vinted] {q!r}: {e}")

    seen_keys: set[tuple[str, str]] = set()
    unique: list[dict] = []
    for o in raw:
        k = (o["platform"], o["external_id"])
        if k in seen_keys:
            continue
        seen_keys.add(k)
        unique.append(o)

    stats["seen"] = len(unique)

    new_ids: list[str] = []
    good_offers: list[dict] = []

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

            if is_game_or_peripheral(offer["title"]):
                _save_rejected(sb, offer, item, "game_or_peripheral")
                continue

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

            margin = compute_margin(float(item["market_value"]), offer["price"])

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
                "margin_pct": margin,
                "status": "analyzed",
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
                "is_new": True,
            }
            inserted = insert_offer(sb, row)
            if inserted:
                stats["new"] += 1
                stats["analyzed"] += 1
                if inserted.get("id"):
                    new_ids.append(inserted["id"])
                # Zbierz zielone oferty do emaila
                good_margin = float(item.get("good_margin_pct") or 30)
                if margin is not None and margin >= good_margin:
                    good_offers.append({
                        "title": offer["title"],
                        "price": offer["price"],
                        "margin_pct": margin,
                        "url": offer["url"],
                        "platform": offer["platform"],
                        "is_urgent": is_urgent,
                        "is_bundle": is_bundle,
                    })
    finally:
        olx_client.close()

    if new_ids:
        try:
            sb.from_("offers").update({"is_new": False})\
                .eq("watchlist_id", item["id"])\
                .eq("is_new", True)\
                .not_.in_("id", new_ids)\
                .execute()
        except Exception as e:
            print(f"[is_new cleanup] {e}")
    else:
        try:
            sb.from_("offers").update({"is_new": False})\
                .eq("watchlist_id", item["id"])\
                .eq("is_new", True)\
                .execute()
        except Exception as e:
            print(f"[is_new cleanup] {e}")

    stats["good_offers"] = good_offers
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

    try:
        sb.from_("offers").update({"is_new": False}).eq("is_new", True).execute()
    except Exception as e:
        print(f"[is_new reset] {e}")

    total = {"seen": 0, "new": 0, "analyzed": 0, "tokens": 0}
    all_good_offers: list[dict] = []

    for item in watchlist:
        run_id = log_run(sb, watchlist_id=item["id"], platform="olx+allegro+vinted")
        try:
            s = process_watchlist_item(sb, item)
            finish_run(sb, run_id,
                       offers_seen=s["seen"], offers_new=s["new"],
                       offers_analyzed=s["analyzed"], claude_tokens=s["tokens"])
            for k in total: total[k] += s[k]
            all_good_offers.extend(s.get("good_offers") or [])
            print(f"[{item['name']}] seen={s['seen']} new={s['new']} analyzed={s['analyzed']} tokens={s['tokens']}")
        except Exception as e:
            traceback.print_exc()
            finish_run(sb, run_id, error=str(e))

    if all_good_offers:
        send_email_notifications(all_good_offers)

    print(f"RAZEM: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
