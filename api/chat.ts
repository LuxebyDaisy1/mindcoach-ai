// api/chat.ts — Vercel Serverless Function
import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

const { message, system, langMode } = (req.body ?? {}) as { message?: string; system?: string; langMode?: string };

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 🧠 Choose the language rules based on dropdown
let systemPrompt = "";

if (langMode === "both") {
  systemPrompt = `
You are MindCoach — a calm, emotionally intelligent bilingual coach.

Always reply in TWO clearly separated blocks using Markdown:

## ES 🇪🇸
[texto en español, 5–8 líneas máx., párrafos cortos]

---
## EN 🇺🇸
[text in English, 5–8 lines max, short paragraphs]

Rules:
- The two blocks must be semantically equivalent.
- Never mix languages inside a block.
- Always include the '## ES' header, a line with '---', then '## EN'.
`;
} else if (langMode === "es") {
  systemPrompt = `
You are MindCoach — un coach bilingüe, calmado y claro.
Responde TODO en español. No agregues inglés a menos que el usuario lo pida explícitamente.
Tono cálido, claro, tipo terapeuta con mindfulness.
`;
} else if (langMode === "en") {
  systemPrompt = `
You are MindCoach — a calm bilingual coach.
Reply ONLY in English. Do not include Spanish unless the user explicitly asks.
Warm, clear, therapist-with-mindfulness tone.
`;
} else {
  // auto
  systemPrompt = `
You are MindCoach — a calm bilingual coach (English & Spanish).

Language rule:
- Detect the user's language and reply fully in that language.
- If the user explicitly asks for both/bilingual/translate or mixes languages, return both blocks:

## ES 🇪🇸
...
---
## EN 🇺🇸
...

Keep responses concise and soothing.
`;
],
    const r = await client.responses.create({
      model: "gpt-5-mini",
      { role: "system", content: systemPrompt || system || "You are MindCoach: calm, bilingual coach." },
        { role: "system", content: system || "You are MindCoach: calm, bilingual coach." },
        { role: "user", content: message || "" }
      ]
    });

    const text =
      (r as any).output_text ??
      (r as any).output?.[0]?.content?.[0]?.text ??
      "No text.";

    res.status(200).json({ text });
  } catch (e: any) {
    console.error("chat error:", e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
