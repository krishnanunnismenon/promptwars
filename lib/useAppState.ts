"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getProfileId, loadAppState, saveAppState } from "./storage";
import { DEFAULT_APP_STATE, type AppState, type UserProfile } from "./types";

/**
 * AppState for client components.
 *
 * Writes land in localStorage synchronously (so a tap is never lost, even
 * offline) and are mirrored to Mongo on a short debounce. Network failures are
 * ignored on purpose — onboarding must never block on a request.
 */

const SYNC_DEBOUNCE_MS = 700;

export function useAppState() {
  // Start from defaults on both server and client so hydration matches; the
  // real state arrives in the effect below.
  const [state, setState] = useState<AppState>(DEFAULT_APP_STATE);
  const [hydrated, setHydrated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest state not yet mirrored, so unmount can flush it instead of losing it. */
  const pending = useRef<AppState | null>(null);

  /** PUT immediately. `keepalive` lets it survive navigation and tab close. */
  const syncNow = useCallback(async (next: AppState) => {
    pending.current = null;
    try {
      await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: getProfileId(), state: next }),
        keepalive: true,
      });
    } catch {
      /* local state is the source of truth; a failed mirror is not an error */
    }
  }, []);

  const scheduleSync = useCallback(
    (next: AppState) => {
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void syncNow(next);
      }, SYNC_DEBOUNCE_MS);
    },
    [syncNow],
  );

  useEffect(() => {
    setState(loadAppState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    // On unmount (route change, tab close) send whatever is still waiting —
    // cancelling the timer here would silently drop the last write.
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) void syncNow(pending.current);
    };
  }, [syncNow]);

  /** Persist immediately, then mirror. Safe to call on every keystroke or tap. */
  const update = useCallback(
    (updater: (previous: AppState) => AppState) => {
      setState((previous) => {
        const next = updater(previous);
        saveAppState(next);
        scheduleSync(next);
        return next;
      });
    },
    [scheduleSync],
  );

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) =>
      update((previous) => ({ ...previous, profile: { ...previous.profile, ...patch } })),
    [update],
  );

  /** Write + mirror in one awaitable step, for the end of onboarding. */
  const commit = useCallback(
    async (next: AppState) => {
      saveAppState(next);
      setState(next);
      if (timer.current) clearTimeout(timer.current);
      await syncNow(next);
    },
    [syncNow],
  );

  return { state, hydrated, update, updateProfile, commit };
}
