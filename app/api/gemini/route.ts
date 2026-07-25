import { NextResponse } from "next/server";

import { generate, imagePart, type GeminiContent, type GeminiPart } from "@/lib/server/gemini";
import {
  DEFAULT_SYSTEM_PROMPT,
  type ChatTurn,
  type GeminiRequestBody,
  type GeminiResponseBody,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 20_000;

/**
 * Served whenever the live call can't be made. Stays in character — a user
 * mid-craving should never see an error string — while `error` carries the
 * real reason for the console.
 */
const FALLBACK_TEXT =
  "Stay with me. We don't have to do anything for the next ten minutes except " +
  "breathe. I'm not going anywhere. We've stood exactly where you are, and we " +
  "got through it — one minute, then the next. Just keep breathing with me.";

function fallback(error: string): NextResponse<GeminiResponseBody> {
  console.error("[api/gemini] falling back:", error);
  // Deliberately HTTP 200: the client renders `text` and never hits an error path.
  return NextResponse.json({ text: FALLBACK_TEXT, fallback: true, error });
}

function toContents(messages: ChatTurn[], imageBase64?: string) {
  const contents = messages
    // `system` turns go in systemInstruction, not the transcript.
    .filter((m) => m.role !== "system" && typeof m.content === "string")
    .map((m) => {
      const parts: GeminiPart[] = [];
      if (m.content.trim()) parts.push({ text: m.content });
      if (m.imageBase64) parts.push(imagePart(m.imageBase64));
      return {
        role: (m.role === "assistant" ? "model" : "user") as GeminiContent["role"],
        parts,
      };
    })
    .filter((c) => c.parts.length > 0);

  // A top-level image belongs to the newest user turn.
  if (imageBase64) {
    const last = contents[contents.length - 1];
    if (last && last.role === "user") {
      last.parts.push(imagePart(imageBase64));
    } else {
      contents.push({ role: "user", parts: [imagePart(imageBase64)] });
    }
  }

  return contents;
}

import { GeminiRequestBodySchema } from "@/lib/schemas";

export async function POST(request: Request) {
  let body: GeminiRequestBody;
  try {
    const rawBody = await request.json();
    const result = GeminiRequestBodySchema.safeParse(rawBody);
    if (!result.success) {
      const issue = result.error.issues[0]?.message ?? "Schema validation failed";
      return fallback(`Invalid request schema: ${issue}`);
    }
    body = result.data as GeminiRequestBody;
  } catch {
    return fallback("request body was not valid JSON");
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const contents = toContents(messages, body?.imageBase64);
  if (contents.length === 0) return fallback("no messages to send");

  const result = await generate({
    contents,
    systemPrompt: body?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    temperature: 0.7,
    maxOutputTokens: 2048,
    timeoutMs: TIMEOUT_MS,
    model: body?.model,
  });

  if (!result.ok) return fallback(result.error);
  return NextResponse.json<GeminiResponseBody>({ text: result.text });
}
