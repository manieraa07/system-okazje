"""Wstępne filtry — uruchamiane PRZED wysłaniem do Claude, żeby oszczędzić tokeny."""
import re
from rapidfuzz import fuzz

DEFAULT_ACCESSORY_WORDS = {
    "etui", "case", "pokrowiec", "kabel", "ładowarka", "ladowarka",
    "folia", "szkło", "szklo", "naklejka", "uchwyt", "stojak",
    "pad", "kontroler", "joystick", "słuchawki", "sluchawki",
    "części", "czesci", "część", "czesc", "uszkodzony", "uszkodzona",
    "nie działa", "nie dziala", "na części", "do naprawy",
    "wkład", "wklad", "tusz", "toner", "filtr",
    "instrukcja", "pudełko", "pudelko", "samo pudełko",
}

# Słowa sugerujące że to JEST główny produkt (sanity-check)
MAIN_PRODUCT_HINTS = {
    "konsola", "console", "zestaw z konsolą", "zestaw z konsola",
    "playstation 5", "ps5 console", "ps5 disc", "ps5 digital",
    "xbox series", "nintendo switch", "iphone", "samsung galaxy",
    "laptop", "macbook", "tablet", "smartfon", "telefon",
}

# Słowa wskazujące że to akcesorium/gra mimo braku w DEFAULT_ACCESSORY_WORDS
GAME_ACCESSORY_WORDS = {
    "na ps5", "do ps5", "na ps4", "do ps4", "na xbox", "do xbox",
    "na nintendo", "do nintendo", "na pc", "do pc",
    "gra ", "gry ", "game", "far cry", "farcry", "baldur", "baldurs",
    "nfs", "need for speed", "tony hawk", "fifa", "ea sports",
    "call of duty", "cod ", "assassin", "cyberpunk", "hogwarts",
    "spider-man", "spiderman", "god of war", "horizon", "ratchet",
    "returnal", "demon souls", "elden ring", "fortnite", "minecraft",
    "grand theft", "gta", "mortal kombat", "mk ", "street fighter",
    "resident evil", "final fantasy", "dragon quest", "persona ",
    "organizer", "podstawka", "charging station", "stacja ładowania",
    "stacja ladowania", "naszywka", "koszulka", "t-shirt", "bluza",
    "plakat", "poster", "figurka", "amiibo",
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
    if not keywords:
        return True
    t = normalize(text)
    for kw in keywords:
        kw_n = normalize(kw)
        if kw_n in t:
            return True
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


def is_game_or_peripheral(title: str) -> bool:
    """Odrzuca gry i akcesoria podszywające się pod główny produkt."""
    t = normalize(title)
    return any(w in t for w in GAME_ACCESSORY_WORDS)


def price_sanity_check(
    price: float,
    market_value: float | None,
    title: str,
    threshold: float = 0.3,
) -> bool:
    """
    Zwraca False (odrzuć) jeśli cena < threshold * market_value
    I tytuł NIE zawiera słów potwierdzających że to główny produkt.
    """
    if not market_value or market_value <= 0:
        return True  # brak danych → przepuść
    if price >= market_value * threshold:
        return True  # cena OK
    t = normalize(title)
    if any(hint in t for hint in MAIN_PRODUCT_HINTS):
        return True  # ma hint głównego produktu → przepuść mimo niskiej ceny
    return False  # za tanie i brak hintów → odrzuć


def detect_urgency(text: str) -> list[str]:
    t = normalize(text)
    return sorted({w for w in URGENCY_WORDS if w in t})


def detect_bundle_hint(text: str) -> bool:
    t = normalize(text)
    return any(w in t for w in BUNDLE_HINTS)


def looks_like_business(seller_name: str | None, description: str | None) -> bool:
    text = normalize(f"{seller_name or ''} {description or ''}")
    return any(w in text for w in BUSINESS_WORDS)
