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

    // 1. Budujemy zapytanie bezpośrednio filtrujące i SORTUJĄCE od najtańszych w bazie danych
    let supabaseQuery = supabase
      .from("offers")
      .select("title, price, url")
      .gt("price", 400) // Odrzucamy śmieci, ogłoszenia typu "zamienię" lub za darmo (poniżej 400 zł)
      .order("price", { ascending: true }); // KLUCZOWE: Najpierw sortujemy od absolutnie najniższej ceny w CAŁEJ bazie

    if (cleanPhrase === "ps5" || cleanPhrase === "playstation 5" || cleanPhrase === "playstation5" || cleanPhrase === "konsola ps5") {
      supabaseQuery = supabaseQuery.or(
        "title.ilike.%ps5%," +
        "title.ilike.%playstation%," +
        "title.ilike.%play station%"
      );
    } else {
      const words = cleanPhrase.split(/\s+/).filter((w: string) => w.length > 1);
      if (words.length > 0) {
        const orFilters = words.map((word: string) => `title.ilike.%${word}%`).join(",");
        supabaseQuery = supabaseQuery.or(orFilters);
      } else {
        supabaseQuery = supabaseQuery.ilike("title", `%${phrase}%`);
      }
    }

    // Pobieramy 150 ABSOLUTNIE NAJTAŃSZYCH ofert dostępnych w bazie danych
    const { data: offers, error: dbError } = await supabaseQuery.limit(150);

    if (dbError) throw dbError;

    if (!offers || offers.length === 0) {
      return NextResponse.json({
        error: `Nie znaleziono w bazie ofert dla frazy: "${phrase}"`,
      }, { status: 404 });
    }

    // 2. Dodatkowa weryfikacja w JS dla generacji konsol (odsiew PS4 przy szukaniu PS5)
    const finalOffersToAnalyze = offers.filter((offer) => {
      if (!offer.title) return false;
      const t = offer.title.toLowerCase();
      if (cleanPhrase === "ps5" || cleanPhrase === "playstation 5") {
        return t.includes("5") || t.includes("ps5");
      }
      return true;
    });

    const prompt = `
    Jesteś profesjonalnym rzeczoznawcą rynku e-commerce. Przeanalizuj listę ogłoszeń dla hasła: "${phrase}".
    Dostałeś listę posortowaną od NAJTAŃSZYCH ofert w bazie danych. Twoim celem jest wyznaczenie realnego dołu rynku.

    BEZWZGLĘDNE ZASADY PODZIAŁU:
    1. Do "analyzed_offers" MUSISZ wrzucić każdą ofertę, która zawiera sprawną, główną konsolę / urządzenie główne. 
       - Zestawy z 1 padem, 2 padami, grami, dodatkami (np. podstawki, słuchawki, dyski, a nawet PS Portal) MAJĄ TU ZOSTAĆ.
       - Tytuły typu "Konsola PS5 PlayStation Pad" czy "PS 5 DIGITAL / GWARANCJA / 15 Gier" ABSOLUTNIE mają być uznane za poprawne oferty konsoli i trafić do "analyzed_offers"!
       - W wycenie "estimated_market_value_pln" podaj średnią cenę bazową (jeśli zestawy są drogie, odejmij w pamięci wartość dodatków, aby nie zawyżać średniej).

    2. Do "rejected_offers" wrzucasz tylko czysty szum: same gry (np. FIFA 25), same akcesoria (pady kupowane osobno, stojaki), puste pudełka lub uszkodzony sprzęt. Odrzucaj też ewidentne błędy cenowe i ogłoszenia archiwalne (jeśli cena to np. 500 zł za sprawną konsolę, odrzuć z powodem "Oferta archiwalna / Błąd").

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
      "tips": "Krótka wskazówka o dole rynku"
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
