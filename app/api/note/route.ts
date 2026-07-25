import { NextResponse } from "next/server";

import { getProfiles, isMongoConfigured } from "@/lib/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The standing note a caregiver leaves for the person they support.
 *
 * Deliberately kept OUT of AppState and off the device's sync path. The user's
 * app is local-first and pushes its whole state to Mongo on a debounce; if the
 * note lived in AppState, the user's next write would race with — and could
 * erase — something their caregiver wrote. So it lives only on the profile
 * document and is read fresh whenever it's shown.
 */

const MAX_LENGTH = 280;

export interface CaregiverNote {
  text: string;
  from: string;
  updatedAt: number;
}

/** GET /api/note?id=<profileId> */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isMongoConfigured()) return NextResponse.json({ note: null });

  try {
    const profiles = await getProfiles();
    const doc = await profiles.findOne(
      { _id: id },
      { projection: { caregiverNote: 1 } },
    );
    return NextResponse.json({ note: doc?.caregiverNote ?? null });
  } catch (error) {
    console.error("[api/note] read failed:", error);
    return NextResponse.json({ note: null });
  }
}

/** POST /api/note — body { id, text, from }. An empty text clears the note. */
export async function POST(request: Request) {
  let id: string;
  let text: string;
  let from: string;

  try {
    const body = (await request.json()) as { id?: string; text?: string; from?: string };
    id = body?.id ?? "";
    text = (body?.text ?? "").trim().slice(0, MAX_LENGTH);
    from = (body?.from ?? "").trim().slice(0, 60);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  if (!isMongoConfigured()) {
    return NextResponse.json({ ok: false, error: "no database" });
  }

  try {
    const profiles = await getProfiles();

    if (!text) {
      await profiles.updateOne({ _id: id }, { $unset: { caregiverNote: "" } });
      return NextResponse.json({ ok: true, note: null });
    }

    const note: CaregiverNote = { text, from: from || "Someone who cares", updatedAt: Date.now() };
    // $set touches only this field, so it never disturbs the user's own state.
    await profiles.updateOne({ _id: id }, { $set: { caregiverNote: note } });
    return NextResponse.json({ ok: true, note });
  } catch (error) {
    console.error("[api/note] write failed:", error);
    return NextResponse.json({ ok: false, error: "write failed" });
  }
}
