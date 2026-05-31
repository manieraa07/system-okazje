import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

// Inicjalizacja Supabase przy użyciu Twoich zmiennych środowiskowych
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // upewnij się, że nazwa pasuje do Twojego .env
);

// Inicjalizacja Groq z Twojego GitHub Secrets / Vercel Env
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { phrase, targetRoi = 30 } = await req.json();
    if (!phrase) return NextResponse.json({ error: "Wpisz czego szukasz!" }, { status: 400 });

    // 1. Wyciągamy z bazy do 80 ogłoszeń pasujących do wpisanej frazy
    // Zakładam, że Twoja tabela nazywa się 'scraped_offers' (dopasuj nazwę jeśli jest inna)
    const { data: offers, error: dbError } = await supabase
      .from("scraped_offers")
      .select("title, price, description, platform")
      .ilike("title", `%${phrase}%`)
      .order("created_at", { ascending: false })
      .limit(80);

    if (dbError) throw dbError;
    if (!offers || offers.length === 0) {
      return NextResponse.json({ error: "Brak ofert w bazie danych dla tego przedmiotu." }, { status: 404 });
    }

    // 2. Budujemy prompt, który zmusi Llamę do odrzucenia padów/akcesoriów i zrobienia matematyki
    const systemPrompt = `Jesteś zaawansowanym algorytmem analizy statystycznej rynków wtórnych.
Przeanalizuj listę surowych ogłoszeń znalezionych dla frazy "${phrase}" i stwórz raport cenowy.

MUSISZ BEZWZGLĘDNIE:
1. Rozdzielić akcesoria/części/uszkodzone od GŁÓWNEGO pełnowartościowego produktu (np. jeśli fraza to "PS5", odseparuj pady i gry od konsol).
2. Wyliczyć REALNĄ średnią wartość rynkową (market_value) dla głównego produktu, ignorując skrajne anomalie cenowe.
3. Obliczyć sugerowaną maksymalną cenę zakupu (max_buy_price) na podstawie oczekiwanego ROI sprzedawcy wynoszącego ${targetRoi}%.

Zwróć odpowiedź TYLKO I WYŁĄCZNIE jako czysty obiekt JSON. Nie pisz żadnych wstępów, markdownu ani komentarzy.
Format wyjściowy JSON:
{
  "main_product_name": "Oczyszczona nazwa głównego produktu (np. 'PlayStation 5 Slim 1TB')",
  "estimated_market_value_pln": 1600, 
  "max_buy_price_pln": 1120, 
  "sample_size_evaluated": 45,
  "detected_noise": ["lista 2-3 wykrytych tytułów ogłoszeń, które były tylko akcesoriami i zostały odrzucone z wyceny"],
  "tips": "Krótka wskazówka na co uważać przy wycenie tego modelu"
}`;

    // 3. Strzał do Groq API (używamy szybkiego i darmowego modelu llama3-8b)
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Oto surowe dane z bazy:\n${JSON.stringify(offers, null, 2)}` }
      ],
      model: "llama3-8b-8192",
      temperature: 0.1, // Niska temperatura, żeby model nie zmyślał liczb
      response_format: { type: "json_object" } // Wymuszenie formatu JSON na poziomie Groqa
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    if (!responseContent) throw new Error("Groq zwrócił pustą odpowiedź");

    return NextResponse.json(JSON.parse(responseContent));

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
