"""Wstępne filtry — uruchamiane PRZED wysłaniem do Claude, żeby oszczędzić tokeny."""
import re
from rapidfuzz import fuzz

# Domyślne słowa "akcesorium/część" jeśli watchlist ich nie nadpisuje
DEFAULT_ACCESSORY_WORDS = {
    "etui", "case", "pokrowiec", "kabel", "ładowarka", "ladowarka",
    "folia", "szkło", "szklo", "naklejka", "uchwyt", "stojak",
    "pad", "kontroler", "joystick", "słuchawki", "sluchawki",
    "części", "czesci", "część", "czesc", "uszkodzony", "uszkodzona",
    "nie działa", "nie dziala", "na części", "do naprawy",
    "wkład", "wklad", "tusz", "toner", "filtr",
    "instrukcja", "pudełko", "pudelko", "samo pudełko",
}

URGENCY_WORDS = {
    "pilne", "pilna", "pilnie", "wyprowadzka", "przeprowadzka",
    "na dziś", "na dzis", "dziś sprzedam", "dzis sprzedam",
    "muszę sprzedać", "musze sprzedac", "szybka sprzedaż",
    "okazja", "tanio", "ostatni dzień", "ostatni dzien",
    "wyjeżdżam", "wyjezdzam", "likwidacja",
}

BUNDLE_HINTS = {
    "wszystko razem", "całość", "calosc", "komplet", "zestaw",
    "sprzedam wszystko", "bundle", "paczka", "całość za",
}

BUSINESS_WORDS = {
    "faktura vat", "fv 23", "sklep", "hurtownia", "dystrybutor",
    "sprzedaż b2b", "gwarancja sklepu",
}


def normalize(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def matches_keywords(text: str, keywords: list[str], threshold: int = 82) -> bool:
    """Fuzzy match — obsługuje literówki ('palystation' ~ 'playstation')."""
    if not keywords:
        return True
    t = normalize(text)
    for kw in keywords:
        kw_n = normalize(kw)
        if kw_n in t:
            return True
        # fuzzy na poszczególnych słowach
        for token in t.split():
            if fuzz.ratio(token, kw_n) >= threshold:
                return True
        if fuzz.partial_ratio(kw_n, t) >= threshold:
            return True
    return False


def is_accessory_by_title(title: str, custom_exclude: list[str]) -> bool:
    t = normalize(title)
    words = set(custom_exclude or []) | DEFAULT_ACCESSORY_WORDS
    return any(w in t for w in words)


def detect_urgency(text: str) -> list[str]:
    t = normalize(text)
    return sorted({w for w in URGENCY_WORDS if w in t})


def detect_bundle_hint(text: str) -> bool:
    t = normalize(text)
    return any(w in t for w in BUNDLE_HINTS)


def looks_like_business(seller_name: str | None, description: str | None) -> bool:
    text = normalize(f"{seller_name or ''} {description or ''}")
    return any(w in text for w in BUSINESS_WORDS)
