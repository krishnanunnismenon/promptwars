import { DEFAULT_APP_STATE, DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT, EMPTY_PERSONA, EMPTY_PROFILE } from "@/lib/types";

describe("Application Types & Defaults", () => {
  it("has valid default profile structure", () => {
    expect(EMPTY_PROFILE).toEqual({
      name: "",
      substance: "",
      duration: "",
      losses: [],
      dreams: [],
      voiceNoteTranscript: "",
    });
  });

  it("has valid default persona structure", () => {
    expect(EMPTY_PERSONA).toEqual({
      systemPrompt: "",
      achievements: [],
      speechStyle: "",
      anchorMemories: [],
    });
  });

  it("has correct default app state", () => {
    expect(DEFAULT_APP_STATE.cleanDays).toBe(0);
    expect(DEFAULT_APP_STATE.relapses).toBe(0);
    expect(DEFAULT_APP_STATE.callHistory).toEqual([]);
    expect(DEFAULT_APP_STATE.diary).toEqual([]);
  });

  it("configures gemini flash-lite model and system prompt", () => {
    expect(DEFAULT_MODEL).toContain("gemini");
    expect(DEFAULT_SYSTEM_PROMPT).toContain("future self");
  });
});
