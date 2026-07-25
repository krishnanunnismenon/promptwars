import { CaregiverRequestBodySchema, GeminiRequestBodySchema, UserProfileSchema } from "@/lib/schemas";

describe("Strict API Schema Validation", () => {
  it("validates correct GeminiRequestBodySchema payloads", () => {
    const validPayload = {
      messages: [{ role: "user", content: "Hello" }],
      systemPrompt: "You are the future self.",
      model: "gemini-flash-lite-latest",
    };

    const result = GeminiRequestBodySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects invalid GeminiRequestBodySchema payloads with empty messages", () => {
    const invalidPayload = {
      messages: [],
    };

    const result = GeminiRequestBodySchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it("validates UserProfileSchema defaults and limits", () => {
    const profile = {
      name: "Alex",
      substance: "Alcohol",
      losses: ["Job", "Trust"],
      dreams: ["Health"],
      phone: "9876543210",
      caregiverPhone: "9876543211",
    };

    const result = UserProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Alex");
      expect(result.data.losses).toEqual(["Job", "Trust"]);
      expect(result.data.caregiverPhone).toBe("9876543211");
    }
  });

  it("rejects oversized voice transcripts before they reach a model route", () => {
    expect(UserProfileSchema.safeParse({ voiceNoteTranscript: "x".repeat(5001) }).success).toBe(false);
  });

  it("validates CaregiverRequestBodySchema", () => {
    const payload = {
      cleanDays: 5,
      lastOutcome: "calmed",
    };

    const result = CaregiverRequestBodySchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
