import { NextResponse } from "next/server";

import { DEFAULT_MODEL, type UserProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_ID = process.env.GEMINI_MODEL || DEFAULT_MODEL;
const TIMEOUT_MS = 15_000;

/**
 * One diary line per clean day, in the future self's voice. The line is the
 * sentence only — /timeline renders the "Day N." prefix.
 */

const FALLBACKS = [
  "We're still here. That counts.",
  "Nothing dramatic today. That's the point.",
  "One more day behind us.",
  "Quiet day. We'll take quiet.",
];

function buildPrompt(profile: UserProfile, day: number, recent: string[]) {
  return [
    `You write one line of a recovery diary, in the voice of ${profile.name || "this person"}`,
    `one year into recovery, speaking as "we".`,
    ``,
    `Rules:`,
    `- First person plural ("we", "us"). Warm, plain, specific.`,
    `- ONE sentence, under 14 words. No "Day N" prefix — that is added separately.`,
    `- Concrete and ordinary: sleep, food, mornings, a phone call, weather, work.`,
    `- Never preachy, never clinical, never a slogan. No emojis.`,
    `- Do not repeat any of the recent lines.`,
    ``,
    `They are leaving behind: ${profile.substance || "a substance"}.`,
    profile.dreams?.length ? `They want back: ${profile.dreams.join(", ")}.` : ``,
    profile.losses?.length ? `It cost them: ${profile.losses.join(", ")}.` : ``,
    ``,
    `This is day ${day}.`,
    recent.length ? `Recent lines (do not repeat):\n${recent.map((l) => `- ${l}`).join("\n")}` : ``,
    ``,
    `Reply with the sentence only.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  let profile = {} as UserProfile;
  let day = 1;
  let recent: string[] = [];

  try {
    const body = (await request.json()) as {
      profile?: UserProfile;
      day?: number;
      recent?: string[];
    };
    profile = body?.profile ?? ({} as UserProfile);
    day = typeof body?.day === "number" ? body.day : 1;
    recent = Array.isArray(body?.recent) ? body.recent.slice(-6) : [];
  } catch {
    /* fall through to a canned line */
  }

  const fallback = () =>
    NextResponse.json({ line: FALLBACKS[day % FALLBACKS.length], fallback: true });

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) return fallback();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(MODEL_ID)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(profile, day, recent) }] }],
          generationConfig: { temperature: 1, maxOutputTokens: 120 },
        }),
      },
    );

    if (!response.ok) {
      console.error("[api/diary]", response.status);
      return fallback();
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const line = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/^Day\s+\d+[.:]\s*/i, "");

    return line ? NextResponse.json({ line }) : fallback();
  } catch (error) {
    console.error("[api/diary] falling back:", error);
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
