// api/chat.ts — STRICT SINGLE LANGUAGE VERSION (Updated for SDK changes)
// Fixed: replaced response_format → text_format and json_format

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

    // ------------ 1) DETECT LANGUAGE ------------
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
              "Return ONLY the ISO 639-1 language code for this text. Example: en, es, fr, it, de, ar, zh, hi. No punctuation or explanation.",
          },
          { role: "user", content: message.slice(0, 400) },
        ],
        json_format: {
          name: "lang_code",
          schema: {
            type: "object",
            properties: { code: { type: "string", pattern: "^[a-z]{2}$" } },
            required: ["code"],
          },
        },
      });

      const code =
        (detect as any).output?.[0]?.content?.[0]?.json?.code ??
        (detect as any).output_text?.trim().toLowerCase();

      target = typeof code === "string" && /^[a-z]{2}$/.test(code) ? code : "en";
    }

    // ------------ 2) GENERATE SINGLE-LANGUAGE REPLY ------------
    const systemPrompt = `
You are MindCoach, a gentle, supportive coach.
Reply ONLY in the detected language: ${target}.
Never include translations or English text if the user writes in another language.
Keep tone warm, empathetic, and concise (2–4 short paragraphs max).
`.trim();

    const first = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      text_format: "plain",
    });

    let text =
      (first as any).output_text ??
      (first as any).output?.[0]?.content?.[0]?.text ??
      "";

    // ------------ 3) VERIFY LANGUAGE OUTPUT ------------
    const verify = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "Return ONLY the ISO 639-1 code of the language used in this text. No extra words.",
        },
        { role: "user", content: text.slice(0, 800) },
      ],
      json_format: {
        name: "lang_check",
        schema: {
          type: "object",
          properties: { code: { type: "string", pattern: "^[a-z]{2}$" } },
          required: ["code"],
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
        text_format: "plain",
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