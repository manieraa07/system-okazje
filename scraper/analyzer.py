"""Claude API — klasyfikuje ofertę.

Wywołanie zwraca JSON o stałym schemacie. Używamy `tools` jako wymuszenia
formatu (function-call-style), żeby zawsze dostać parsowalną odpowiedź.
"""
from __future__ import annotations
import os
import json
import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5")

_client: anthropic.Anthropic | None = None
def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


ANALYZE_TOOL = {
    "name": "save_analysis",
    "description": "Zapisuje wynik analizy oferty",
    "input_schema": {
        "type": "object",
        "properties": {
            "is_real_item": {
                "type": "boolean",
                "description": "True jeśli oferta to faktyczny przedmiot z watchlist. False jeśli to akcesorium, część, etui, kabel, sama instrukcja, samo pudełko, uszkodzony egzemplarz 'na części' itp."
            },
            "matched_item": {
                "type": "string",
                "description": "Konkretna nazwa przedmiotu (np. 'PS5 Slim', 'iPhone 13 128GB'). Pusty string jeśli nie pasuje."
            },
            "is_urgent": {"type": "boolean", "description": "Sygnały pilności w opisie/tytule."},
            "urgency_signals": {
                "type": "array", "items": {"type": "string"},
                "description": "Konkretne frazy wskazujące pilność, np. ['wyprowadzka','pilne']."
            },
            "is_bundle": {
                "type": "boolean",
                "description": "True jeśli sprzedawca sprzedaje WIELE rzeczy razem ('sprzedam wszystko razem', 'komplet', 'zestaw kilku gier')."
            },
            "bundle_items": {
                "type": "array",
                "description": "Jeśli bundle: lista przedmiotów wchodzących w skład.",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "est_value_pln": {"type": "number", "description": "Szacunkowa wartość rynkowa w PLN (Twoja najlepsza estymacja)."}
                    },
                    "required": ["name"]
                }
            },
            "short_description": {
                "type": "string",
                "description": "1-2 zdania po polsku streszczające ofertę dla człowieka."
            },
            "confidence": {"type": "number", "description": "0.0–1.0 — jak pewna jest klasyfikacja."},
            "notes": {"type": "string", "description": "Krótkie uzasadnienie / wyjaśnienie wątpliwości."}
        },
        "required": ["is_real_item", "matched_item", "is_urgent", "is_bundle",
                     "short_description", "confidence"]
    }
}


SYSTEM_PROMPT = """Jesteś ekspertem od ocen ofert sprzedaży na polskich serwisach (OLX, Allegro).
Twoje zadanie: dla każdej oferty zaklasyfikować precyzyjnie:
1) Czy to FAKTYCZNY przedmiot, którego szuka kupujący, czy akcesorium/część/uszkodzony egzemplarz.
2) Jaki to dokładnie model (nawet jeśli tytuł jest niedokładny lub ma literówki — np. "konsola sony nowa" + opis "ps 5 slim 1tb biała" → PS5 Slim).
3) Czy sprzedaż jest PILNA (słowa: pilne, wyprowadzka, na dziś, muszę sprzedać, wyjeżdżam, likwidacja).
4) Czy to BUNDLE (sprzedam wszystko razem, komplet, zestaw) — wtedy wymień osobno przedmioty z szacowaną wartością.

Bądź konserwatywny: lepiej oznaczyć ofertę jako `is_real_item=false` przy wątpliwościach niż wpuścić śmieci.
Zawsze wywołaj narzędzie `save_analysis`. Odpowiadaj po polsku w polach tekstowych."""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=20))
def analyze(
    *, title: str, description: str | None, price: float,
    watchlist_name: str, watchlist_keywords: list[str], market_value: float
) -> tuple[dict, int]:
    """Zwraca (analysis_dict, tokens_used)."""
    user_msg = f"""## Szukamy: {watchlist_name}
Słowa kluczowe / aliasy: {', '.join(watchlist_keywords) if watchlist_keywords else '(brak)'}
Moja szacowana wartość rynkowa: {market_value:.0f} PLN

## Oferta do oceny
Tytuł: {title}
Cena: {price:.0f} PLN
Opis:
{description or '(brak opisu — analizuj tylko po tytule, obniż confidence)'}
"""

    client = _get_client()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=[ANALYZE_TOOL],
        tool_choice={"type": "tool", "name": "save_analysis"},
        messages=[{"role": "user", "content": user_msg}],
    )
    tokens = (resp.usage.input_tokens or 0) + (resp.usage.output_tokens or 0)
    for block in resp.content:
        if block.type == "tool_use" and block.name == "save_analysis":
            return block.input, tokens
    raise RuntimeError("Claude nie zwrócił tool_use")
