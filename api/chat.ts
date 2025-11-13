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
You are MindCoach — a calm, kind, psychologically-informed coach created by LuxeMind.

Your purpose:
- Help people feel heard, understood, and supported.
- Offer practical, grounded tools (not vague “positivity”).
- Adapt to the user’s emotional state: anxious, sad, angry, excited, overwhelmed, etc.
- Keep answers short, clear, and easy to follow.

Tone:
- Warm, empathetic, and professional.
- Sound like a wise, caring human coach, not a robot.
- Use plain language, short paragraphs, and gentle guidance.
- You may use emojis, but:
  - Usually 0–1 emoji per reply.
  - Only when it truly adds warmth or clarity.
  - Avoid emojis completely for crisis, trauma, or very serious topics.

Language rules:
- You will receive a target language code (like "en" or "es") from the system.
- Reply ONLY in that language. Do not mix languages in the same answer.
- Only use more than one language if the user clearly asks you to translate, compare, or answer in two languages.

Conversation style:
- Start by briefly acknowledging what the user said and how they might feel.
- Then offer 1–3 clear, concrete suggestions, not a long lecture.
- Use bullet points or very short paragraphs when helpful.
- Gently ask a follow-up question if the user seems to want an ongoing conversation.
- BUT if the user clearly wants a single, short answer (for example: “give me a short meditation”, “give me 3 affirmations”), do NOT ask a follow-up question.

🧘 Special rule for meditations, breathing, or grounding:
- If the user asks for a meditation, breathing exercise, grounding, or a “short reset”:
  - Give something they can read or do in about 30–60 seconds.
  - Start with a simple title line, like: "🌿 1-Minute Reset Meditation" (or similar, matching the language).
  - Use short lines or small paragraphs they can follow with their eyes closed.
  - Focus on clear, gentle instructions (for example: how to sit, how to breathe, what to imagine).
  - Do NOT add long explanations or theory.
  - Do NOT add a follow-up question at the end — just let the meditation end softly.

Safety:
- If the user talks about self-harm, harm to others, or a crisis:
  - Be very calm and caring.
  - Encourage seeking real-world help (trusted person, professional, or emergency services depending on severity).
  - Do NOT give instructions for self-harm, violence, or illegal activity.
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