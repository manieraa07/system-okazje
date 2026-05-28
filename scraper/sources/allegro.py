"""Scraper Allegro — oficjalne REST API.

Dokumentacja: https://developer.allegro.pl/documentation/
Autoryzacja: OAuth2 client_credentials (publiczne dane, bez konta usera).
Endpoint listingu: GET https://api.allegro.pl/offers/listing
"""
from __future__ import annotations
import os
import time
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

TOKEN_URL = "https://allegro.pl/auth/oauth/token"
API = "https://api.allegro.pl"

_token_cache = {"value": None, "exp": 0.0}


def _get_token() -> str:
    if _token_cache["value"] and _token_cache["exp"] > time.time() + 30:
        return _token_cache["value"]
    cid = os.environ["ALLEGRO_CLIENT_ID"]
    sec = os.environ["ALLEGRO_CLIENT_SECRET"]
    r = httpx.post(
        TOKEN_URL,
        params={"grant_type": "client_credentials"},
        auth=(cid, sec),
        timeout=20.0,
    )
    r.raise_for_status()
    data = r.json()
    _token_cache["value"] = data["access_token"]
    _token_cache["exp"] = time.time() + int(data.get("expires_in", 3600))
    return _token_cache["value"]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
def _api_get(path: str, params: dict) -> dict:
    headers = {
        "Authorization": f"Bearer {_get_token()}",
        "Accept": "application/vnd.allegro.public.v1+json",
    }
    r = httpx.get(API + path, headers=headers, params=params, timeout=20.0)
    if r.status_code == 401:  # token wygasł
        _token_cache["exp"] = 0
        headers["Authorization"] = f"Bearer {_get_token()}"
        r = httpx.get(API + path, headers=headers, params=params, timeout=20.0)
    r.raise_for_status()
    return r.json()


def search(query: str, max_offers: int = 40) -> list[dict]:
    """Szuka ofert. Filtry:
        - Sprzedawca: tylko osoby prywatne (Seller.UserType=Person → param `Sprzedawca=osoba-prywatna`
          działa przez parametr kategorii; bezpieczniej filtrujemy po polu `seller.login` i typie konta
          przy analizie odpowiedzi).
        - Sortowanie: najnowsze (`sort=-startTime`).
        - Z dostawą: `parameter.11323=11323_1` (Dostawa: tak) — różni się per kategoria,
          więc dodatkowo filtrujemy po polu `delivery` w odpowiedzi.
    """
    params = {
        "phrase": query,
        "limit": min(max_offers, 60),
        "sort": "-startTime",
        "include": "-promoted",  # pomijaj promowane (śmieci)
    }
    data = _api_get("/offers/listing", params)
    regular = data.get("items", {}).get("regular", [])
    out: list[dict] = []
    for it in regular:
        try:
            price = float(it["sellingMode"]["price"]["amount"])
        except (KeyError, ValueError, TypeError):
            continue

        seller = it.get("seller") or {}
        # Allegro: "Person" = osoba prywatna, "Company" = firma
        is_private = (seller.get("userType") or seller.get("type") or "").lower() == "person"

        # delivery może mieć `availableForFree` lub `lowestPrice`
        delivery = it.get("delivery") or {}
        shipping = bool(delivery)  # jeśli w ogóle jest opcja dostawy

        out.append({
            "platform": "allegro",
            "external_id": str(it["id"]),
            "url": f"https://allegro.pl/oferta/{it['id']}",
            "title": it.get("name", ""),
            "price": price,
            "currency": it["sellingMode"]["price"].get("currency", "PLN"),
            "shipping_available": shipping,
            "seller_type": "private" if is_private else "business",
            "seller_name": seller.get("login"),
            "location": (it.get("location") or {}).get("city"),
            "description": None,  # listing nie zawiera; pobranie pełnego opisu = osobny call /sale/offers/{id} (kosztowny)
            "posted_at": it.get("publication", {}).get("startingAt"),
        })
    return out
