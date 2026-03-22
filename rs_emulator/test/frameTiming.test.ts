import { describe, expect, it } from "vitest";
import { getFrameDeltaSeconds, getRuntimeTimeSeconds } from "../src/emulator/frameTiming";

describe("frame timing helpers", () => {
  it("returns measured frame deltas in seconds", () => {
    expect(getFrameDeltaSeconds(1025, 1000, 16.6667)).toBe(0.025);
  });

  it("falls back to the configured frame interval for the first animated frame", () => {
    expect(getFrameDeltaSeconds(1000, null, 16.6667)).toBeCloseTo(1 / 60, 6);
  });

  it("returns run-relative time in seconds", () => {
    expect(getRuntimeTimeSeconds(1750, 1000)).toBe(0.75);
  });
});
