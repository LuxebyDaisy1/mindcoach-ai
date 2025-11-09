// /api/chat.ts — Vercel Serverless Function
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

    const { message, langMode } = (await req.json?.()) || req.body || {};
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build language rules
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
- Always add the '## ES' header, a line with '---', then '## EN'.
- Keep responses concise and soothing.
      `.trim();
    } else if (langMode === "es") {
      systemPrompt = `
Eres MindCoach — un coach bilingüe, calmado y claro.
Responde SIEMPRE solo en español. No mezcles inglés salvo que el usuario lo pida explícitamente.
Usa un tono cálido, claro y terapéutico con atención plena. Párrafos breves.
      `.trim();
    } else if (langMode === "en") {
      systemPrompt = `
You are MindCoach — a calm, bilingual coach.
Reply ONLY in English. Do not include Spanish unless the user explicitly asks.
Warm, clear, therapist-with-mindfulness tone. Short paragraphs.
      `.trim();
    } else {
      // auto
      systemPrompt = `
You are MindCoach — a calm, multilingual coach.
Language rule:
- Detect the user's language from the latest message and reply fully in that language.
- Do NOT include translations or a second language unless the user explicitly asks
  for "both", "translate", or mixes languages in the request.
Keep responses concise (5–8 lines), with short paragraphs.
      `.trim();
    }

    const r = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message || "" }
      ],
    });

    const text =
      // SDK convenience
      (r as any).output_text ??
      // fallback path
      (r as any).output?.[0]?.content?.[0]?.text ??
      "No text.";

    return res.status(200).json({ text });
  } catch (e: any) {
    console.error("chat error:", e);
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}