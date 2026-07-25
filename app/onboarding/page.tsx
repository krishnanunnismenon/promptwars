"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { MorrowMark, SoftBlobs } from "@/components/MorrowMark";
import { SelfieStep } from "@/components/onboarding/SelfieStep";
import { SAMPLE_TRANSCRIPT, VoiceNoteStep } from "@/components/onboarding/VoiceNoteStep";
import {
  ChipGrid,
  GhostButton,
  PrimaryButton,
  ProgressDots,
  StepShell,
} from "@/components/onboarding/ui";
import { useAppState } from "@/lib/useAppState";
import type { FutureSelfPersona } from "@/lib/types";

const SUBSTANCES = [
  "Alcohol",
  "Nicotine",
  "Cannabis",
  "Opioids",
  "Cocaine",
  "Meth",
  "Pills",
  "Something else",
] as const;

const DURATIONS = [
  "Under 6 months",
  "6–12 months",
  "1–2 years",
  "2–5 years",
  "5–10 years",
  "10+ years",
] as const;

const LOSSES = ["Relationships", "Health", "Money", "Self-respect", "Time", "Career"] as const;

const DREAMS = [
  "Relationships",
  "Health",
  "Money",
  "Self-respect",
  "Time",
  "Career",
  "Mornings",
  "Someone's trust",
] as const;

const TOTAL_STEPS = 8;
/** Rendered after the last question while the persona is generated. */
const BUILDING_STEP = TOTAL_STEPS;

export default function OnboardingPage() {
  const router = useRouter();
  const { state, commit, updateProfile } = useAppState();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const profile = state.profile;

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((current) => current + 1);
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((current) => Math.max(0, current - 1));
  }, []);

  /** Single-select chips: record the answer, then move on by themselves. */
  const pickOne = useCallback(
    (patch: Parameters<typeof updateProfile>[0]) => {
      updateProfile(patch);
      setTimeout(goNext, 220); // let the chip's selected state land first
    },
    [goNext, updateProfile],
  );

  const toggleInList = useCallback(
    (key: "losses" | "dreams", label: string) => {
      const current = profile[key];
      updateProfile({
        [key]: current.includes(label)
          ? current.filter((item) => item !== label)
          : [...current, label],
      });
    },
    [profile, updateProfile],
  );

  const setTranscript = useCallback(
    (voiceNoteTranscript: string) => updateProfile({ voiceNoteTranscript }),
    [updateProfile],
  );

  const finish = useCallback(async () => {
    setDirection(1);
    setStep(BUILDING_STEP);

    let persona: FutureSelfPersona | null = null;
    try {
      const response = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const payload = (await response.json()) as { persona?: FutureSelfPersona };
      persona = payload?.persona ?? null;
    } catch {
      // /api/persona already falls back server-side; this covers a dead network.
    }

    // Awaited, not debounced: the next line unmounts this screen, and the
    // persona is the one write we can't afford to lose.
    await commit({
      ...state,
      persona: persona ?? state.persona,
      cleanDays: state.cleanDays || 1,
    });
    router.push("/");
  }, [commit, profile, router, state]);

  if (step === BUILDING_STEP) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-7 overflow-hidden px-6">
        <SoftBlobs />
        <div className="relative">
          <span className="animate-breathe absolute -inset-6 rounded-full bg-sage/25 blur-2xl" />
          <MorrowMark className="relative size-14 text-clay" />
        </div>
        <div className="relative text-center">
          <p className="text-xl font-bold">Building your future self</p>
          <p className="mt-2 text-base text-muted">One moment — we&apos;re reading it all back.</p>
        </div>
      </main>
    );
  }
  const screens = [
    <StepShell
      key="name"
      stepKey={step}
      direction={direction}
      title="What should we call you?"
      subtitle="This is the only thing you'll need to type."
      footer={
        <PrimaryButton onClick={goNext} disabled={!profile.name.trim()}>
          Continue
        </PrimaryButton>
      }
    >
      <input
        autoFocus
        value={profile.name}
        onChange={(event) => updateProfile({ name: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter" && profile.name.trim()) goNext();
        }}
        placeholder="Your name"
        enterKeyHint="next"
        autoComplete="given-name"
        className="w-full border-b-2 border-border bg-transparent pb-3 text-4xl font-bold tracking-tight outline-none placeholder:font-medium placeholder:text-muted/70 focus:border-clay focus:outline-none"
      />
    </StepShell>,

    <StepShell
      key="substance"
      stepKey={step}
      direction={direction}
      title="What are we leaving behind?"
      footer={<GhostButton onClick={goBack}>Back</GhostButton>}
    >
      <ChipGrid
        options={SUBSTANCES}
        selected={profile.substance ? [profile.substance] : []}
        onToggle={(substance) => pickOne({ substance })}
      />
    </StepShell>,

    <StepShell
      key="duration"
      stepKey={step}
      direction={direction}
      title="How long has it been with you?"
      footer={<GhostButton onClick={goBack}>Back</GhostButton>}
    >
      <ChipGrid
        options={DURATIONS}
        selected={profile.duration ? [profile.duration] : []}
        onToggle={(duration) => pickOne({ duration })}
      />
    </StepShell>,

    <StepShell
      key="losses"
      stepKey={step}
      direction={direction}
      title="What has it taken from you?"
      subtitle="Tap everything that fits. There's no wrong answer here."
      footer={
        <>
          <PrimaryButton onClick={goNext} disabled={profile.losses.length === 0}>
            Continue
          </PrimaryButton>
          <GhostButton onClick={goBack}>Back</GhostButton>
        </>
      }
    >
      <ChipGrid
        options={LOSSES}
        selected={profile.losses}
        onToggle={(label) => toggleInList("losses", label)}
      />
    </StepShell>,

    <StepShell
      key="dreams"
      stepKey={step}
      direction={direction}
      title="What do you want back?"
      subtitle="Tap everything you're going after."
      footer={
        <>
          <PrimaryButton onClick={goNext} disabled={profile.dreams.length === 0}>
            Continue
          </PrimaryButton>
          <GhostButton onClick={goBack}>Back</GhostButton>
        </>
      }
    >
      <ChipGrid
        options={DREAMS}
        selected={profile.dreams}
        onToggle={(label) => toggleInList("dreams", label)}
      />
    </StepShell>,

    <StepShell
      key="voice"
      stepKey={step}
      direction={direction}
      title="Describe your life one year from now."
      subtitle="Tap the mic and just talk. However it comes out is fine."
      footer={
        <>
          <PrimaryButton onClick={goNext} disabled={!profile.voiceNoteTranscript.trim()}>
            Continue
          </PrimaryButton>
          <GhostButton
            onClick={() => {
              if (!profile.voiceNoteTranscript.trim()) setTranscript(SAMPLE_TRANSCRIPT);
              goNext();
            }}
          >
            Skip for now
          </GhostButton>
        </>
      }
    >
      <VoiceNoteStep value={profile.voiceNoteTranscript} onChange={setTranscript} />
    </StepShell>,

    <StepShell
      key="selfie"
      stepKey={step}
      direction={direction}
      title="Add a photo of yourself?"
      subtitle="Optional. It stays on your device and in your own database."
      footer={
        <>
          <PrimaryButton onClick={goNext}>{profile.photoBase64 ? "Continue" : "Next"}</PrimaryButton>
          <GhostButton onClick={goBack}>Back</GhostButton>
        </>
      }
    >
      <SelfieStep
        value={profile.photoBase64}
        onChange={(photoBase64) => updateProfile({ photoBase64 })}
        onUploaded={(photoUrl) => updateProfile({ photoUrl })}
      />
    </StepShell>,

    <StepShell
      key="caregiver"
      stepKey={step}
      direction={direction}
      title="Is there someone in your corner?"
      subtitle="Optional. We'll bring their words with us when it gets hard."
      footer={
        <>
          <PrimaryButton onClick={() => void finish()}>Finish</PrimaryButton>
          <GhostButton onClick={goBack}>Back</GhostButton>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="sr-only">Caregiver name</span>
        <input
          value={profile.caregiverName ?? ""}
          onChange={(event) => updateProfile({ caregiverName: event.target.value })}
          placeholder="Their name"
          className="min-h-16 w-full rounded-[1.375rem] border border-border bg-surface px-5 text-lg shadow-[var(--shadow-card)] outline-none placeholder:text-muted focus:border-clay focus:outline-none"
        />
        </label>
        <label className="block">
          <span className="sr-only">Caregiver phone number</span>
          <input
            value={profile.caregiverPhone ?? ""}
            onChange={(event) => updateProfile({ caregiverPhone: event.target.value })}
            inputMode="tel"
            autoComplete="tel"
            placeholder="Their phone number (for one-tap help)"
            className="min-h-16 w-full rounded-[1.375rem] border border-border bg-surface px-5 text-lg shadow-[var(--shadow-card)] outline-none placeholder:text-muted focus:border-clay focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="sr-only">A supportive thing the caregiver said</span>
        <input
          value={profile.caregiverQuote ?? ""}
          onChange={(event) => updateProfile({ caregiverQuote: event.target.value })}
          placeholder="One thing they said to you"
          className="min-h-16 w-full rounded-[1.375rem] border border-border bg-surface px-5 text-lg shadow-[var(--shadow-card)] outline-none placeholder:text-muted focus:border-clay focus:outline-none"
        />
        </label>
      </div>
    </StepShell>,
  ];

  return (
    <main className="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
      <SoftBlobs />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ProgressDots total={TOTAL_STEPS} current={step} />
        {screens[step]}
      </div>
    </main>
  );
}
