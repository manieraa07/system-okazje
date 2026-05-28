"""Zastępnik Claude — używa lokalnych reguł zamiast AI.

Zwraca dokładnie ten sam słownik co `analyzer.analyze`, więc reszta kodu
nie musi nic wiedzieć. Gdy dostaniesz klucz Claude, ustaw USE_CLAUDE=1.
"""
from __future__ import annotations
from filters import (
    DEFAULT_ACCESSORY_WORDS, detect_urgency, detect_bundle_hint,
    matches_keywords, normalize,
)


def analyze(
    *, title: str, description: str | None, price: float,
    watchlist_name: str, watchlist_keywords: list[str], market_value: float
) -> tuple[dict, int]:
    text = f"{title}\n{description or ''}"
    text_n = normalize(text)

    # 1) Czy to akcesorium? — sprawdzamy też opis, nie tylko tytuł
    is_accessory = any(w in text_n for w in DEFAULT_ACCESSORY_WORDS)

    # 2) Czy pasuje do keywords? (już sprawdzone w main, tu dla pewności)
    matches = matches_keywords(text, watchlist_keywords or [watchlist_name])

    is_real_item = matches and not is_accessory

    # 3) Pilność i bundle
    urgency_signals = detect_urgency(text)
    is_urgent = bool(urgency_signals)
    is_bundle = detect_bundle_hint(text)

    # 4) Krótki opis = pierwsze 180 znaków opisu albo tytuł
    short = (description or title).strip().replace("\n", " ")
    if len(short) > 180:
        short = short[:177] + "..."

    # 5) Confidence: niskie, bo to tylko reguły
    confidence = 0.55 if is_real_item else 0.35
    if not description:
        confidence -= 0.1

    analysis = {
        "is_real_item": is_real_item,
        "matched_item": watchlist_name,            # bez AI nie rozpoznamy modelu — bierzemy nazwę z watchlist
        "is_urgent": is_urgent,
        "urgency_signals": urgency_signals,
        "is_bundle": is_bundle,
        "bundle_items": None,                       # bez AI nie rozbijemy bundle
        "short_description": short,
        "confidence": round(max(0.0, confidence), 2),
        "notes": "stub (bez Claude) — analiza regułowa",
    }
    return analysis, 0  # 0 tokenów
