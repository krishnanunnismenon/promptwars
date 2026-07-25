"use client";

import { useEffect, useRef } from "react";

/**
 * Looping ringtone (Web Audio) + vibration, for the incoming-call screen.
 *
 * Autoplay policy blocks audio until the document has been interacted with, and
 * a route change resets that. So we try immediately and also resume on the
 * first touch anywhere on the page — a silent ring is acceptable, a thrown
 * error is not.
 */

const RING_ON_MS = 2000;
const RING_CYCLE_MS = 5000;
const VIBRATE_PATTERN = [600, 400, 600, 1800];

export function useRingtone(active: boolean) {
  const context = useRef<AudioContext | null>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    if (!active) return;

    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    context.current = ctx;

    /** One classic two-tone burst, softened with a lowpass. */
    const ring = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;

      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;
      gain.connect(filter);
      filter.connect(ctx.destination);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
      gain.gain.setValueAtTime(0.18, now + RING_ON_MS / 1000 - 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + RING_ON_MS / 1000);

      for (const frequency of [440, 480]) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency;
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + RING_ON_MS / 1000);
      }
    };

    const buzz = () => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(VIBRATE_PATTERN);
        } catch {
          /* unsupported or blocked */
        }
      }
    };

    const startLoop = () => {
      ring();
      buzz();
      timers.current.push(
        setInterval(() => {
          ring();
          buzz();
        }, RING_CYCLE_MS),
      );
    };

    void ctx
      .resume()
      .then(startLoop)
      .catch(() => undefined);

    // If autoplay blocked us, the first tap unblocks it.
    const unlock = () => {
      void ctx.resume().catch(() => undefined);
    };
    document.addEventListener("pointerdown", unlock, { once: true });

    return () => {
      document.removeEventListener("pointerdown", unlock);
      timers.current.forEach(clearInterval);
      timers.current = [];
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(0);
        } catch {
          /* ignore */
        }
      }
      void ctx.close().catch(() => undefined);
      context.current = null;
    };
  }, [active]);
}
