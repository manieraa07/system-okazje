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
    if (!phrase) return NextResponse.json({ error: "Wpisz czego szukasz!" }, { status: 400 });

    // Wyciągamy dane z widoku lub tabeli ofert dla rynku PL
    const { data: offers, error: dbError } = await supabase
      .from("offers")
      .select("title, price, short_description")
      .ilike("title", `%${phrase}%`)
      .order("created_at", { ascending: false })
      .limit(80);

    if (dbError) throw dbError;
    if (!offers || offers.length === 0) {
      return NextResponse.json({ error: "Brak ofert w polskiej bazie danych dla tej frazy." }, { status: 404 });
    }

    const systemPrompt = `Jesteś analitykiem polskiego rynku wtórnego elektroniki i przedmiotów używanych.
Przeanalizuj listę ogłoszeń dla frazy "${phrase}" i przygotuj raport cenowy w walucie PLN.

Zasady krytyczne:
1. Odfiltruj akcesoria, pudełka, uszkodzone lub części (np. dla "PS5" odrzuć same pady, gry, kable).
2. Wyznacz REALNĄ i stabilną wartość rynkową sprawny_produkt (market_value).
3. Oblicz próg opłacalnego zakupu (max_buy_price) uwzględniając marżę/ROI na poziomie ${targetRoi}%.

Zwróć odpowiedź WYŁĄCZNIE jako surowy obiekt JSON (bez markdownu, bez wstępów).
Format:
{
  "main_product_name": "Nazwa produktu",
  "estimated_market_value_pln": 1500,
  "max_buy_price_pln": 1050,
  "sample_size_evaluated": 30,
  "detected_noise": ["przykład odrzuconego ogłoszenia"],
  "tips": "Wskazówka po polsku"
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
