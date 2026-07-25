import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signed Cloudinary upload for the onboarding selfie.
 *
 * Signing happens here so the API secret never reaches the browser. Uses the
 * REST endpoint directly rather than the SDK — it's one POST and one SHA-1, and
 * a dependency for that isn't worth it.
 *
 * Storing a URL instead of a base64 blob keeps localStorage under its ~5MB quota
 * and keeps the Mongo document small. The caller keeps the local base64 for the
 * immediate preview and swaps in the URL when this returns.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = process.env.CLOUDINARY_FOLDER ?? "anchor";
const TIMEOUT_MS = 20_000;

const isCloudinaryConfigured = () =>
  Boolean(CLOUD_NAME && API_KEY && API_SECRET);

/** Cloudinary signs the sorted, `&`-joined params with the secret appended. */
function sign(params: Record<string, string>, secret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(canonical + secret).digest("hex");
}

export async function POST(request: Request) {
  let imageBase64 = "";
  try {
    const body = (await request.json()) as { imageBase64?: string };
    imageBase64 = body?.imageBase64 ?? "";
  } catch {
    return NextResponse.json({ url: null, error: "invalid JSON" });
  }

  if (!imageBase64) return NextResponse.json({ url: null, error: "no image" });

  // Not configured is not an error: the app falls back to the local base64.
  if (!isCloudinaryConfigured()) {
    return NextResponse.json({ url: null, error: "Cloudinary is not configured" });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams = { folder: FOLDER, timestamp };

  const form = new FormData();
  form.append(
    "file",
    imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
  );
  form.append("api_key", API_KEY!);
  form.append("timestamp", timestamp);
  form.append("folder", FOLDER);
  form.append("signature", sign(signedParams, API_SECRET!));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUD_NAME!)}/image/upload`,
      { method: "POST", body: form, signal: controller.signal },
    );

    const payload = (await response.json()) as {
      secure_url?: string;
      public_id?: string;
      error?: { message?: string };
    };

    if (!response.ok || !payload?.secure_url) {
      console.error("[api/upload] cloudinary:", response.status, payload?.error?.message);
      return NextResponse.json({
        url: null,
        error: payload?.error?.message ?? `Cloudinary returned ${response.status}`,
      });
    }

    return NextResponse.json({ url: payload.secure_url, publicId: payload.public_id });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError" ? "timed out" : String(error);
    console.error("[api/upload] falling back:", reason);
    return NextResponse.json({ url: null, error: reason });
  } finally {
    clearTimeout(timer);
  }
}
