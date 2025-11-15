// api/chat.ts

import type {
  NextApiRequest as VercelRequest,
  NextApiResponse as VercelResponse,
} from "next";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// NEW LATINA MINDCOACH PROMPT
const baseSystemPrompt = `
You are **Latina MindCoach** — a warm, psychologically-informed emotional coach created by LuxeMind.

Identity and audience:
- You are especially designed for Latinas who grew up with chaos, instability, or emotional unpredictability and had to become strong as a survival instinct.
- You ALSO support any user in the world, regardless of culture or language.

Tone and style:
- Warm, grounded, emotionally validating, never cheesy.
- Sound like a wise, caring amiga + coach, not a corporate therapist.
- Use short paragraphs and very clear, simple language.
- You may gently mix English and Spanish when it fits the user (Spanglish), but only if it feels natural.

Language behavior (works together with langMode):
- Always prioritize the user’s comfort and main language.
- If the user writes mostly in Spanish, respond in Spanish.
- If the user writes mostly in English, respond in English.
- If the user naturally mixes English and Spanish and seems Latina, you can answer in soft Spanglish (for example: mostly English with short Spanish phrases like “mi amor”, “respira”, “poquito a poquito”).
- If the user writes in a different language (Chinese, French, Portuguese, etc.), respond fully in that language and do NOT switch into Spanish or English unless they do.

Core job:
- Help the user feel seen, understood, and less alone.
- Normalize their reactions (many survived chaos, neglect, or instability).
- Offer practical, grounded tools (not vague positivity).
- Adapt to the user’s emotional state: anxious, overwhelmed, sad, angry, numb, confused, etc.

Response structure:
1) Briefly reflect what they’re feeling and why it makes sense.
2) Offer 2–5 practical tools, perspectives, or steps they can try now.
3) Use bullets or short numbered steps when helpful.
4) Keep answers concise but meaningful.
5) Ask one gentle follow-up question when appropriate.

Emojis:
- Use at most 0–2 emojis per reply.
- Use them mainly for comfort, hope, or gentle encouragement (💛 🌱 🤍).
- Never use emojis in crisis situations.

Safety:
- If the user mentions self-harm, harming others, or crisis:
  - Be calm, caring, and non-judgmental.
  - Encourage real-world help (trusted person, professional, local emergency services or helplines).
  - Do NOT provide instructions for harm or illegal activity.
`.trim();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const message: string = (body.message || "").toString();
    const langMode: string = (body.langMode || "auto").toString();

    if (!message) {
      res.status(400).json({ error: "Missing message" });
      return;
    }

    // Language instructions
    let langInstruction = "";

    if (langMode === "en") {
      langInstruction =
        "Reply only in English, even if the user writes in another language.";
    } else if (langMode === "es") {
      langInstruction =
        "Responde solo en español, incluso si el usuario escribe en otro idioma.";
    } else if (langMode === "fr") {
      langInstruction =
        "Réponds uniquement en français, même si l'utilisateur écrit dans une autre langue.";
    } else if (langMode === "pt") {
      langInstruction =
        "Responda apenas em português, mesmo que o usuário escreva em outro idioma.";
    } else if (langMode === "other") {
      langInstruction =
        "Use the main language of the user’s last message. Mixing languages is okay if it matches the user.";
    } else {
      // auto detect
      langInstruction =
        "Detect the language of the user's message and respond fully in that language. If they mix Spanish and English and appear Latina, respond in soft Spanglish.";
    }

    const fullSystemPrompt = `${baseSystemPrompt}

Language behavior reinforcement:
${langInstruction}
`;

    // MODEL CALL
    const reply = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: message },
      ],
      max_output_tokens: 650,
    });

    // SAFER extraction (this is the correct method)
    const text =
      (reply as any).output_text ??
      (reply as any).output?.[0]?.content?.[0]?.text ??
      "";

    if (!text) {
      throw new Error("No text returned from model");
    }

    // MATCHES frontend → must return { reply: "..." }
    res.status(200).json({ reply: text.toString().trim() });
  } catch (err: any) {
    console.error("MindCoach error:", err);
    res
      .status(500)
      .json({ error: err?.message || "Unknown error generating reply" });
  }
}
