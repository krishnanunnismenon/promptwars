import { NextResponse } from "next/server";

import {
  DEFAULT_MODEL,
  EMPTY_PERSONA,
  type FutureSelfPersona,
  type UserProfile,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 30_000;

/**
 * Builds the Future Self character from the profile. Returns a
 * FutureSelfPersona; on any failure it returns a locally-composed persona
 * built from the same profile, so onboarding always ends with a usable call.
 */

const BUILDER_PROMPT = `You are creating a "Future Self" character: the user, exactly one year
from today, fully in recovery. Input: their profile JSON.

Return ONLY valid JSON:
{
  "systemPrompt": "...",
  "achievements": ["..."],
  "speechStyle": "...",
  "anchorMemories": ["..."]
}

systemPrompt rules — this will run a live voice call with the user
mid-craving, when their cognitive load is at its highest:
- Speak in first person plural ("we", "us") — you ARE them, one year ahead
- You carry the entire conversation; never rely on the user to lead
- Never ask open questions. Only binary/one-word questions, max one
  per 3 turns ("Are you home or outside? One word is enough.")
- If the user is silent, keep talking calmly; silence is normal
- Reference their specific dreams and losses by name, and the caregiver
  quote if present, sparingly — one reference per call segment, not a list
- Short sentences. Warm, steady, unhurried. Never clinical, never preachy
- Never mention being an AI. Never break character
- Goal of every call: get through the next 10 minutes together
- If the user mentions self-harm or sounds in danger, gently and
  immediately encourage calling a helpline or their caregiver by name`;

/** Last-resort persona composed on the server from the profile itself. */
function localPersona(profile: UserProfile): FutureSelfPersona {
  const name = profile.name?.trim() || "friend";
  const dreams = profile.dreams?.filter(Boolean) ?? [];
  const losses = profile.losses?.filter(Boolean) ?? [];
  const caregiver = profile.caregiverName?.trim();

  const systemPrompt = [
    `You are ${name}, exactly one year from today, fully in recovery.`,
    `You are speaking to yourself as you are now, mid-craving, on a voice call.`,
    ``,
    `Speak in first person plural — "we", "us". You ARE them, one year ahead.`,
    `Carry the entire conversation yourself. Never rely on them to lead.`,
    `Never ask open questions. Only binary or one-word questions, at most one every three turns.`,
    `If they are silent, keep talking calmly. Silence is normal.`,
    dreams.length ? `Things we got back this year: ${dreams.join(", ")}.` : ``,
    losses.length ? `What it cost us before: ${losses.join(", ")}.` : ``,
    caregiver && profile.caregiverQuote
      ? `${caregiver} once said: "${profile.caregiverQuote}". Use it sparingly — once, at most.`
      : ``,
    `Reference these by name sparingly — one per call segment, never as a list.`,
    `Short sentences. Warm, steady, unhurried. Never clinical, never preachy.`,
    `Never mention being an AI. Never break character.`,
    `The goal of this call is to get through the next ten minutes together.`,
    `If they mention self-harm or sound in danger, gently and immediately encourage`,
    caregiver
      ? `calling a helpline or ${caregiver}.`
      : `calling a helpline or someone they trust.`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    systemPrompt,
    achievements: dreams.length
      ? dreams.map((d) => `We got ${d} back.`)
      : ["We made it through a year, one day at a time."],
    speechStyle:
      "Short, warm sentences. First person plural. Unhurried. No questions unless one word can answer them.",
    anchorMemories: losses.length
      ? losses.map((l) => `The days when ${l} was slipping away.`)
      : ["The hardest nights, and the mornings after them."],
  };
}

/** Pulls the JSON object out of a response that may be fenced or padded. */
function parsePersona(text: string): FutureSelfPersona | null {
  const candidates = [text, text.replace(/^[\s\S]*?```(?:json)?/, "").replace(/```[\s\S]*$/, "")];
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced) candidates.push(braced);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim()) as Partial<FutureSelfPersona>;
      if (typeof parsed?.systemPrompt === "string" && parsed.systemPrompt.trim()) {
        return {
          ...EMPTY_PERSONA,
          ...parsed,
          achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
          anchorMemories: Array.isArray(parsed.anchorMemories) ? parsed.anchorMemories : [],
          speechStyle: typeof parsed.speechStyle === "string" ? parsed.speechStyle : "",
        };
      }
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

import { PersonaRequestBodySchema } from "@/lib/schemas";

export async function POST(request: Request) {
  let profile: UserProfile;
  try {
    const rawBody = await request.json();
    const result = PersonaRequestBodySchema.safeParse(rawBody);
    if (result.success) {
      profile = ("profile" in result.data && result.data.profile ? result.data.profile : result.data) as UserProfile;
    } else {
      profile = (rawBody?.profile ?? rawBody) as UserProfile;
    }
  } catch {
    return NextResponse.json({ persona: localPersona({} as UserProfile), fallback: true });
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      persona: localPersona(profile),
      fallback: true,
      error: "GEMINI_API_KEY is not set",
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(process.env.GEMINI_MODEL || DEFAULT_MODEL)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `Profile JSON:\n${JSON.stringify(profile, null, 2)}` }],
            },
          ],
          systemInstruction: { parts: [{ text: BUILDER_PROMPT }] },
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[api/persona]", response.status, detail.slice(0, 500));
      return NextResponse.json({
        persona: localPersona(profile),
        fallback: true,
        error: `Gemini returned ${response.status}`,
      });
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");

    const persona = parsePersona(text);
    if (!persona) {
      console.error("[api/persona] unparseable response:", text.slice(0, 300));
      return NextResponse.json({
        persona: localPersona(profile),
        fallback: true,
        error: "could not parse persona JSON",
      });
    }

    return NextResponse.json({ persona });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "timed out"
        : error instanceof Error
          ? error.message
          : "unknown error";
    console.error("[api/persona] falling back:", reason);
    return NextResponse.json({ persona: localPersona(profile), fallback: true, error: reason });
  } finally {
    clearTimeout(timer);
  }
}
