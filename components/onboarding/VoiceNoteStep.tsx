"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Describe your life one year from now", captured with webkitSpeechRecognition.
 *
 * Support is patchy (no Firefox, no Android Firefox, needs a network round-trip
 * in Chrome), so an unsupported browser or a mic denial is a normal path here,
 * not an error: the skip button fills in a sample so onboarding always finishes.
 */

export const SAMPLE_TRANSCRIPT =
  "A year from now I'm waking up early and I actually feel like myself. " +
  "I've got my mornings back. People trust me again, and I trust me again. " +
  "I'm working, I'm sleeping properly, and the first thing I think about when " +
  "I wake up isn't using. It's just an ordinary day, and that's the whole point.";

export function VoiceNoteStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (transcript: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const finalText = useRef(value);

  useEffect(() => {
    finalText.current = value;
  }, [value]);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }

    const instance = new Ctor();
    instance.lang = "en-US";
    instance.continuous = true;
    instance.interimResults = true;

    instance.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalText.current = `${finalText.current} ${text}`.trim();
          onChange(finalText.current);
        } else {
          pending += text;
        }
      }
      setInterim(pending);
    };

    instance.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone access was blocked. You can skip this step."
          : "Couldn't hear that. Try again, or skip.",
      );
      setListening(false);
    };

    instance.onend = () => {
      setInterim("");
      setListening(false);
    };

    recognition.current = instance;
    return () => {
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      instance.abort();
    };
    // onChange is stable (useCallback in the parent); re-running would drop the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    const instance = recognition.current;
    if (!instance) return;
    setError(null);
    if (listening) {
      instance.stop();
      setListening(false);
      return;
    }
    try {
      instance.start();
      setListening(true);
    } catch {
      // start() throws if it is already running — treat as already listening.
      setListening(true);
    }
  }, [listening]);

  const transcript = `${value}${interim ? ` ${interim}` : ""}`.trim();

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        aria-label={listening ? "Stop recording" : "Start recording"}
        className={`relative flex size-36 items-center justify-center rounded-full border transition duration-150 ease-out active:scale-95 disabled:opacity-40 ${
          listening
            ? "border-sage bg-sage/20 shadow-[var(--shadow-lift)]"
            : "border-border bg-surface shadow-[var(--shadow-card)]"
        }`}
      >
        {listening && (
          <span className="animate-breathe absolute inset-0 rounded-full bg-sage/25" aria-hidden />
        )}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          className={`relative size-14 ${listening ? "text-sage-ink" : "text-clay"}`}
          aria-hidden
        >
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
        </svg>
      </button>

      <p className="mt-5 min-h-6 text-sm text-muted">
        {!supported
          ? "This browser can't record — skip below."
          : listening
            ? "Listening… tap to stop"
            : value
              ? "Tap to add more"
              : "Tap and start talking"}
      </p>

      {error && <p className="mt-1 text-sm text-danger">{error}</p>}

      <div className="mt-6 min-h-32 w-full rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        {transcript ? (
          <p className="text-[1.0625rem] leading-relaxed whitespace-pre-wrap">
            {value}
            {interim && <span className="text-muted"> {interim}</span>}
          </p>
        ) : (
          <p className="text-[1.0625rem] leading-relaxed text-muted">
            Your words will appear here as you speak.
          </p>
        )}
      </div>
    </div>
  );
}
