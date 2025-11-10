// api/chat.ts — Vercel Serverless Function
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const { message, langMode } = (req.body ?? {}) as {
      message?: string;
      langMode?: "auto" | "en" | "es" | "both";
    };

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // --- Language behavior rules -------------------------------------------
    // Modes:
    //  - "auto": Detect user's language and reply ONLY in that language.
    //            If user explicitly asks for bilingual/translation or mixes languages,
    //            then (and only then) reply with ES+EN two-block format.
    //  - "en":   Force English only.
    //  - "es":   Force Spanish only.
    //  - "both": Always reply with TWO blocks: "## ES" then "## EN".
    let systemPrompt = `
You are MindCoach — a calm, clear, therapist-with-mindfulness tone.
Warm, supportive, concise, practical.

General rules:
- Keep responses readable (short paragraphs, bullets when helpful).
- Be encouraging, never clinical.
- If advice might be sensitive (mental/medical/financial/legal), give general guidance and encourage seeking a licensed professional when appropriate.
`.trim();

    if (langMode === "both") {
      systemPrompt += `
Language output mode: BILINGUAL (ES+EN)
- Always return TWO clearly separated blocks using Markdown:
  ## ES 🇪🇸
  <texto en español — 5–8 líneas máx., párrafos cortos>

  ## EN 🇺🇸
  <text in English — 5–8 lines max., short paragraphs>
- Both blocks must be semantically equivalent.
`.trim();
    } else if (langMode === "es") {
      systemPrompt += `
Language output mode: SPANISH ONLY
- Reply ONLY in Spanish.
- Do NOT include English unless the user explicitly asks for translation.
`.trim();
    } else if (langMode === "en") {
      systemPrompt += `
Language output mode: ENGLISH ONLY
- Reply ONLY in English.
- Do NOT include Spanish unless the user explicitly asks for translation.
`.trim();
    } else {
      // auto
      systemPrompt += `
Language output mode: AUTO
- Detect the user's language and reply ONLY in that language (support ANY language).
- Do NOT add English or Spanish if the user wrote in some other language.
- If (and only if) the user explicitly asks for bilingual/translation or mixes two languages in one message,
  then return TWO blocks exactly like the BILINGUAL mode above (## ES … then ## EN …).
`.trim();
    }

    const r = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message || "" }
      ]
    });

    const text =
      // new SDK helper
      (r as any).output_text ??
      // fallback path
      (r as any).output?.[0]?.content?.[0]?.text ??
      "No text.";

    res.status(200).json({ text });
  } catch (e: any) {
    console.error("chat error:", e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}