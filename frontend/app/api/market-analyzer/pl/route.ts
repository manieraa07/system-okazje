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

    // 1. Uniwersalne rozbicie szukanej frazy na pojedyncze słowa kluczowe
    const searchWords = phrase
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((w: string) => w.length > 1);

    // Synonimy uniwersalne dla popularnych sprzętów
    if (searchWords.includes("ps5")) {
      searchWords.push("playstation");
    }

    // 2. Pobieramy dużą paczkę surowych danych (250 ofert)
    const { data: allOffers, error: dbError } = await supabase
      .from("offers")
      .select("title, price, url")
      .limit(250);

    if (dbError) throw dbError;

    if (!allOffers || allOffers.length === 0) {
      return NextResponse.json({ error: "Baza danych ofert jest pusta." }, { status: 404 });
    }

    // 3. Zaawansowane dopasowanie w JavaScript z jawnym typowaniem (word: string)
    const filteredOffers = allOffers.filter((offer) => {
      if (!offer.title) return false;
      const titleLower = offer.title.toLowerCase();
      
      // TypeScript Fix: Jawnie wskazujemy typ string dla parametru word
      return searchWords.some((word: string) => titleLower.includes(word));
    });

    if (filteredOffers.length === 0) {
      return NextResponse.json({
        error: `Nie znaleziono w bazie ofert pasujących do kryteriów: "${phrase}"`,
      }, { status: 404 });
    }

    // 4. Przekazujemy przefiltrowaną listę (maksymalnie 100 sztuk) do sztucznej inteligencji
    const finalOffersToAnalyze = filteredOffers.slice(0, 100);

    const prompt = `
    Jesteś rygorystycznym systemem wyceniającym i kategoryzującym oferty e-commerce. 
    Przeanalizuj listę ogłoszeń dla: "${phrase}".

    BEZWZGLĘDNE ZASADY ANALIZY:
    1. ODSYŁANIE DO "analyzed_offers" (URZĄDZENIA GŁÓWNE):
       - Masz obowiązek zaakceptować każde ogłoszenie, które sprzedaje działający przedmiot główny (np. konsola, odkurzacz, telefon), niezależnie od tego czy jest sprzedawany sam, czy w gigantycznym zestawie z dodatkami (np. z 15 grami, dodatkowymi padami, akcesoriami).
       - Jeśli cena zestawu jest wysoka, uwzględnij ofertę, ale w polu "estimated_market_value_pln" oblicz realną, skorygowaną cenę bazową samego urządzenia (odejmując w pamięci wartość dodatków).

    2. ODSYŁANIE DO "rejected_offers" (CZYSTY SZUM I BŁĘDY):
       - Odrzucaj oferty, które NIE są przedmiotem głównym (same gry, same akcesoria, pudełka, kable, części).
       - BARDZO WAŻNE: Odrzucaj oferty, które są oczywistym błędem skrapera, ogłoszeniami archiwalnymi, ofertami typu "KUPIĘ / ZAMIENIĘ" lub oszustwami (np. cena 850 zł za sprawną konsolę PS5, podczas gdy inne kosztują 1400+ zł, to oczywisty błąd/niedostępna oferta). Wpisz powód: "Oferta archiwalna / Podejrzanie niska cena".

    Oferty do analizy:
    ${JSON.stringify(finalOffersToAnalyze, null, 2)}

    Zwróć wynik WYŁĄCZNIE jako czysty, poprawny format JSON:
    {
      "main_product_name": "Precyzyjna nazwa produktu rynkowego",
      "estimated_market_value_pln": 1450,
      "analyzed_offers": [
        {"title": "Tytuł oferty", "price": 1600, "url": "url_oferty"}
      ],
      "rejected_offers": [
        {"title": "Tytuł odrzuconej oferty", "reason": "Powód odrzucenia (np. Sama gra / Oferta archiwalna / Podejrzana cena)"}
      ],
      "tips": "Krótkie podsumowanie analizy cenowej"
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
