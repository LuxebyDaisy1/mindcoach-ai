// /api/chat.ts — MindCoach API with strict language logic
import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const { message, langMode } = req.body || {};
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // --- Tiny language detector for Auto mode ---
    function detectLang(text: string): string {
      const t = text.toLowerCase();
      if (/[¿¡ñáéíóúü]/i.test(t)) return "es";
      if (/[àâçéèêëîïôùûüÿœæ]|(merci|bonjour|s'il|ça|oui|non)/i.test(t)) return "fr";
      if (/(grazie|ciao|per favore|come stai|si|no)/i.test(t)) return "it";
      if (/(obrigado|olá|por favor|tudo bem|sim|não)/i.test(t)) return "pt";
      if (/(danke|hallo|bitte|wie geht|ja|nein)/i.test(t)) return "de";
      if (/(thanks|hello|hi|please|how are you|yes|no)/i.test(t)) return "en";
      return "auto";
    }

    const autoDetected =
      langMode === "auto" ? detectLang(message || "") : langMode;

    // ----- Language rules (strict) -----
    let systemPrompt = "";

    if (langMode === "both") {
      systemPrompt = `
You are MindCoach — a calm, emotionally intelligent coach.

Always reply in TWO clearly separated blocks using Markdown:

## ES 🇪🇸
[texto en español, 5–8 líneas máx., párrafos cortos]

---
## EN 🇺🇸
[text in English, 5–8 lines max., short paragraphs]

Rules:
- The two blocks must be semantically equivalent.
- Do NOT mix languages inside a block.
- Always add '## ES', then '---', then '## EN'.
- Keep responses concise, warm, and soothing.
`.trim();
    } else if (langMode === "es") {
      systemPrompt = `
Eres MindCoach — un coach sereno y claro.
Responde SOLAMENTE en español. No incluyas inglés bajo ninguna circunstancia,
a menos que el usuario lo pida explícitamente.
Tono cálido, claro y breve (5–8 líneas, párrafos cortos).
`.trim();
    } else if (langMode === "en") {
      systemPrompt = `
You are MindCoach — calm and clear.
Reply ONLY in English. Do not include Spanish or any other language
unless explicitly requested by the user.
Warm, concise tone (5–8 lines, short paragraphs).
`.trim();
    } else {
      systemPrompt = `
You are MindCoach — calm, multilingual, and emotionally intelligent.

LANGUAGE RULE (strict):
- Detect the user's language from the latest message and reply ONLY in that language.
- If the user writes in French → reply only in French.
- If Italian → only Italian.
- If Portuguese → only Portuguese.
- If German → only German.
- If English → only English.
- Do NOT add translations or bilingual text unless user asks for "both" or "translate".

Style:
- Warm, supportive, natural flow (5–8 short lines).
`.trim();
    }

    // ----- Model call -----
    const r = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },

        ...(langMode === "auto"
          ? [
              {
                role: "system",
                content:
                  autoDetected === "auto"
                    ? "AUTO MODE: Detect the user's language and reply ONLY in that language. Never mix or translate."
                    : `AUTO MODE: Detected language = ${autoDetected}. Reply ONLY in ${autoDetected}.`,
              },
            ]
          : []),

        { role: "user", content: message || "" },
      ],
    });

    const text =
      (r as any).output_text ??
      (r as any).output?.[0]?.content?.[0]?.text ??
      "No response.";

    return res.status(200).json({ text });
  } catch (e: any) {
    console.error("chat error:", e);
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}