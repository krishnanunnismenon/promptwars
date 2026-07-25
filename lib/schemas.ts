import { z } from "zod";

/**
 * Strict API Schemas using Zod for runtime request validation,
 * type safety, and input sanitization.
 */

export const UserProfileSchema = z.object({
  name: z.string().max(100).optional().default(""),
  substance: z.string().max(100).optional().default(""),
  duration: z.string().max(100).optional().default(""),
  losses: z.array(z.string().max(100)).optional().default([]),
  dreams: z.array(z.string().max(100)).optional().default([]),
  voiceNoteTranscript: z.string().max(5000).optional().default(""),
  photoBase64: z.string().optional(),
  photoUrl: z.string().url().optional(),
  phone: z.string().max(20).optional(),
  caregiverName: z.string().max(100).optional(),
  caregiverPhone: z.string().max(20).optional(),
  caregiverQuote: z.string().max(500).optional(),
});

export const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  imageBase64: z.string().optional(),
});

export const GeminiRequestBodySchema = z.object({
  messages: z.array(ChatTurnSchema).min(1, "Messages array must contain at least one turn"),
  systemPrompt: z.string().max(10000).optional(),
  imageBase64: z.string().optional(),
  model: z.string().max(100).optional(),
});

export const PersonaRequestBodySchema = z.union([
  z.object({ profile: UserProfileSchema.optional() }),
  UserProfileSchema,
]);

export const CaregiverRequestBodySchema = z.object({
  profile: UserProfileSchema.optional(),
  lastOutcome: z.enum(["calmed", "escalated"]).nullable().optional(),
  cleanDays: z.number().min(0).optional().default(1),
});
