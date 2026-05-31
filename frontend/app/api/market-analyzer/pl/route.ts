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

    // Jeśli szukamy PS5 lub pokrewnych, rozbijamy zapytanie na inteligentne słowa kluczowe
    if (cleanPhrase === "ps5" || cleanPhrase === "playstation 5" || cleanPhrase === "playstation5" || cleanPhrase === "konsola ps5") {
      supabaseQuery = supabaseQuery.or(
        "title.ilike.%ps5%," +
        "title.ilike.%playstation%," +
        "title.ilike.%play station%"
      );
    } else {
      // Dla każdego innego przedmiotu rozbijamy frazę po spacjach na wypadek innej kolejności słów
      const words = cleanPhrase.split(/\s+/).filter(w => w.length > 1);
      if (words.length > 1) {
        const orFilters = words.map(word => `title.ilike.%${word}%`).join(",");
        supabaseQuery = supabaseQuery.or(orFilters);
      } else {
        supabaseQuery = supabaseQuery.ilike("title", `%${phrase}%`);
      }
    }

    // Zwiększamy limit do 100, żeby wyciągnąć absolutnie wszystko z bazy
    const { data: offers, error: dbError } = await supabaseQuery.limit(100);

    if (dbError) throw dbError;

    if (!offers || offers.length === 0) {
      return NextResponse.json({
        error: `Nie znaleziono w bazie ofert dla frazy: "${phrase}"`,
      }, { status: 404 });
    }

    const prompt = `
    Jesteś profesjonalnym rzeczoznawcą wyceniającym sprzęt elektroniczny w e-commerce. 
    Przeanalizuj poniższą listę ogłoszeń (tytuł, cena, url) zebranych dla hasła: "${phrase}".

    Twoje kluczowe zadania:
    1. WYCENA URZĄDZENIA GŁÓWNEGO: Chcemy poznać średnią rynkową wartość SAMEJ KONSOLI / SAMEGO URZĄDZENIA.
    2. OBSŁUGA BOGATYCH ZESTAWÓW: Jeśli na liście jest oferta z konsolą i masą dodatków (pady, gry, akcesoria), absolutnie jej NIE odrzucaj! Dorzuć ją do listy "analyzed_offers". Jednak przy obliczaniu końcowej ceny rynkowej ("estimated_market_value_pln") odejmij w pamięci szacowaną wartość tych wielkich dodatków, tak aby ten jeden drogi zestaw nie zawyżył nienaturalnie ceny zwykłej konsoli.
    3. SELEKCJA SZUMU: Do sekcji "rejected_offers" odsyłaj TYLKO i WYŁĄCZNIE rzeczy, które NIE SĄ urządzeniem głównym (np. same gry, same stojaki, puste pudełka, kable, pady sprzedawane osobno lub sprzęt uszkodzony).

    Oferty do analizy:
    ${JSON.stringify(offers, null, 2)}

    Zwróć wynik WYŁĄCZNIE jako czysty, poprawny format JSON (bez markdownu):
    {
      "main_product_name": "Precyzyjna nazwa produktu (np. Sony PlayStation 5)",
      "estimated_market_value_pln": 1500,
      "analyzed_offers": [
        {"title": "Tytuł oferty", "price": 1650, "url": "url_oferty"}
      ],
      "rejected_offers": [
        {"title": "Tytuł odrzuconego szumu", "reason": "Sama gra / Akcesorium"}
      ],
      "tips": "Krótkie uzasadnienie ceny (np. uwzględniono korektę na zestawy z dodatkami)"
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
