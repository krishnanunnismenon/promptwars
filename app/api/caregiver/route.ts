import { NextResponse } from "next/server";

import { DEFAULT_MODEL, type CallOutcome, type UserProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_ID = process.env.GEMINI_MODEL || DEFAULT_MODEL;
const TIMEOUT_MS = 20_000;

/**
 * Coaching for the person on the other side of this: what to say tonight, and
 * what to leave alone. Written for someone who is frightened and likely to
 * reach for the wrong sentence.
 */

export interface CaregiverAdvice {
  say: string[];
  avoid: string[];
  fallback?: boolean;
}

const FALLBACK: CaregiverAdvice = {
  say: [
    "I'm glad you're here.",
    "Do you want company, or quiet? Either is fine.",
    "I'm not going anywhere tonight.",
  ],
  avoid: [
    "Anything that starts with \"you should\".",
    "Asking how many days it's been.",
    "Bringing up what it has cost the family.",
  ],
  fallback: true,
};

function buildPrompt(profile: UserProfile, outcome: CallOutcome | null, cleanDays: number) {
  const name = profile.name?.trim() || "them";
  return [
    `You are coaching ${profile.caregiverName?.trim() || "a family member"} on how to talk to`,
    `${name} tonight. ${name} is in recovery and today was hard.`,
    ``,
    `What you know:`,
    `- They are leaving behind: ${profile.substance || "a substance"}.`,
    `- Day ${Math.max(1, cleanDays)} of the journey.`,
    profile.losses?.length ? `- It has cost them: ${profile.losses.join(", ")}.` : ``,
    profile.dreams?.length ? `- They want back: ${profile.dreams.join(", ")}.` : ``,
    outcome === "escalated"
      ? `- They just asked for real help on a call. Tonight is serious.`
      : outcome === "calmed"
        ? `- They got through a craving on a call earlier and came out okay.`
        : `- No call yet today.`,
    ``,
    `Rules:`,
    `- Each item is ONE short sentence a real person would actually say out loud.`,
    `- Warm, ordinary, specific. No therapy jargon, no slogans, no emojis.`,
    `- "avoid" items name the sentence or move to skip, and stay non-judgemental.`,
    `- Never suggest bargaining, monitoring, guilt, or ultimatums.`,
    ``,
    `Respond ONLY as JSON:`,
    `{"say": ["...", "...", "..."], "avoid": ["...", "...", "..."]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function parse(text: string): CaregiverAdvice | null {
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  for (const candidate of [text, braced]) {
    try {
      const parsed = JSON.parse(candidate.trim()) as Partial<CaregiverAdvice>;
      const say = Array.isArray(parsed?.say) ? parsed.say.filter(Boolean).slice(0, 4) : [];
      const avoid = Array.isArray(parsed?.avoid) ? parsed.avoid.filter(Boolean).slice(0, 4) : [];
      if (say.length && avoid.length) return { say, avoid };
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

export async function POST(request: Request) {
  let profile = {} as UserProfile;
  let outcome: CallOutcome | null = null;
  let cleanDays = 1;

  try {
    const body = (await request.json()) as {
      profile?: UserProfile;
      lastOutcome?: CallOutcome | null;
      cleanDays?: number;
    };
    profile = body?.profile ?? ({} as UserProfile);
    outcome = body?.lastOutcome ?? null;
    cleanDays = typeof body?.cleanDays === "number" ? body.cleanDays : 1;
  } catch {
    return NextResponse.json(FALLBACK);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json(FALLBACK);

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
          contents: [
            { role: "user", parts: [{ text: buildPrompt(profile, outcome, cleanDays) }] },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 600,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("[api/caregiver]", response.status);
      return NextResponse.json(FALLBACK);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");

    return NextResponse.json(parse(text) ?? FALLBACK);
  } catch (error) {
    console.error("[api/caregiver] falling back:", error);
    return NextResponse.json(FALLBACK);
  } finally {
    clearTimeout(timer);
  }
}
