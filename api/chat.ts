import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, langMode } = req.body;

  if (!message) {
    return res.status(400).json({ error: "No message received" });
  }

  try {
    // Send the message to OpenAI
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are MindCoach — a warm, bilingual AI life coach that blends neuroscience, mindfulness, and emotional intelligence.
Speak with kindness, optimism, and wisdom.
Always respect user’s language choice: ${langMode}.
If 'both', reply first in Spanish (🇪🇸) and then in English (🇺🇸), separated by a line.
Keep responses under 200 words. Encourage peace, focus, and self-awareness.`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await openaiRes.json();

    // Extract and clean the AI’s message
    const aiMessage =
      data.choices?.[0]?.message?.content?.trim() ||
      "Hmm… I couldn’t process that. Please try again.";

    return res.status(200).json({ text: aiMessage });
  } catch (err: any) {
    console.error("MindCoach API error:", err);
    return res.status(500).json({
      error: "Server error: " + (err?.message || "unknown"),
    });
  }
}