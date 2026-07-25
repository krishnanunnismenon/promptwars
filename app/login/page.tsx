"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { AnchorMark, SoftBlobs } from "@/components/AnchorMark";
import { isValidPhone, normalizePhone, startSession, type Role } from "@/lib/session";
import { saveAppState, setItem } from "@/lib/storage";
import { PROFILE_ID_KEY } from "@/lib/storage";
import { normalizeAppState } from "@/lib/storage";
import type { AppState } from "@/lib/types";

/**
 * Prototype sign-in. The phone number is the entire credential — no OTP.
 *
 * Two doors, because the two roles are genuinely different people with
 * different needs: the person in recovery gets their own profile, the caregiver
 * gets read access to the profile that listed their number.
 */

const ROLES: { role: Role; title: string; blurb: string }[] = [
  {
    role: "user",
    title: "I'm in recovery",
    blurb: "Your days, your calls, your future self.",
  },
  {
    role: "caregiver",
    title: "I'm supporting someone",
    blurb: "See how they're doing and what helps today.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!role || !isValidPhone(phone)) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, phone: normalizePhone(phone) }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        isNew?: boolean;
        profileId?: string;
        state?: AppState | null;
      };

      if (!payload.ok || !payload.profileId) {
        setError(payload.error ?? "That didn't work. Try again.");
        return;
      }

      startSession(role, phone, payload.profileId);

      if (role === "caregiver") {
        router.replace(`/caregiver?id=${encodeURIComponent(payload.profileId)}`);
        return;
      }

      if (payload.state) {
        // Returning user: their profile comes down with them.
        saveAppState(normalizeAppState(payload.state));
        router.replace("/");
      } else {
        // New number: keep it so onboarding can attach it to the new profile.
        setItem(PROFILE_ID_KEY, payload.profileId);
        saveAppState(
          normalizeAppState({ profile: { phone: normalizePhone(phone) } }),
        );
        router.replace("/onboarding");
      }
    } catch {
      setError("Couldn't connect. Check your network and try again.");
    } finally {
      setBusy(false);
    }
  }, [phone, role, router]);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center overflow-hidden px-6 py-12">
      <SoftBlobs />

      <div className="relative">
        <span className="inline-flex items-center gap-2 text-clay">
          <AnchorMark className="size-6" />
          <span className="text-xl font-bold tracking-tight">Anchor</span>
        </span>

        {!role ? (
          <>
            <h1 className="mt-8 text-[1.75rem] leading-tight font-bold tracking-tight text-balance">
              Who&apos;s using this phone?
            </h1>
            <div className="mt-7 space-y-3">
              {ROLES.map((option) => (
                <button
                  key={option.role}
                  type="button"
                  onClick={() => {
                    setRole(option.role);
                    setError(null);
                  }}
                  className="w-full rounded-[var(--radius-card)] border border-border bg-surface px-5 py-5 text-left shadow-[var(--shadow-card)] transition duration-150 ease-out hover:border-clay/40 active:scale-[0.98]"
                >
                  <p className="text-[1.1875rem] font-bold">{option.title}</p>
                  <p className="mt-1 text-base leading-relaxed text-muted text-pretty">
                    {option.blurb}
                  </p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-[1.75rem] leading-tight font-bold tracking-tight text-balance">
              {role === "user" ? "What's your number?" : "What's your number?"}
            </h1>
            <p className="mt-2 max-w-[34ch] text-base leading-relaxed text-muted text-pretty">
              {role === "user"
                ? "We'll find your days if you've been here before."
                : "Use the number they listed for you."}
            </p>

            <input
              autoFocus
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              enterKeyHint="go"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
              placeholder="98765 43210"
              className="mt-8 w-full border-b-2 border-border bg-transparent pb-3 text-4xl font-bold tracking-tight outline-none placeholder:font-medium placeholder:text-muted/60 focus:border-clay focus:outline-none"
            />

            {error && <p className="mt-4 text-base leading-relaxed text-danger text-pretty">{error}</p>}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={!isValidPhone(phone) || busy}
              className="mt-8 min-h-15 w-full rounded-full bg-clay text-lg font-semibold text-on-clay shadow-[var(--shadow-card)] transition duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:bg-sunk disabled:text-muted disabled:shadow-none"
            >
              {busy ? "Just a moment…" : "Continue"}
            </button>

            <button
              type="button"
              onClick={() => {
                setRole(null);
                setPhone("");
                setError(null);
              }}
              className="mt-2 min-h-13 w-full rounded-full text-base font-medium text-muted transition duration-150 ease-out active:scale-[0.98]"
            >
              Back
            </button>
          </>
        )}

        <p className="mt-10 text-sm leading-relaxed text-muted text-pretty">
          Prototype sign-in — a number is all it takes, and there&apos;s no code to enter.
        </p>
      </div>
    </main>
  );
}
