import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

// Bezpieczna inicjalizacja (zapobiega wywaleniu buildu na Vercelu przy braku zmiennych)
const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "placeholder-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "placeholder" });

export async function POST(req: Request) {
  try {
    const { phrase, targetRoi } = await req.json();

    if (!phrase) {
      return NextResponse.json({ error: "Suchbegriff ist erforderlich" }, { status: 400 });
    }

    const roiMultiplier = 1 - (targetRoi || 30) / 100;

    // Pobranie ostatnich 40 ogłoszeń dla rynku niemieckiego z bazy Supabase
    const { data: offers, error: dbError } = await supabase
      .from("offers_de")
      .select("title, price_eur")
      .ilike("title", `%${phrase}%`)
      .order("created_at", { ascending: false })
      .limit(40);

    if (dbError) throw dbError;

    if (!offers || offers.length === 0) {
      return NextResponse.json({
        error: `Es wurden keine Angebote für "${phrase}" in der Datenbank gefunden.`,
      }, { status: 404 });
    }

    const prompt = `
    Du bist ein Experte für E-Commerce-Marktanalysen. Analysiere die folgenden Angebote (Titel und Preis in EUR) für das Produkt: "${phrase}".
    Deine Aufgabe ist es, Rauschen (z. B. Zubehör, defekte Artikel, Boxen, andere Produkte) zu filtern und den tatsächlichen Marktwert des Hauptartikels zu berechnen.

    Angebote zur Analyse:
    ${JSON.stringify(offers, null, 2)}

    Gieb das Ergebnis AUSSCHLIESSLICH als gültiges JSON-Objekt zurück (kein Markdown, kein \`\`\`json), mit exakt diesen Feldern:
    {
      "main_product_name": "Präziser Name des analysierten Hauptprodukts",
      "estimated_market_value_eur": 350,
      "sample_size_evaluated": 12,
      "detected_noise": ["Angebotstitel 1 - Grund für Filterung", "Angebotstitel 2 - Grund"],
      "tips": "Kurzer Tipp für den Händler bezüglich dieses Produkts auf Deutsch"
    }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-8b-8192",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const aiResponseText = chatCompletion.choices[0]?.message?.content || "{}";
    const result = JSON.parse(aiResponseText);

    // Wyliczenie progu maksymalnego zakupu w Euro na podstawie marży użytkownika
    result.max_buy_price_eur = Math.round(result.estimated_market_value_eur * roiMultiplier);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Błąd handlera DE:", error);
    return NextResponse.json({ error: error.message || "Interner Serverfehler" }, { status: 500 });
  }
}
