"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { AnchorMark, SoftBlobs } from "@/components/AnchorMark";
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

  if (!hydrated) return <main className="min-h-dvh bg-cream" />;

  const entries = [...state.diary].reverse();

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col">
      <SoftBlobs />

      {/* The future self, coming into focus. */}
      <section className="relative flex shrink-0 flex-col items-center justify-center px-5 pt-24 pb-9">
        <Link
          href="/"
          aria-label="Back home"
          className="absolute top-8 left-5 flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-[var(--shadow-card)] transition duration-150 ease-out active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>

        {/* The halo is the reward: barely there on day 3, unmistakable at a year. */}
        <div
          aria-hidden
          className="animate-breathe absolute size-64 rounded-full blur-3xl"
          style={{ background: "var(--sage)", opacity: 0.05 + glow * 0.32 }}
        />

        {/* Sized generously: a small shape under blur(20px) reads as an empty
            smudge, and day 1 is exactly when the figure needs to read as a person. */}
        <div className="relative size-56 overflow-hidden rounded-full border border-border/70 bg-surface">
          {state.profile.photoBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.profile.photoBase64}
              alt="Your future self"
              className="size-full object-cover transition-[filter] duration-700 ease-out"
              style={{ filter: `blur(${blur}px)` }}
            />
          ) : (
            <div
              className="flex size-full items-center justify-center transition-[filter] duration-700 ease-out"
              style={{ filter: `blur(${blur}px)` }}
            >
              <svg viewBox="0 0 24 24" className="size-44 text-clay/70" fill="currentColor" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0z" />
              </svg>
            </div>
          )}
        </div>

        <p className="relative mt-6 text-[2.75rem] leading-none font-bold tracking-[-0.03em]">
          {days}
        </p>
        <p className="relative mt-1 text-base font-semibold text-muted">
          {days === 1 ? "day" : "days"} anchored
          {relapses > 0 && <span className="text-muted"> · {relapses} slip{relapses > 1 ? "s" : ""}</span>}
        </p>
      </section>

      {/* The diary, newest first. */}
      {/* pb clears the sticky footer so the last entry is never hidden under it. */}
      <section className="relative flex-1 space-y-2.5 px-5 pb-36">
        {entries.length === 0 ? (
          <div className="mt-4 rounded-[var(--radius-card)] border border-dashed border-border bg-surface/70 px-6 py-10 text-center">
            <AnchorMark className="mx-auto size-7 text-clay/60" />
            <p className="mt-3 text-lg font-bold">No entries yet</p>
            <p className="mx-auto mt-1.5 max-w-[30ch] text-base leading-relaxed text-muted text-pretty">
              Each day you get through adds one line here, in your own voice.
            </p>
          </div>
        ) : (
          entries.map((entry, index) => {
            const slip = entry.line === RELAPSE_LINE;
            return (
              <article
                key={`${entry.day}-${index}`}
                className={`animate-rise rounded-[var(--radius-card)] border px-5 py-4 ${
                  slip
                    ? "border-amber/50 bg-amber/12"
                    : "border-border bg-surface shadow-[var(--shadow-card)]"
                }`}
                style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
              >
                <p className="text-sm font-bold text-muted">Day {entry.day}</p>
                <p className="mt-1 text-[1.0625rem] leading-relaxed text-pretty">{entry.line}</p>
              </article>
            );
          })
        )}
      </section>

      <footer className="sticky bottom-0 space-y-2 bg-gradient-to-t from-cream via-cream to-transparent px-5 pt-5 pb-8">
        {devToolsEnabled() && (
          <button
            type="button"
            onClick={() => void addDay()}
            disabled={busy}
            className="min-h-14 w-full rounded-full bg-clay text-lg font-semibold text-on-clay shadow-[var(--shadow-card)] transition duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:bg-sunk disabled:text-muted disabled:shadow-none"
          >
            {busy ? "Writing today's line…" : "+1 day"}
          </button>
        )}

        <button
          type="button"
          onClick={recordSlip}
          className="min-h-12 w-full rounded-full text-sm font-medium text-muted transition duration-150 ease-out hover:bg-sunk/60 active:scale-[0.98]"
        >
          I slipped
        </button>
      </footer>
    </main>
  );
}
