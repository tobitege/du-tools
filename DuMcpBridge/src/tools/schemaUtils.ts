import * as z from "zod/v4";

export function clampedIntSchema(min: number, max: number, defaultValue: number) {
  return z.preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
      return value;
    }

    const intValue = Math.trunc(value);
    if (intValue < min) {
      return min;
    }

    if (intValue > max) {
      return max;
    }

    return intValue;
  }, z.number().int().min(min).max(max).default(defaultValue));
}
