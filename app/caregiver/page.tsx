"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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

  if (!ready) return <main className="min-h-dvh bg-background" />;

  if (!state || !state.profile.name) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">Nothing to show yet</h1>
        <p className="text-lg text-muted">
          This page fills in once they&apos;ve finished setting up.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-10">
      {escalated && (
        <section
          role="alert"
          className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5"
        >
          <p className="text-xs tracking-[0.15em] text-red-300/80 uppercase">Right now</p>
          <p className="mt-2 text-xl leading-snug font-medium text-red-200">
            {name} asked for real help on a call.
          </p>
          {lastCall && (
            <p className="mt-2 text-base text-red-200/60">{formatWhen(lastCall.timestamp)}</p>
          )}
          <p className="mt-3 text-base leading-relaxed text-red-100/70">
            Call {name} now, or just go to them. You don&apos;t need the right words.
          </p>
        </section>
      )}

      <header>
        <p className="text-sm tracking-[0.15em] text-muted uppercase">
          {state.profile.caregiverName ? `For ${state.profile.caregiverName}` : "For you"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">How {name} is doing</h1>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-5xl font-semibold tabular-nums">{Math.max(1, state.cleanDays)}</p>
          <p className="mt-1 text-sm text-muted">
            {state.cleanDays === 1 ? "day" : "days"} clean
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          {lastCall ? (
            <>
              <p className="text-lg leading-snug font-medium">
                {escalated ? `${name} asked for help.` : `${name} answered. ${name}'s okay.`}
              </p>
              <p className="mt-2 text-sm text-muted">{formatWhen(lastCall.timestamp)}</p>
            </>
          ) : (
            <>
              <p className="text-lg leading-snug font-medium">No calls yet.</p>
              <p className="mt-2 text-sm text-muted">That&apos;s good news.</p>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xs tracking-[0.15em] text-muted uppercase">What to say tonight</h2>
        {advice ? (
          <ul className="mt-3 space-y-3">
            {advice.say.map((line) => (
              <li key={line} className="flex gap-3 text-lg leading-relaxed">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-base text-muted">Thinking about tonight…</p>
        )}

        {advice && (
          <>
            <h2 className="mt-6 text-xs tracking-[0.15em] text-muted uppercase">
              What not to say
            </h2>
            <ul className="mt-3 space-y-3">
              {advice.avoid.map((line) => (
                <li key={line} className="flex gap-3 text-lg leading-relaxed text-muted">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted/50" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Helplines tone="surface" />
    </main>
  );
}

export default function CaregiverPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-background" />}>
      <CaregiverView />
    </Suspense>
  );
}
