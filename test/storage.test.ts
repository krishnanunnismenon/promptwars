import { normalizeAppState } from "@/lib/storage";

describe("durable app-state normalization", () => {
  it("preserves newer recovery fields while repairing malformed records", () => {
    const state = normalizeAppState({
      profile: { name: "Asha", caregiverPhone: "9876543210", losses: "bad" },
      diary: [{ day: 3, line: "We stayed." }],
      callHistory: [{ timestamp: 1, outcome: "calmed", triggers: ["evenings"] }],
      cleanDays: 3,
    });

    expect(state.profile.name).toBe("Asha");
    expect(state.profile.caregiverPhone).toBe("9876543210");
    expect(state.profile.losses).toEqual([]);
    expect(state.callHistory[0]?.triggers).toEqual(["evenings"]);
  });

  it("returns a usable safe default for corrupt input", () => {
    expect(normalizeAppState(null).cleanDays).toBe(0);
    expect(normalizeAppState("not-state").callHistory).toEqual([]);
  });
});
