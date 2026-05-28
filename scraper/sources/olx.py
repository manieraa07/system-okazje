"""Scraper OLX — listingi HTML + opcjonalnie strona oferty.

OLX nie udostępnia publicznego API, więc parsujemy HTML.
Filtrujemy parametrami URL:
  - search[private_business]=private  → tylko osoby prywatne
  - search[order]=created_at:desc     → najnowsze
URL bazowy: https://www.olx.pl/oferty/q-<query>/
"""
from __future__ import annotations
import re
import json
import httpx
from bs4 import BeautifulSoup
from urllib.parse import quote
from tenacity import retry, stop_after_attempt, wait_exponential

OLX_BASE = "https://www.olx.pl"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept-Language": "pl,en;q=0.9"}


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
def _get(client: httpx.Client, url: str) -> str:
    r = client.get(url, headers=HEADERS, timeout=20.0, follow_redirects=True)
    r.raise_for_status()
    return r.text


def _build_search_url(query: str, page: int = 1) -> str:
    q = quote(query.strip().replace(" ", "-"))
    url = f"{OLX_BASE}/oferty/q-{q}/?search%5Bprivate_business%5D=private&search%5Border%5D=created_at:desc"
    if page > 1:
        url += f"&page={page}"
    return url


def _parse_listing(html: str) -> list[dict]:
    """Wyciąga oferty z listingu. OLX renderuje większość przez `data-cy` atrybuty."""
    soup = BeautifulSoup(html, "lxml")
    items: list[dict] = []

    # Każda karta oferty ma data-cy="l-card"
    for card in soup.select('[data-cy="l-card"]'):
        a = card.select_one("a[href]")
        if not a:
            continue
        href = a["href"]
        url = href if href.startswith("http") else OLX_BASE + href

        # external_id z URL: .../oferta/...-IDxxxxx.html
        m = re.search(r"-ID([A-Za-z0-9]+)\.html", url)
        external_id = m.group(1) if m else url

        title_el = card.select_one("h4, h6, [data-cy='ad-card-title']")
        title = title_el.get_text(strip=True) if title_el else ""

        price_el = card.select_one('[data-testid="ad-price"]')
        price_txt = price_el.get_text(" ", strip=True) if price_el else ""
        price = _parse_price(price_txt)

        loc_el = card.select_one('[data-testid="location-date"]')
        location = loc_el.get_text(" ", strip=True) if loc_el else ""

        # czy "Wysyłka OLX" — badge w karcie
        shipping = bool(card.select_one('[data-testid="adCard-delivery-badge"]')) \
                   or "wysyłka" in card.get_text(" ", strip=True).lower()

        if price is None or not title:
            continue

        items.append({
            "platform": "olx",
            "external_id": external_id,
            "url": url.split("?")[0],
            "title": title,
            "price": price,
            "currency": "PLN",
            "shipping_available": shipping,
            "seller_type": "private",  # wymusiliśmy w URL
            "location": location,
            "description": None,        # uzupełnimy w fetch_description
            "posted_at": None,
        })
    return items


_PRICE_RE = re.compile(r"([\d\s\u00a0]+)([.,]\d{1,2})?")

def _parse_price(s: str) -> float | None:
    s = s.replace("\xa0", " ").replace("zł", "").strip()
    if not s or s.lower().startswith("zamienię"):
        return None
    m = _PRICE_RE.search(s)
    if not m:
        return None
    whole = re.sub(r"\D", "", m.group(1))
    frac = (m.group(2) or "").replace(",", ".")
    try:
        return float(f"{whole}{frac}") if whole else None
    except ValueError:
        return None


def fetch_description(client: httpx.Client, offer_url: str) -> str | None:
    """Pobiera pełen opis ze strony oferty. Wywołuj OSZCZĘDNIE."""
    try:
        html = _get(client, offer_url)
    except Exception:
        return None
    soup = BeautifulSoup(html, "lxml")
    el = soup.select_one('[data-cy="ad_description"]') or soup.select_one('div[data-testid="ad-description"]')
    if el:
        return el.get_text("\n", strip=True)[:5000]
    # fallback: JSON-LD
    for tag in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(tag.string or "{}")
            desc = data.get("description")
            if desc:
                return desc[:5000]
        except Exception:
            pass
    return None


def search(query: str, max_offers: int = 40) -> list[dict]:
    out: list[dict] = []
    with httpx.Client(http2=True) as client:
        for page in range(1, 4):  # max 3 strony
            url = _build_search_url(query, page)
            try:
                html = _get(client, url)
            except Exception as e:
                print(f"[olx] błąd strony {page}: {e}")
                break
            items = _parse_listing(html)
            if not items:
                break
            out.extend(items)
            if len(out) >= max_offers:
                break
    return out[:max_offers]
