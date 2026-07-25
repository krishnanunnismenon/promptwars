"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AnchorMark, AnchorWordmark, SoftBlobs } from "@/components/AnchorMark";
import { useAppState } from "@/lib/useAppState";

/**
 * Home: the day count, and one button you can hit without looking.
 *
 * Everything else on this screen is deliberately absent. The count doubles as
 * the way into the timeline so there is no nav to read at 2am.
 */
export default function Home() {
  const router = useRouter();
  const { state, hydrated } = useAppState();

  const onboarded = Boolean(state.profile.name && state.persona.systemPrompt);

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/onboarding");
  }, [hydrated, onboarded, router]);

  if (!hydrated || !onboarded) return <main className="min-h-dvh bg-cream" />;

  const days = Math.max(1, state.cleanDays);

  return (
    <main className="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden px-6 pt-8 pb-12">
      <SoftBlobs />

      <header className="relative flex items-center justify-between text-clay">
        <AnchorWordmark />
        <button
          type="button"
          onClick={() => router.push("/caregiver")}
          className="min-h-11 rounded-full px-4 text-sm font-semibold text-muted transition duration-150 ease-out hover:bg-sunk/70 active:scale-[0.97]"
        >
          Caregiver
        </button>
      </header>

      {/* The count is the tap target for the timeline — no extra chrome. */}
      <button
        type="button"
        onClick={() => router.push("/timeline")}
        aria-label={`${days} days in. Open your timeline.`}
        className="relative flex flex-1 flex-col items-center justify-center rounded-[var(--radius-card)] transition duration-150 ease-out active:scale-[0.98]"
      >
        <span className="animate-breathe absolute size-56 rounded-full bg-sage/20 blur-3xl" />
        <span className="relative text-[6.5rem] leading-none font-bold tracking-[-0.04em]">
          {days}
        </span>
        <span className="relative mt-2 text-base font-semibold text-muted">
          {days === 1 ? "day" : "days"} anchored
        </span>
        <span className="relative mt-6 inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm font-medium text-muted shadow-[var(--shadow-card)]">
          <AnchorMark className="size-3.5 text-sage-ink" />
          See your timeline
        </span>
      </button>

      <button
        type="button"
        onClick={() => router.push("/call")}
        className="relative min-h-40 w-full rounded-[2.25rem] bg-clay text-[1.75rem] font-bold text-on-clay shadow-[var(--shadow-lift)] transition duration-150 ease-out hover:brightness-110 active:scale-[0.98]"
      >
        <span className="animate-breathe absolute -inset-2 -z-10 rounded-[2.5rem] bg-clay/30 blur-2xl" />
        I&apos;m struggling
        <span className="mt-1.5 block text-base font-medium text-on-clay/75">
          We&apos;ll call you right back
        </span>
      </button>
    </main>
  );
}
