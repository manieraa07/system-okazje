"""Scraper OLX — listingi HTML."""
from __future__ import annotations
import re
import json
import httpx
from bs4 import BeautifulSoup
from urllib.parse import quote
from tenacity import retry, stop_after_attempt, wait_exponential

OLX_BASE = "https://www.olx.pl"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def _get(client: httpx.Client, url: str) -> str:
    r = client.get(url, headers=HEADERS, timeout=25.0, follow_redirects=True)
    if r.status_code >= 400:
        # logujemy konkretny status — zobaczymy w GitHub Actions
        print(f"[olx HTTP {r.status_code}] {url}")
        r.raise_for_status()
    return r.text


def _build_search_url(query: str, page: int = 1) -> str:
    q = quote(query.strip().replace(" ", "-"))
    url = f"{OLX_BASE}/oferty/q-{q}/?search%5Bprivate_business%5D=private&search%5Border%5D=created_at:desc"
    if page > 1:
        url += f"&page={page}"
    return url


def _parse_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    items: list[dict] = []
    for card in soup.select('[data-cy="l-card"]'):
        a = card.select_one("a[href]")
        if not a:
            continue
        href = a["href"]
        url = href if href.startswith("http") else OLX_BASE + href
        m = re.search(r"-ID([A-Za-z0-9]+)\.html", url)
        external_id = m.group(1) if m else url
        title_el = card.select_one("h4, h6, [data-cy='ad-card-title']")
        title = title_el.get_text(strip=True) if title_el else ""
        price_el = card.select_one('[data-testid="ad-price"]')
        price_txt = price_el.get_text(" ", strip=True) if price_el else ""
        price = _parse_price(price_txt)
        loc_el = card.select_one('[data-testid="location-date"]')
        location = loc_el.get_text(" ", strip=True) if loc_el else ""
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
            "seller_type": "private",
            "location": location,
            "description": None,
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
    try:
        html = _get(client, offer_url)
    except Exception:
        return None
    soup = BeautifulSoup(html, "lxml")
    el = soup.select_one('[data-cy="ad_description"]') or soup.select_one('div[data-testid="ad-description"]')
    if el:
        return el.get_text("\n", strip=True)[:5000]
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
    # http2=False — Cloudflare często łatwiej puszcza HTTP/1.1
    with httpx.Client(http2=False) as client:
        for page in range(1, 4):
            url = _build_search_url(query, page)
            try:
                html = _get(client, url)
            except Exception as e:
                print(f"[olx] błąd strony {page} dla {query!r}: {type(e).__name__}: {e}")
                break
            items = _parse_listing(html)
            if not items:
                break
            out.extend(items)
            if len(out) >= max_offers:
                break
    return out[:max_offers]
