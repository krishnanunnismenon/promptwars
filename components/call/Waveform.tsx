"use client";

import { useEffect, useRef } from "react";

/**
 * Symmetric bar waveform driven straight off the engine's level getter, so it
 * animates at display rate without pushing React state every frame.
 */

const BARS = 44;

export function Waveform({ getLevel }: { getLevel: () => number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    // Per-bar smoothing so the shape breathes instead of flickering.
    const heights = new Array<number>(BARS).fill(0.04);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const level = getLevel();
      const now = Date.now() / 1000;
      const mid = height / 2;
      const gap = width / BARS;
      const barWidth = Math.max(2, gap * 0.42);

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < BARS; i += 1) {
        const centered = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        // Envelope keeps the ends quiet; the noise term keeps it alive.
        const envelope = 0.25 + 0.75 * centered ** 1.4;
        const wobble =
          0.5 + 0.5 * Math.sin(now * 6.1 + i * 0.55) * Math.sin(now * 2.3 + i * 0.21);
        const target = Math.max(0.03, level * envelope * (0.45 + 0.75 * wobble));
        heights[i] += (target - heights[i]) * 0.22;

        const barHeight = Math.max(3, heights[i] * height * 0.9);
        const x = i * gap + (gap - barWidth) / 2;

        const gradient = ctx.createLinearGradient(0, mid - barHeight / 2, 0, mid + barHeight / 2);
        gradient.addColorStop(0, `rgba(167,139,250,${0.35 + level * 0.55})`);
        gradient.addColorStop(0.5, `rgba(124,92,255,${0.55 + level * 0.45})`);
        gradient.addColorStop(1, `rgba(167,139,250,${0.35 + level * 0.55})`);
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.roundRect(x, mid - barHeight / 2, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [getLevel]);

  return <canvas ref={canvasRef} className="h-32 w-full" aria-hidden />;
}
