/** @jest-environment node */

import { POST as diaryPost } from "@/app/api/diary/route";
import { POST as summaryPost } from "@/app/api/call-summary/route";
import { POST as reviewPost } from "@/app/api/year-review/route";
import { DEFAULT_APP_STATE } from "@/lib/types";

describe("AI route graceful degradation", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  afterAll(() => {
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns a diary line when the model is unavailable", async () => {
    const response = await diaryPost(
      new Request("http://localhost/api/diary", {
        method: "POST",
        body: JSON.stringify({ day: 2, profile: { name: "Asha" } }),
      }),
    );
    const body = await response.json();
    expect(body.fallback).toBe(true);
    expect(body.line).toBeTruthy();
  });

  it("records a safe silent-call outcome without calling a model", async () => {
    const response = await summaryPost(
      new Request("http://localhost/api/call-summary", {
        method: "POST",
        body: JSON.stringify({ transcript: [], profile: { name: "Asha" } }),
      }),
    );
    const body = await response.json();
    expect(body.mood).toBe("quiet");
    expect(body.summary).toMatch(/stayed on the line/i);
  });

  it("keeps the year review usable when Gemini is unavailable", async () => {
    const response = await reviewPost(
      new Request("http://localhost/api/year-review", {
        method: "POST",
        body: JSON.stringify({ state: { ...DEFAULT_APP_STATE, profile: { ...DEFAULT_APP_STATE.profile, name: "Asha" } } }),
      }),
    );
    const body = await response.json();
    expect(body.fallback).toBe(true);
    expect(body.benefits).toHaveLength(4);
  });
});
