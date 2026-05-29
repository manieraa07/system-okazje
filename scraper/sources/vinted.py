"""Scraper Vinted — używa Playwright do zdobycia sesji, potem requests do API."""
from __future__ import annotations
import time
import requests
from playwright.sync_api import sync_playwright

VINTED_BASE = "https://www.vinted.pl"
API_URL = f"{VINTED_BASE}/api/v2/catalog/items"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pl-PL,pl;q=0.9",
}

VINTED_EXCLUDE = {
    "naszywka", "patch", "koszulka", "t-shirt", "bluza", "hoodie",
    "czapka", "kubek", "plakat", "poster", "nadruk", "print",
    "naklejka", "sticker", "torba", "bag", "etui", "case",
}

_session_cookie: str | None = None


def _get_session_cookie() -> str | None:
    global _session_cookie
    if _session_cookie:
        return _session_cookie
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=HEADERS["User-Agent"],
                locale="pl-PL",
            )
            page = context.new_page()
            page.goto(VINTED_BASE, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            cookies = context.cookies()
            browser.close()
            for c in cookies:
                if c["name"] == "_vinted_fr_session":
                    _session_cookie = c["value"]
                    print("[vinted] sesja OK")
                    return _session_cookie
            print("[vinted] brak ciasteczka sesji po Playwright")
            return None
    except Exception as e:
        print(f"[vinted] Playwright error: {e}")
        return None


def search(query: str, max_offers: int = 40) -> list[dict]:
    session = _get_session_cookie()
    if not session:
        print("[vinted] brak sesji — pomijam")
        return []

    cookies = {"_vinted_fr_session": session}
    out: list[dict] = []

    for page in range(1, 4):
        params = {
            "search_text": query,
            "order": "newest_first",
            "per_page": 30,
            "page": page,
        }
        try:
            time.sleep(2)
            r = requests.get(
                API_URL,
                headers=HEADERS,
                cookies=cookies,
                params=params,
                timeout=20,
            )
            if r.status_code == 401:
                print("[vinted] 401 — sesja wygasła")
                global _session_cookie
                _session_cookie = None
                break
            if r.status_code >= 400:
                print(f"[vinted HTTP {r.status_code}] {query!r}")
                break
            data = r.json()
        except Exception as e:
            print(f"[vinted] {query!r} p{page}: {e}")
            break

        items = data.get("items") or []
        if not items:
            break

        for item in items:
            try:
                oid = str(item.get("id", ""))
                title = item.get("title") or ""
                if not oid or not title:
                    continue

                title_low = title.lower()
                if any(w in title_low for w in VINTED_EXCLUDE):
                    continue

                price_raw = item.get("price") or item.get("total_item_price")
                if isinstance(price_raw, dict):
                    price = float(price_raw.get("amount") or 0)
                else:
                    try:
                        price = float(price_raw or 0)
                    except (ValueError, TypeError):
                        continue
                if price <= 0:
                    continue

                url_offer = f"{VINTED_BASE}/items/{oid}"
                user = item.get("user") or {}

                out.append({
                    "platform": "vinted",
                    "external_id": oid,
                    "url": url_offer,
                    "title": title,
                    "price": price,
                    "currency": "PLN",
                    "shipping_available": True,
                    "seller_type": "private",
                    "seller_name": user.get("login"),
                    "location": item.get("city") or "",
                    "description": item.get("description") or "",
                    "posted_at": item.get("created_at_ts"),
                })
            except Exception as e:
                print(f"[vinted] pomijam: {e}")
                continue

        if len(out) >= max_offers:
            break

    return out[:max_offers]
