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
    Jesteś ekspertem analizy rynku e-commerce. Przeanalizuj poniższe oferty (tytuł i cena) dla przedmiotu: "${phrase}".
    Twoim zadaniem jest odrzucenie szumu (np. akcesoria, uszkodzone, pudełka, inne przedmioty) i kalkulacja realnej wartości rynkowej głównego przedmiotu.

    Oferty do analizy:
    ${JSON.stringify(offers, null, 2)}

    Zwróć wynik WYŁĄCZNIE jako czysty format JSON (bez markdownu, bez \`\`\`json), posiadający dokładnie te pola:
    {
      "main_product_name": "Precyzyjna nazwa analizowanego produktu głównego",
      "estimated_market_value_pln": 1250, 
      "sample_size_evaluated": 15,
      "detected_noise": ["Tytuł oferty 1 - powód odrzucenia", "Tytuł oferty 2 - powód"],
      "tips": "Krótka wskazówka dla tradera dotycząca tego produktu"
    }
    `;

    // STABILNY MODEL ZAKOTWICZONY NA STAŁE W GROQ
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
