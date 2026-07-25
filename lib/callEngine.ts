"use client";

import { useEffect, useRef, useState } from "react";

import { captureFrame } from "./camera";
import type { AppState, ChatTurn } from "./types";

/**
 * The call state machine.
 *
 * One pass through the loop:
 *   stream a reply → speak it sentence-by-sentence → listen → on transcript,
 *   stream the next reply. Silence is a normal input, not an error: after 8s of
 *   nothing we nudge the future self to keep talking.
 *
 * Everything degrades rather than stopping. No mic, no speech synthesis, no
 * network — the call still runs and the future self still talks.
 */

export type CallPhase =
  | "connecting"
  | "speaking"
  | "listening"
  | "thinking"
  | "ended";

/** A deliberately small, deterministic safety layer. The model never owns this decision. */
export type SafetyRisk = "support" | "urgent";

export interface CallSnapshot {
  phase: CallPhase;
  /** What the future self is saying right now, for the caption line. */
  caption: string;
  elapsedMs: number;
  muted: boolean;
  micDenied: boolean;
  commitmentOffered: boolean;
  /** True while the camera is open, so the UI can show the shutter state. */
  cameraOpen: boolean;
  /** Last captured frame, shown as picture-in-picture for a few seconds. */
  frame: string | null;
  risk: SafetyRisk;
}

const URGENT_LANGUAGE = /\b(kill myself|want to die|end my life|suicide|overdose|took too much|can't stay safe|hurt myself|harm myself)\b/i;

export function classifySafetyRisk(text: string): SafetyRisk {
  return URGENT_LANGUAGE.test(text) ? "urgent" : "support";
}

const SILENCE_MS = 8_000;
/**
 * The call is deliberately short. Someone mid-craving can't hold a long
 * conversation, and a three-minute call they finish beats a ten-minute one they
 * hang up on. At ~75s the future self asks for the ten-minute commitment; at
 * ~2:45 it closes the call itself rather than waiting to be hung up on.
 */
const COMMITMENT_AFTER_MS = 75_000;
const CALL_MAX_MS = 165_000;
const SENTENCE_GAP_MS = 190;
const SPEECH_RATE = 0.9;
/** The camera moment fires after this many real user turns. */
const CAMERA_AFTER_USER_TURNS = 2;
const FRAME_VISIBLE_MS = 7_000;

const CAMERA_LINE = "Show me where you are. Just point the camera.";

/**
 * Stage directions. Gemini has no mid-conversation system role, and the API
 * route drops `system` turns, so these ride in as bracketed user turns — the
 * persona reads them as direction and never reads them aloud.
 */
const SILENCE_NUDGE = "[user is silent — continue gently, no questions]";
const OPENING_NUDGE = "[call just connected — open the conversation yourself]";
const COMMITMENT_NUDGE =
  "[now propose the ten-minute commitment: we do nothing for ten minutes " +
  "together, then we decide. Two short sentences, then one yes/no question.]";
const WRAPUP_NUDGE =
  "[the call is ending now — close it warmly in two short sentences. Tell them " +
  "we're staying with them for the ten minutes. Ask nothing.]";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

/** Time of day, weekday and clean-day count, so the opening line lands. */
export function buildContext(state: AppState): string {
  const now = new Date();
  const hour = now.getHours();
  const partOfDay =
    hour < 5 ? "the middle of the night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "late night";
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });

  return [
    `Context for this call: it is ${partOfDay} on a ${weekday}.`,
    `They are on day ${Math.max(1, state.cleanDays)}.`,
    `Use this naturally if it helps. Do not recite it.`,
    ``,
    `LENGTH AND QUESTIONS — these override anything above:`,
    `- This call lasts about three minutes. Every reply is ONE or TWO short sentences. Never more.`,
    `- Ask only yes/no or one-word questions: "Are you sitting down?", "Home or outside?", "Water or tea?".`,
    `- Never ask anything that needs explaining. They have no energy to explain.`,
    `- It is fine to ask nothing at all and simply keep them company.`,
  ].join("\n");
}

/** Manual override for demos: localStorage.setItem("anchor:voice", "Samantha") */
const VOICE_OVERRIDE_KEY = "anchor:voice";

/**
 * Voices named "Compact", or the bare OS defaults, are the flat robotic ones.
 * The warm, human-sounding voices are the downloadable/network tiers, which
 * announce themselves as Enhanced / Premium / Neural / Natural, or (on Android)
 * are the "Google …" set. So we score rather than take the first English match.
 */
const WARM_VOICE_NAMES = [
  // macOS / iOS, warmest first. "(Enhanced)" and "(Premium)" are separate entries.
  "Samantha",
  "Ava",
  "Allison",
  "Susan",
  "Nicky",
  "Karen",
  "Moira",
  "Tessa",
  // Android / Chrome network voices — far better than the local fallbacks.
  "Google UK English Female",
  "Google US English",
];

const voiceScoreCache = new Map<string, number>();

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const cacheKey = `${voice.name}:${voice.lang}`;
  const cached = voiceScoreCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const name = voice.name.toLowerCase();
  let score = 0;

  // Quality tier does most of the work.
  if (/(neural|natural|premium|enhanced)/.test(name)) score += 60;
  if (name.startsWith("google")) score += 35;
  if (/compact/.test(name)) score -= 50;
  if (/(eloquence|espeak|pico)/.test(name)) score -= 70;

  // Then the named shortlist, best-first.
  const index = WARM_VOICE_NAMES.findIndex((candidate) =>
    name.includes(candidate.toLowerCase()),
  );
  if (index >= 0) score += 40 - index * 2;

  // Prefer the user's own locale variant, then any English.
  const lang = voice.lang?.toLowerCase() ?? "";
  if (typeof navigator !== "undefined" && lang === navigator.language?.toLowerCase()) score += 12;
  if (lang.startsWith("en")) score += 20;
  if (lang.startsWith("en-in") || lang.startsWith("en-gb")) score += 6;

  voiceScoreCache.set(cacheKey, score);
  return score;
}

/** Picks the warmest available English voice, honouring a manual override. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  try {
    const override = localStorage.getItem(VOICE_OVERRIDE_KEY);
    if (override) {
      const match = voices.find((v) => v.name.toLowerCase().includes(override.toLowerCase()));
      if (match) return match;
    }
  } catch {
    /* storage unavailable — fall through to scoring */
  }

  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : voices;

  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}

/** Every voice the device offers, for the picker on the call screen. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === "undefined") return [];
  const english = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"));
  return english.sort((a, b) => scoreVoice(b) - scoreVoice(a));
}

export function setPreferredVoice(name: string | null) {
  try {
    if (name) localStorage.setItem(VOICE_OVERRIDE_KEY, name);
    else localStorage.removeItem(VOICE_OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
}

export class CallEngine {
  private history: ChatTurn[] = [];
  private phase: CallPhase = "connecting";
  private caption = "";
  private muted = false;
  private micDenied = false;
  private commitmentOffered = false;
  private startedAt = Date.now();
  private disposed = false;

  private userTurns = 0;
  private wrappingUp = false;
  private cameraDone = false;
  private cameraOpen = false;
  private frame: string | null = null;
  private risk: SafetyRisk = "support";
  private frameTimer: ReturnType<typeof setTimeout> | null = null;

  private recognition: SpeechRecognitionLike | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private speechChain: Promise<void> = Promise.resolve();
  private voice: SpeechSynthesisVoice | null = null;
  private lastBoundaryAt = 0;
  private speakingSince = 0;

  constructor(
    private readonly systemPrompt: string,
    private readonly context: string,
    private readonly onChange: (snapshot: CallSnapshot) => void,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Public surface                                                      */
  /* ------------------------------------------------------------------ */

  get snapshot(): CallSnapshot {
    return {
      phase: this.phase,
      caption: this.caption,
      elapsedMs: Date.now() - this.startedAt,
      muted: this.muted,
      micDenied: this.micDenied,
      commitmentOffered: this.commitmentOffered,
      cameraOpen: this.cameraOpen,
      frame: this.frame,
      risk: this.risk,
    };
  }

  /**
   * 0–1 mouth-level for the waveform. Computed on demand so the canvas can
   * animate at 60fps without pushing React state every frame.
   */
  get level(): number {
    if (this.phase === "speaking") {
      const t = (Date.now() - this.speakingSince) / 1000;
      const sinceBoundary = Date.now() - this.lastBoundaryAt;
      // Word boundaries punch the level up; between them it breathes.
      const emphasis = sinceBoundary < 160 ? 0.32 : 0;
      return Math.min(1, 0.34 + emphasis + 0.2 * Math.abs(Math.sin(t * 7.5)) + 0.12 * Math.abs(Math.sin(t * 19)));
    }
    if (this.phase === "listening") return 0.1 + 0.05 * Math.abs(Math.sin(Date.now() / 420));
    if (this.phase === "thinking") return 0.16 + 0.06 * Math.abs(Math.sin(Date.now() / 260));
    return 0.06;
  }

  async start() {
    this.startedAt = Date.now();
    this.warmUpVoices();
    this.emit();
    await this.turn(OPENING_NUDGE);
  }

  /**
   * Chrome returns an empty voice list on first call and fills it
   * asynchronously. Without this the *first* sentence — the one that matters
   * most — gets the flat browser default.
   */
  private warmUpVoices() {
    if (typeof speechSynthesis === "undefined") return;
    this.voice = pickVoice(speechSynthesis.getVoices());
    if (this.voice) return;
    speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        if (!this.voice) this.voice = pickVoice(speechSynthesis.getVoices());
      },
      { once: true },
    );
  }

  /**
   * The conversation as it actually happened, for summarising. Bracketed stage
   * directions are stripped — they were never spoken and would confuse a
   * summary of what the *person* said.
   */
  get transcript(): ChatTurn[] {
    return this.history.filter(
      (turn) => !(turn.role === "user" && /^\s*\[[\s\S]*\]\s*$/.test(turn.content)),
    );
  }

  get durationMs(): number {
    return Date.now() - this.startedAt;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopListening();
    else if (this.phase === "listening") this.startListening();
    this.emit();
  }

  /**
   * "I need real help" was pressed. Cuts off whatever is being said, states
   * plainly that the caregiver is being told, and asks nothing of the user.
   */
  async escalate(caregiverName?: string) {
    if (this.disposed) return;
    this.clearSilenceTimer();
    this.stopListening();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();

    const who = caregiverName?.trim();
    await this.speakAll(
      who
        ? `I'm letting ${who} know. You don't have to do anything.`
        : `I'm getting someone to you. You don't have to do anything.`,
    );

    if (!this.disposed) this.startListening();
  }

  /** Manual trigger for the in-call camera icon. */
  captureNow() {
    if (this.disposed || this.cameraOpen) return;
    this.cameraDone = true;
    void this.cameraMoment(false);
  }

  end() {
    this.disposed = true;
    this.clearSilenceTimer();
    this.stopListening();
    if (this.frameTimer) clearTimeout(this.frameTimer);
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.setPhase("ended");
  }

  /* ------------------------------------------------------------------ */
  /* Conversation loop                                                   */
  /* ------------------------------------------------------------------ */

  /** One full exchange: send `input`, stream + speak the reply, then listen. */
  private async turn(input: string, visible = false) {
    if (this.disposed) return;

    this.clearSilenceTimer();
    this.stopListening();
    this.history.push({ role: "user", content: input });
    if (visible) {
      this.userTurns += 1;
      if (classifySafetyRisk(input) === "urgent") {
        this.risk = "urgent";
        this.emit();
      }
    }

    this.setPhase("thinking");
    this.caption = "";

    let spoken = "";
    try {
      spoken = await this.streamAndSpeak();
    } catch {
      spoken = "I'm right here. Stay with me.";
      await this.speakAll(spoken);
    }

    if (this.disposed) return;
    this.history.push({ role: "assistant", content: spoken });

    // After the second real answer, ask to see where they actually are.
    if (!this.cameraDone && this.userTurns >= CAMERA_AFTER_USER_TURNS) {
      this.cameraDone = true;
      await this.cameraMoment(true);
      return;
    }

    // Time's up: close the call ourselves rather than letting it drift.
    if (!this.wrappingUp && Date.now() - this.startedAt > CALL_MAX_MS) {
      this.wrappingUp = true;
      await this.turn(WRAPUP_NUDGE);
      if (!this.disposed) this.end();
      return;
    }

    // The future self asks for the ten minutes — once.
    if (!this.commitmentOffered && Date.now() - this.startedAt > COMMITMENT_AFTER_MS) {
      this.commitmentOffered = true;
      this.emit();
      await this.turn(COMMITMENT_NUDGE);
      return;
    }

    this.startListening();
  }

  /**
   * Speaks the invitation, grabs one frame, and injects what the camera saw so
   * the next line reacts to the real room. A refused camera is a non-event:
   * the call goes straight back to listening.
   */
  private async cameraMoment(speakInvitation: boolean) {
    this.clearSilenceTimer();
    this.stopListening();

    if (speakInvitation) await this.speakAll(CAMERA_LINE);
    if (this.disposed) return;

    this.cameraOpen = true;
    this.setPhase("thinking");

    const frame = await captureFrame();
    this.cameraOpen = false;

    if (!frame || this.disposed) {
      this.emit();
      if (!this.disposed) this.startListening();
      return;
    }

    this.showFrame(frame);

    let description = "somewhere I can't quite see";
    let risk = "unknown";
    try {
      const response = await fetch("/api/gemini/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: frame }),
      });
      const result = (await response.json()) as { description?: string; risk?: string };
      description = result?.description?.trim() || description;
      risk = result?.risk ?? "unknown";
    } catch {
      /* keep the neutral default; the call continues either way */
    }

    if (this.disposed) return;
    await this.turn(`[camera shows: ${description}, risk: ${risk}]`);
  }

  private showFrame(frame: string) {
    this.frame = frame;
    this.emit();
    if (this.frameTimer) clearTimeout(this.frameTimer);
    this.frameTimer = setTimeout(() => {
      this.frame = null;
      this.emit();
    }, FRAME_VISIBLE_MS);
  }

  /** Streams the reply, speaking each sentence as soon as it is complete. */
  private async streamAndSpeak(): Promise<string> {
    const response = await fetch("/api/gemini/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: `${this.systemPrompt}\n\n${this.context}`,
        messages: this.history,
      }),
    });

    if (!response.body) throw new Error("no stream");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (this.disposed) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      full += chunk;

      // Speak whole sentences the moment they close.
      for (;;) {
        const match = /[^.!?…]*[.!?…]+/.exec(buffer);
        if (!match) break;
        const sentence = match[0].trim();
        buffer = buffer.slice(match[0].length);
        if (sentence) this.enqueueSpeech(sentence);
      }
    }

    if (buffer.trim()) this.enqueueSpeech(buffer.trim());
    await this.speechChain;
    return full.trim();
  }

  /* ------------------------------------------------------------------ */
  /* Speech synthesis                                                    */
  /* ------------------------------------------------------------------ */

  private enqueueSpeech(sentence: string) {
    this.speechChain = this.speechChain
      .then(() => this.utter(sentence))
      .then(() => delay(SENTENCE_GAP_MS))
      .catch(() => undefined);
  }

  private async speakAll(text: string) {
    for (const sentence of text.match(/[^.!?…]+[.!?…]*/g) ?? [text]) {
      this.enqueueSpeech(sentence.trim());
    }
    await this.speechChain;
  }

  private utter(sentence: string): Promise<void> {
    if (this.disposed || !sentence) return Promise.resolve();
    if (typeof speechSynthesis === "undefined") {
      // No TTS: hold the caption up for a readable beat instead.
      this.caption = sentence;
      this.setPhase("speaking");
      return delay(Math.min(6000, 400 + sentence.length * 55));
    }

    if (!this.voice) this.voice = pickVoice(speechSynthesis.getVoices());

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      if (this.voice) utterance.voice = this.voice;
      utterance.rate = SPEECH_RATE;
      // Slightly above neutral. Dropping pitch below 1 was making the voice
      // read as flat and synthetic rather than calm.
      utterance.pitch = 1.05;
      utterance.volume = 1;
      utterance.lang = this.voice?.lang ?? "en-US";

      utterance.onstart = () => {
        this.speakingSince = Date.now();
        this.caption = sentence;
        this.setPhase("speaking");
      };
      utterance.onboundary = () => {
        this.lastBoundaryAt = Date.now();
      };
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      speechSynthesis.speak(utterance);
      // Safari occasionally drops onend; don't let the call stall on it.
      setTimeout(resolve, 2_000 + sentence.length * 110);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Recognition                                                         */
  /* ------------------------------------------------------------------ */

  private startListening() {
    if (this.disposed) return;
    this.setPhase("listening");
    this.armSilenceTimer();

    if (this.muted || this.micDenied) return;

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      this.micDenied = true; // no recognition available; silence timer carries the call
      this.emit();
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) final += result[0]?.transcript ?? "";
        }
        if (final.trim()) {
          this.clearSilenceTimer();
          void this.turn(final.trim(), true);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          this.micDenied = true; // keep going; the call becomes one-directional
          this.emit();
        }
        // "no-speech" and friends are normal here — the silence timer handles them.
      };

      recognition.onend = () => {
        this.recognition = null;
      };

      recognition.start();
      this.recognition = recognition;
    } catch {
      this.micDenied = true;
      this.emit();
    }
  }

  private stopListening() {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch {
      /* already stopped */
    }
    this.recognition = null;
  }

  private armSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.disposed) return;
      void this.turn(SILENCE_NUDGE);
    }, SILENCE_MS);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  /* ------------------------------------------------------------------ */

  private setPhase(phase: CallPhase) {
    this.phase = phase;
    this.emit();
  }

  private emit() {
    if (!this.disposed || this.phase === "ended") this.onChange(this.snapshot);
  }
}

/* -------------------------------------------------------------------- */
/* React binding                                                         */
/* -------------------------------------------------------------------- */

export function useCallEngine(state: AppState, active: boolean) {
  const engineRef = useRef<CallEngine | null>(null);
  const [snapshot, setSnapshot] = useState<CallSnapshot>({
    phase: "connecting",
    caption: "",
    elapsedMs: 0,
    muted: false,
    micDenied: false,
    commitmentOffered: false,
    cameraOpen: false,
    frame: null,
    risk: "support",
  });

  useEffect(() => {
    if (!active || engineRef.current) return;

    const engine = new CallEngine(
      state.persona.systemPrompt,
      buildContext(state),
      setSnapshot,
    );
    engineRef.current = engine;
    void engine.start();

    return () => {
      engine.end();
      engineRef.current = null;
    };
    // Built once, when the call is answered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Tick the call timer independently of engine events.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const engine = engineRef.current;
      if (engine) setSnapshot(engine.snapshot);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return { snapshot, engine: engineRef };
}
