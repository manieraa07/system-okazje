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

    // Zaawansowane szukanie wariacji (rozwiązuje problem małej liczby ofert)
    let queryFilter = `%${phrase}%`;
    if (phrase.toLowerCase() === "ps5" || phrase.toLowerCase() === "playstation 5") {
      // Jeśli szukasz PS5, złapmy wszystkie możliwe odmiany z bazy
      queryFilter = "%ps5%,%playstation 5%,%playstation5%";
    }

    let supabaseQuery = supabase.from("offers").select("title, price, url"); // Pobieramy też link url

    if (queryFilter.includes(",")) {
      const parts = queryFilter.split(",").map(p => `title.ilike.${p}`);
      supabaseQuery = supabaseQuery.or(parts.join(","));
    } else {
      supabaseQuery = supabaseQuery.ilike("title", queryFilter);
    }

    const { data: offers, error: dbError } = await supabaseQuery.limit(60);

    if (dbError) throw dbError;

    if (!offers || offers.length === 0) {
      return NextResponse.json({
        error: `Nie znaleziono w bazie ofert dla frazy: "${phrase}"`,
      }, { status: 404 });
    }

    const prompt = `
    Jesteś zaawansowanym rzeczoznawcą rynku e-commerce. Przeanalizuj listę ofert dla: "${phrase}".
    Twój cel: Wyznaczyć realną, bazową wartość rynkową SAMEGO URZĄDZENIA GŁÓWNEGO w standardowym zestawie (np. konsola + 1 pad).

    ZASADA SPRAWIEDLIWEJ WYCENY (BARDZO WAŻNE):
    Jeśli oferta to potężny zestaw (np. Konsola + PS Portal + Dysk 2TB + 2 Pady) i kosztuje dużo więcej, NIE odrzucaj jej. 
    Zamiast tego w pamięci ODEJMIJ wartość tych drogich dodatków, aby oszacować, ile z tej kwoty przypada na samą konsolę, i tę skorygowaną wartość weź pod uwagę przy wyliczaniu średniej rynkowej. Nie pozwól, aby bogate zestawy sztucznie zawyżyły końcową cenę bazową!

    SELEKCJA SZUMU: Odrzucaj wyłącznie akcesoria, same gry, puste pudełka lub sprzęt uszkodzony.

    Oferty do analizy:
    ${JSON.stringify(offers, null, 2)}

    Zwróć wynik WYŁĄCZNIE jako czysty format JSON (bez markdownu):
    {
      "main_product_name": "Precyzyjna nazwa wycenianego urządzenia rynkowego",
      "estimated_market_value_pln": 1400,
      "analyzed_offers": [
        {"title": "Tytuł oferty", "price": 1450, "url": "link_z_bazy_danych"}
      ],
      "rejected_offers": [
        {"title": "Tytuł odrzuconej oferty", "reason": "Powód odrzucenia"}
      ],
      "tips": "Krótka analiza dlaczego taka cena (np. uwzględniłem korektę na zestawy z portalami/dyskami)"
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
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
