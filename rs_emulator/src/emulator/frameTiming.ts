export function millisecondsToSeconds(milliseconds: number): number {
  return Math.max(0, milliseconds) / 1000;
}

export function getFrameDeltaSeconds(nowMs: number, previousFrameStartedAtMs: number | null, fallbackDeltaMs: number): number {
  if (previousFrameStartedAtMs == null) {
    return millisecondsToSeconds(fallbackDeltaMs);
  }

  return millisecondsToSeconds(nowMs - previousFrameStartedAtMs);
}

export function getRuntimeTimeSeconds(nowMs: number, runStartedAtMs: number): number {
  return millisecondsToSeconds(nowMs - runStartedAtMs);
}
