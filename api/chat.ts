// api/chat.ts — MindCoach: STRICT single-language replies (auto-detect + sanitizer)
// No bilingual mode at all.

import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const LANGUAGE_NAMES: Record<string, string> = {
  af:"Afrikaans", ar:"Arabic", bg:"Bulgarian", bn:"Bengali",
  ca:"Catalan", cs:"Czech", da:"Danish", de:"German",
  el:"Greek", en:"English", es:"Spanish", et:"Estonian",
  fa:"Persian", fi:"Finnish", fr:"French", he:"Hebrew",
  hi:"Hindi", hr:"Croatian", hu:"Hungarian", id:"Indonesian",
  it:"Italian", ja:"Japanese", ko:"Korean", lt:"Lithuanian",
  lv:"Latvian", ms:"Malay", nl:"Dutch", no:"Norwegian",
  pl:"Polish", pt:"Portuguese", ro:"Romanian", ru:"Russian",
  sk:"Slovak", sl:"Slovenian", sr:"Serbian", sv:"Swedish",
  th:"Thai", tr:"Turkish", uk:"Ukrainian", ur:"Urdu",
  vi:"Vietnamese", zh:"Chinese"
};

// quick heuristic to catch obvious bilingual outputs
function containsEnglish(text: string) {
  return /\b(the|and|you|to|for|with|of|in|is|are|be|can|will|your)\b/i.test(text);
}
function containsSpanish(text: string) {
  return /\b(el|la|los|las|y|de|en|es|eres|estás|para|con|tu|sus|una|un)\b/i.test(text) ||
         /[¿¡ñáéíóúü]/i.test(text);
}

// If target isn't English/Spanish, strip common "## ES/EN" or flag headers
function stripBilingualMarkers(text: string): string {
  // remove markdown language headers and separators if present
  return text
    .replace(/(^|\n)##\s*(ES|EN)[^\n]*\n/gi, "\n")
    .replace(/(^|\n)🇪🇸[^\n]*\n/gi, "\n")
    .replace(/(^|\n)🇺🇸[^\n]*\n/gi, "\n")
    .replace(/\n-{3,}\n/g, "\n")
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { message, langMode } = (req.body ?? {}) as {
      message?: string;
      langMode?: "auto" | "en" | "es"; // ⬅ removed "both"
    };
    if (!message?.trim()) return res.status(400).json({ error: "Empty message" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Decide target language
    let target = "en"; // default
    if (langMode === "en" || langMode === "es") {
      target = langMode;
    } else {
      // auto-detect — return ONLY ISO code
      const detect = await client.responses.create({
        model: "gpt-5-mini",
        input: [
          { role: "system", content: "Return ONLY the ISO 639-1 language code (ex: en, es, fr, it, de, pt, ar, zh). No extra words." },
          { role: "user", content: message.slice(0, 400) }
        ],
        response_format: { type: "text" }
      });
      const raw = (detect as any).output_text?.trim().toLowerCase() ?? "";
      const code = raw.replace(/[^a-z]/g, "");
      target = LANGUAGE_NAMES[code] ? code : "en";
    }
    const targetName = LANGUAGE_NAMES[target] ?? "English";

    // 2) Strict single-language system prompt
    const systemPrompt = `
You are MindCoach — a calm, supportive coach.
Reply ONLY in ${targetName} (code: ${target}).
Do NOT include any translation, any second language, or any bilingual sections.
Use short paragraphs (5–8 lines max). Warm, encouraging tone.
`.trim();

    // 3) Generate answer
    const first = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      response_format: { type: "text" }
    });

    let text =
      (first as any).output_text ??
      (first as any).output?.[0]?.content?.[0]?.text ??
      "No response.";

    // 4) Sanitize: if target is not 'en' and the text looks English, or not 'es' and looks Spanish, rewrite.
    // Also remove common bilingual headers if any slipped in.
    text = stripBilingualMarkers(text);

    const needsRewrite =
      (target !== "en" && containsEnglish(text)) ||
      (target !== "es" && containsSpanish(text));

    if (needsRewrite) {
      const rewrite = await client.responses.create({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content: `Rewrite the following content entirely in ${targetName} (code: ${target}). Remove any other language or translation. Keep it warm and concise.`
          },
          { role: "user", content: text }
        ],
        response_format: { type: "text" }
      });
      text =
        (rewrite as any).output_text ??
        (rewrite as any).output?.[0]?.content?.[0]?.text ??
        text;
    }

    res.status(200).json({ text: text.trim() });
  } catch (e: any) {
    console.error("chat error:", e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}