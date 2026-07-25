"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SoftBlobs } from "@/components/MorrowMark";
import { CaregiverNoteCard, useCaregiverNote } from "@/components/CaregiverNote";
import { Helplines } from "@/components/Helplines";
import { Waveform } from "@/components/call/Waveform";
import { useCallEngine } from "@/lib/callEngine";
import { useRingtone } from "@/lib/ringtone";
import { useAppState } from "@/lib/useAppState";

/**
 * The call runs on the night surface — deep espresso, not the cream used
 * everywhere else. This screen appears at 2am on a phone at low brightness,
 * and it needs the gravity of a real incoming call.
 */

const COMMITMENT_MS = 10 * 60 * 1000;

type Screen = "incoming" | "in-call" | "ended";

const mmss = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Shared by answer/decline/end — one shape, three intents. */
function CallButton({
  intent,
  label,
  onClick,
  ringing,
}: {
  intent: "answer" | "decline";
  label: string;
  onClick: () => void;
  ringing?: boolean;
}) {
  const answer = intent === "answer";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative flex size-[4.5rem] items-center justify-center rounded-full transition duration-150 ease-out active:scale-90 ${
        answer ? "bg-sage" : "bg-danger"
      }`}
    >
      {ringing && answer && (
        <span className="animate-breathe absolute -inset-2 rounded-full bg-sage/35" aria-hidden />
      )}
      <svg
        viewBox="0 0 24 24"
        className={`relative size-8 text-white ${answer ? "" : "rotate-[135deg]"}`}
        fill="currentColor"
        aria-hidden
      >
        <path d="M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.25 1z" />
      </svg>
    </button>
  );
}

export default function CallPage() {
  const router = useRouter();
  const { state, hydrated, update } = useAppState();
  const note = useCaregiverNote();
  const [screen, setScreen] = useState<Screen>("incoming");
  const [showHelp, setShowHelp] = useState(false);
  const [messageOpened, setMessageOpened] = useState(false);
  const [countdown, setCountdown] = useState(COMMITMENT_MS);
  const [summary, setSummary] = useState<string | null>(null);
  const safetyHandled = useRef(false);
  /** Timestamp of the escalation record, so its summary patches the right row. */
  const lastEscalationStamp = useRef<number | null>(null);

  useRingtone(screen === "incoming");
  const { snapshot, engine } = useCallEngine(state, screen === "in-call");

  const getLevel = useCallback(() => engine.current?.level ?? 0.05, [engine]);

  /**
   * `outcome: null` ends without logging — used when escalation already did.
   *
   * The record is written immediately so nothing is lost if the summary call
   * fails or the user closes the tab; the summary is patched onto it after.
   */
  const finish = useCallback(
    (outcome: "calmed" | "escalated" | null) => {
      const active = engine.current;
      const transcript = active?.transcript ?? [];
      const durationMs = active?.durationMs ?? 0;
      const timestamp = Date.now();

      active?.end();

      if (outcome) {
        update((previous) => ({
          ...previous,
          callHistory: [...previous.callHistory, { timestamp, outcome, durationMs }],
        }));
      }
      setScreen("ended");

      // Summarise in the background; the ended screen doesn't wait on it.
      const stamp = outcome ? timestamp : lastEscalationStamp.current;
      if (stamp && transcript.length > 0) {
        void fetch("/api/call-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, profile: state.profile }),
        })
          .then((response) => response.json())
          .then((payload: { summary?: string; mood?: string; triggers?: string[]; whatHelped?: string }) => {
            if (!payload?.summary) return;
            setSummary(payload.summary);
            update((previous) => ({
              ...previous,
              callHistory: previous.callHistory.map((record) =>
                record.timestamp === stamp
                  ? {
                      ...record,
                      durationMs: record.durationMs ?? durationMs,
                      summary: payload.summary,
                      mood: payload.mood,
                      triggers: payload.triggers,
                      whatHelped: payload.whatHelped,
                    }
                  : record,
              ),
            }));
          })
          .catch(() => {
            /* the call record stands on its own without a summary */
          });
      }
    },
    [engine, state.profile, update],
  );

  // The engine closes the call itself once it runs out of time.
  useEffect(() => {
    if (screen === "in-call" && snapshot.phase === "ended") finish("calmed");
  }, [finish, screen, snapshot.phase]);

  /**
   * Logged the moment it's pressed, not when the call ends — the caregiver
   * view should light up while this person is still on the phone.
   */
  const escalate = useCallback(() => {
    if (safetyHandled.current) return;
    safetyHandled.current = true;
    const timestamp = Date.now();
    lastEscalationStamp.current = timestamp;
    update((previous) => ({
      ...previous,
      callHistory: [...previous.callHistory, { timestamp, outcome: "escalated" as const }],
    }));
    void engine.current?.escalate(state.profile.caregiverName);
    setShowHelp(true);
  }, [engine, state.profile.caregiverName, update]);

  // Hard safety routing for high-risk spoken phrases. This happens before any
  // generated reply can make the decision ambiguous.
  useEffect(() => {
    if (snapshot.risk === "urgent") escalate();
  }, [escalate, snapshot.risk]);

  const caregiverNumber = (state.profile.caregiverPhone ?? "").replace(/[^+\d]/g, "");
  const caregiverMessage = `${state.profile.name || "I"} needs support right now. Please call or check in as soon as you can.`;
  const smsHref = caregiverNumber ? `sms:${caregiverNumber}?body=${encodeURIComponent(caregiverMessage)}` : "";
  const whatsappHref = caregiverNumber
    ? `https://wa.me/${caregiverNumber.replace(/^\+/, "")}?text=${encodeURIComponent(caregiverMessage)}`
    : "";

  useEffect(() => {
    if (screen !== "ended") return;
    const startedAt = Date.now();
    const id = setInterval(() => setCountdown(COMMITMENT_MS - (Date.now() - startedAt)), 250);
    return () => clearInterval(id);
  }, [screen]);

  const portrait = useMemo(() => {
    const photo = state.profile.photoBase64;
    return (
      <div className="relative">
        <span className="animate-breathe absolute -inset-5 rounded-full bg-clay/40 blur-2xl" aria-hidden />
        <div className="relative flex size-32 items-center justify-center overflow-hidden rounded-full border border-night-ink/15 bg-night-raised">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full scale-110 object-cover blur-[5px]" />
          ) : (
            <svg viewBox="0 0 24 24" className="size-20 text-night-ink/60" fill="currentColor" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0z" />
            </svg>
          )}
        </div>
      </div>
    );
  }, [state.profile.photoBase64]);

  if (!hydrated) return <main className="min-h-dvh bg-night" />;

  /* ---------------------------------------------------------------- */

  if (screen === "incoming") {
    return (
      <main className="night relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-night text-night-ink">
        <SoftBlobs tone="night" />

        <div className="relative flex flex-1 flex-col items-center pt-24">
          <p className="text-sm font-semibold text-night-muted">Incoming call</p>
          <div className="mt-11">{portrait}</div>
          <h1 className="mt-8 px-8 text-center text-[1.75rem] leading-tight font-bold text-balance">
            You — one year from now
          </h1>
          <p className="mt-2 text-base text-night-muted">wants to talk for ten minutes</p>

          {/* Their person's words, while the phone is still ringing. */}
          {note && (
            <div className="mt-9 w-full px-6">
              <CaregiverNoteCard note={note} tone="night" />
            </div>
          )}
        </div>

        <div className="relative flex items-center justify-between px-14 pb-20">
          <CallButton intent="decline" label="Decline" onClick={() => router.push("/")} />
          <CallButton intent="answer" label="Answer" ringing onClick={() => setScreen("in-call")} />
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------- */

  if (screen === "in-call") {
    return (
      <main className="night relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-night text-night-ink">
        <SoftBlobs tone="night" />

        <header className="relative pt-14 text-center">
          <h1 className="text-xl font-bold">You — one year from now</h1>
          <p className="mt-1.5 text-sm text-night-muted">{mmss(snapshot.elapsedMs)}</p>
        </header>

        {(snapshot.frame || snapshot.cameraOpen) && (
          <div className="absolute top-28 right-5 z-20 overflow-hidden rounded-2xl border border-night-ink/15 bg-night-raised shadow-[var(--shadow-lift)]">
            {snapshot.frame ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={snapshot.frame} alt="" className="h-32 w-24 object-cover" />
            ) : (
              <div className="flex h-32 w-24 items-center justify-center">
                <span className="animate-breathe size-2.5 rounded-full bg-night-danger" />
              </div>
            )}
          </div>
        )}

        <section aria-label="Conversation view" className="relative flex flex-1 flex-col justify-center px-7">
          <Waveform getLevel={getLevel} />
          <p
            aria-live="polite"
            aria-atomic="true"
            role="status"
            className="mt-8 min-h-24 text-center text-xl leading-relaxed text-night-ink/90 text-pretty"
          >
            {snapshot.caption}
          </p>
          {snapshot.micDenied && (
            <p className="mt-1 text-center text-sm text-night-muted">
              Mic is off — that&apos;s okay. Just listen.
            </p>
          )}
        </section>

        <footer className="relative space-y-6 px-7 pb-14">
          <button
            type="button"
            onClick={escalate}
            className="min-h-14 w-full rounded-full border border-night-danger/45 bg-night-danger/12 text-base font-semibold text-night-danger transition duration-150 ease-out active:scale-[0.98]"
          >
            I need real help
          </button>

          <div className="flex items-center justify-center gap-7">
            <button
              type="button"
              onClick={() => engine.current?.captureNow()}
              disabled={snapshot.cameraOpen}
              aria-label="Show where you are"
              className="flex size-16 items-center justify-center rounded-full border border-night-ink/15 bg-night-raised text-night-ink transition duration-150 ease-out active:scale-90 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7" aria-hidden>
                <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.9l1.2-2h6.8l1.2 2h1.9A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
                <circle cx="12" cy="12.5" r="3.5" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => engine.current?.toggleMute()}
              aria-label={snapshot.muted ? "Unmute" : "Mute"}
              aria-pressed={snapshot.muted}
              className={`flex size-[4.5rem] items-center justify-center rounded-full border transition duration-150 ease-out active:scale-90 ${
                snapshot.muted
                  ? "border-transparent bg-night-ink text-night"
                  : "border-night-ink/15 bg-night-raised text-night-ink"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="size-8" aria-hidden>
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
                {snapshot.muted && <path d="M4 3l16 18" />}
              </svg>
            </button>

            <CallButton intent="decline" label="End call" onClick={() => finish("calmed")} />
          </div>
        </footer>

        {showHelp && (
          <div className="absolute inset-0 z-30 flex flex-col justify-end bg-night/85 p-5 pb-12 backdrop-blur-sm">
            <div className="animate-slide-in-right space-y-4 rounded-[var(--radius-card)] border border-night-ink/12 bg-night-raised p-6">
              <h2 className="text-2xl font-bold text-balance">
                {state.profile.caregiverName
                  ? `Let ${state.profile.caregiverName} know now.`
                  : "Bring someone in now."}
              </h2>
              <p className="text-lg leading-relaxed text-night-ink/75 text-pretty">
                We&apos;ve prepared the message. One tap opens your phone&apos;s messaging app — you stay in control of sending it.
              </p>

              {caregiverNumber ? (
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`tel:${caregiverNumber}`}
                    className="flex min-h-14 items-center justify-center rounded-full bg-sage px-4 text-center font-semibold text-night"
                  >
                    Call now
                  </a>
                  <a
                    href={smsHref}
                    onClick={() => setMessageOpened(true)}
                    className="flex min-h-14 items-center justify-center rounded-full border border-night-ink/20 px-4 text-center font-semibold text-night-ink"
                  >
                    Text {state.profile.caregiverName || "them"}
                  </a>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMessageOpened(true)}
                    className="col-span-2 flex min-h-12 items-center justify-center rounded-full text-sm font-semibold text-night-muted hover:bg-night-ink/10"
                  >
                    Or open WhatsApp
                  </a>
                  {messageOpened && (
                    <p role="status" className="col-span-2 text-center text-sm text-night-muted">
                      Message opened. Tap send, then come straight back here.
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-2xl bg-night/45 px-4 py-3 text-sm leading-relaxed text-night-muted">
                  No number is saved yet. Use the urgent support line below, or call someone you trust.
                </p>
              )}

              <Helplines tone="night" />

              <button
                type="button"
                onClick={() => finish(null)}
                className="min-h-15 w-full rounded-full border border-night-ink/20 text-lg font-semibold text-night-ink/85 transition duration-150 ease-out active:scale-[0.98]"
              >
                End this call
              </button>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="min-h-12 w-full text-base font-medium text-night-muted"
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

  const progress = Math.max(0, countdown) / COMMITMENT_MS;

  return (
    <main className="night relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 overflow-hidden bg-night px-6 py-12 text-night-ink">
      <SoftBlobs tone="night" />

      <div className="relative text-center">
        <h1 className="text-[1.75rem] font-bold">Call ended</h1>
        <p className="mt-2 text-lg text-night-muted text-pretty">
          Ten minutes, together. Nothing else has to happen yet.
        </p>
      </div>

      <div className="relative flex size-52 shrink-0 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-night-ink/12" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-sage transition-[stroke-dashoffset] duration-300 ease-out"
            strokeDasharray={2 * Math.PI * 46}
            strokeDashoffset={2 * Math.PI * 46 * (1 - progress)}
          />
        </svg>
        <span className="text-5xl font-bold">{mmss(countdown)}</span>
      </div>

      {/* What they said, in their record. Appears when the summary lands. */}
      {summary && (
        <div className="animate-rise relative w-full rounded-[var(--radius-card)] border border-night-ink/12 bg-night-raised/70 p-5">
          <p className="text-sm font-bold text-night-muted">Saved to your journey</p>
          <p className="mt-2 text-[1.0625rem] leading-relaxed text-night-ink/85 text-pretty">
            {summary}
          </p>
        </div>
      )}

      <div className="relative w-full">
        <Helplines tone="night" />
      </div>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="relative min-h-15 w-full rounded-full border border-night-ink/20 text-lg font-semibold text-night-ink/85 transition duration-150 ease-out active:scale-[0.98]"
      >
        {countdown > 0 ? "I'm okay for now" : "Ten minutes done"}
      </button>
    </main>
  );
}
