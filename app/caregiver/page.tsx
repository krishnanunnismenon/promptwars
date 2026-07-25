"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AnchorMark, AnchorWordmark, SoftBlobs } from "@/components/AnchorMark";
import { Helplines } from "@/components/Helplines";
import { normalizeAppState } from "@/lib/storage";
import { useAppState } from "@/lib/useAppState";
import type { AppState, CallOutcome } from "@/lib/types";

/**
 * The view for the person waiting at home.
 *
 * Reads the same AppState. On the user's own device that's localStorage; open
 * it as /caregiver?id=<profileId> on any other device and it reads that
 * profile straight from Mongo instead.
 */

interface Advice {
  say: string[];
  avoid: string[];
}

/** "today at 9:42 pm" / "yesterday at ..." / a date for anything older. */
function formatWhen(timestamp: number): string {
  const then = new Date(timestamp);
  const time = then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const isSameDay = then.toDateString() === today.toDateString();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = then.toDateString() === yesterday.toDateString();

  if (isSameDay) return `today at ${time}`;
  if (isYesterday) return `yesterday at ${time}`;
  return `${then.toLocaleDateString(undefined, { day: "numeric", month: "short" })} at ${time}`;
}

function CaregiverView() {
  const params = useSearchParams();
  const remoteId = params.get("id");

  const local = useAppState();
  const [remote, setRemote] = useState<AppState | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);

  // A caregiver on their own phone reads the profile from Mongo.
  useEffect(() => {
    if (!remoteId) return;
    let cancelled = false;
    void fetch(`/api/state?id=${encodeURIComponent(remoteId)}`)
      .then((response) => response.json())
      .then((payload: { state?: unknown }) => {
        if (!cancelled) setRemote(payload?.state ? normalizeAppState(payload.state) : null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setRemoteLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [remoteId]);

  const state = remoteId ? remote : local.state;
  const ready = remoteId ? remoteLoaded : local.hydrated;

  const lastCall = useMemo(
    () => (state?.callHistory.length ? state.callHistory[state.callHistory.length - 1] : null),
    [state],
  );
  const outcome: CallOutcome | null = lastCall?.outcome ?? null;
  const escalated = outcome === "escalated";
  const name = state?.profile.name?.trim() || "They";

  // One call, refreshed when the last outcome changes.
  useEffect(() => {
    if (!state?.profile.name) return;
    let cancelled = false;
    void fetch("/api/caregiver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: state.profile,
        lastOutcome: outcome,
        cleanDays: state.cleanDays,
      }),
    })
      .then((response) => response.json())
      .then((payload: Advice) => {
        if (!cancelled && payload?.say?.length) setAdvice(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Keyed on the signals that change the advice, not the whole object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.profile.name, outcome, state?.cleanDays]);

  if (!ready) return <main className="min-h-dvh bg-cream" />;

  if (!state || !state.profile.name) {
    return (
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 overflow-hidden px-6">
        <SoftBlobs />
        <AnchorMark className="relative size-8 text-clay/70" />
        <h1 className="relative text-2xl font-bold">Nothing to show yet</h1>
        <p className="relative max-w-[32ch] text-lg leading-relaxed text-muted text-pretty">
          This page fills in once they&apos;ve finished setting up.
        </p>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col gap-4 overflow-hidden px-5 py-9">
      <SoftBlobs />

      {escalated && (
        <section
          role="alert"
          className="animate-rise relative rounded-[var(--radius-card)] border border-danger/35 bg-danger/10 p-5"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-danger">
            <span className="animate-breathe size-2 rounded-full bg-danger" aria-hidden />
            Right now
          </p>
          <p className="mt-2 text-xl leading-snug font-bold text-balance">
            {name} asked for real help on a call.
          </p>
          {lastCall && (
            <p className="mt-1.5 text-base text-muted">{formatWhen(lastCall.timestamp)}</p>
          )}
          <p className="mt-3 max-w-[38ch] text-base leading-relaxed text-pretty">
            Call {name} now, or just go to them. You don&apos;t need the right words.
          </p>
        </section>
      )}

      <header className="relative">
        <AnchorWordmark className="text-clay" />
        <h1 className="mt-4 text-[1.75rem] leading-tight font-bold tracking-tight">
          How {name} is doing
        </h1>
        {state.profile.caregiverName && (
          <p className="mt-1 text-base text-muted">for {state.profile.caregiverName}</p>
        )}
      </header>

      <section className="relative grid grid-cols-2 gap-2.5">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <p className="text-[2.75rem] leading-none font-bold tracking-[-0.03em] text-sage-ink">
            {Math.max(1, state.cleanDays)}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-muted">
            {state.cleanDays === 1 ? "day" : "days"} anchored
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          {lastCall ? (
            <>
              <p className="text-[1.0625rem] leading-snug font-bold text-pretty">
                {escalated ? `${name} asked for help.` : `${name} answered. ${name}'s okay.`}
              </p>
              <p className="mt-1.5 text-sm text-muted">{formatWhen(lastCall.timestamp)}</p>
            </>
          ) : (
            <>
              <p className="text-[1.0625rem] leading-snug font-bold">No calls yet.</p>
              <p className="mt-1.5 text-sm text-muted">That&apos;s good news.</p>
            </>
          )}
        </div>
      </section>

      <section className="relative rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold text-sage-ink">What to say tonight</h2>
        {advice ? (
          <ul className="mt-3 space-y-3">
            {advice.say.map((line, index) => (
              <li
                key={line}
                className="animate-rise flex gap-3 text-[1.0625rem] leading-relaxed text-pretty"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sage" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          /* Skeleton rather than a spinner — the card keeps its shape. */
          <ul className="mt-3 space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sunk" />
                <span
                  className="h-4 animate-pulse rounded-full bg-sunk"
                  style={{ width: `${72 - i * 12}%` }}
                />
              </li>
            ))}
          </ul>
        )}

        {advice && (
          <>
            <div className="my-5 h-px bg-border" />
            <h2 className="text-sm font-bold text-muted">What not to say</h2>
            <ul className="mt-3 space-y-3">
              {advice.avoid.map((line, index) => (
                <li
                  key={line}
                  className="animate-rise flex gap-3 text-[1.0625rem] leading-relaxed text-muted text-pretty"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-border" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="relative">
        <Helplines />
      </div>
    </main>
  );
}

export default function CaregiverPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-cream" />}>
      <CaregiverView />
    </Suspense>
  );
}
