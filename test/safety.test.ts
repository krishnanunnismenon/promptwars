import { classifySafetyRisk } from "@/lib/callEngine";

describe("safety language routing", () => {
  it("routes direct self-harm and overdose language to urgent support", () => {
    expect(classifySafetyRisk("I want to hurt myself")).toBe("urgent");
    expect(classifySafetyRisk("I think I took too much")).toBe("urgent");
  });

  it("keeps ordinary craving language in the supportive call flow", () => {
    expect(classifySafetyRisk("I really want a drink tonight")).toBe("support");
  });
});
