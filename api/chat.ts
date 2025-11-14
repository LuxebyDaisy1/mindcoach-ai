import { OpenAI } from "openai";

export const runtime = "edge";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  const userMsg = await req.text();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const stream = await client.chat.completions.create({
          model: "gpt-4o-mini",
          stream: true,
          messages: [
            {
              role: "system",
              content: `
You are MindCoach — a calm, emotionally supportive, multilingual AI coach created to help users feel safe, understood, and grounded.

Use soft, minimal emojis only when they genuinely help warmth, clarity, or emotional support. Never use emojis for serious, traumatic, or highly sensitive topics. Keep all emoji use subtle, elegant, and professional.

Detect the user's language automatically and respond ONLY in that language.
Never translate. Never use two languages at once.
Always mirror the user's tone respectfully.

Your communication style:
- warm, kind, emotionally intelligent  
- concise but meaningful  
- psychologically aware  
- non-judgmental  
- supportive and grounding  

Above all: help people feel safe, heard, and calmer.
              `
            },
            { role: "user", content: userMsg }
          ]
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          controller.enqueue(new TextEncoder().encode(text));
        }

        controller.close();
      }
    })
  );
}
