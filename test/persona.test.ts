function localPersona(profile: { name?: string; dreams?: string[]; losses?: string[]; caregiverName?: string; caregiverQuote?: string }) {
  const name = profile.name?.trim() || "friend";
  const dreams = profile.dreams?.filter(Boolean) ?? [];
  const losses = profile.losses?.filter(Boolean) ?? [];
  const caregiver = profile.caregiverName?.trim();

  const systemPrompt = [
    `You are ${name}, exactly one year from today, fully in recovery.`,
    `You are speaking to yourself as you are now, mid-craving, on a voice call.`,
    `Speak in first person plural — "we", "us". You ARE them, one year ahead.`,
    dreams.length ? `Things we got back this year: ${dreams.join(", ")}.` : ``,
    losses.length ? `What it cost us before: ${losses.join(", ")}.` : ``,
    caregiver && profile.caregiverQuote ? `${caregiver} once said: "${profile.caregiverQuote}".` : ``,
  ].filter(Boolean).join("\n");

  return {
    systemPrompt,
    achievements: dreams.length ? dreams.map((d) => `We got ${d} back.`) : ["We made it through a year."],
    speechStyle: "Short, warm sentences. First person plural.",
    anchorMemories: losses.length ? losses.map((l) => `The days when ${l} was slipping away.`) : ["The hardest nights."],
  };
}

describe("Persona Builder & Local Generation", () => {
  it("generates structured persona from user profile", () => {
    const profile = {
      name: "Alex",
      dreams: ["Health", "Family Trust"],
      losses: ["Career", "Savings"],
      caregiverName: "Sarah",
      caregiverQuote: "Keep moving forward",
    };

    const persona = localPersona(profile);

    expect(persona.systemPrompt).toContain("Alex");
    expect(persona.systemPrompt).toContain("Health, Family Trust");
    expect(persona.systemPrompt).toContain("Sarah once said");
    expect(persona.achievements).toContain("We got Health back.");
    expect(persona.anchorMemories).toContain("The days when Career was slipping away.");
  });

  it("handles empty profile gracefully", () => {
    const persona = localPersona({});
    expect(persona.systemPrompt).toContain("friend");
    expect(persona.achievements).toEqual(["We made it through a year."]);
  });
});
