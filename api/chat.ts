// /api/chat.ts — Vercel Serverless Function
import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { message, langMode } = (req.body ?? {}) as {
      message?: string;
      langMode?: "auto" | "es" | "en" | "both";
    };

    if (!message?.trim()) return res.status(400).json({ error: "Empty message" });

    // Build bilingual system prompt
    let systemPrompt = "";
    if (langMode === "both") {
      systemPrompt = `
You are MindCoach — a calm, emotionally intelligent bilingual coach.
Always reply in TWO clearly separated blocks using Markdown:

## ES 🇪🇸
[texto en español, 5–8 líneas máx, párrafos cortos]

---
## EN 🇺🇸
[text in English, 5–8 lines max, short paragraphs]

Rules:
• Both blocks must be semantically equivalent.
• Never mix languages inside a block.
• Keep responses concise and soothing.`.trim();
    } else if (langMode === "es") {
      systemPrompt = `
Eres MindCoach — un coach bilingüe, calmado y claro.
Responde TODO en español. No agregues inglés a menos que el usuario lo pida.
Tono cálido, claro, tipo mindfulness. 5–8 líneas máx, párrafos cortos.`.trim();
    } else if (langMode === "en") {
      systemPrompt = `
You are MindCoach — a calm bilingual coach.
Reply ONLY in English unless the user explicitly asks Spanish.
Warm, clear, therapist-with-mindfulness tone. 5–8 lines max, short paragraphs.`.trim();
    } else {
      // auto: detect user's language; if user asks for bilingual/translate/mixes → return both blocks
      systemPrompt = `
You are MindCoach — a calm bilingual coach (English & Spanish).
Language rule:
• Detect the user's language and reply fully in that language.
• If the user explicitly asks for both/bilingual/translate or mixes languages, return both blocks:

## ES 🇪🇸
---
## EN 🇺🇸
---
Keep responses concise and soothing.`.trim();
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const r = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ]
    });

    // Robust text extraction for the Responses API
    const text =
      // @ts-ignore
      r.output_text ??
      // @ts-ignore
      r.output?.[0]?.content?.[0]?.text ??
      "No text.";

    return res.status(200).json({ text });
  } catch (e: any) {
    console.error("chat error:", e);
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}