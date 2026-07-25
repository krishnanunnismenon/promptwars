/**
 * The Morrow mark. A sun just clearing the horizon — "the morrow" is the
 * morning that comes after, which is the whole promise of the app: not a
 * triumphant sunrise, just the next ordinary day arriving on schedule.
 *
 * Rounded strokes and an open arc, so it reads as warm rather than corporate,
 * and stays legible at 14px next to the wordmark.
 */
export function MorrowMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* horizon */}
      <path d="M4 24h24" />
      {/* the sun, still partly below it */}
      <path d="M9.5 24a6.5 6.5 0 0 1 13 0" />
      {/* first light */}
      <path d="M16 8.5v2.5M24.5 12l-1.7 1.7M7.5 12l1.7 1.7" />
    </svg>
  );
}

/** Wordmark: mark + name, for screen headers. */
export function MorrowWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <MorrowMark className="size-5" />
      <span className="text-lg font-bold tracking-tight">Morrow</span>
    </span>
  );
}

/**
 * Soft background wash. Two overlapping blurred blobs, drifting slowly — the
 * warmth in the design comes from these, not from the card styling.
 */
export function SoftBlobs({ tone = "day" }: { tone?: "day" | "night" }) {
  const primary = tone === "day" ? "var(--sage)" : "var(--clay)";
  const secondary = tone === "day" ? "var(--amber)" : "var(--lilac)";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="animate-drift absolute -top-32 -left-28 size-64 rounded-full blur-3xl"
        style={{ background: primary, opacity: tone === "day" ? 0.09 : 0.2 }}
      />
      <div
        className="animate-drift absolute -right-32 -bottom-24 size-72 rounded-full blur-3xl"
        style={{
          background: secondary,
          opacity: tone === "day" ? 0.08 : 0.14,
          animationDelay: "-5s",
        }}
      />
    </div>
  );
}
