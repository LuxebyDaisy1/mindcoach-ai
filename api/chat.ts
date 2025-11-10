// api/chat.ts — SINGLE LANGUAGE MODE (final, compatible with new SDK)
// Fixed: uses "format" instead of deprecated response_format/json_format

import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { message, langMode } = (req.body ?? {}) as {
      message?: string;
      langMode?: "auto" | "en" | "es";
    };
    if (!message?.trim()) return res.status(400).json({ error: "Empty message" });

    // ---------- STEP 1: Detect language ----------
    let target = "en";
    if (langMode && langMode !== "auto") {
      target = langMode;
    } else {
      const detect = await client.responses.create({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content:
              "Return ONLY the ISO 639-1 language code for the text (en, es, fr, it, de, ar, zh, hi, etc). No explanation.",
          },
          { role: "user", content: message.slice(0, 400) },
        ],
        format: {
          type: "json_schema",
          json_schema: {
            name: "lang_code",
            schema: {
              type: "object",
              properties: { code: { type: "string", pattern: "^[a-z]{2}$" } },
              required: ["code"],
            },
          },
        },
      });

      const code =
        (detect as any).output?.[0]?.content?.[0]?.json?.code ??
        (detect as any).output_text?.trim().toLowerCase();

      target = typeof code === "string" && /^[a-z]{2}$/.test(code) ? code : "en";
    }

    // ---------- STEP 2: Generate single-language reply ----------
    const systemPrompt = `
You are MindCoach, a calm and supportive AI coach.
Reply ONLY in the detected language: ${target}.
Never include translations or other languages.
If user mixes languages, use the dominant one.
Keep it warm, empathetic, and concise (2–4 short paragraphs max).
`.trim();

    const reply = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      format: "text",
    });

    let text =
      (reply as any).output_text ??
      (reply as any).output?.[0]?.content?.[0]?.text ??
      "";

    // ---------- STEP 3: Verify and correct if wrong language ----------
    const verify = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "Return ONLY the ISO 639-1 code of the language used in the text. No other words.",
        },
        { role: "user", content: text.slice(0, 800) },
      ],
      format: {
        type: "json_schema",
        json_schema: {
          name: "lang_check",
          schema: {
            type: "object",
            properties: { code: { type: "string", pattern: "^[a-z]{2}$" } },
            required: ["code"],
          },
        },
      },
    });

    const outCode =
      (verify as any).output?.[0]?.content?.[0]?.json?.code ??
      (verify as any).output_text?.trim().toLowerCase();

    if (outCode !== target) {
      const rewrite = await client.responses.create({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content: `Rewrite the following strictly in ${target}. Remove any other languages.`,
          },
          { role: "user", content: text },
        ],
        format: "text",
      });

      text =
        (rewrite as any).output_text ??
        (rewrite as any).output?.[0]?.content?.[0]?.text ??
        text;
    }

    res.status(200).json({ text: (text || "…").trim() });
  } catch (err: any) {
    console.error("MindCoach error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}