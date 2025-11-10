// api/chat.ts — MindCoach: strict SINGLE-language replies with detect + sanitize
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

// Heuristic sanitizer: keep only the requested language block if model tries to output ES/EN together.
function extractBlock(text: string, target: "es"|"en"): string | null {
  const t = text;

  // Try Markdown headers first: "## ES" / "## EN"
  const reES = /(^|\n)##\s*ES[^\n]*\n([\s\S]*?)(?=\n##\s*EN|\n##\s*[A-Z]{2}|$)/i;
  const reEN = /(^|\n)##\s*EN[^\n]*\n([\s\S]*?)(?=\n##\s*ES|\n##\s*[A-Z]{2}|$)/i;
  const mES = reES.exec(t);
  const mEN = reEN.exec(t);
  if (target === "es" && mES) return mES[2].trim();
  if (target === "en" && mEN) return mEN[2].trim();

  // Try emoji labels "🇪🇸" / "🇺🇸"
  const reESFlag = /(^|\n)🇪🇸[^\n]*\n([\s\S]*?)(?=\n🇺🇸|\n##|$)/i;
  const reENFlag = /(^|\n)🇺🇸[^\n]*\n([\s\S]*?)(?=\n🇪🇸|\n##|$)/i;
  const fES = reESFlag.exec(t);
  const fEN = reENFlag.exec(t);
  if (target === "es" && fES) return fES[2].trim();
  if (target === "en" && fEN) return fEN[2].trim();

  // Try common separator '---' when ES first then EN
  if (/---/.test(t)) {
    const parts = t.split(/\n-{3,}\n/);
    if (parts.length >= 2) {
      if (target === "es") return parts[0].trim();
      if (target === "en") return parts[1].trim();
    }
  }

  return null;
}

// Basic bilingual marker check
function looksBilingual(text: string): boolean {
  return /(^|\n)##\s*(ES|EN)\b/i.test(text) || /🇪🇸|🇺🇸/.test(text) || /---/.test(text);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { message, langMode } = (req.body ?? {}) as {
      message?: string;
      langMode?: "auto" | "en" | "es" | "both";
    };

    if (!message?.trim()) return res.status(400).json({ error: "Empty message" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Determine target language code
    let targetCode = "";
    if (langMode === "en" || langMode === "es") {
      targetCode = langMode;
    } else if (langMode === "auto") {
      // Robust detect: return ONLY ISO code
      const detect = await client.responses.create({
        model: "gpt-5-mini",
        input: [
          { role: "system", content: "You are a language detector. Return ONLY the ISO 639-1 language code of the user's message (like en, es, fr, it, de, pt, ar, zh). No extra words." },
          { role: "user", content: message.slice(0, 400) }
        ],
        response_format: { type: "text" }
      });

      const raw = (detect as any).output_text?.trim().toLowerCase() ?? "";
      const code = raw.replace(/[^a-z]/g, "");
      targetCode = LANGUAGE_NAMES[code] ? code : /[a-z]/i.test(message) ? "en" : "es"; // safe fallback
    } else if (langMode === "both") {
      targetCode = "both";
    } else {
      targetCode = "en";
    }

    // 2) Build strict system prompt
    let systemPrompt = `
You are MindCoach — a calm, supportive coach.
Keep answers practical, warm, and concise (short paragraphs).
`.trim();

    if (targetCode === "both") {
      systemPrompt += `
Language mode: BILINGUAL (ES + EN)
Return TWO clearly separated blocks, Spanish first then English.
Do NOT mix languages inside a block.
`.trim();
    } else {
      const name = LANGUAGE_NAMES[targetCode] ?? "English";
      systemPrompt += `
Language mode: SINGLE (${name} / code: ${targetCode})
Reply ONLY in ${name}. Do NOT include any other language unless the user explicitly requests translation or both.
`.trim();
    }

    // 3) Create first answer
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

    // 4) If not in 'both' mode, sanitize away bilingual formatting
    if (targetCode !== "both") {
      // If model tried to output ES/EN together
      if (looksBilingual(text)) {
        if (targetCode === "es" || targetCode === "en") {
          const only = extractBlock(text, targetCode);
          if (only) text = only;
        } else {
          // Target is some other language (fr/it/de/pt/etc.). Force rewrite to target only.
          const name = LANGUAGE_NAMES[targetCode] ?? "English";
          const rewrite = await client.responses.create({
            model: "gpt-5-mini",
            input: [
              { role: "system", content: `Rewrite the following advice entirely in ${name} (code: ${targetCode}). Remove all other languages and bilingual formatting. Keep it warm and concise.` },
              { role: "user", content: text }
            ],
            response_format: { type: "text" }
          });
          text =
            (rewrite as any).output_text ??
            (rewrite as any).output?.[0]?.content?.[0]?.text ??
            text;
        }
      }
    }

    res.status(200).json({ text });
  } catch (e: any) {
    console.error("chat error:", e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}