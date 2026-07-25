"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAppState } from "@/lib/useAppState";

/** Home: the clean-day count, and one button you can hit without looking. */
export default function Home() {
  const router = useRouter();
  const { state, hydrated } = useAppState();

  const onboarded = Boolean(state.profile.name && state.persona.systemPrompt);

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/onboarding");
  }, [hydrated, onboarded, router]);

  if (!hydrated || !onboarded) return <main className="min-h-dvh bg-background" />;

  const days = Math.max(1, state.cleanDays);

  return (
    <main className="flex h-dvh flex-col items-center justify-between px-6 py-16">
      {/* The count itself is the way into the timeline — no extra chrome. */}
      <button
        type="button"
        onClick={() => router.push("/timeline")}
        aria-label="Open your timeline"
        className="flex flex-1 flex-col items-center justify-center transition active:scale-[0.98]"
      >
        <span className="text-[7rem] leading-none font-semibold tracking-tight tabular-nums">
          {days}
        </span>
        <span className="mt-3 text-lg tracking-[0.2em] text-muted uppercase">
          {days === 1 ? "day" : "days"} clean
        </span>
      </button>

      <button
        type="button"
        onClick={() => router.push("/call")}
        className="relative min-h-44 w-full rounded-[2rem] bg-accent text-3xl font-semibold text-white transition active:scale-[0.98]"
      >
        <span className="absolute inset-0 animate-pulse rounded-[2rem] bg-accent/30 blur-xl" />
        <span className="relative">I&apos;m struggling</span>
      </button>
    </main>
  );
}
