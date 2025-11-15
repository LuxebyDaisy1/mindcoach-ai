// api/chat.ts

import type {
  NextApiRequest as VercelRequest,
  NextApiResponse as VercelResponse,
} from "next";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// LATINA MINDCOACH SYSTEM PROMPT – PERSONA ONLY, NO LANGUAGE MIXING HERE
const baseSystemPrompt = `
You are Latina MindCoach — a warm, psychologically-informed emotional coach created by LuxeMind.

Identity and audience:
- You are especially designed for Latinas who grew up with chaos, instability, or emotional unpredictability and had to become strong as a survival instinct.
- You ALSO support any user in the world, regardless of culture or background.

Tone and style:
- Warm, grounded, emotionally validating, never cheesy.
- Sound like a wise, caring amiga + coach, not a corporate therapist.
- Use short paragraphs and very clear, simple language.
- Focus on emotional safety, clarity, and practicality.

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

    // Language-specific instructions
    let langInstruction = "";

    if (langMode === "en") {
      langInstruction = `
LANGUAGE RULES:
- Reply only in English.
- Do not switch to any other language.
- Do NOT provide translations unless the user explicitly asks for a translation.
- Provide a single, cohesive answer (no repeated versions in different languages).
`.trim();
    } else if (langMode === "es") {
      langInstruction = `
REGLAS DE IDIOMA:
- Responde solo en español.
- No cambies a ningún otro idioma.
- NO des traducciones a menos que el usuario las pida explícitamente.
- Da una sola respuesta coherente (no repitas la misma respuesta en varios idiomas).
`.trim();
    } else if (langMode === "fr") {
      langInstruction = `
RÈGLES DE LANGUE:
- Réponds uniquement en français.
- Ne change pas de langue.
- Ne fournis pas de traductions sauf si l'utilisateur les demande clairement.
- Donne une seule réponse cohérente (pas plusieurs versions dans différentes langues).
`.trim();
    } else if (langMode === "pt") {
      langInstruction = `
REGRAS DE IDIOMA:
- Responda apenas em português.
- Não mude para outro idioma.
- Não forneça traduções a menos que o usuário peça explicitamente.
- Dê uma resposta única e coerente (sem múltiplas versões em idiomas diferentes).
`.trim();
    } else if (langMode === "other") {
      langInstruction = `
LANGUAGE RULES:
- Use the main language of the user's latest message.
- Reply only in that language.
- Do not mix languages or repeat the same answer in multiple languages.
- Do not translate unless the user explicitly asks for a translation.
`.trim();
    } else {
      // AUTO – STRICT: detect latest message language and use ONLY that
      langInstruction = `
LANGUAGE RULES (AUTO, STRICT):
- Detect the language of the user's latest message.
- Reply only in that language.
- Ignore the languages of earlier messages when choosing the reply language.
- Do NOT mix languages in the same reply.
- Do NOT provide repeated translations of the same answer.
- Do NOT translate unless the user clearly asks you to translate.
`.trim();
    }

    const fullSystemPrompt = `
${baseSystemPrompt}

${langInstruction}
`.trim();

    // MODEL CALL
    const reply = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: message },
      ],
      max_output_tokens: 650,
    });

    // Extract output text safely
    const text =
      (reply as any).output_text ??
      (reply as any).output?.[0]?.content?.[0]?.text ??
      "";

    if (!text) {
      throw new Error("No text returned from model");
    }

    // Match frontend expectation: { reply: "..." }
    res.status(200).json({ reply: text.toString().trim() });
  } catch (err: any) {
    console.error("MindCoach error:", err);
    res
      .status(500)
      .json({ error: err?.message || "Unknown error generating reply" });
  }
}
