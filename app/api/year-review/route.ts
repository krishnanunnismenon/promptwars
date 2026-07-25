import { NextResponse } from "next/server";

import { generate, parseJson, textPart, userTurn } from "@/lib/server/gemini";
import type { AppState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 25_000;

/**
 * The year, read back. Takes everything the app has accumulated — diary lines,
 * call summaries, the triggers that kept recurring — and states what actually
 * changed. This is the payoff screen, so it must be specific: generic recovery
 * platitudes would make a year of real records feel worthless.
 */

export interface YearReview {
  headline: string;
  benefits: { label: string; detail: string }[];
  patterns: string[];
  closing: string;
  fallback?: boolean;
}

const FALLBACK: YearReview = {
  headline: "A year of ordinary days, which was the whole point.",
  benefits: [
    { label: "Mornings", detail: "They start without dread now." },
    { label: "Trust", detail: "The people who stepped back have stepped closer." },
    { label: "Health", detail: "Sleep, appetite and steadiness all came back." },
    { label: "Money", detail: "What used to disappear each week stayed put." },
  ],
  patterns: ["Evenings were hardest", "Calls were shortest when made early"],
  closing: "Nothing here was luck. It was answered calls and ordinary days.",
  fallback: true,
};

const PROMPT = `You are writing a one-year review inside a recovery app, for the person themselves.

You receive their profile, their diary lines, and summaries of the support calls
they made across the year.

Respond ONLY as JSON:
{
  "headline": "one sentence, warm and plain, no exclamation marks",
  "benefits": [
    { "label": "one or two words", "detail": "one short sentence, concrete" }
  ],
  "patterns": ["short observations drawn from the call summaries and triggers"],
  "closing": "one sentence that credits them, not the app"
}

Rules:
- Give 4 or 5 benefits. Each must be grounded in something actually in the data.
- Quote or paraphrase real diary moments where you can. Specific beats inspiring.
- 2 to 3 patterns, drawn from recurring triggers or what helped.
- Never use recovery slogans, never say "journey" or "proud of you", no emojis.
- Acknowledge any slip plainly and without weight. It does not undo the year.
- Speak to them as "you". Never mention being an AI.`;

const hasHeadline = (value: unknown): value is Partial<YearReview> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { headline?: unknown }).headline === "string";

function normalise(parsed: Partial<YearReview>): YearReview | null {
  const benefits = (Array.isArray(parsed.benefits) ? parsed.benefits : [])
    .filter(
      (b): b is { label: string; detail: string } =>
        Boolean(b) && typeof b.label === "string" && typeof b.detail === "string",
    )
    .slice(0, 5);
  if (!parsed.headline?.trim() || benefits.length < 3) return null;

  return {
    headline: parsed.headline.trim(),
    benefits,
    patterns: Array.isArray(parsed.patterns)
      ? parsed.patterns.filter((p): p is string => typeof p === "string").slice(0, 3)
      : [],
    closing: typeof parsed.closing === "string" ? parsed.closing.trim() : FALLBACK.closing,
  };
}

export async function POST(request: Request) {
  let state: AppState;
  try {
    const body = (await request.json()) as { state?: AppState };
    state = body?.state as AppState;
    if (!state?.profile) return NextResponse.json(FALLBACK);
  } catch {
    return NextResponse.json(FALLBACK);
  }

  const calls = state.callHistory.filter((c) => c.summary);
  const input = [
    `Name: ${state.profile.name}`,
    `Leaving behind: ${state.profile.substance}`,
    `Days: ${state.cleanDays}. Slips: ${state.relapses ?? 0}.`,
    `What it had cost them: ${(state.profile.losses ?? []).join(", ") || "unstated"}`,
    `What they wanted back: ${(state.profile.dreams ?? []).join(", ") || "unstated"}`,
    state.profile.caregiverName ? `Person in their corner: ${state.profile.caregiverName}` : "",
    ``,
    `Diary (day: line):`,
    ...state.diary.map((entry) => `${entry.day}: ${entry.line}`),
    ``,
    `Support calls (${state.callHistory.length} total, ${calls.length} summarised):`,
    ...calls.map(
      (call) =>
        `- [${call.outcome}] mood: ${call.mood ?? "unknown"}; triggers: ${
          (call.triggers ?? []).join(", ") || "none noted"
        }; ${call.summary}; helped: ${call.whatHelped ?? "unstated"}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");


  const result = await generate({
    contents: [userTurn(textPart(input))],
    systemPrompt: PROMPT,
    temperature: 0.75,
    maxOutputTokens: 1200,
    timeoutMs: TIMEOUT_MS,
    json: true,
  });

  if (!result.ok) {
    console.error("[api/year-review]", result.error);
    return NextResponse.json(FALLBACK);
  }

  const parsed = parseJson(result.text, hasHeadline);
  return NextResponse.json((parsed && normalise(parsed)) ?? FALLBACK);
}
