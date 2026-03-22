import { describe, expect, it } from "vitest";
import {
  getAnimationDelayMs,
  getEffectiveMaxFps,
  getFrameDeltaSeconds,
  getRuntimeTimeSeconds,
  mergeMeasuredDisplayFps,
  normalizeAnimationFrameCount,
} from "../src/emulator/frameTiming";

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

  it("normalizes requested animation frames to positive integers", () => {
    expect(normalizeAnimationFrameCount(5)).toBe(5);
    expect(normalizeAnimationFrameCount(2.9)).toBe(2);
    expect(normalizeAnimationFrameCount(0)).toBe(0);
    expect(normalizeAnimationFrameCount(-3)).toBe(0);
    expect(normalizeAnimationFrameCount(Number.NaN)).toBe(0);
  });

  it("clamps max fps to the measured display paint rate when available", () => {
    expect(getEffectiveMaxFps(90, 59.8)).toBe(60);
    expect(getEffectiveMaxFps(120, 144)).toBe(120);
  });

  it("falls back to the configured max fps when no display measurement exists", () => {
    expect(getEffectiveMaxFps(90, null)).toBe(90);
    expect(getEffectiveMaxFps(60, Number.NaN)).toBe(60);
  });

  it("keeps the highest measured display fps instead of chasing temporary slowdowns", () => {
    expect(mergeMeasuredDisplayFps(null, 59.8)).toBe(59.8);
    expect(mergeMeasuredDisplayFps(59.8, 23.4)).toBe(59.8);
    expect(mergeMeasuredDisplayFps(59.8, 119.7)).toBe(119.7);
  });

  it("converts requested animation frames into an exact delay from the frame start", () => {
    expect(getAnimationDelayMs(1000, 1000, 5, 1000 / 60)).toBeCloseTo(83.333333, 6);
  });

  it("subtracts elapsed execution time from the requested animation delay", () => {
    expect(getAnimationDelayMs(1025, 1000, 2, 1000 / 60)).toBeCloseTo(8.333333, 6);
  });
});
