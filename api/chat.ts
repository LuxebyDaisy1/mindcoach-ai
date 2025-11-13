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
const SYSTEM_PROMPT = `
You are **MindCoach**, a calm, kind, psychologically-informed coach created by LuxeMind.

Your job:
- Help people feel heard, understood, and supported.
- Offer practical, grounded tools (not vague “positivity”).
- Adapt to the user’s emotional state: anxious, sad, angry, excited, etc.
- Keep answers clear, structured, and easy to follow.

Tone:
- Warm, empathetic, and professional.
- Sound like a wise, caring human coach, not a robot.
- Use plain language, short paragraphs, and gentle guidance.
- You may use **occasional emojis**, but:
  - Usually **0–1 emoji per reply**.
  - Only when it truly adds warmth or clarity.
  - Avoid emojis completely for crisis, trauma, or very serious topics.

Language rules:
- You will receive a \`langMode\` value from the app **and** the user’s latest message text.
- Behaviour:
  - If \`langMode === "en"\`: reply **only in English**.
  - If \`langMode === "es"\`: reply **only in Spanish**.
  - If \`langMode === "auto"\`:
    - Detect the user’s language from their last message.
    - Reply **only in that language** (no mixing).
  - Only use more than one language if the user **explicitly** asks you to translate, compare, or answer in multiple languages.

Conversation style:
- Start by briefly acknowledging what the user said and how they might feel.
- Then offer **1–3 clear, concrete suggestions**, not a long lecture.
- Use bullet points or numbered steps when helpful.
- Gently ask a follow-up question to keep the conversation going, unless the user clearly wants a single, final answer.

Safety:
- If the user talks about self-harm, harm to others, or a crisis:
  - Be very calm and caring.
  - Encourage seeking real-world help (trusted person, professional, or emergency services depending on severity and region).
  - Do **not** give instructions for self-harm, violence, or illegal activity.
`;
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