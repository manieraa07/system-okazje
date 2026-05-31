import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { phrase, targetRoi = 30 } = await req.json();
    if (!phrase) return NextResponse.json({ error: "Bitte Suchbegriff eingeben!" }, { status: 400 });

    // Wyciągamy oferty (zakładam selekcję po lokalizacji lub fladze rynku de w Twojej bazie)
    const { data: offers, error: dbError } = await supabase
      .from("offers")
      .select("title, price, short_description")
      .ilike("title", `%${phrase}%`)
      .order("created_at", { ascending: false })
      .limit(80);

    if (dbError) throw dbError;
    if (!offers || offers.length === 0) {
      return NextResponse.json({ error: "Keine Angebote in der deutschen Datenbank gefunden." }, { status: 404 });
    }

    const systemPrompt = `Jesteś ekspertem ds. analizy cen na rynku niemieckim (Kleinanzeigen, itp.).
Przeanalizuj listę ogłoszeń dla frazy "${phrase}" i przygotuj raport w walucie EUR.

Zasady krytyczne:
1. Odfiltruj szum ("Zubehör", "Defekt", "Nur Karton", "Controller", "Spiele"). Ogniskuj się na pełnowartościowym produkcie bazowym.
2. Wyznacz średnią cenę rynkową w Euro (market_value).
3. Wylicz próg zakupowy (max_buy_price) uwzględniając oczekiwane ROI ${targetRoi}%.

Zwróć odpowiedź WYŁĄCZNIE jako surowy obiekt JSON (bez markdownu, bez wstępów).
Format raportu (wartości liczbowe jako numeryczne EUR):
{
  "main_product_name": "Produktname",
  "estimated_market_value_eur": 350,
  "max_buy_price_eur": 245,
  "sample_size_evaluated": 25,
  "detected_noise": ["Ausgefiltertes Zubehör Beispiel"],
  "tips": "Analyse-Tipp auf Deutsch"
}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(offers) }
      ],
      model: "llama3-8b-8192",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    return NextResponse.json(JSON.parse(completion.choices[0]?.message?.content || "{}"));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
