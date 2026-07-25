import type { AppState } from "./types";

/**
 * Derived views over the journey.
 *
 * Slip days are read back out of the diary rather than stored separately —
 * a slip always writes this exact line, so the diary already is the record.
 */

export const RELAPSE_LINE = "Still here. Blurrier, not gone.";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Day numbers on which a slip was recorded, ascending and de-duplicated. */
export function slipDays(state: AppState): number[] {
  const days = state.diary
    .filter((entry) => entry.line === RELAPSE_LINE)
    .map((entry) => entry.day);
  return [...new Set(days)].sort((a, b) => a - b);
}

export interface JourneyDay {
  /** 1-based day number in the journey. */
  day: number;
  date: Date;
  slipped: boolean;
  /** True for the most recent day, so the UI can mark "today". */
  today: boolean;
}

/**
 * The last `windowDays` of the journey, oldest first. Day 1 is dated by
 * counting back from today, so the grid always ends on the current day.
 */
export function buildJourney(state: AppState, windowDays = 91): JourneyDay[] {
  const total = Math.max(1, state.cleanDays);
  const slips = new Set(slipDays(state));
  const start = Math.max(1, total - windowDays + 1);

  const midnightToday = new Date();
  midnightToday.setHours(0, 0, 0, 0);

  const days: JourneyDay[] = [];
  for (let day = start; day <= total; day += 1) {
    days.push({
      day,
      date: new Date(midnightToday.getTime() - (total - day) * DAY_MS),
      slipped: slips.has(day),
      today: day === total,
    });
  }
  return days;
}

/** The next round-number milestone, for the progress line. */
export function nextMilestone(days: number): { target: number; label: string } {
  const ladder: [number, string][] = [
    [7, "one week"],
    [30, "one month"],
    [90, "three months"],
    [180, "six months"],
    [365, "one year"],
  ];
  for (const [target, label] of ladder) {
    if (days < target) return { target, label };
  }
  // Past a year, count in further years.
  const years = Math.floor(days / 365) + 1;
  return { target: years * 365, label: `${years} years` };
}
