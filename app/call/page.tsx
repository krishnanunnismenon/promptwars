"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Waveform } from "@/components/call/Waveform";
import { useCallEngine } from "@/lib/callEngine";
import { useRingtone } from "@/lib/ringtone";
import { useAppState } from "@/lib/useAppState";

/**
 * Set this to the crisis line for your region before shipping. Left empty on
 * purpose — a wrong number here is worse than no number.
 */
const HELPLINE_NUMBER = "";
const HELPLINE_LABEL = "a crisis helpline";

const COMMITMENT_MS = 10 * 60 * 1000;

type Screen = "incoming" | "in-call" | "ended";

const mmss = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export default function CallPage() {
  const router = useRouter();
  const { state, hydrated, update } = useAppState();
  const [screen, setScreen] = useState<Screen>("incoming");
  const [showHelp, setShowHelp] = useState(false);
  const [countdown, setCountdown] = useState(COMMITMENT_MS);

  useRingtone(screen === "incoming");
  const { snapshot, engine } = useCallEngine(state, screen === "in-call");

  const getLevel = useCallback(() => engine.current?.level ?? 0.05, [engine]);

  const finish = useCallback(
    (outcome: "calmed" | "escalated") => {
      engine.current?.end();
      update((previous) => ({
        ...previous,
        callHistory: [...previous.callHistory, { timestamp: Date.now(), outcome }],
      }));
      setScreen("ended");
    },
    [engine, update],
  );

  // Ten-minute commitment countdown on the ended screen.
  useEffect(() => {
    if (screen !== "ended") return;
    const startedAt = Date.now();
    const id = setInterval(() => setCountdown(COMMITMENT_MS - (Date.now() - startedAt)), 250);
    return () => clearInterval(id);
  }, [screen]);

  const backdrop = useMemo(() => {
    const photo = state.profile.photoBase64;
    if (photo) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-3xl saturate-150"
        />
      );
    }
    return (
      <div
        aria-hidden
        className="absolute top-1/4 left-1/2 size-[26rem] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(124,92,255,0.55), rgba(124,92,255,0.12) 55%, transparent 72%)",
        }}
      />
    );
  }, [state.profile.photoBase64]);

  if (!hydrated) return <main className="min-h-dvh bg-black" />;

  /* ---------------------------------------------------------------- */

  if (screen === "incoming") {
    return (
      <main className="relative flex h-dvh flex-col overflow-hidden bg-black">
        {backdrop}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />

        <div className="relative flex flex-1 flex-col items-center pt-24">
          <p className="text-sm tracking-[0.2em] text-white/40 uppercase">Incoming call</p>

          <div className="relative mt-12">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
            <div className="relative flex size-32 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 backdrop-blur">
              {state.profile.photoBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.profile.photoBase64}
                  alt=""
                  className="size-full object-cover blur-[6px]"
                />
              ) : (
                <svg viewBox="0 0 24 24" className="size-16 text-white/70" fill="currentColor">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0z" />
                </svg>
              )}
            </div>
          </div>

          <h1 className="mt-8 px-8 text-center text-3xl font-medium text-white">
            You — one year from now
          </h1>
          <p className="mt-2 text-base text-white/40">mobile</p>
        </div>

        <div className="relative flex items-center justify-between px-14 pb-20">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Decline"
            className="flex size-20 items-center justify-center rounded-full bg-red-600 transition active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="size-9 rotate-[135deg] text-white" fill="currentColor">
              <path d="M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.25 1z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setScreen("in-call")}
            aria-label="Answer"
            className="relative flex size-20 items-center justify-center rounded-full bg-emerald-500 transition active:scale-90"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" />
            <svg viewBox="0 0 24 24" className="relative size-9 text-white" fill="currentColor">
              <path d="M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.25 1z" />
            </svg>
          </button>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------- */

  if (screen === "in-call") {
    return (
      <main className="relative flex h-dvh flex-col overflow-hidden bg-black">
        {backdrop}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black" />

        <header className="relative pt-16 text-center">
          <h1 className="text-2xl font-medium text-white">You — one year from now</h1>
          <p className="mt-2 font-mono text-sm text-white/40 tabular-nums">
            {mmss(snapshot.elapsedMs)}
          </p>
        </header>

        {(snapshot.frame || snapshot.cameraOpen) && (
          <div className="absolute top-32 right-5 z-10 overflow-hidden rounded-2xl border border-white/15 bg-black/60 shadow-2xl backdrop-blur">
            {snapshot.frame ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={snapshot.frame} alt="" className="h-32 w-24 object-cover" />
            ) : (
              <div className="flex h-32 w-24 items-center justify-center">
                <span className="size-3 animate-pulse rounded-full bg-red-500" />
              </div>
            )}
          </div>
        )}

        <section className="relative flex flex-1 flex-col justify-center px-6">
          <Waveform getLevel={getLevel} />
          <p className="mt-8 min-h-24 text-center text-xl leading-relaxed text-white/85">
            {snapshot.caption ||
              (snapshot.phase === "listening"
                ? "…"
                : snapshot.phase === "thinking"
                  ? ""
                  : "")}
          </p>
          {snapshot.micDenied && (
            <p className="mt-2 text-center text-sm text-white/35">
              Mic is off — that&apos;s okay. Just listen.
            </p>
          )}
        </section>

        <footer className="relative space-y-5 px-8 pb-14">
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="min-h-14 w-full rounded-2xl border border-red-500/40 bg-red-500/10 text-base font-medium text-red-300 transition active:scale-[0.98]"
          >
            I need real help
          </button>

          <div className="flex items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => engine.current?.captureNow()}
              disabled={snapshot.cameraOpen}
              aria-label="Show where you are"
              className="flex size-16 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition active:scale-90 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7">
                <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.9l1.2-2h6.8l1.2 2h1.9A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
                <circle cx="12" cy="12.5" r="3.5" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => engine.current?.toggleMute()}
              aria-label={snapshot.muted ? "Unmute" : "Mute"}
              className={`flex size-20 items-center justify-center rounded-full border transition active:scale-90 ${
                snapshot.muted
                  ? "border-white/20 bg-white text-black"
                  : "border-white/15 bg-white/10 text-white"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="size-8">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
                {snapshot.muted && <path d="M4 3l16 18" />}
              </svg>
            </button>

            <button
              type="button"
              onClick={() => finish("calmed")}
              aria-label="End call"
              className="flex size-20 items-center justify-center rounded-full bg-red-600 transition active:scale-90"
            >
              <svg viewBox="0 0 24 24" className="size-9 rotate-[135deg] text-white" fill="currentColor">
                <path d="M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.25 1z" />
              </svg>
            </button>
          </div>
        </footer>

        {showHelp && (
          <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/80 p-6 pb-14 backdrop-blur-sm">
            <div className="space-y-4 rounded-3xl border border-white/10 bg-surface p-6">
              <h2 className="text-2xl font-semibold text-white">Let&apos;s get someone real.</h2>
              {state.profile.caregiverName ? (
                <p className="text-lg leading-relaxed text-white/70">
                  Call {state.profile.caregiverName} right now. They asked you to.
                </p>
              ) : (
                <p className="text-lg leading-relaxed text-white/70">
                  Call someone you trust right now, or {HELPLINE_LABEL}.
                </p>
              )}

              {HELPLINE_NUMBER && (
                <a
                  href={`tel:${HELPLINE_NUMBER}`}
                  className="flex min-h-16 w-full items-center justify-center rounded-2xl bg-red-600 text-lg font-medium text-white"
                >
                  Call {HELPLINE_NUMBER}
                </a>
              )}

              <button
                type="button"
                onClick={() => finish("escalated")}
                className="min-h-16 w-full rounded-2xl border border-white/15 text-lg text-white/80"
              >
                End this call
              </button>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="min-h-12 w-full text-base text-white/40"
              >
                Go back
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  /* ---------------------------------------------------------------- */

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-10 bg-black px-8">
      <div className="text-center">
        <h1 className="text-3xl font-medium text-white">Call ended</h1>
        <p className="mt-3 text-lg text-white/50">Timer started. Ten minutes, together.</p>
      </div>

      <div className="relative flex size-56 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute size-full -rotate-90">
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 46}
            strokeDashoffset={2 * Math.PI * 46 * (1 - Math.max(0, countdown) / COMMITMENT_MS)}
            className="transition-[stroke-dashoffset] duration-200"
          />
        </svg>
        <span className="font-mono text-5xl text-white tabular-nums">{mmss(countdown)}</span>
      </div>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="min-h-16 w-full max-w-sm rounded-2xl border border-white/15 text-lg text-white/80 transition active:scale-[0.98]"
      >
        {countdown > 0 ? "I'm okay for now" : "Ten minutes done"}
      </button>
    </main>
  );
}
