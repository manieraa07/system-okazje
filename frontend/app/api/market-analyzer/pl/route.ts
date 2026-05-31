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
    let supabaseQuery = supabase.from("offers").select("title, price, url");

    if (cleanPhrase === "ps5" || cleanPhrase === "playstation 5" || cleanPhrase === "playstation5" || cleanPhrase === "konsola ps5") {
      supabaseQuery = supabaseQuery.or(
        "title.ilike.%ps5%," +
        "title.ilike.%playstation%," +
        "title.ilike.%play station%"
      );
    } else {
      const words = cleanPhrase.split(/\s+/).filter((w: string) => w.length > 1);
      if (words.length > 1) {
        const orFilters = words.map((word: string) => `title.ilike.%${word}%`).join(",");
        supabaseQuery = supabaseQuery.or(orFilters);
      } else {
        supabaseQuery = supabaseQuery.ilike("title", `%${phrase}%`);
      }
    }

    // Zwiększamy limit do 120 ofert, żeby mieć pełen obraz z bazy danych
    const { data: offers, error: dbError } = await supabaseQuery.limit(120);

    if (dbError) throw dbError;

    if (!offers || offers.length === 0) {
      return NextResponse.json({
        error: `Nie znaleziono w bazie ofert dla frazy: "${phrase}"`,
      }, { status: 404 });
    }

    const prompt = `
    Jesteś rygorystycznym systemem wyceniającym i kategoryzującym oferty e-commerce. 
    Przeanalizuj listę ogłoszeń dla: "${phrase}".

    BEZWZGLĘDNE ZASADY KATEGORYZACJI (ZAKAZ SAMOWOLKI AI):

    1. CO MUSISZ ZAAKCEPTOWAĆ (w "analyzed_offers"):
       - Każde ogłoszenie, które zawiera w tytule fizyczną konsolę (np. PS5, PlayStation 5, Digital, Slim), NAWET jeśli w zestawie jest 5, 10 czy 15 gier, dodatkowe pady, słuchawki, podstawki czy gwarancja. 
       - Przykład: "PS 5 DIGITAL / GWARANCJA / 15 Gier" -> MA BYĆ W "analyzed_offers".
       - Jeśli cena takiego dużego zestawu jest wysoka, weź ją do analizy, ale w polu "estimated_market_value_pln" oblicz wartość czystej konsoli (odejmując w pamięci rynkową wartość tych gier/akcesoriów).

    2. CO MOŻESZ ODRZUCIĆ (w "rejected_offers"):
       - TYLKO oferty, które NIE ZAWIERAJĄ konsoli. Czyli: same gry (np. "Wiedźmin 3 PS5"), same pady, same kable, uszkodzone konsole (na części), puste pudełka, usługi naprawy.

    Jeżeli w tytule jest sprawna konsola + masa dodatków, masz OBOWIĄZEK dodać ją do "analyzed_offers".

    Oferty do analizy:
    ${JSON.stringify(offers, null, 2)}

    Zwróć wynik WYŁĄCZNIE jako czysty, poprawny format JSON:
    {
      "main_product_name": "Precyzyjna nazwa produktu (np. Sony PlayStation 5 Digital)",
      "estimated_market_value_pln": 1450,
      "analyzed_offers": [
        {"title": "Tytuł oferty (tutaj lądują też zestawy z grami)", "price": 1600, "url": "url_oferty"}
      ],
      "rejected_offers": [
        {"title": "Tytuł odrzucenia (np. Pad PS5 DualSense)", "reason": "Sprzedaż samego akcesorium"}
      ],
      "tips": "Krótkie uzasadnienie (np. Uwzględniono zestawy z grami, korygując ich wpływ na cenę bazową)"
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
