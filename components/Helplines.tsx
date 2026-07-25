/**
 * Real numbers only. Anything added here must be verified — a wrong helpline
 * number is worse than no card at all.
 */

export const HELPLINES = [
  {
    name: "Kiran",
    number: "1800-599-0019",
    tel: "18005990019",
    note: "India · 24/7 · toll-free · 13 languages",
  },
] as const;

export function Helplines({ tone = "day" }: { tone?: "day" | "night" }) {
  const night = tone === "night";

  return (
    <section
      className={`rounded-[var(--radius-card)] border p-5 ${
        night ? "border-night-ink/12 bg-night/50" : "border-border bg-surface shadow-[var(--shadow-card)]"
      }`}
    >
      <h2 className={`text-sm font-bold ${night ? "text-night-muted" : "text-muted"}`}>
        If it&apos;s urgent
      </h2>
      <ul className="mt-3 space-y-1">
        {HELPLINES.map((line) => (
          <li key={line.number}>
            <a
              href={`tel:${line.tel}`}
              className={`-mx-2 flex min-h-14 items-center justify-between gap-4 rounded-2xl px-2 transition duration-150 ease-out ${
                night ? "active:bg-night-ink/10" : "active:bg-sunk"
              }`}
            >
              <span>
                <span className="block text-lg font-bold">{line.name}</span>
                <span className={`block text-sm ${night ? "text-night-muted" : "text-muted"}`}>
                  {line.note}
                </span>
              </span>
              <span
                className={`text-lg font-bold whitespace-nowrap ${
                  night ? "text-night-danger" : "text-danger"
                }`}
              >
                {line.number}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
