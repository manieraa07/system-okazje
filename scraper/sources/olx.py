"""Scraper OLX — wzorowany na działającym kodzie użytkownika.
Czyta __PRERENDERED_STATE__ z taga olx-init-config zamiast parsować HTML."""
from __future__ import annotations
import re
import json
import requests
from urllib.parse import quote
from bs4 import BeautifulSoup

OLX_BASE = "https://www.olx.pl"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pl-PL,pl;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _build_search_url(query: str, page: int = 1) -> str:
    q = quote(query.strip().replace(" ", "-"))
    url = (f"{OLX_BASE}/oferty/q-{q}/"
           f"?search%5Bprivate_business%5D=private"
           f"&search%5Border%5D=created_at:desc")
    if page > 1:
        url += f"&page={page}"
    return url


def _znajdz_ads(data, depth=0):
    if depth > 12:
        return None
    if isinstance(data, dict):
        if "ads" in data and isinstance(data["ads"], list) and data["ads"]:
            first = data["ads"][0]
            if isinstance(first, dict) and "id" in first:
                return data["ads"]
        for v in data.values():
            r = _znajdz_ads(v, depth + 1)
            if r:
                return r
    elif isinstance(data, list):
        for it in data:
            r = _znajdz_ads(it, depth + 1)
            if r:
                return r
    return None


def _wytnij_js_string(text, start_idx):
    assert text[start_idx] == '"'
    i = start_idx + 1
    out = []
    while i < len(text):
        ch = text[i]
        if ch == "\\":
            if i + 1 < len(text):
                out.append(text[i:i + 2])
                i += 2
                continue
            break
        if ch == '"':
            return "".join(out), i + 1
        out.append(ch)
        i += 1
    raise ValueError("brak zamykajacego cudzyslowia")


def _parse_state(html: str):
    soup = BeautifulSoup(html, "lxml")
    tag = soup.find("script", {"id": "olx-init-config"})
    if not tag or not tag.string:
        return None
    raw = tag.string
    for nazwa in ("__PRERENDERED_STATE__", "__INIT_CONFIG__"):
        m = re.search(r'window\.' + re.escape(nazwa) + r'\s*=\s*"', raw)
        if not m:
            continue
        try:
            esc, _ = _wytnij_js_string(raw, m.end() - 1)
            js = esc.encode("utf-8").decode("unicode_escape")
            js = js.encode("latin-1", "ignore").decode("utf-8", "ignore")
            data = json.loads(js)
        except Exception:
            continue
        ads = _znajdz_ads(data)
        if ads:
            return ads
    return None


def _liczba(x):
    if x is None:
        return None
    s = re.sub(r"[^\d,.\-]", "", str(x).replace("\xa0", " "))
    if not s:
        return None
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    else:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _cena(ad):
    p = ad.get("price")
    if isinstance(p, dict):
        for k in ("regularPrice", "displayValue"):
            v = p.get(k)
            if isinstance(v, dict) and v.get("value") is not None:
                return _liczba(v.get("value"))
            if v is not None and not isinstance(v, dict):
                return _liczba(v)
        if p.get("value") is not None:
            return _liczba(p.get("value"))
    elif p is not None:
        return _liczba(p)
    return None


def search(query: str, max_offers: int = 40) -> list[dict]:
    out: list[dict] = []
    for page in range(1, 4):
        url = _build_search_url(query, page)
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code >= 400:
                print(f"[olx HTTP {r.status_code}] {url}")
                break
            html = r.text
        except requests.RequestException as e:
            print(f"[olx] {query!r} p{page}: {e}")
            break

        ads = _parse_state(html)
        if not ads:
            print(f"[olx] {query!r} p{page}: brak ads w __PRERENDERED_STATE__")
            break

        for ad in ads:
            try:
                oid = str(ad.get("id", ""))
                if not oid:
                    continue
                title = ad.get("title") or ""
                url_offer = ad.get("url") or ""
                price = _cena(ad)
                if price is None or not title:
                    continue

                # parametry oferty
                params = {}
                for p in ad.get("params", []) or []:
                    key = p.get("key", "")
                    val = p.get("value", {})
                    if isinstance(val, dict):
                        params[key] = val.get("value") or val.get("key")
                    else:
                        params[key] = val

                # typ sprzedawcy
                seller = ad.get("user") or {}
                is_business = bool(seller.get("isBusiness"))

                # wysylka — flagi rozne na OLX
                shipping = bool(
                    ad.get("delivery") or ad.get("safeDeal")
                    or params.get("courier") or "courier" in str(params).lower()
                )

                location = ""
                loc = ad.get("location") or {}
                if isinstance(loc, dict):
                    city = (loc.get("city") or {}).get("name") if isinstance(loc.get("city"), dict) else loc.get("city")
                    location = city or ""

                desc = ad.get("description")
                if desc:
                    # OLX czesto trzyma HTML
                    desc = BeautifulSoup(desc, "lxml").get_text("\n", strip=True)[:5000]

                out.append({
                    "platform": "olx",
                    "external_id": oid,
                    "url": url_offer.split("?")[0],
                    "title": title,
                    "price": price,
                    "currency": "PLN",
                    "shipping_available": shipping,
                    "seller_type": "business" if is_business else "private",
                    "seller_name": seller.get("name"),
                    "location": location,
                    "description": desc,
                    "posted_at": ad.get("createdTime") or ad.get("created_time"),
                })
            except Exception as e:
                print(f"[olx] pomijam: {e}")
                continue

        if len(out) >= max_offers:
            break

    return out[:max_offers]


# zostawiamy stub żeby main.py nie wybuchł — opis i tak mamy z listingu
def fetch_description(client, offer_url):
    return None
