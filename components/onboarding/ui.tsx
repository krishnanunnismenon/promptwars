"use client";

import type { ReactNode } from "react";

/**
 * Shared furniture for the wizard: one question per screen, thumb-reachable.
 * Every control here is ≥56px tall and shares one shape language — soft cards
 * for choices, pills for actions.
 */

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div
      className="flex justify-center gap-1.5 pt-7"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-label={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ease-out ${
            i === current
              ? "w-7 bg-clay"
              : i < current
                ? "w-1.5 bg-clay/45"
                : "w-1.5 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export function StepShell({
  title,
  subtitle,
  direction,
  stepKey,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  /** 1 = moving forward, -1 = moving back. Drives the slide direction. */
  direction: number;
  /** Changing this key replays the slide animation. */
  stepKey: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      key={stepKey}
      className={`flex min-h-0 flex-1 flex-col ${
        direction >= 0 ? "animate-slide-in-right" : "animate-slide-in-left"
      }`}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-10 pb-4">
        <h1 className="text-[1.75rem] leading-[1.15] font-bold tracking-tight text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-[34ch] text-base leading-relaxed text-muted text-pretty">
            {subtitle}
          </p>
        )}
        <div className="mt-8">{children}</div>
      </div>
      {footer && (
        <div className="sticky bottom-0 space-y-2 bg-gradient-to-t from-cream via-cream to-transparent px-6 pt-5 pb-8">
          {footer}
        </div>
      )}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="min-h-15 w-full rounded-full bg-clay px-6 text-lg font-semibold text-on-clay shadow-[var(--shadow-card)] transition duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:bg-sunk disabled:text-muted disabled:shadow-none"
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-13 w-full rounded-full text-base font-medium text-muted transition duration-150 ease-out hover:bg-sunk/60 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

export function Chip({
  label,
  selected,
  onTap,
}: {
  label: string;
  selected: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={selected}
      className={`flex min-h-16 items-center rounded-[1.375rem] border px-5 text-left text-[1.0625rem] leading-snug font-medium transition duration-150 ease-out active:scale-[0.97] ${
        selected
          ? "border-sage bg-sage/15 text-ink shadow-[var(--shadow-card)]"
          : "border-border bg-surface text-ink/85 hover:border-clay/35"
      }`}
    >
      {label}
    </button>
  );
}

export function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  /** Selected labels. Single-select callers pass an array of 0 or 1. */
  selected: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map((option, index) => (
        <div
          key={option}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(index, 7) * 35}ms` }}
        >
          <Chip
            label={option}
            selected={selected.includes(option)}
            onTap={() => onToggle(option)}
          />
        </div>
      ))}
    </div>
  );
}
