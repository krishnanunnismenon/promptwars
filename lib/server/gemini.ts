import "server-only";

import { DEFAULT_MODEL } from "@/lib/types";

/**
 * The single place this app talks to Gemini.
 *
 * Every route previously carried its own copy of the base URL, key lookup,
 * abort timeout, candidate unwrapping and JSON salvage. That duplication is
 * where drift starts — one route gets a fix, five don't. Routes now describe
 * *what* they want and handle their own fallback; everything else lives here.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 20_000;

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GenerateOptions {
  contents: GeminiContent[];
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask the model for `application/json`. Pair with `parseJson`. */
  json?: boolean;
  timeoutMs?: number;
  model?: string;
}

export type GenerateResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const apiKey = () => process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

export const modelId = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;

export const isGeminiConfigured = () => Boolean(apiKey());

/** A data URI or bare base64 string as an inline image part. */
export function imagePart(imageBase64: string): GeminiPart {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(imageBase64.trim());
  return {
    inlineData: {
      mimeType: match ? match[1] : "image/jpeg",
      data: (match ? match[2] : imageBase64).replace(/\s/g, ""),
    },
  };
}

export const textPart = (text: string): GeminiPart => ({ text });

/** Shorthand for the common single-user-turn call. */
export const userTurn = (...parts: GeminiPart[]): GeminiContent => ({ role: "user", parts });

function buildBody(options: GenerateOptions) {
  return JSON.stringify({
    contents: options.contents,
    ...(options.systemPrompt
      ? { systemInstruction: { parts: [{ text: options.systemPrompt }] } }
      : {}),
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 1024,
      ...(options.json ? { responseMimeType: "application/json" } : {}),
    },
  });
}

function extractText(payload: unknown): string {
  const candidate = (
    payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  )?.candidates?.[0];
  return (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

/**
 * One-shot generation. Never throws — callers get a tagged result and decide
 * what their own fallback looks like.
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const key = apiKey();
  if (!key) return { ok: false, error: "GEMINI_API_KEY is not set" };
  if (options.contents.length === 0) return { ok: false, error: "no contents to send" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(options.model ?? modelId())}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: buildBody(options),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, error: `Gemini returned ${response.status}: ${detail.slice(0, 300)}` };
    }

    const text = extractText(await response.json());
    return text ? { ok: true, text } : { ok: false, error: "Gemini returned an empty response" };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `timed out after ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : "unknown error";
    return { ok: false, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Streaming generation, yielding text deltas as they arrive.
 *
 * Throws rather than returning a result: the caller is already inside a
 * ReadableStream and needs to fall back by writing its own copy into the same
 * stream, which a try/catch expresses more directly than a tagged union.
 */
export async function* streamGenerate(options: GenerateOptions): AsyncGenerator<string> {
  const key = apiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const response = await fetch(
    `${API_BASE}/${encodeURIComponent(options.model ?? modelId())}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: buildBody(options),
    },
  );

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini returned ${response.status}: ${detail.slice(0, 300)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are newline-delimited; keep the trailing partial line.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const text = extractText(JSON.parse(payload));
        if (text) yield text;
      } catch {
        /* skip a malformed frame rather than dropping the stream */
      }
    }
  }
}

/**
 * Pulls a JSON object out of a reply that may be fenced, padded or truncated.
 * `guard` decides whether the parsed shape is usable.
 */
export function parseJson<T>(text: string, guard: (value: unknown) => value is T): T | null {
  const fenced = text.replace(/^[\s\S]*?```(?:json)?/, "").replace(/```[\s\S]*$/, "");
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);

  for (const candidate of [text, fenced, braced]) {
    if (!candidate.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(candidate.trim());
      if (guard(parsed)) return parsed;
    } catch {
      /* try the next shape */
    }
  }
  return null;
}
