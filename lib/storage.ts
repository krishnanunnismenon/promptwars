/**
 * Typed localStorage. Every call is SSR-safe and never throws — on a quota
 * error, private-mode block, or corrupt JSON it falls back to defaults so the
 * UI keeps rendering.
 *
 * localStorage is the source of truth during a session; Mongo is the durable
 * mirror (see `lib/useAppState.ts` and `app/api/state/route.ts`).
 */

import { DEFAULT_APP_STATE, EMPTY_PERSONA, EMPTY_PROFILE, type AppState } from "./types";

/** Bumped when the AppState shape changes — old keys are simply ignored. */
export const APP_STATE_KEY = "futureself:appState:v1";
export const PROFILE_ID_KEY = "futureself:profileId";

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

/** Read any JSON-serializable value, returning `fallback` if missing or bad. */
export function getItem<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write any JSON-serializable value. Returns false if the write was rejected. */
export function setItem<T>(key: string, value: T): boolean {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------------- */
/* Profile id — anonymous per-device key, used as the Mongo _id            */
/* ---------------------------------------------------------------------- */

export function getProfileId(): string {
  const existing = getItem<string | null>(PROFILE_ID_KEY, null);
  if (typeof existing === "string" && existing.length > 0) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  setItem(PROFILE_ID_KEY, id);
  return id;
}

/* ---------------------------------------------------------------------- */
/* AppState                                                                */
/* ---------------------------------------------------------------------- */

const clone = <T,>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * Normalizes anything into a complete AppState — missing, partial, and
 * corrupt input all produce a usable object. Also used for payloads coming
 * back from Mongo, which is why it is exported.
 */
export function normalizeAppState(value: unknown): AppState {
  if (typeof value !== "object" || value === null) return clone(DEFAULT_APP_STATE);
  const partial = value as Partial<AppState>;

  const profile = { ...EMPTY_PROFILE, ...(partial.profile ?? {}) };
  const persona = { ...EMPTY_PERSONA, ...(partial.persona ?? {}) };

  return {
    profile: {
      ...profile,
      losses: asArray<string>(profile.losses),
      dreams: asArray<string>(profile.dreams),
    },
    persona: {
      ...persona,
      achievements: asArray<string>(persona.achievements),
      anchorMemories: asArray<string>(persona.anchorMemories),
    },
    cleanDays: typeof partial.cleanDays === "number" ? partial.cleanDays : 0,
    diary: asArray<AppState["diary"][number]>(partial.diary),
    callHistory: asArray<AppState["callHistory"][number]>(partial.callHistory),
    relapses: typeof partial.relapses === "number" ? partial.relapses : 0,
  };
}

export function loadAppState(): AppState {
  return normalizeAppState(getItem<unknown>(APP_STATE_KEY, null));
}

export function saveAppState(state: AppState): boolean {
  return setItem(APP_STATE_KEY, state);
}

/** Read-modify-write in one shot. Returns the state that was persisted. */
export function updateAppState(updater: (previous: AppState) => AppState): AppState {
  const next = updater(loadAppState());
  saveAppState(next);
  return next;
}

export function clearAppState(): void {
  removeItem(APP_STATE_KEY);
}
