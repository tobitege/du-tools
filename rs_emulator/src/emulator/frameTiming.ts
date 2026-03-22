export function millisecondsToSeconds(milliseconds: number): number {
  return Math.max(0, milliseconds) / 1000;
}

export function normalizeAnimationFrameCount(frames: number): number {
  if (!Number.isFinite(frames)) {
    return 0;
  }

  const normalized = Math.floor(frames);
  return normalized > 0 ? normalized : 0;
}

export function getEffectiveMaxFps(configuredMaxFps: number, measuredDisplayFps: number | null | undefined): number {
  const configured = Math.max(1, Math.round(configuredMaxFps));

  if (typeof measuredDisplayFps !== "number" || !Number.isFinite(measuredDisplayFps) || measuredDisplayFps <= 0) {
    return configured;
  }

  return Math.min(configured, Math.max(1, Math.round(measuredDisplayFps)));
}

export function mergeMeasuredDisplayFps(
  currentMeasuredFps: number | null | undefined,
  nextMeasuredFps: number | null | undefined,
): number | null {
  const current = typeof currentMeasuredFps === "number" && Number.isFinite(currentMeasuredFps) && currentMeasuredFps > 0
    ? currentMeasuredFps
    : null;
  const next = typeof nextMeasuredFps === "number" && Number.isFinite(nextMeasuredFps) && nextMeasuredFps > 0
    ? nextMeasuredFps
    : null;

  if (next == null) {
    return current;
  }

  if (current == null) {
    return next;
  }

  return next > current ? next : current;
}

export function getAnimationDelayMs(nowMs: number, frameStartedAtMs: number, requestedFrames: number, frameIntervalMs: number): number {
  const normalizedFrames = normalizeAnimationFrameCount(requestedFrames);
  const targetTimeMs = frameStartedAtMs + (normalizedFrames * Math.max(0, frameIntervalMs));
  return Math.max(0, targetTimeMs - nowMs);
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
