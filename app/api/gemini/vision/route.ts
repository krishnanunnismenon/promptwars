import { NextResponse } from "next/server";

import { DEFAULT_MODEL } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_ID = process.env.GEMINI_MODEL || DEFAULT_MODEL;
const TIMEOUT_MS = 15_000;

/**
 * Reads one captured frame from the in-call camera.
 *
 * Like every other model route here it degrades instead of failing — a call in
 * progress must never stall on this. An unreadable frame comes back as
 * `risk: "unknown"`, which the persona treats as "keep going, don't assume".
 */

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface VisionResult {
  description: string;
  risk: RiskLevel;
  fallback?: boolean;
}

const PROMPT =
  "Describe this location in one short phrase and assess risk for someone " +
  "fighting a substance craving (bar/liquor visible = high). " +
  'Respond ONLY as JSON: {"description": "...", "risk": "low" | "medium" | "high"}';

const FALLBACK: VisionResult = {
  description: "somewhere I can't quite see",
  risk: "unknown",
  fallback: true,
};

function toInlinePart(imageBase64: string) {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(imageBase64.trim());
  return {
    inlineData: {
      mimeType: match ? match[1] : "image/jpeg",
      data: (match ? match[2] : imageBase64).replace(/\s/g, ""),
    },
  };
}

function parse(text: string): VisionResult | null {
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  for (const candidate of [text, braced]) {
    try {
      const parsed = JSON.parse(candidate.trim()) as Partial<VisionResult>;
      if (typeof parsed?.description === "string" && parsed.description.trim()) {
        const risk = String(parsed.risk ?? "").toLowerCase();
        return {
          description: parsed.description.trim(),
          risk:
            risk === "high" || risk === "medium" || risk === "low"
              ? (risk as RiskLevel)
              : "unknown",
        };
      }
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

export async function POST(request: Request) {
  let imageBase64 = "";
  try {
    const body = (await request.json()) as { imageBase64?: string };
    imageBase64 = body?.imageBase64 ?? "";
  } catch {
    return NextResponse.json(FALLBACK);
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!imageBase64 || !apiKey) return NextResponse.json(FALLBACK);

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
            { role: "user", parts: [{ text: PROMPT }, toInlinePart(imageBase64)] },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 200,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("[api/gemini/vision]", response.status);
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
    console.error("[api/gemini/vision] falling back:", error);
    return NextResponse.json(FALLBACK);
  } finally {
    clearTimeout(timer);
  }
}
