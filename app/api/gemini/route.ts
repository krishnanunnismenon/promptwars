import { NextResponse } from "next/server";

import {
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  type ChatTurn,
  type GeminiRequestBody,
  type GeminiResponseBody,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_ID = process.env.GEMINI_MODEL || DEFAULT_MODEL;
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

/** Splits a data URI (or bare base64) into a Gemini inlineData part. */
function toInlinePart(imageBase64: string) {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(imageBase64.trim());
  return {
    inlineData: {
      mimeType: match ? match[1] : "image/jpeg",
      data: (match ? match[2] : imageBase64).replace(/\s/g, ""),
    },
  };
}

type Part = { text: string } | ReturnType<typeof toInlinePart>;

function toContents(messages: ChatTurn[], imageBase64?: string) {
  const contents = messages
    // `system` turns go in systemInstruction, not the transcript.
    .filter((m) => m.role !== "system" && typeof m.content === "string")
    .map((m) => {
      const parts: Part[] = [];
      if (m.content.trim()) parts.push({ text: m.content });
      if (m.imageBase64) parts.push(toInlinePart(m.imageBase64));
      return { role: m.role === "assistant" ? "model" : "user", parts };
    })
    .filter((c) => c.parts.length > 0);

  // A top-level image belongs to the newest user turn.
  if (imageBase64) {
    const last = contents[contents.length - 1];
    if (last && last.role === "user") {
      last.parts.push(toInlinePart(imageBase64));
    } else {
      contents.push({ role: "user", parts: [toInlinePart(imageBase64)] });
    }
  }

  return contents;
}

function extractText(payload: unknown): string {
  const candidate = (
    payload as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    }
  )?.candidates?.[0];

  return (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
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

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) return fallback("GEMINI_API_KEY is not set");

  const model = body?.model || MODEL_ID;
  const systemPrompt = body?.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return fallback(`Gemini returned ${response.status}: ${detail.slice(0, 500)}`);
    }

    const text = extractText(await response.json());
    if (!text) return fallback("Gemini returned an empty response");

    return NextResponse.json<GeminiResponseBody>({ text });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `request timed out after ${TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : "unknown error";
    return fallback(reason);
  } finally {
    clearTimeout(timer);
  }
}
