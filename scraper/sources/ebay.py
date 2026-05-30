"""Scraper eBay.de — używa Browse API z OAuth2 Client Credentials."""
from __future__ import annotations
import os
import time
import requests
from base64 import b64encode

EBAY_API_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
EBAY_AUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token"
EBAY_MARKETPLACE = "EBAY_DE"

_token: str | None = None
_token_expiry: float = 0


def _get_token() -> str | None:
    global _token, _token_expiry
    if _token and time.time() < _token_expiry - 60:
        return _token
    app_id = os.environ.get("EBAY_APP_ID")
    secret = os.environ.get("EBAY_CLIENT_SECRET")
    if not app_id or not secret:
        print("[ebay] brak EBAY_APP_ID lub EBAY_CLIENT_SECRET")
        return None
    credentials = b64encode(f"{app_id}:{secret}".encode()).decode()
    try:
        resp = requests.post(
            EBAY_AUTH_URL,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data="grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        _token = data["access_token"]
        _token_expiry = time.time() + data.get("expires_in", 7200)
        print("[ebay] token OK")
        return _token
    except Exception as e:
        print(f"[ebay] błąd tokenu: {e}")
        return None


def search(query: str, max_offers: int = 40) -> list[dict]:
    token = _get_token()
    if not token:
        return []

    out: list[dict] = []
    offset = 0
    limit = min(50, max_offers)

    while len(out) < max_offers:
        try:
            time.sleep(1)
            resp = requests.get(
                EBAY_API_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE,
                    "X-EBAY-C-ENDUSERCTX": "contextualLocation=country=DE",
                    "Content-Type": "application/json",
                },
                params={
                    "q": query,
                    "limit": limit,
                    "offset": offset,
                    "sort": "newlyListed",
                    "filter": "conditionIds:{3000|4000|5000|6000}",  # używane
                },
                timeout=20,
            )
            if resp.status_code == 401:
                print("[ebay] 401 — odświeżam token")
                global _token
                _token = None
                token = _get_token()
                if not token:
                    break
                continue
            if resp.status_code >= 400:
                print(f"[ebay HTTP {resp.status_code}] {query!r}")
                break
            data = resp.json()
        except Exception as e:
            print(f"[ebay] {query!r}: {e}")
            break

        items = data.get("itemSummaries") or []
        if not items:
            break

        for item in items:
            try:
                oid = item.get("itemId", "")
                title = item.get("title", "")
                if not oid or not title:
                    continue

                price_info = item.get("price") or {}
                try:
                    price = float(price_info.get("value", 0))
                except (ValueError, TypeError):
                    continue
                if price <= 0:
                    continue

                currency = price_info.get("currency", "EUR")
                url = item.get("itemWebUrl", f"https://www.ebay.de/itm/{oid}")

                shipping = True
                shipping_options = item.get("shippingOptions") or []
                if shipping_options:
                    first = shipping_options[0]
                    shipping_cost = first.get("shippingCost", {}).get("value", "0")
                    try:
                        shipping = float(shipping_cost) >= 0
                    except (ValueError, TypeError):
                        shipping = True

                seller = item.get("seller") or {}
                seller_type = "business" if seller.get("feedbackScore", 0) > 500 else "private"

                location = item.get("itemLocation") or {}
                loc_str = location.get("city") or location.get("country") or ""

                posted_at = item.get("itemCreationDate")

                out.append({
                    "platform": "ebay",
                    "external_id": str(oid),
                    "url": url,
                    "title": title,
                    "price": price,
                    "currency": currency,
                    "shipping_available": shipping,
                    "seller_type": seller_type,
                    "seller_name": seller.get("username"),
                    "location": loc_str,
                    "description": item.get("shortDescription") or "",
                    "posted_at": posted_at,
                    "market": "de",
                })
            except Exception as e:
                print(f"[ebay] pomijam: {e}")
                continue

        offset += limit
        if offset >= data.get("total", 0):
            break

    print(f"[ebay] {query!r}: {len(out)} ofert")
    return out[:max_offers]
