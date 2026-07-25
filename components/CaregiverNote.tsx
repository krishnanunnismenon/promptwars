"use client";

import { useEffect, useState } from "react";

import type { CaregiverNote } from "@/app/api/note/route";
import { getProfileId } from "@/lib/storage";

/**
 * The note their person left them, shown where it will actually land: above
 * the diary composer, and on the incoming-call screen before they answer.
 *
 * Read fresh from the server each time rather than cached in AppState — see
 * the note in app/api/note/route.ts for why.
 */

export function useCaregiverNote(profileId?: string) {
  const [note, setNote] = useState<CaregiverNote | null>(null);

  useEffect(() => {
    const id = profileId ?? getProfileId();
    if (!id) return;
    let cancelled = false;

    void fetch(`/api/note?id=${encodeURIComponent(id)}`)
      .then((response) => response.json())
      .then((payload: { note?: CaregiverNote | null }) => {
        if (!cancelled && payload?.note?.text) setNote(payload.note);
      })
      .catch(() => {
        /* a missing note is the normal case, not an error */
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return note;
}

/** Quote mark, message, attribution. Warm on day surfaces, quiet on night. */
export function CaregiverNoteCard({
  note,
  tone = "day",
}: {
  note: CaregiverNote;
  tone?: "day" | "night";
}) {
  const night = tone === "night";

  return (
    <figure
      className={`animate-rise rounded-[var(--radius-card)] border px-5 py-5 ${
        night
          ? "border-night-ink/12 bg-night-raised/60"
          : "border-amber/40 bg-amber/12 shadow-[var(--shadow-card)]"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`size-5 ${night ? "text-night-muted" : "text-clay/60"}`}
        aria-hidden
      >
        <path d="M7 7h4v4c0 2.8-1.7 4.6-4 5v-2c1.2-.4 2-1.4 2-2.6H7zm8 0h4v4c0 2.8-1.7 4.6-4 5v-2c1.2-.4 2-1.4 2-2.6h-2z" />
      </svg>

      <blockquote
        className={`mt-2 text-[1.125rem] leading-relaxed text-pretty ${
          night ? "text-night-ink/90" : "text-ink"
        }`}
      >
        {note.text}
      </blockquote>

      <figcaption
        className={`mt-3 text-sm font-semibold ${night ? "text-night-muted" : "text-muted"}`}
      >
        — {note.from}
      </figcaption>
    </figure>
  );
}
