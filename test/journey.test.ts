import { buildJourney, nextMilestone, RELAPSE_LINE, slipDays } from "@/lib/journey";
import { DEFAULT_APP_STATE } from "@/lib/types";

describe("recovery journey calculations", () => {
  const state = {
    ...DEFAULT_APP_STATE,
    cleanDays: 100,
    diary: [
      { day: 12, line: RELAPSE_LINE },
      { day: 12, line: RELAPSE_LINE },
      { day: 88, line: RELAPSE_LINE },
      { day: 99, line: "We made dinner." },
    ],
  };

  it("keeps slips visible without resetting the recovery total", () => {
    expect(slipDays(state)).toEqual([12, 88]);
    expect(buildJourney(state, 14).map((day) => day.day)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 87),
    );
    expect(buildJourney(state, 14).filter((day) => day.slipped).map((day) => day.day)).toEqual([88]);
  });

  it("returns the next meaningful recovery milestone", () => {
    expect(nextMilestone(6)).toEqual({ target: 7, label: "one week" });
    expect(nextMilestone(90)).toEqual({ target: 180, label: "six months" });
    expect(nextMilestone(365)).toEqual({ target: 730, label: "2 years" });
  });
});
