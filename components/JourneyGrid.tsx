"use client";

import { useMemo } from "react";

import { buildJourney, nextMilestone, slipDays } from "@/lib/journey";
import type { AppState } from "@/lib/types";

/**
 * The journey at a glance. Sage means a day held, amber means a slip.
 *
 * Two layouts, because one doesn't work at both ends:
 *
 *   Early (< 4 weeks) — a single row of days so far, followed by hollow dots up
 *     to the next milestone. On day 1 this reads "1 of 7", which is encouraging.
 *     The week-column grid here would be six blank cells and one dot.
 *   Later — the familiar 13-week grid, weeks running down each column.
 */

const WINDOW_DAYS = 91; // 13 weeks
const COLUMN_LAYOUT_FROM = 28;
/** Past this many remaining days the hollow dots stop being readable. */
const MAX_HOLLOW = 45;

export function JourneyGrid({ state }: { state: AppState }) {
  const days = useMemo(() => buildJourney(state, WINDOW_DAYS), [state]);
  const slips = useMemo(() => slipDays(state), [state]);
  const total = Math.max(1, state.cleanDays);
  const milestone = useMemo(() => nextMilestone(total), [total]);

  // Both counts must come from the same scope as the grid, or the header
  // claims a slip the dots don't show (a slip 200 days ago, a 91-day window).
  const held = days.filter((d) => !d.slipped).length;
  const slipsInView = days.filter((d) => d.slipped).length;
  const olderSlips = slips.length - slipsInView;

  const progress = Math.min(1, total / milestone.target);
  const remaining = Math.max(0, milestone.target - total);
  const useColumns = total >= COLUMN_LAYOUT_FROM;

  const dotClass = (slipped: boolean, today: boolean) =>
    slipped ? "bg-amber" : today ? "bg-sage ring-2 ring-sage/35" : "bg-sage/45";

  const label = `${held} day${held === 1 ? "" : "s"} held${
    slipsInView > 0 ? ` and ${slipsInView} slip${slipsInView > 1 ? "s" : ""}` : ""
  } in this view.`;

  return (
    <section className="w-full rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-muted">
          {useColumns ? "Last 13 weeks" : "Your journey so far"}
        </h2>
        <p className="text-sm font-semibold text-sage-ink">
          {held} held
          {slipsInView > 0 && `, ${slipsInView} slip${slipsInView > 1 ? "s" : ""}`}
        </p>
      </div>

      {useColumns ? (
        <div
          className="mt-4 grid grid-flow-col grid-rows-7 justify-between gap-[3px]"
          role="img"
          aria-label={label}
        >
          {/* Pad the front so the first column starts on a week boundary. */}
          {Array.from({ length: (7 - (days.length % 7)) % 7 }, (_, i) => (
            <span key={`pad-${i}`} className="size-3.5" />
          ))}
          {days.map((cell) => (
            <span
              key={cell.day}
              title={`Day ${cell.day}${cell.slipped ? " · slipped" : ""}`}
              className={`size-3.5 rounded-[4px] ${dotClass(cell.slipped, cell.today)}`}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2" role="img" aria-label={label}>
          {days.map((cell) => (
            <span
              key={cell.day}
              title={`Day ${cell.day}${cell.slipped ? " · slipped" : ""}`}
              className={`size-3.5 rounded-full ${dotClass(cell.slipped, cell.today)}`}
            />
          ))}
          {remaining > 0 &&
            remaining <= MAX_HOLLOW &&
            Array.from({ length: remaining }, (_, i) => (
              <span
                key={`todo-${i}`}
                className="size-3.5 rounded-full border border-border"
                aria-hidden
              />
            ))}
        </div>
      )}

      {/* A slip outside the window would otherwise vanish without explanation. */}
      {olderSlips > 0 && (
        <p className="mt-3 text-sm text-muted">
          {olderSlips} earlier slip{olderSlips > 1 ? "s" : ""}, before this window.
        </p>
      )}

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-muted">Next: {milestone.label}</span>
          <span className="font-semibold text-muted">{remaining} to go</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunk">
          <div
            className="h-full rounded-full bg-sage transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(3, Math.round(progress * 100))}%` }}
          />
        </div>
      </div>
    </section>
  );
}
