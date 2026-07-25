"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Optional selfie. `capture="user"` opens the front camera directly on mobile
 * and degrades to a normal file picker on desktop.
 *
 * The photo is downscaled before it becomes base64: a modern phone photo is
 * 3–8 MB, which would blow the ~5 MB localStorage quota on its own.
 */

const MAX_EDGE = 512;
const JPEG_QUALITY = 0.72;

function downscaleToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("could not read file"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("could not decode image"));
      image.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        if (!context) {
          // No canvas: fall back to the original data URI rather than failing.
          resolve(reader.result as string);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function SelfieStep({
  value,
  onChange,
}: {
  value?: string;
  onChange: (photoBase64: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setBusy(true);
      setError(null);
      try {
        onChange(await downscaleToBase64(file));
      } catch {
        setError("That photo didn't load. You can skip this step.");
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  return (
    <div className="flex flex-col items-center">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex size-52 items-center justify-center overflow-hidden rounded-full border border-dashed border-clay/35 bg-surface shadow-[var(--shadow-card)] transition duration-150 ease-out active:scale-95 disabled:opacity-50"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Your photo" className="size-full object-cover" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
            strokeLinecap="round"
            className="size-16 text-clay/70"
            aria-hidden
          >
            <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.9l1.2-2h6.8l1.2 2h1.9A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
            <circle cx="12" cy="12.5" r="3.5" />
          </svg>
        )}
      </button>

      <p className="mt-5 min-h-6 text-sm text-muted">
        {busy ? "Adding photo…" : value ? "Tap to retake" : "Tap to take a photo"}
      </p>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}

      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="mt-2 min-h-12 px-4 text-sm text-muted underline underline-offset-4"
        >
          Remove photo
        </button>
      )}
    </div>
  );
}
