"""Analyzer używający Groq API (Llama) zamiast reguł.
Fallback na reguły jeśli brak klucza GROQ_API_KEY.
"""
from __future__ import annotations
import os
import json
import requests
from filters import (
    DEFAULT_ACCESSORY_WORDS, detect_urgency, detect_bundle_hint,
    matches_keywords, normalize,
)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


def _analyze_with_groq(
    title: str, description: str | None, price: float,
    watchlist_name: str, watchlist_keywords: list[str], market_value: float
) -> tuple[dict, int]:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return _analyze_stub(title, description, price, watchlist_name, watchlist_keywords, market_value)

    prompt = f"""Analizujesz ogłoszenie z polskiego portalu ogłoszeniowego.
Szukamy: {watchlist_name} (słowa kluczowe: {', '.join(watchlist_keywords)})
Wartość rynkowa: {market_value} PLN

Ogłoszenie:
Tytuł: {title}
Cena: {price} PLN
Opis: {(description or 'brak')[:500]}

Odpowiedz TYLKO w JSON (bez markdown, bez komentarzy):
{{
  "is_real_item": true/false,
  "matched_item": "nazwa rozpoznanego przedmiotu lub null",
  "is_urgent": true/false,
  "urgency_signals": ["lista sygnałów pilności"],
  "is_bundle": true/false,
  "bundle_items": null,
  "short_description": "1-2 zdania po polsku o stanie i szczegółach",
  "confidence": 0.0-1.0,
  "notes": "krótka notatka"
}}

Zasady:
- is_real_item=true TYLKO jeśli ogłoszenie dotyczy dokładnie szukanego przedmiotu (nie akcesoriów, nie innych modeli, nie uszkodzonych)
- Jeśli tytuł to akcesorium (etui, kabel, szkło, ładowarka) → is_real_item=false
- Jeśli w opisie jest "tylko odbiór", "odbiór osobisty", "nie wysyłam", "nie wysylam", "brak wysyłki" → is_real_item=false
- Jeśli to inny model niż szukany (np. szukamy S20 a jest S21/S10/zegarek) → is_real_item=false
- is_urgent=true jeśli sprzedający jest w pośpiechu (wyprowadzka, pilne, na dziś)
- is_bundle=true jeśli sprzedaje zestaw kilku rzeczy"""

    try:
        resp = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 300,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"].strip()
        # Usuń ewentualne markdown backticks
        content = content.replace("```json", "").replace("```", "").strip()
        analysis = json.loads(content)
        tokens = data.get("usage", {}).get("total_tokens", 0)

        # Upewnij się że mamy wszystkie pola
        analysis.setdefault("is_real_item", False)
        analysis.setdefault("matched_item", watchlist_name)
        analysis.setdefault("is_urgent", False)
        analysis.setdefault("urgency_signals", [])
        analysis.setdefault("is_bundle", False)
        analysis.setdefault("bundle_items", None)
        analysis.setdefault("short_description", title[:180])
        analysis.setdefault("confidence", 0.7)
        analysis.setdefault("notes", "Groq Llama")

        return analysis, tokens

    except Exception as e:
        print(f"[groq] błąd: {e} — fallback na stub")
        return _analyze_stub(title, description, price, watchlist_name, watchlist_keywords, market_value)


def _analyze_stub(
    title: str, description: str | None, price: float,
    watchlist_name: str, watchlist_keywords: list[str], market_value: float
) -> tuple[dict, int]:
    text = f"{title}\n{description or ''}"
    matches = matches_keywords(text, watchlist_keywords or [watchlist_name])
    title_n = normalize(title)
    is_accessory_title = any(w in title_n for w in DEFAULT_ACCESSORY_WORDS)
    is_real_item = matches and not is_accessory_title
    urgency_signals = detect_urgency(text)
    is_urgent = bool(urgency_signals)
    is_bundle = detect_bundle_hint(text)
    short = (description or title).strip().replace("\n", " ")
    if len(short) > 180:
        short = short[:177] + "..."
    confidence = 0.55 if is_real_item else 0.35
    if not description:
        confidence -= 0.1
    analysis = {
        "is_real_item": is_real_item,
        "matched_item": watchlist_name,
        "is_urgent": is_urgent,
        "urgency_signals": urgency_signals,
        "is_bundle": is_bundle,
        "bundle_items": None,
        "short_description": short,
        "confidence": round(max(0.0, confidence), 2),
        "notes": "stub (bez AI) — analiza regułowa",
    }
    return analysis, 0


def analyze(
    *, title: str, description: str | None, price: float,
    watchlist_name: str, watchlist_keywords: list[str], market_value: float
) -> tuple[dict, int]:
    return _analyze_with_groq(
        title=title,
        description=description,
        price=price,
        watchlist_name=watchlist_name,
        watchlist_keywords=watchlist_keywords,
        market_value=market_value,
    )
