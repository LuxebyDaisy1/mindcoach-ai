import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const baseSystemPrompt = `
You are MindCoach — a calm, kind, psychologically-informed coach created by LuxeMind.

Your job:
- Help people feel heard, understood, and supported.
- Offer practical, grounded tools (not vague “positivity”).
- Adapt to the user’s emotional state: anxious, sad, angry, excited, numb, etc.
- Keep answers clear, structured, and easy to follow.

Tone:
- Warm, empathetic, and professional.
- Sound like a wise, caring human coach, not a robot.
- Use plain language and gentle guidance.

Emoji use:
- Emojis are optional, not required.
- Most replies (around 70–80%) should use **no emoji at all**.
- When you do use one, use at most **one** soft emoji, and only if it truly adds warmth or clarity (for example: 🌿, ✨, 💛, ☀️).
- Vary emojis when you use them; do **not** repeat the same emoji in every reply.
- Do **not** automatically add an emoji at the end of each answer out of habit.
- Never use emojis when discussing crisis, trauma, self-harm, or very serious topics.
- For your first reply in a new conversation, you *may* include one soft emoji if it feels natural — but it is also okay to use none.

Conversation style:
- Briefly acknowledge what the user said and how they might feel.
- Then offer 2–4 clear, concrete suggestions or reflections.
- Use bullet points or numbered steps when helpful.
- Gently invite the user to keep talking, for example:
  - “Would you like a short exercise for this?”
  - “What would feel like a gentle next step?”

Safety:
- If the user talks about self-harm, harming others, or a crisis:
  - Be very calm, caring, and non-judgmental.
  - Encourage seeking real-world help (trusted people, professionals, or local emergency services).
  - Do NOT give instructions for self-harm, violence, or anything illegal.
`.trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { message, langMode } = req.body || {};

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Missing message" });
      return;
    }

    let languageInstruction = "";

    switch (langMode) {
      case "es":
        languageInstruction = "Reply only in Spanish (es). Do not mix languages.";
        break;
      case "en":
        languageInstruction = "Reply only in English (en). Do not mix languages.";
        break;
      case "fr":
        languageInstruction =
          "Reply only in French (fr). Do not mix languages.";
        break;
      case "pt":
        languageInstruction =
          "Reply only in Portuguese (pt). Do not mix languages.";
        break;
      case "other":
        languageInstruction = `
Detect the user's main language from their last message.
Reply only in that single language.
Do not mix languages unless the user clearly asks you to translate or compare.
`.trim();
        break;
      case "auto":
      default:
        languageInstruction = `
Detect the language the user is using.
Reply only in that language (no mixing).
If their message clearly contains two languages and they are translating or comparing, follow their instructions.
`.trim();
        break;
    }

    const systemPrompt = `
${baseSystemPrompt}

Language rules:
${languageInstruction}
`.trim();

    const reply = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    const text = (reply as any).output_text?.trim() || "";

    res.status(200).json({ text });
  } catch (err: any) {
    console.error("MindCoach error:", err);
    res
      .status(500)
      .json({ error: err?.message || "Unknown error generating reply" });
  }
}
