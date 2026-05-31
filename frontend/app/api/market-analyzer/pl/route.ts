import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "placeholder-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "placeholder" });

export async function POST(req: Request) {
  try {
    const { phrase } = await req.json();

    if (!phrase) {
      return NextResponse.json({ error: "Fraza jest wymagana" }, { status: 400 });
    }

    const cleanPhrase = phrase.toLowerCase().trim();

    // 1. Pobieramy z bazy 200 najświeższych ofert, żeby mieć pewność, że nowo dodane ogłoszenia tam są
    const { data: allOffers, error: dbError } = await supabase
      .from("offers")
      .select("title, price, url")
      .order("created_at", { ascending: false }) // Sortujemy od najnowszych
      .limit(200);

    if (dbError) throw dbError;

    if (!allOffers || allOffers.length === 0) {
      return NextResponse.json({ error: "Baza danych ofert jest pusta." }, { status: 404 });
    }

    // 2. STRYKTNE FILTROWANIE W JAVASCRIPT
    const filteredOffers = allOffers.filter((offer) => {
      if (!offer.title) return false;
      const titleLower = offer.title.toLowerCase();

      // Specjalny warunek dla PS5 / PlayStation 5
      if (cleanPhrase === "ps5" || cleanPhrase === "playstation 5" || cleanPhrase === "playstation5" || cleanPhrase === "konsola ps5") {
        // Oferta MUSI zawierać "ps5" LUB "playstation 5" LUB "playstation5", żeby odsiać śmieci z innych generacji (np. PS4)
        return titleLower.includes("ps5") || titleLower.includes("playstation 5") || titleLower.includes("playstation5") || titleLower.includes("play station 5");
      }

      // Dla każdego innego przedmiotu (np. Dyson V15) - tytuł musi zawierać WSZYSTKIE wpisane słowa
      const words = cleanPhrase.split(/\s+/).filter((w: string) => w.length > 1);
      return words.every((word: string) => titleLower.includes(word));
    });

    if (filteredOffers.length === 0) {
      return NextResponse.json({
        error: `Nie znaleziono w bazie ofert pasujących bezpośrednio do: "${phrase}"`,
      }, { status: 404 });
    }

    // 3. Przekazujemy przefiltrowane, PEWNE oferty konsol do AI (maksymalnie 80 sztuk)
    const finalOffersToAnalyze = filteredOffers.slice(0, 80);

    const prompt = `
    Jesteś ekspertem analizy cenowej e-commerce. Przeanalizuj listę ogłoszeń dla hasła: "${phrase}".

    ZASADY PODZIAŁU:
    1. Do "analyzed_offers" dajesz KAŻDE ogłoszenie, które sprzedaje konsolę (urządzenie główne) - niezależnie czy samą, czy w zestawie z 1, 2 padami, grami czy gwarancją.
       - PRZYKŁAD: "Konsola PS5 PlayStation Pad" LUB "PS 5 DIGITAL / GWARANCJA / 15 Gier" MUSZĄ znaleźć się w "analyzed_offers".
       - W polu "estimated_market_value_pln" podaj średnią cenę bazową (jeśli zestawy są drogie, odejmij w pamięci wartość dodatków, aby wycenić samą konsolę).

    2. Do "rejected_offers" dajesz wyłącznie szum: same gry (np. Fifa 25 PS5), same akcesoria (stojaki, kable), puste pudełka lub uszkodzony sprzęt. Odrzucaj też ewidentne błędy cenowe (np. sprawna konsola za mniej niż 1000 zł to błąd/oferta archiwalna).

    Oferty do analizy:
    ${JSON.stringify(finalOffersToAnalyze, null, 2)}

    Zwróć wynik WYŁĄCZNIE jako czysty, poprawny format JSON (bez markdownu):
    {
      "main_product_name": "Precyzyjna nazwa produktu rynkowego",
      "estimated_market_value_pln": 1450,
      "analyzed_offers": [
        {"title": "Tytuł oferty", "price": 1600, "url": "url_oferty"}
      ],
      "rejected_offers": [
        {"title": "Tytuł odrzuconej oferty", "reason": "Powód odrzucenia"}
      ],
      "tips": "Krótka wskazówka"
    }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const aiResponseText = chatCompletion.choices[0]?.message?.content || "{}";
    const result = JSON.parse(aiResponseText);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Błąd handlera PL:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
