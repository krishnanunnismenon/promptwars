import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getProfiles, isMongoConfigured } from "@/lib/mongo";
import { normalizeAppState } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prototype sign-in: the phone number IS the credential.
 *
 * There is no OTP, no password and no session token — anyone who types a number
 * gets that account. This is a demo shortcut, deliberately contained in this one
 * route so it is obvious what has to be replaced before this goes anywhere real.
 *
 * "user"      — the person in recovery, matched on profile.phone.
 * "caregiver" — matched on profile.caregiverPhone, i.e. the number the person
 *               in recovery listed for them. A caregiver cannot invent a link.
 */

const normalize = (input: string) => {
  const digits = String(input ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export async function POST(request: Request) {
  let role: string;
  let phone: string;

  try {
    const body = (await request.json()) as { role?: string; phone?: string };
    role = body?.role ?? "";
    phone = normalize(body?.phone ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  if (role !== "user" && role !== "caregiver") {
    return NextResponse.json({ ok: false, error: "unknown role" }, { status: 400 });
  }
  if (phone.length !== 10) {
    return NextResponse.json({ ok: false, error: "Enter a 10-digit number." }, { status: 400 });
  }

  // No database: let a first-time user through so onboarding still works offline.
  if (!isMongoConfigured()) {
    return role === "user"
      ? NextResponse.json({ ok: true, isNew: true, profileId: randomUUID(), state: null })
      : NextResponse.json({ ok: false, error: "No records available right now." });
  }

  try {
    const profiles = await getProfiles();

    if (role === "caregiver") {
      const doc = await profiles.findOne({ "profile.caregiverPhone": phone });
      if (!doc) {
        return NextResponse.json({
          ok: false,
          error:
            "No one has listed this number yet. Ask them to add you as their person in the app.",
        });
      }
      return NextResponse.json({
        ok: true,
        profileId: doc._id,
        name: doc.profile?.name ?? null,
      });
    }

    const doc = await profiles.findOne({ "profile.phone": phone });
    if (doc) {
      const { _id, updatedAt, ...state } = doc;
      void updatedAt;
      return NextResponse.json({
        ok: true,
        isNew: false,
        profileId: _id,
        state: normalizeAppState(state),
      });
    }

    // First time on this number — onboarding will fill the rest in.
    return NextResponse.json({ ok: true, isNew: true, profileId: randomUUID(), state: null });
  } catch (error) {
    console.error("[api/auth/login]", error);
    return NextResponse.json({ ok: false, error: "Couldn't reach the database." });
  }
}
