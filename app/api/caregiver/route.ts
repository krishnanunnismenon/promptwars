import { NextResponse } from "next/server";

import { generate, parseJson, textPart, userTurn } from "@/lib/server/gemini";
import type { AppState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 20_000;

/**
 * Tips for today, for the person supporting them.
 *
 * Grounded in what the app actually recorded — how many slips there have been,
 * what the recent calls were about, which triggers keep recurring, and how far
 * into the journey they are. Not generic advice: if it could have been written
 * without reading the data, it isn't worth showing.
 */

export interface CaregiverTips {
  /** One line naming what today most likely needs. */
  focus: string;
  tips: { title: string; detail: string }[];
  fallback?: boolean;
}

const FALLBACK: CaregiverTips = {
  focus: "Today mostly needs company, not conversation.",
  tips: [
    {
      title: "Be nearby without hovering",
      detail: "Same room, own thing. Presence does more than questions do.",
    },
    {
      title: "Offer something concrete",
      detail: "Food, a walk, a film. A choice between two things is easier than an open offer.",
    },
    {
      title: "Let them not talk about it",
      detail: "An ordinary evening is the goal, not a debrief.",
    },
  ],
  fallback: true,
};

const PROMPT = `You are advising the person supporting someone in recovery. They will read
this on their phone, today, and act on it tonight.

You receive: how far into recovery the person is, how many slips there have
been, and summaries of recent support calls including moods and recurring
triggers.

Respond ONLY as JSON:
{
  "focus": "one sentence naming what today most likely needs",
  "tips": [
    { "title": "3-5 words, imperative", "detail": "one or two short sentences, concrete and doable today" }
  ]
}

Rules:
- Give 3 or 4 tips. Each must be traceable to something in the data — a recurring
  trigger, a recent mood, the day count, or the slip history.
- If a trigger recurs (evenings, payday, work stress), aim at least one tip at it.
- If there has been a recent slip, address it once, plainly, with no blame and no
  extra vigilance-theatre. Never suggest monitoring, searching, counting, or testing.
- Never suggest ultimatums, guilt, bargaining, or "tough love".
- Plain language a worried relative would actually use. No therapy jargon, no
  slogans, no emojis, never the words "journey" or "proud of you".
- Address the reader as "you"; refer to the person in recovery by name.`;

const hasTips = (value: unknown): value is Partial<CaregiverTips> =>
  typeof value === "object" && value !== null && Array.isArray((value as { tips?: unknown }).tips);

function normalise(parsed: Partial<CaregiverTips>): CaregiverTips | null {
  const tips = (parsed.tips ?? [])
    .filter(
      (t): t is { title: string; detail: string } =>
        Boolean(t) && typeof t.title === "string" && typeof t.detail === "string",
    )
    .slice(0, 4);
  if (tips.length < 2) return null;
  return {
    focus: typeof parsed.focus === "string" && parsed.focus.trim() ? parsed.focus.trim() : FALLBACK.focus,
    tips,
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

  const recent = [...state.callHistory].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  const triggers = new Map<string, number>();
  for (const call of state.callHistory) {
    for (const trigger of call.triggers ?? []) {
      triggers.set(trigger, (triggers.get(trigger) ?? 0) + 1);
    }
  }
  const ranked = [...triggers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const daysSinceLastCall = recent[0]
    ? Math.floor((Date.now() - recent[0].timestamp) / 86_400_000)
    : null;

  const input = [
    `Person in recovery: ${state.profile.name || "unnamed"}, leaving behind ${
      state.profile.substance || "a substance"
    }.`,
    `Day ${Math.max(1, state.cleanDays)}. Slips so far: ${state.relapses ?? 0}.`,
    state.profile.caregiverName ? `You are ${state.profile.caregiverName}.` : "",
    daysSinceLastCall === null
      ? `They have not used a call yet.`
      : `Last call was ${daysSinceLastCall === 0 ? "today" : `${daysSinceLastCall} day(s) ago`}, outcome: ${recent[0].outcome}.`,
    ranked.length
      ? `Recurring triggers across all calls: ${ranked
          .map(([t, n]) => `${t} (${n}x)`)
          .join(", ")}.`
      : "",
    "",
    "Recent calls:",
    ...recent.map(
      (call) =>
        `- [${call.outcome}] mood: ${call.mood ?? "unknown"}; ${
          call.summary ?? "no summary"
        }; what helped: ${call.whatHelped ?? "unstated"}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");


  const result = await generate({
    contents: [userTurn(textPart(input))],
    systemPrompt: PROMPT,
    temperature: 0.75,
    maxOutputTokens: 800,
    timeoutMs: TIMEOUT_MS,
    json: true,
  });

  if (!result.ok) {
    console.error("[api/caregiver]", result.error);
    return NextResponse.json(FALLBACK);
  }

  const parsed = parseJson(result.text, hasTips);
  return NextResponse.json((parsed && normalise(parsed)) ?? FALLBACK);
}
