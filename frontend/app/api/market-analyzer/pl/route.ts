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

    // 1. Wyciągamy najtańsze oferty z bazy
    let supabaseQuery = supabase
      .from("offers")
      .select("title, price, url")
      .gt("price", 500) // Ignoruj uszkodzone i gry (poniżej 500zł)
      .order("price", { ascending: true });

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

    // Limit 60 ofert (Zmniejszony, aby oszczędzać tokeny i nie przekraczać limitów TPD)
    const { data: offers, error: dbError } = await supabaseQuery.limit(60);

    if (dbError) throw dbError;

    if (!offers || offers.length === 0) {
      return NextResponse.json({ error: "Brak ofert." }, { status: 404 });
    }

    // Filtrowanie generacji (odsiew PS4)
    const finalOffersToAnalyze = offers.filter((offer) => {
      if (!offer.title) return false;
      const t = offer.title.toLowerCase();
      if (cleanPhrase === "ps5" || cleanPhrase === "playstation 5") {
        return t.includes("5") || t.includes("ps5");
      }
      return true;
    });

    // Skrócony prompt zoptymalizowany pod lekki model i oszczędność tokenów
    const prompt = `
    Analyze product offers for: "${phrase}". Return JSON only.
    
    CRITICAL RULES:
    1. "analyzed_offers": MUST include any offer selling the main working console/device, EVEN if it is a bundle with games, extra controllers, or accessories. Titles like "Konsola PS5 PlayStation 5 PAD" or bundles with 15 games MUST be here. Estimate market value for the core device alone.
    2. "rejected_offers": ONLY pure noise (standalone games, single controllers, boxes, damaged items, or obvious price errors under 1000 PLN).

    Data: ${JSON.stringify(finalOffersToAnalyze)}

    Format:
    {
      "main_product_name": "Product Name",
      "estimated_market_value_pln": 1450,
      "analyzed_offers": [{"title": "Title", "price": 1600, "url": "url"}],
      "rejected_offers": [{"title": "Title", "reason": "Reason"}],
      "tips": "Brief comment"
    }
    `;

    // ZMIANA MODELU NA LLAMA-3.1-8B-INSTANT (Większy limit dzienny tokenów - 500K)
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
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
