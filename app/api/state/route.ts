import { NextResponse } from "next/server";

import { getProfiles, isMongoConfigured, type StoredProfile } from "@/lib/mongo";
import { normalizeAppState } from "@/lib/storage";
import type { AppState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Durable mirror of AppState. The client keeps working from localStorage, so
 * every failure here is soft: the response says `{ ok: false }` and the UI
 * carries on. Nothing in onboarding blocks on the network.
 */

/** GET /api/state?id=<profileId> — returns the stored state, or null. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing id", state: null });
  if (!isMongoConfigured()) {
    return NextResponse.json({ ok: false, error: "MONGO_DB_URI is not set", state: null });
  }

  try {
    const profiles = await getProfiles();
    const doc = await profiles.findOne({ _id: id });
    if (!doc) return NextResponse.json({ ok: true, state: null });

    const { _id, updatedAt, ...state } = doc;
    void _id;
    void updatedAt;
    return NextResponse.json({ ok: true, state: normalizeAppState(state) });
  } catch (error) {
    console.error("[api/state] read failed:", error);
    return NextResponse.json({ ok: false, error: "read failed", state: null });
  }
}

/** PUT /api/state — body { id, state } — upserts the whole document. */
export async function PUT(request: Request) {
  let body: { id?: string; state?: AppState };
  try {
    body = (await request.json()) as { id?: string; state?: AppState };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" });
  }

  const id = body?.id;
  if (!id) return NextResponse.json({ ok: false, error: "missing id" });
  if (!isMongoConfigured()) {
    return NextResponse.json({ ok: false, error: "MONGO_DB_URI is not set" });
  }

  try {
    const profiles = await getProfiles();
    const state = normalizeAppState(body?.state);
    await profiles.updateOne(
      { _id: id },
      { $set: { ...state, updatedAt: Date.now() } as Partial<StoredProfile> },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/state] write failed:", error);
    return NextResponse.json({ ok: false, error: "write failed" });
  }
}
