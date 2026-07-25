"use client";

import { useEffect, useState } from "react";

import type { CaregiverNote } from "@/app/api/note/route";

/**
 * Where the caregiver writes the note. One field, a low ceiling, and prompts
 * that steer away from the two things people reach for when frightened:
 * instructions, and reminders of what it has cost everyone.
 */

const MAX_LENGTH = 280;

const PROMPTS = [
  "I'm glad you're here.",
  "Nothing you have to do today. I'm around.",
  "Whatever kind of day it is, come home to it.",
];

export function NoteComposer({
  profileId,
  name,
  from,
}: {
  profileId: string;
  /** The person in recovery — who this is for. */
  name: string;
  /** The caregiver — who it's from. */
  from: string;
}) {
  const [note, setNote] = useState<CaregiverNote | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/note?id=${encodeURIComponent(profileId)}`)
      .then((response) => response.json())
      .then((payload: { note?: CaregiverNote | null }) => {
        if (cancelled) return;
        if (payload?.note?.text) {
          setNote(payload.note);
          setText(payload.note.text);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const save = async (value: string) => {
    setBusy(true);
    try {
      const response = await fetch("/api/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profileId, text: value, from }),
      });
      const payload = (await response.json()) as { ok?: boolean; note?: CaregiverNote | null };
      if (payload?.ok) {
        setNote(payload.note ?? null);
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      /* leave the text in the box so nothing typed is lost */
    } finally {
      setBusy(false);
    }
  };

  const firstName = name.split(" ")[0] || name;

  if (note && !editing) {
    return (
      <section className="rounded-[var(--radius-card)] border border-amber/40 bg-amber/12 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-clay">
            {firstName} sees this{saved && " — saved"}
          </h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 text-sm font-semibold text-clay underline underline-offset-4"
          >
            Change
          </button>
        </div>
        <p className="mt-2 text-[1.125rem] leading-relaxed text-pretty">{note.text}</p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-bold text-sage-ink">Leave {firstName} a note</h2>
      <p className="mt-1.5 text-base leading-relaxed text-muted text-pretty">
        They&apos;ll see it every day, before they write their line and before a call.
      </p>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        maxLength={MAX_LENGTH}
        placeholder={PROMPTS[0]}
        className="mt-3 w-full resize-none rounded-[1.125rem] border border-border bg-cream px-4 py-3 text-[1.0625rem] leading-relaxed outline-none placeholder:text-muted focus:border-clay"
      />

      {!text && (
        <div className="mt-2 flex flex-wrap gap-2">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setText(prompt)}
              className="rounded-full border border-border bg-cream px-3 py-2 text-sm font-medium text-muted transition duration-150 ease-out active:scale-[0.97]"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!text.trim() || busy}
          onClick={() => void save(text.trim())}
          className="min-h-13 flex-1 rounded-full bg-clay text-[1.0625rem] font-semibold text-on-clay transition duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:bg-sunk disabled:text-muted"
        >
          {busy ? "Saving…" : note ? "Update note" : "Leave it for them"}
        </button>
        {note && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save("")}
            className="min-h-13 rounded-full px-5 text-[1.0625rem] font-semibold text-muted"
          >
            Remove
          </button>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted text-pretty">
        Keep it short and warm. Nothing to do, nothing to answer.
      </p>
    </section>
  );
}
