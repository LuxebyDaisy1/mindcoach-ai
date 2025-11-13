// api/chat.ts — final stable version (single-language replies)
// Works with current Vercel + OpenAI SDK (no "format" or "json_format")

import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    // Allow only POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    // Get body
    const { message, langMode } = (req.body as any) ?? {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Empty message" });
    }

    // ---------------- STEP 1: Decide target language ----------------
    let target = "en"; // default

    if (langMode && langMode !== "auto") {
      // Explicit language from front-end ("en", "es", "fr", etc.)
      target = String(langMode).toLowerCase();
    } else {
      // Auto-detect language from user's text
      const detect = await client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "Detect the language of this text and return only its ISO 639-1 two-letter code (en, es, fr, pt, etc.). No other words.",
          },
          {
            role: "user",
            content: message.slice(0, 300),
          },
        ],
      });

      const detected = ((detect as any).output_text ?? "").trim().toLowerCase();

      if (/^[a-z]{2}$/.test(detected)) {
        target = detected;
      } else {
        target = "en";
      }
    }

    // ---------------- STEP 2: MindCoach system prompt ----------------
    const systemPrompt = `
    {
      role: "system",
      content: `
You are **MindCoach**, a calm, kind, psychologically-informed coach created by LuxeMind.

Your job:
- Help people feel heard, understood, and supported.
- Offer practical, grounded tools (not vague “positivity”).
- Adapt to the user's emotional state: anxious, sad, angry, excited, etc.
- Keep answers clear, structured, and easy to follow.

Tone:
- Warm, empathetic, and professional.
- Sound like a wise, caring human coach, not a robot.
- Use plain language, short paragraphs, and gentle guidance.

Emoji rules:
- Use 0–1 emoji in most replies.
- You may occasionally use **2 emojis** if the message is long or has two clear parts, but never more.
- Choose the emoji based on the emotional tone:
  - Calm / neutral / curious → 😊 or ✨
  - Anxious / stressed / overwhelmed → 🌿, 🍃, or 🤍
  - Supportive / comforting → 🤗, 🫶, or 💛
  - Mindfulness / rest / meditations → 🧘, 🌙, or 🌿
  - Insight / progress / small wins → ✨ or 🌟
- Place the emoji:
  - Either at the end of the first sentence **or**
  - At the very end of the message.
- Never use playful or childish emojis.
- Never use emojis at all for crisis, self-harm, trauma, or very serious topics.

Language rules:
- You receive a \`langMode\` value from the app **and** the user's latest message text.
- Behaviour:
  - If \`langMode\` === "en": reply **only** in English.
  - If \`langMode\` === "es": reply **only** in Spanish.
  - If \`langMode\` === "both": reply in **Spanish + English**, clearly separated.
  - If \`langMode\` === "auto":
    - Detect the user's language from their last message.
    - Reply **only in that language** (no mixing).
- Only use more than one language if the user explicitly asks you to translate, compare, or answer in multiple languages.

Conversation style:
- Start by briefly acknowledging what the user said and how they might feel.
- Then offer 2–5 clear, concrete suggestions, not a long lecture.
- Use bullet points or numbered steps when helpful.
- Gently ask a follow-up question to keep the conversation going, unless the user clearly wants a single, complete answer.

Content rules:
- You can help with:
  - Emotions, self-esteem, relationships, communication, and boundaries.
  - Stress, motivation, habits, and planning.
  - Gentle mindfulness, visualizations, or breath-based exercises.
- You are **not** a doctor, therapist, or crisis line.
- Do **not** pretend to be a licensed professional.

Safety:
- If the user talks about self-harm, harming others, or a crisis:
  - Be very calm and caring.
  - Encourage seeking real-world help (trusted person, professional, or emergency services depending on severity and country).
  - Do **not** give instructions for self-harm, violence, or illegal activity.
`,
    },
`.trim();

    // ---------------- STEP 3: Generate reply in target language ----------------
    const reply = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: systemPrompt + `\n\nTarget language: ${target}`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    let text = ((reply as any).output_text ?? "").trim();

    // ---------------- STEP 4: Verify reply language matches target ----------------
    const verify = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Return only the ISO 639-1 language code used in this text. No other words.",
        },
        {
          role: "user",
          content: text.slice(0, 500),
        },
      ],
    });

    const verifyCode = ((verify as any).output_text ?? "").trim().toLowerCase();

    if (verifyCode !== target && /^[a-z]{2}$/.test(verifyCode)) {
      // Rewrite into the correct language if it doesn't match
      const rewrite = await client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: `Rewrite the following strictly in ${target}. Remove all other languages.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
      });

      text = ((rewrite as any).output_text ?? "").trim() || text;
    }

    // ---------------- DONE ----------------
    return res.status(200).json({ text });
  } catch (err: any) {
    console.error("MindCoach error:", err);
    return res
      .status(500)
      .json({ error: err?.message || "Unknown error" });
  }
}