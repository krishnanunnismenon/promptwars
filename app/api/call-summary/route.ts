import { NextResponse } from "next/server";

import { generate, parseJson, textPart, userTurn } from "@/lib/server/gemini";
import type { ChatTurn, UserProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Turns a finished call into a short record: what they said, how they sounded,
 * what set it off, what helped. This is what accumulates into the year review,
 * so it is written about the *person*, never about the assistant's replies.
 */

export interface CallSummary {
  summary: string;
  mood: string;
  triggers: string[];
  whatHelped: string;
  fallback?: boolean;
}

const FALLBACK: CallSummary = {
  summary: "They picked up and stayed on the call.",
  mood: "unsettled",
  triggers: [],
  whatHelped: "Company, and not being asked to explain anything.",
  fallback: true,
};

const PROMPT = `You are summarising one short support call for a recovery app.

You will receive a transcript. "user" is the person in recovery; "assistant" is
their own future self, one year ahead. Summarise ONLY what the person said and
how they seemed — never summarise the assistant's lines.

Respond ONLY as JSON:
{
  "summary": "two short sentences, third person, plain and non-judgemental",
  "mood": "one or two words, e.g. shaky, flat, angry, tired, steadier",
  "triggers": ["short noun phrases for what set this off, [] if unclear"],
  "whatHelped": "one short sentence on what seemed to settle them"
}

Rules:
- Never diagnose, never moralise, never use clinical language.
- If the person barely spoke, say so plainly. Silence is normal and not a failure.
- Do not invent detail that is not in the transcript.`;

const hasSummary = (value: unknown): value is Partial<CallSummary> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { summary?: unknown }).summary === "string" &&
  (value as { summary: string }).summary.trim().length > 0;

function normalise(parsed: Partial<CallSummary>): CallSummary {
  return {
    summary: parsed.summary!.trim(),
    mood: typeof parsed.mood === "string" ? parsed.mood.trim() : "unsettled",
    triggers: Array.isArray(parsed.triggers)
      ? parsed.triggers.filter((t): t is string => typeof t === "string").slice(0, 4)
      : [],
    whatHelped:
      typeof parsed.whatHelped === "string" ? parsed.whatHelped.trim() : FALLBACK.whatHelped,
  };
}

export async function POST(request: Request) {
  let transcript: ChatTurn[] = [];
  let profile = {} as UserProfile;

  try {
    const body = (await request.json()) as { transcript?: ChatTurn[]; profile?: UserProfile };
    transcript = Array.isArray(body?.transcript) ? body.transcript : [];
    profile = body?.profile ?? ({} as UserProfile);
  } catch {
    return NextResponse.json(FALLBACK);
  }

  const spoken = transcript.filter((t) => t.role === "user" && t.content.trim());
  // Nothing said at all: a silent call is a real outcome, not an error.
  if (spoken.length === 0) {
    return NextResponse.json({
      ...FALLBACK,
      summary: "They answered and stayed on the line without speaking.",
      mood: "quiet",
      whatHelped: "Not being asked to talk.",
    });
  }

  const rendered = transcript
    .map((turn) => `${turn.role === "assistant" ? "assistant" : "user"}: ${turn.content}`)
    .join("\n");

  const result = await generate({
    contents: [
      userTurn(
        textPart(
          `Person: ${profile.name || "unnamed"}, leaving behind ${
            profile.substance || "a substance"
          }.\n\nTranscript:\n${rendered}`,
        ),
      ),
    ],
    systemPrompt: PROMPT,
    temperature: 0.4,
    maxOutputTokens: 400,
    json: true,
  });

  if (!result.ok) {
    console.error("[api/call-summary]", result.error);
    return NextResponse.json(FALLBACK);
  }

  const parsed = parseJson(result.text, hasSummary);
  return NextResponse.json(parsed ? normalise(parsed) : FALLBACK);
}
