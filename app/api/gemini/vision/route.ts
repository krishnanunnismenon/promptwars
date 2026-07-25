import { NextResponse } from "next/server";

import { generate, imagePart, parseJson, textPart, userTurn } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const isVisionShape = (value: unknown): value is { description: string; risk?: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { description?: unknown }).description === "string" &&
  (value as { description: string }).description.trim().length > 0;

export async function POST(request: Request) {
  let imageBase64 = "";
  try {
    const body = (await request.json()) as { imageBase64?: string };
    imageBase64 = body?.imageBase64 ?? "";
  } catch {
    return NextResponse.json(FALLBACK);
  }
  if (!imageBase64) return NextResponse.json(FALLBACK);

  const result = await generate({
    contents: [userTurn(textPart(PROMPT), imagePart(imageBase64))],
    temperature: 0.3,
    maxOutputTokens: 200,
    json: true,
    timeoutMs: 15_000,
  });

  if (!result.ok) {
    console.error("[api/gemini/vision]", result.error);
    return NextResponse.json(FALLBACK);
  }

  const parsed = parseJson(result.text, isVisionShape);
  if (!parsed) return NextResponse.json(FALLBACK);

  const risk = String(parsed.risk ?? "").toLowerCase();
  return NextResponse.json<VisionResult>({
    description: parsed.description.trim(),
    risk: risk === "high" || risk === "medium" || risk === "low" ? (risk as RiskLevel) : "unknown",
  });
}
