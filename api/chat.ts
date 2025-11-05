// api/chat.ts — Vercel Serverless Function
import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { message, system } = (req.body ?? {}) as { message?: string; system?: string };

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const r = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: system || "You are MindCoach: calm, bilingual coach." },
        { role: "user", content: message || "" }
      ]
    });

    const text =
      (r as any).output_text ??
      (r as any).output?.[0]?.content?.[0]?.text ??
      "No text.";

    res.status(200).json({ text });
  } catch (e: any) {
    console.error("chat error:", e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
