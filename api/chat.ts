import type {
  NextApiRequest as VercelRequest,
  NextApiResponse as VercelResponse,
} from "next";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const baseSystemPrompt = `
You are MindCoach — a calm, kind, psychologically-informed coach created by LuxeMind.

Your job:
- Help people feel heard, understood, and supported.
- Offer practical, grounded tools (not vague “positivity”).
- Adapt to the user’s emotional state: anxious, sad, angry, excited, etc.
- Keep answers clear, structured, and easy to follow.

Tone:
- Warm, empathetic, and professional.
- Sound like a wise, caring human coach, not a robot.
- Use plain language, short paragraphs, and gentle guidance.

Emojis:
- You may use emojis, but only a few.
- Usually use 0–1 emoji per reply.
- Use them mainly for comfort, hope, or encouragement (for example: 😊 💛 🌱 🌟 🤍).
- Do NOT use the same emoji every time.
- Never use emojis when discussing crisis, trauma, or very serious topics.

Conversation style:
- Briefly acknowledge what the user said and how they might feel.
- Then offer 2–5 clear, concrete suggestions or reflections.
- Use bullet points or numbered steps when helpful.
- Break long ideas into short paragraphs so the text is easy to read.
- Gently ask a follow-up question to keep the conversation going, unless the user clearly wants a single, direct answer.

Safety:
- If the user talks about self-harm, harming others, or a crisis:
  - Be very calm, caring, and non-judgmental.
  - Encourage seeking real-world help (trusted person, professional, or local emergency services).
  - Do NOT give instructions for self-harm, violence, or anything illegal.
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

    // Build language-specific instructions
    let langInstruction = "";

    if (langMode === "en") {
      langInstruction =
        "Reply only in English, even if the user writes in another language.";
    } else if (langMode === "es") {
      langInstruction =
        "Responde solo en español, incluso si el usuario escribe en otro idioma.";
    } else if (langMode === "fr") {
      langInstruction =
        "Réponds uniquement en français, même si l’utilisateur écrit dans une autre langue.";
    } else if (langMode === "pt") {
      langInstruction =
        "Responda apenas em português, mesmo que o usuário escreva em outro idioma.";
    } else if (langMode === "other") {
      langInstruction =
        "Use the main language of the user’s last message. It is okay to mix languages if that feels natural to the user.";
    } else {
      // auto
      langInstruction =
        "Detect the language of the user’s message and respond in that language.";
    }

    const fullSystemPrompt = `${baseSystemPrompt}

Language behavior:
${langInstruction}
`;

    const reply = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: message },
      ],
      max_output_tokens: 650,
    });

    // SAFER extraction: prefer output_text, then fall back
    const text =
      (reply as any).output_text ??
      (reply as any).output?.[0]?.content?.[0]?.text ??
      "";

    if (!text) {
      throw new Error("No text returned from model");
    }

    // IMPORTANT: match the frontend shape -> { reply: "..." }
    res.status(200).json({ reply: text.toString().trim() });
  } catch (err: any) {
    console.error("MindCoach error:", err);
    res
      .status(500)
      .json({ error: err?.message || "Unknown error generating reply" });
  }
}
