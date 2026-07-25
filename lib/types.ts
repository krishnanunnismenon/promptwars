/* lib/types.ts — single source of truth */

export interface UserProfile {
  name: string;
  substance: string;
  duration: string;
  losses: string[]; // chips selected
  dreams: string[]; // chips selected
  voiceNoteTranscript: string; // the "life in one year" note
  photoBase64?: string;
  caregiverName?: string;
  caregiverQuote?: string;
}

export interface FutureSelfPersona {
  systemPrompt: string; // fully-rendered persona prompt for calls
  achievements: string[];
  speechStyle: string;
  anchorMemories: string[]; // "the hard days" references
}

export interface AppState {
  profile: UserProfile;
  persona: FutureSelfPersona;
  cleanDays: number;
  diary: { day: number; line: string }[];
  callHistory: { timestamp: number; outcome: "calmed" | "escalated" }[];
  /**
   * Added for /timeline: slips nudge the avatar's blur back up without
   * resetting the day count. Optional so existing stored states stay valid.
   */
  relapses?: number;
}

export type DiaryEntry = AppState["diary"][number];
export type CallRecord = AppState["callHistory"][number];
export type CallOutcome = CallRecord["outcome"];

/* ---------------------------------------------------------------------- */
/* Defaults                                                                */
/* ---------------------------------------------------------------------- */

export const EMPTY_PROFILE: UserProfile = {
  name: "",
  substance: "",
  duration: "",
  losses: [],
  dreams: [],
  voiceNoteTranscript: "",
};

export const EMPTY_PERSONA: FutureSelfPersona = {
  systemPrompt: "",
  achievements: [],
  speechStyle: "",
  anchorMemories: [],
};

export const DEFAULT_APP_STATE: AppState = {
  profile: EMPTY_PROFILE,
  persona: EMPTY_PERSONA,
  cleanDays: 0,
  diary: [],
  callHistory: [],
  relapses: 0,
};

/* ---------------------------------------------------------------------- */
/* Wire types: POST /api/gemini                                            */
/* ---------------------------------------------------------------------- */

export type Role = "user" | "assistant" | "system";

export interface ChatTurn {
  role: Role;
  content: string;
  imageBase64?: string;
}

export interface GeminiRequestBody {
  messages: ChatTurn[];
  /** Normally `persona.systemPrompt`. */
  systemPrompt?: string;
  /** Image for the latest turn — e.g. `profile.photoBase64`. Data URI or bare base64. */
  imageBase64?: string;
  model?: string;
}

export interface GeminiResponseBody {
  text: string;
  /** True when the canned fallback was served instead of a live model reply. */
  fallback?: boolean;
  /** Short reason for the fallback, for debugging. Not for display to the user. */
  error?: string;
}

/**
 * Model choice is driven by what this key can actually serve on the free tier:
 * the pinned 2.x ids are quota-0 or retired, and `gemini-flash-latest`
 * (→ gemini-3.6-flash) allows only 20 requests/day. The lite alias has real
 * headroom and the lowest latency, which is what a live voice call needs.
 * Override per-environment with GEMINI_MODEL.
 */
export const DEFAULT_MODEL = "gemini-flash-lite-latest";

/** Used only if a call arrives before the persona has been rendered. */
export const DEFAULT_SYSTEM_PROMPT =
  "You are the user's future self, one year into recovery. Speak warmly and " +
  "plainly, in short sentences. You remember the hard days. You are not a " +
  "doctor and you do not give medical advice.";
