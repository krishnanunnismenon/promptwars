"use client";

import { useState } from "react";

/**
 * Today's entry, written by hand.
 *
 * Two fields, both deliberately small: one sentence about the day, and one
 * thing they're going after. The second is the point — an entry that ends in
 * something wanted reads forward instead of backward, and it's what the future
 * self references on the next call.
 *
 * The prompt rotates so it never feels like the same empty box every day.
 */

const PROMPTS = [
  "What happened today? One sentence is plenty.",
  "What did today actually look like?",
  "One true sentence about today.",
  "How did today go? Short is fine.",
  "What's worth writing down about today?",
];

const INTENT_PLACEHOLDERS = [
  "Sleep before midnight",
  "Call my sister back",
  "Eat a proper breakfast",
  "Get through the evening",
  "Walk instead of scroll",
];

const pick = <T,>(list: T[], day: number): T => list[day % list.length];

export function DiaryComposer({
  day,
  onSave,
  saved,
}: {
  day: number;
  onSave: (line: string, intent: string) => void;
  /** True once today already has an entry. */
  saved?: boolean;
}) {
  const [line, setLine] = useState("");
  const [intent, setIntent] = useState("");
  const [open, setOpen] = useState(false);

  const canSave = line.trim().length > 0;

  if (saved && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[var(--radius-card)] border border-dashed border-border bg-surface/60 px-5 py-4 text-left transition duration-150 ease-out active:scale-[0.99]"
      >
        <p className="text-[1.0625rem] font-semibold text-muted">
          Today&apos;s line is written. Add another?
        </p>
      </button>
    );
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-sage-ink">Day {day}</h2>
        <span className="text-sm font-semibold text-muted">Today&apos;s entry</span>
      </div>

      <label htmlFor="diary-line" className="mt-3 block text-[1.0625rem] font-semibold text-pretty">
        {pick(PROMPTS, day)}
      </label>
      <textarea
        id="diary-line"
        value={line}
        onChange={(event) => setLine(event.target.value)}
        rows={2}
        maxLength={160}
        placeholder="We…"
        className="mt-2 w-full resize-none rounded-[1.125rem] border border-border bg-cream px-4 py-3 text-[1.0625rem] leading-relaxed outline-none placeholder:text-muted focus:border-clay"
      />

      <label htmlFor="diary-intent" className="mt-4 block text-[1.0625rem] font-semibold">
        And one thing you&apos;re going after.
      </label>
      <input
        id="diary-intent"
        value={intent}
        onChange={(event) => setIntent(event.target.value)}
        maxLength={80}
        placeholder={pick(INTENT_PLACEHOLDERS, day)}
        className="mt-2 min-h-14 w-full rounded-[1.125rem] border border-border bg-cream px-4 text-[1.0625rem] outline-none placeholder:text-muted focus:border-clay"
      />

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            onSave(line.trim(), intent.trim());
            setLine("");
            setIntent("");
            setOpen(false);
          }}
          className="min-h-13 flex-1 rounded-full bg-clay text-[1.0625rem] font-semibold text-on-clay transition duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:bg-sunk disabled:text-muted"
        >
          Save today
        </button>
        {saved && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-13 rounded-full px-5 text-[1.0625rem] font-semibold text-muted"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted text-pretty">
        Whatever you write here is what we&apos;ll remember on the next call.
      </p>
    </section>
  );
}
