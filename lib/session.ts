"use client";

import { PROFILE_ID_KEY, getItem, removeItem, setItem } from "./storage";
import { APP_STATE_KEY } from "./storage";

/**
 * Who is using this device.
 *
 * Prototype auth: a phone number is the whole credential — no OTP, no password.
 * Good enough to demo two roles on two devices, and nowhere near good enough to
 * ship. See the note in app/login/page.tsx.
 */

export type Role = "user" | "caregiver";

const ROLE_KEY = "morrow:role";
const PHONE_KEY = "morrow:phone";
/** For a caregiver: whose profile they are watching. */
const WATCHING_KEY = "morrow:watching";

/** Digits only, so "+91 98765 43210" and "9876543210" are the same person. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  // Indian numbers are commonly typed with and without the 91 country code.
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export const isValidPhone = (input: string) => normalizePhone(input).length === 10;

export function getRole(): Role | null {
  const role = getItem<Role | null>(ROLE_KEY, null);
  return role === "user" || role === "caregiver" ? role : null;
}

export function getPhone(): string | null {
  return getItem<string | null>(PHONE_KEY, null);
}

export function getWatching(): string | null {
  return getItem<string | null>(WATCHING_KEY, null);
}

/** Signs this device in. Replaces any state left by a previous session. */
export function startSession(role: Role, phone: string, profileId?: string) {
  setItem(ROLE_KEY, role);
  setItem(PHONE_KEY, normalizePhone(phone));
  if (role === "user" && profileId) setItem(PROFILE_ID_KEY, profileId);
  if (role === "caregiver" && profileId) setItem(WATCHING_KEY, profileId);
}

export function endSession() {
  removeItem(ROLE_KEY);
  removeItem(PHONE_KEY);
  removeItem(WATCHING_KEY);
  removeItem(PROFILE_ID_KEY);
  removeItem(APP_STATE_KEY);
}
