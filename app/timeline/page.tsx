"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { useAppState } from "@/lib/useAppState";

/**
 * The year, seen from the outside: the future self sharpens as the days add up.
 *
 * Blur maps clean days onto blur(20px) → blur(0) across a year. A slip adds a
 * little blur back but never touches the day count — the journey is the total,
 * not the streak.
 */

const FULL_BLUR_PX = 20;
const HORIZON_DAYS = 365;
const BLUR_PER_RELAPSE = 1.6;
const RELAPSE_LINE = "Still here. Blurrier, not gone.";

/** The demo control is hidden in production unless ?dev=1 is present. */
const devToolsEnabled = () =>
  process.env.NODE_ENV !== "production" ||
  (typeof window !== "undefined" && new URLSearchParams(location.search).has("dev"));

export default function TimelinePage() {
  const { state, hydrated, update } = useAppState();
  const [busy, setBusy] = useState(false);

  const days = state.cleanDays;
  const relapses = state.relapses ?? 0;

  const blur = useMemo(() => {
    const progress = Math.min(1, Math.max(0, days) / HORIZON_DAYS);
    return Math.max(0, FULL_BLUR_PX * (1 - progress) + relapses * BLUR_PER_RELAPSE);
  }, [days, relapses]);

  /** Sharper avatar earns a stronger glow. */
  const glow = useMemo(() => Math.min(1, Math.max(0, days) / HORIZON_DAYS), [days]);

  const addDay = useCallback(async () => {
    setBusy(true);
    const nextDay = days + 1;
    let line = "We're still here. That counts.";
    try {
      const response = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: state.profile,
          day: nextDay,
          recent: state.diary.slice(-6).map((entry) => entry.line),
        }),
      });
      const payload = (await response.json()) as { line?: string };
      line = payload?.line?.trim() || line;
    } catch {
      /* keep the canned line */
    }

    update((previous) => ({
      ...previous,
      cleanDays: nextDay,
      diary: [...previous.diary, { day: nextDay, line }],
    }));
    setBusy(false);
  }, [days, state.diary, state.profile, update]);

  const recordSlip = useCallback(() => {
    update((previous) => ({
      ...previous,
      relapses: (previous.relapses ?? 0) + 1,
      diary: [
        ...previous.diary,
        { day: Math.max(1, previous.cleanDays), line: RELAPSE_LINE },
      ],
    }));
  }, [update]);

  if (!hydrated) return <main className="min-h-dvh bg-background" />;

  const entries = [...state.diary].reverse();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      {/* Top half: the future self, coming into focus. */}
      <section className="relative flex h-[45dvh] shrink-0 flex-col items-center justify-center overflow-hidden">
        <div
          aria-hidden
          className="absolute size-72 rounded-full blur-3xl transition-opacity duration-700"
          style={{
            background:
              "radial-gradient(circle, rgba(124,92,255,0.75), rgba(124,92,255,0.12) 60%, transparent 72%)",
            opacity: 0.25 + glow * 0.65,
          }}
        />

        {/* Sized generously: a small shape under blur(20px) reads as an empty
            smudge, and day 1 is exactly when the figure needs to read as a person. */}
        <div className="relative size-56 overflow-hidden rounded-full border border-white/10">
          {state.profile.photoBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.profile.photoBase64}
              alt="Your future self"
              className="size-full object-cover transition-[filter] duration-700"
              style={{ filter: `blur(${blur}px)` }}
            />
          ) : (
            <div
              className="flex size-full items-center justify-center bg-white/5 transition-[filter] duration-700"
              style={{ filter: `blur(${blur}px)` }}
            >
              <svg viewBox="0 0 24 24" className="size-44 text-white/80" fill="currentColor">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0z" />
              </svg>
            </div>
          )}
        </div>

        <p className="relative mt-6 text-5xl font-semibold tracking-tight tabular-nums">
          {days}
        </p>
        <p className="relative mt-1 text-sm tracking-[0.2em] text-muted uppercase">
          {days === 1 ? "day" : "days"} in
        </p>
      </section>

      {/* Bottom: the diary, newest first. */}
      <section className="flex-1 space-y-3 px-5 pb-8">
        {entries.length === 0 && (
          <p className="pt-6 text-center text-base text-muted">
            The first line lands after your first full day.
          </p>
        )}

        {entries.map((entry, index) => (
          <article
            key={`${entry.day}-${index}`}
            className={`rounded-2xl border px-5 py-4 ${
              entry.line === RELAPSE_LINE
                ? "border-amber-500/25 bg-amber-500/5"
                : "border-border bg-surface"
            }`}
          >
            <p className="text-xs tracking-[0.15em] text-muted uppercase">Day {entry.day}</p>
            <p className="mt-1.5 text-lg leading-relaxed">{entry.line}</p>
          </article>
        ))}
      </section>

      <footer className="sticky bottom-0 space-y-3 bg-gradient-to-t from-background via-background to-transparent px-5 pt-4 pb-8">
        {devToolsEnabled() && (
          <button
            type="button"
            onClick={() => void addDay()}
            disabled={busy}
            className="min-h-14 w-full rounded-2xl bg-accent text-lg font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "Writing…" : "+1 day"}
          </button>
        )}

        <div className="flex items-center justify-between">
          <Link href="/" className="min-h-12 px-2 py-3 text-sm text-muted">
            Back
          </Link>
          <button
            type="button"
            onClick={recordSlip}
            className="min-h-12 px-2 py-3 text-sm text-muted underline underline-offset-4"
          >
            I slipped
          </button>
        </div>
      </footer>
    </main>
  );
}
