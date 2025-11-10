// api/chat.ts — STRICT SINGLE-LANGUAGE ENFORCEMENT
// Detects user's language and replies ONLY in that language.
// If the model mixes languages, we auto-rewrite to the target language.

import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { message, langMode } = (req.body ?? {}) as {
      message?: string;
      langMode?: "auto" | "en" | "es";
    };
    if (!message?.trim()) return res.status(400).json({ error: "Empty message" });

    // ------------ 1) DETECT LANGUAGE (JSON schema, code only) ------------
    let target = "en";
    if (langMode && langMode !== "auto") {
      target = langMode; // manual override (en|es)
    } else {
      const detect = await client.responses.create({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content:
              "Return ONLY the ISO 639-1 language code for the user's message. Example: en, es, fr, it, de, ar, zh, hi. No prose, no punctuation.",
          },
          { role: "user", content: message.slice(0, 400) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "lang_code",
            schema: {
              type: "object",
              properties: { code: { type: "string", pattern: "^[a-z]{2}$" } },
              required: ["code"],
              additionalProperties: false,
            },
          },
        },
      });

      const code =
        (detect as any).output?.[0]?.content?.[0]?.json?.code ??
        (detect as any).output_text?.trim().toLowerCase();

      target = typeof code === "string" && /^[a-z]{2}$/.test(code) ? code : "en";
    }

    // ------------ 2) GENERATE (forbid bilingual, keep brief) ------------
    const system = `
You are MindCoach, a calm, supportive coach.
Reply ONLY in the language with ISO code "${target}".
- Do NOT include translations, duplicates, or any other language.
- If user mixes languages, choose the predominant one and reply ONLY in "${target}".
- Keep it warm and concise (2–4 short paragraphs max).`.trim();

    const first = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
      response_format: { type: "text" },
    });

    let text =
      (first as any).output_text ??
      (first as any).output?.[0]?.content?.[0]?.text ??
      "";

    // ------------ 3) VERIFY OUTPUT LANGUAGE ------------
    const verify = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "Read the user's text and return ONLY the ISO 639-1 language code of the text. No prose.",
        },
        { role: "user", content: text.slice(0, 800) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lang_code",
          schema: {
            type: "object",
            properties: { code: { type: "string", pattern: "^[a-z]{2}$" } },
            required: ["code"],
            additionalProperties: false,
          },
        },
      },
    });

    const outCode =
      (verify as any).output?.[0]?.content?.[0]?.json?.code ??
      (verify as any).output_text?.trim().toLowerCase();

    const mismatch = !(typeof outCode === "string" && outCode === target);

    // ------------ 4) If mismatch or bilingual, REWRITE strictly ------------
    const looksMixed =
      /(?:\bhello\b|\bhola\b|\bbonjour\b|\bciao\b|\bこんにちは\b|\b안녕\b|\bمرحبا\b)/i.test(text) &&
      /[a-z]/i.test(text);

    if (!text || mismatch || looksMixed) {
      const rewrite = await client.responses.create({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content: `Rewrite the following so it is 100% in "${target}" only. Remove any other language. Output ONLY the final text.`,
          },
          { role: "user", content: text || message },
        ],
        response_format: { type: "text" },
      });

      text =
        (rewrite as any).output_text ??
        (rewrite as any).output?.[0]?.content?.[0]?.text ??
        text;
    }

    res.status(200).json({ text: (text || "…").trim() });
  } catch (e: any) {
    console.error("MindCoach error:", e);
    res.status(500).json({ error: e.message || "Unknown error" });
  }
}