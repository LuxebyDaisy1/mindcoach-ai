// api/chat.ts — final stable version (single language replies)
// Works with current Vercel + OpenAI SDK (no 'format' or 'json_format')

import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing API key" });

    const { message, langMode } = req.body ?? {};
    if (!message?.trim()) return res.status(400).json({ error: "Empty message" });

    // ---------- STEP 1: Detect language ----------
    let target = "en";
    if (langMode && langMode !== "auto") {
      target = langMode;
    } else {
      const detect = await client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "Detect the language of this text and return only its ISO 639-1 two-letter code (en, es, fr, it, de, ar, zh, etc). No explanation.",
          },
          { role: "user", content: message.slice(0, 300) },
        ],
      });

      const detected = (detect as any).output_text?.trim().toLowerCase() || "en";
      if (/^[a-z]{2}$/.test(detected)) target = detected;
    }

    // ---------- STEP 2: Generate single-language reply ----------
    const systemPrompt = `
You are MindCoach, a calm and supportive bilingual AI coach.
Reply ONLY in the detected language: ${target}.
Do not include translations or any other languages.
If the message mixes languages, reply entirely in the dominant one.
Keep tone warm, empathetic, and concise (2–4 short paragraphs max).
`.trim();

    const reply = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    let text = (reply as any).output_text?.trim() || "";

    // ---------- STEP 3: Verify that reply matches target ----------
    const verify = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Return only the ISO 639-1 language code used in this text. No other words.",
        },
        { role: "user", content: text.slice(0, 500) },
      ],
    });

    const verifyCode = (verify as any).output_text?.trim().toLowerCase() || "";
    if (verifyCode !== target && /^[a-z]{2}$/.test(verifyCode)) {
      const rewrite = await client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: `Rewrite the following strictly in ${target}. Remove all other languages.`,
          },
          { role: "user", content: text },
        ],
      });
      text = (rewrite as any).output_text?.trim() || text;
    }

    res.status(200).json({ text });
  } catch (err: any) {
    console.error("MindCoach error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}