import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { message, langMode } = (req.body ?? {}) as { message?: string; langMode?: string };
    if (!message) return res.status(400).json({ error: "Empty message" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1️⃣ detect language (short message, force ISO code)
    let targetLang = "en";
    if (langMode === "en" || langMode === "es" || langMode === "both") {
      targetLang = langMode;
    } else {
      const detect = await client.responses.create({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content:
              "Return ONLY the ISO 639-1 code (like en, es, fr, it, de, pt, ar, zh) for the language of the user's message. No text, no explanation.",
          },
          { role: "user", content: message },
        ],
        response_format: { type: "text" },
      });

      const code = (detect as any).output_text?.trim().toLowerCase().replace(/[^a-z]/g, "");
      targetLang = code && code.length === 2 ? code : "en";
    }

    // 2️⃣ prepare system instruction
    let systemPrompt = "";
    if (targetLang === "both") {
      systemPrompt = `
You are MindCoach, a bilingual coach.
Always reply with two blocks:
## 🇪🇸 Español
<es version>

## 🇺🇸 English
<en version>
Do not include any other language.
      `.trim();
    } else if (targetLang === "es") {
      systemPrompt = "Eres MindCoach. Responde SOLO en español, sin traducir al inglés.";
    } else if (targetLang === "en") {
      systemPrompt = "You are MindCoach. Reply ONLY in English, never translate.";
    } else {
      systemPrompt = `You are MindCoach. Reply ONLY in ${targetLang} language. Do not include English, Spanish, or any translation.`;
    }

    // 3️⃣ final call with forced language
    const answer = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      response_format: { type: "text" },
    });

    const text =
      (answer as any).output_text ||
      (answer as any).output?.[0]?.content?.[0]?.text ||
      "No response.";

    res.status(200).json({ text });
  } catch (err: any) {
    console.error("chat.ts error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}