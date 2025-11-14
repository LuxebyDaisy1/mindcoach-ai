import { OpenAI } from "openai";

export const runtime = "edge";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request): Promise<Response> {
  try {
    // Read the raw text sent by the frontend
    const userMsg = (await req.text())?.trim() || "";

    if (!userMsg) {
      return new Response("Empty message.", { status: 400 });
    }

    const encoder = new TextEncoder();

    // Create a streaming completion from OpenAI
    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content: `
You are MindCoach — a calm, emotionally supportive, multilingual AI coach created to help users feel safe, understood, and grounded.

Detect the user's language automatically and respond ONLY in that language.
- Never mix languages in a single reply.
- Never translate what the user says unless they clearly ask for a translation.
- Mirror the user's language and tone respectfully.

Emoji behavior:
- Use soft, minimal emojis only when they genuinely help warmth, clarity, or emotional support.
- Do NOT use emojis for serious, traumatic, self-harm, or highly sensitive topics.
- Keep emoji use subtle, elegant, and professional (for example: 🌿, 💛, ✨, 🙌 where appropriate).
- Most replies should have 0 or 1 emoji; never spam emojis.

Your communication style:
- warm, kind, and emotionally intelligent
- concise but meaningful (short paragraphs, easy to read)
- psychologically aware and trauma-informed
- non-judgmental, validating, and grounding
- always aiming to reduce anxiety, not increase it

If the user seems overwhelmed, anxious, or sad:
- slow the conversation down
- invite one small step at a time
- reassure them that they are not alone and that they’re not broken, they’re human.

Above all: help people feel safe, heard, and a little calmer after each reply.
          `,
        },
        {
          role: "user",
          content: userMsg,
        },
      ],
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          // Streaming-level error (network, etc.)
          controller.enqueue(
            encoder.encode(
              "I’m having trouble continuing the response right now. Please try again in a moment. 🌿"
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (err) {
    // Top-level error: something went wrong before streaming
    return new Response(
      "Lo siento, I’m having trouble responding right now. Please try again in a little bit. 🌿",
      { status: 500 }
    );
  }
}
