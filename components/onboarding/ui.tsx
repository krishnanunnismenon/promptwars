"use client";

import type { ReactNode } from "react";

/** Shared furniture for the wizard: one question per screen, thumb-reachable. */

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex justify-center gap-2 pt-6" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? "w-6 bg-accent" : i < current ? "w-1.5 bg-accent/50" : "w-1.5 bg-border"
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
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {subtitle && <p className="mt-3 text-base leading-relaxed text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
      {footer && (
        <div className="sticky bottom-0 space-y-3 bg-gradient-to-t from-background via-background to-transparent px-6 pt-4 pb-8">
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
      className="min-h-16 w-full rounded-2xl bg-accent px-6 text-lg font-medium text-white transition active:scale-[0.98] disabled:opacity-30 disabled:active:scale-100"
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
      className="min-h-14 w-full rounded-2xl text-base text-muted transition active:scale-[0.98]"
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
      className={`min-h-16 rounded-2xl border px-5 text-left text-lg transition active:scale-[0.97] ${
        selected
          ? "border-accent bg-accent/15 text-foreground"
          : "border-border bg-surface text-foreground/90"
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
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={selected.includes(option)}
          onTap={() => onToggle(option)}
        />
      ))}
    </div>
  );
}
