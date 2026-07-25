/**
 * The Anchor mark. Rounded strokes, open shackle, wide flukes — an anchor that
 * reads as steadying rather than nautical-decorative. Used small (a wordmark
 * companion) and large (the resting state on the home screen).
 */
export function AnchorMark({ className = "size-6" }: { className?: string }) {
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
      <circle cx="16" cy="6" r="3" />
      <path d="M16 9v17" />
      <path d="M10 13h12" />
      <path d="M5 18a11 11 0 0 0 11 8 11 11 0 0 0 11-8" />
    </svg>
  );
}

/** Wordmark: mark + name, for screen headers. */
export function AnchorWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <AnchorMark className="size-5" />
      <span className="text-lg font-bold tracking-tight">Anchor</span>
    </span>
  );
}

/**
 * Soft background wash. Two overlapping blurred blobs, drifting slowly — the
 * warmth in the reference comes from these, not from the card styling.
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
