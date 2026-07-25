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

export function Helplines({ tone = "dark" }: { tone?: "dark" | "surface" }) {
  return (
    <section
      className={`rounded-2xl border p-5 ${
        tone === "dark" ? "border-white/10 bg-white/5" : "border-border bg-surface"
      }`}
    >
      <h2 className="text-xs tracking-[0.15em] text-muted uppercase">If it&apos;s urgent</h2>
      <ul className="mt-3 space-y-3">
        {HELPLINES.map((line) => (
          <li key={line.number}>
            <a
              href={`tel:${line.tel}`}
              className="flex min-h-14 items-center justify-between gap-4 rounded-xl px-1"
            >
              <span>
                <span className="block text-lg font-medium">{line.name}</span>
                <span className="block text-sm text-muted">{line.note}</span>
              </span>
              <span className="font-mono text-lg whitespace-nowrap text-accent">
                {line.number}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
