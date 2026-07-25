import type { AppState } from "./types";

/**
 * A complete year, for the demo.
 *
 * Everything here is fabricated sample data for showing the app at day 365 —
 * it is never generated, never written to a real user's profile, and the only
 * way in is the dev control on /timeline.
 *
 * The diary is milestone entries rather than 365 rows: generating a line per
 * day would be 365 model calls, and the timeline reads better as the moments
 * that mattered.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days before today, so the record always looks current. */
const ago = (days: number) => Date.now() - days * DAY_MS;

const DIARY: [number, string][] = [
  [1, "We didn't drink today. That's the whole entry."],
  [2, "We slept four hours and it felt like a win."],
  [4, "We ate a proper breakfast sitting down."],
  [7, "One week. We told nobody, but we knew."],
  [11, "We walked past the shop and kept walking."],
  [16, "Our hands were steady enough to write this."],
  [23, "We called Meera back for the first time in months."],
  [30, "A month. We slept through the whole night."],
  [41, "We laughed at something stupid on TV."],
  [55, "We cooked for two and she stayed for dinner."],
  [68, "Still here. Blurrier, not gone."],
  [74, "We got up the morning after and didn't disappear."],
  [90, "Three months. We paid a bill we'd been hiding from."],
  [112, "We went to a wedding and drank lime soda all night."],
  [134, "We ran for a bus and weren't out of breath."],
  [160, "Our sister asked us to look after her kids. She asked us."],
  [188, "Half a year. We booked a dentist appointment."],
  [215, "We had a bad day and it stayed just a bad day."],
  [246, "We saved enough for the deposit."],
  [270, "We taught someone else how to get through a Friday."],
  [301, "We slept in on a Sunday because we wanted to, not to recover."],
  [333, "Meera said we look like ourselves again."],
  [352, "We forgot, for a whole afternoon, that we were counting."],
  [365, "One year. We're going to make dinner and go to bed early."],
];

/**
 * Triggers deliberately repeat across calls — the point of the year review is
 * that patterns surface, and a list where every trigger appears once shows
 * nothing.
 */
const CALLS: [number, "calmed" | "escalated", string, string, string[], string][] = [
  [
    362,
    "calmed",
    "They were shaky after a work call and rang while sitting in the car. They stayed on and their breathing settled.",
    "shaky",
    ["work stress", "evenings"],
    "Being asked nothing but yes-or-no questions.",
  ],
  [
    338,
    "calmed",
    "They called from a wedding, standing outside. They said the bar was the hardest part and they left after ten minutes.",
    "tense",
    ["social events", "being offered a drink"],
    "Naming the ten minutes and counting them down together.",
  ],
  [
    291,
    "calmed",
    "A short call on a Sunday evening. They mostly listened and said they were tired rather than craving.",
    "flat",
    ["evenings"],
    "Company without conversation.",
  ],
  [
    247,
    "calmed",
    "They called on the way home past their old pub. They kept walking while on the call.",
    "restless",
    ["passing the old pub", "evenings"],
    "Staying on the line until they were through the door.",
  ],
  [
    198,
    "calmed",
    "They rang after an argument at home. Angry at first, quieter by the end.",
    "angry",
    ["argument at home", "work stress"],
    "Not being told to calm down.",
  ],
  [
    141,
    "calmed",
    "A late-night call. They answered and stayed on the line without speaking for most of it.",
    "quiet",
    ["evenings", "not sleeping"],
    "Not being asked to talk.",
  ],
  [
    97,
    "calmed",
    "They called from a friend's house where people were drinking. They left the room to take the call.",
    "unsettled",
    ["social events", "being offered a drink"],
    "Having a reason to step outside.",
  ],
  [
    68,
    "escalated",
    "They called after a slip and sounded frightened. They asked for real help and Meera was told.",
    "frightened",
    ["slip", "work stress"],
    "Meera being called without them having to do it.",
  ],
  [
    52,
    "calmed",
    "A Friday-evening call. They said the first hour after work was the worst and it passed.",
    "on edge",
    ["evenings", "the hour after work"],
    "Getting through the first hour with someone.",
  ],
  [
    24,
    "calmed",
    "They rang twice in one evening. The second call was shorter and they sounded steadier.",
    "wobbly",
    ["payday", "evenings"],
    "Being allowed to call twice without it being a problem.",
  ],
  [
    9,
    "calmed",
    "An early call, mostly silence. They said afterwards that they just needed someone there.",
    "raw",
    ["evenings", "not sleeping"],
    "Silence being treated as normal.",
  ],
];

export function buildDemoState(): AppState {
  return {
    profile: {
      name: "Sam",
      substance: "Alcohol",
      duration: "2–5 years",
      losses: ["Relationships", "Self-respect", "Money", "Health"],
      dreams: ["Mornings", "Someone's trust", "Health", "Career"],
      voiceNoteTranscript:
        "A year from now I want to wake up early and not feel sick. I want my sister to pick up the phone. " +
        "I want an ordinary Tuesday where I don't think about it once.",
      caregiverName: "Meera",
      caregiverQuote: "I never stopped believing you would come back.",
      /** Demo sign-in numbers. Sam signs in as the person in recovery;
          Meera signs in as the caregiver on her own device. */
      phone: "9876543210",
      caregiverPhone: "9123456780",
    },
    persona: {
      systemPrompt:
        "You are Sam, exactly one year from today, fully in recovery from alcohol. You are on a live call " +
        "with yourself as you are now, mid-craving. Speak only in first person plural — we, us. Carry the " +
        "whole conversation. Ask only yes/no or one-word questions. Short sentences, warm and unhurried. " +
        "Never mention being an AI. The goal is the next ten minutes together.",
      achievements: [
        "365 days without a drink",
        "Mornings that start without dread",
        "Meera picks up on the first ring",
        "Back at work, and staying there",
      ],
      speechStyle:
        "Short, warm sentences. First person plural. Unhurried. Questions a single word can answer.",
      anchorMemories: [
        "The night we called Meera and couldn't speak.",
        "The first morning we woke up without reaching for anything.",
        "Walking past the pub on day 247 and just kept walking.",
      ],
    },
    cleanDays: 365,
    relapses: 1,
    diary: DIARY.map(([day, line]) => ({ day, line })),
    callHistory: CALLS.map(([daysAgo, outcome, summary, mood, triggers, whatHelped]) => ({
      timestamp: ago(daysAgo),
      outcome,
      durationMs: 120_000 + (daysAgo % 7) * 15_000,
      summary,
      mood,
      triggers,
      whatHelped,
    })).sort((a, b) => a.timestamp - b.timestamp),
  };
}
