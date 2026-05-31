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

    const { data: offers, error: dbError } = await supabase
      .from("offers")
      .select("title, price")
      .ilike("title", `%${phrase}%`)
      .limit(40);

    if (dbError) throw dbError;

    if (!offers || offers.length === 0) {
      return NextResponse.json({
        error: `Nie znaleziono w bazie żadnych ofert pasujących do frazy: "${phrase}"`,
      }, { status: 404 });
    }

    const prompt = `
    Jesteś ekspertowym systemem analizy cen e-commerce. Przeanalizuj listę ogłoszeń dla hasła: "${phrase}".
    Twój cel: Wyliczyć realną wartość rynkową sprawnych, głównych przedmiotów.

    ZASADY SELEKCJI:
    1. AKCEPTUJ i bierz do kalkulacji: Główne przedmioty (np. całe konsole, odkurzacze), również jeśli są w zestawie z grami, dodatkowymi padami czy akcesoriami! Zestawy podnoszą lub stabilizują wartość, nie odrzucaj ich, jeśli zawierają sprawny główny produkt.
    2. ODRZUCAJ (jako szum): Same akcesoria (stojaki, kable), same gry (np. "Fifa 23 ps5"), puste pudełka, usługi naprawy/wymiany, przedmioty uszkodzone/na części.

    Oferty do analizy:
    ${JSON.stringify(offers, null, 2)}

    Zwróć wynik WYŁĄCZNIE jako czysty format JSON (bez markdownu, bez \`\`\`json), posiadający dokładnie taką strukturę:
    {
      "main_product_name": "Precyzyjna nazwa produktu (np. Sony PlayStation 5)",
      "estimated_market_value_pln": 1650,
      "analyzed_offers": [
        {"title": "Tytuł oferty włączonej do analizy", "price": 1600}
      ],
      "rejected_offers": [
        {"title": "Tytuł oferty odrzuconej jako szum", "reason": "Powód odrzucenia (np. sama gra / uszkodzone)"}
      ],
      "tips": "Krótka wskazówka dotycząca cen tego produktu"
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
    return NextResponse.json({ error: error.message || "Błąd wewnętrzny serwera" }, { status: 500 });
  }
}
