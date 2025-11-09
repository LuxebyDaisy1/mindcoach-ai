// api/chat.ts — Vercel Serverless Function
import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { message, langMode } = (await req.body) ?? {};
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build strict, single-language system rules
    let systemPrompt = "";

    if (langMode === "both") {
      systemPrompt = `
You are MindCoach — a calm, supportive coach.
Always reply in TWO clearly separated blocks:
## ES 🇪🇸
[Spanish only]

## EN 🇺🇸
[English only]

The two blocks must be semantically