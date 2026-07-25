"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { MorrowMark, SoftBlobs } from "@/components/MorrowMark";
import { useAppState } from "@/lib/useAppState";
import type { YearReview } from "@/app/api/year-review/route";

/**
 * The payoff screen: everything the app recorded, read back as what actually
 * changed. Counted facts come from the stored records; the prose comes from one
 * model call over the same data.
 */

const minutes = (ms: number) => Math.round(ms / 60_000);

export default function ReviewPage() {
  const { state, hydrated } = useAppState();
  const [review, setReview] = useState<YearReview | null>(null);
  const [failed, setFailed] = useState(false);

  /** Counted, not generated — these must be exactly right. */
  const stats = useMemo(() => {
    const calls = state.callHistory;
    const totalMs = calls.reduce((sum, call) => sum + (call.durationMs ?? 0), 0);
    const triggers = new Map<string, number>();
    for (const call of calls) {
      for (const trigger of call.triggers ?? []) {
        triggers.set(trigger, (triggers.get(trigger) ?? 0) + 1);
      }
    }
    return {
      days: state.cleanDays,
      calls: calls.length,
      answered: calls.filter((c) => c.outcome === "calmed").length,
      escalated: calls.filter((c) => c.outcome === "escalated").length,
      minutes: minutes(totalMs),
      entries: state.diary.length,
      topTriggers: [...triggers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }, [state]);

  useEffect(() => {
    if (!hydrated || !state.profile.name) return;
    let cancelled = false;
    void fetch("/api/year-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    })
      .then((response) => response.json())
      .then((payload: YearReview) => {
        if (!cancelled && payload?.headline) setReview(payload);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // Regenerated when the day count or call count changes, not on every write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, state.profile.name, state.cleanDays, state.callHistory.length]);

  if (!hydrated) return <main className="min-h-dvh bg-cream" />;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col gap-5 overflow-hidden px-5 py-9">
      <SoftBlobs />

      <header className="relative">
        <Link
          href="/timeline"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Timeline
        </Link>

        <p className="mt-5 flex items-center gap-2 text-sm font-bold text-clay">
          <MorrowMark className="size-4" />
          {stats.days} days
        </p>
        <h1 className="mt-2 text-[1.875rem] leading-tight font-bold tracking-tight text-balance">
          {review ? review.headline : "Reading your year back…"}
        </h1>
      </header>

      {/* Counted facts, straight from the records. */}
      <section className="relative grid grid-cols-3 gap-2.5">
        {[
          { value: stats.calls, label: stats.calls === 1 ? "call" : "calls" },
          { value: stats.minutes, label: "minutes held" },
          { value: stats.entries, label: "entries" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[1.375rem] border border-border bg-surface px-4 py-4 text-center shadow-[var(--shadow-card)]"
          >
            <p className="text-[1.75rem] leading-none font-bold text-sage-ink">{stat.value}</p>
            <p className="mt-1.5 text-xs font-semibold text-muted">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="relative rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold text-sage-ink">What changed</h2>

        {review ? (
          <ul className="mt-4 space-y-4">
            {review.benefits.map((benefit, index) => (
              <li
                key={benefit.label}
                className="animate-rise"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <p className="text-[1.0625rem] font-bold">{benefit.label}</p>
                <p className="mt-0.5 text-[1.0625rem] leading-relaxed text-muted text-pretty">
                  {benefit.detail}
                </p>
              </li>
            ))}
          </ul>
        ) : failed ? (
          <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">
            Couldn&apos;t read the year back just now. Your records are all still here.
          </p>
        ) : (
          <ul className="mt-4 space-y-4" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="space-y-2">
                <span className="block h-4 w-24 animate-pulse rounded-full bg-sunk" />
                <span
                  className="block h-4 animate-pulse rounded-full bg-sunk"
                  style={{ width: `${88 - i * 9}%` }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {(review?.patterns.length || stats.topTriggers.length > 0) && (
        <section className="relative rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-bold text-muted">What the calls showed</h2>

          {stats.topTriggers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.topTriggers.map(([trigger, count]) => (
                <span
                  key={trigger}
                  className="rounded-full bg-amber/20 px-3 py-1.5 text-sm font-semibold"
                >
                  {trigger} · {count}×
                </span>
              ))}
            </div>
          )}

          {review && review.patterns.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {review.patterns.map((pattern) => (
                <li key={pattern} className="flex gap-3 text-[1.0625rem] leading-relaxed text-pretty">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-lilac" />
                  <span>{pattern}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {stats.escalated > 0 && (
        <p className="relative px-1 text-[0.9375rem] leading-relaxed text-muted text-pretty">
          {stats.escalated === 1 ? "One call" : `${stats.escalated} calls`} reached for real help.
          That is the system working, not failing.
        </p>
      )}

      {review && (
        <p className="animate-rise relative rounded-[var(--radius-card)] bg-clay px-5 py-5 text-[1.0625rem] leading-relaxed font-medium text-on-clay text-pretty">
          {review.closing}
        </p>
      )}
    </main>
  );
}
