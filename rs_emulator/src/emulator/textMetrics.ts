import { getDUFontMetadata, getDUTextBoundsOverride } from "./renderScriptCompat";

export interface MeasuredText {
  width: number;
  height: number;
  ascent: number;
  descent: number;
}

export interface CompatFontMetrics {
  ascender: number;
  descender: number;
}

function fallbackAscent(size: number): number {
  return size * 0.8;
}

function fallbackDescent(size: number): number {
  return size * 0.2;
}

export function fontFamilyWithFallback(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "sans-serif";
  }

  return getDUFontMetadata(trimmed)?.displayFamily ?? `"${trimmed}", sans-serif`;
}

export function getFontString(name: string, size: number): string {
  const metadata = getDUFontMetadata(name.trim());
  const weight = metadata?.weight ? `${metadata.weight} ` : "";
  return `${weight}${size}px ${fontFamilyWithFallback(name)}`;
}

function createMeasurementContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    return canvas.getContext("2d");
  }

  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(1, 1).getContext("2d");
  }

  return null;
}

const measurementContext = createMeasurementContext();

function getAverageDimensions(name: string, size: number): { width: number; height: number } {
  const metadata = getDUFontMetadata(name);
  if (!metadata) {
    return {
      width: size * 0.6,
      height: size,
    };
  }

  return {
    width: metadata.averageWidthMultiplier * size,
    height: metadata.averageHeightMultiplier * size,
  };
}

function hasAscender(text: string): boolean {
  return /[A-Z0-9bdfhklt]/.test(text);
}

function hasDescender(text: string): boolean {
  return /[gjpqyQ%]/.test(text);
}

function resolveTextVerticalMetrics(fontDescent: number, height: number, text: string): { ascent: number; descent: number } {
  const safeHeight = Math.max(height, 0);
  if (safeHeight === 0) {
    return { ascent: 0, descent: 0 };
  }

  const descentFactor = hasDescender(text)
    ? 0.95
    : text.trim() === ""
      ? 0.5
      : 0.35;
  const targetDescent = Math.min(safeHeight, Math.max(fontDescent * descentFactor, safeHeight * 0.12));
  const targetAscent = Math.max(0, Math.min(safeHeight, hasAscender(text) ? safeHeight - targetDescent : safeHeight * 0.82));
  const remaining = Math.max(0, safeHeight - targetAscent);

  return {
    ascent: targetAscent,
    descent: remaining,
  };
}

export function measureCompatFontMetrics(name: string, size: number): CompatFontMetrics {
  const metadata = getDUFontMetadata(name);
  if (!metadata) {
    return {
      ascender: fallbackAscent(size),
      descender: -fallbackDescent(size),
    };
  }

  return {
    ascender: metadata.ascenderMultiplier * size,
    descender: metadata.descenderMultiplier * size,
  };
}

export function measureFontMetrics(name: string, size: number): MeasuredText {
  const compat = measureCompatFontMetrics(name, size);
  const ascent = compat.ascender;
  const descent = Math.abs(compat.descender);
  const average = getAverageDimensions(name, size);

  return {
    width: average.width,
    height: average.height,
    ascent,
    descent,
  };
}

export function measureTextBounds(name: string, size: number, text: string): MeasuredText {
  const safeText = text ?? "";
  const baseMetrics = measureFontMetrics(name, size);
  const override = getDUTextBoundsOverride(name, size, safeText);
  let width: number;
  let height: number;

  if (override) {
    [width, height] = override;
  } else if (!safeText) {
    width = 0;
    height = baseMetrics.height;
  } else if (!measurementContext) {
    width = getAverageDimensions(name, size).width * safeText.length;
    height = getAverageDimensions(name, size).height;
  } else {
    measurementContext.font = getFontString(name, size);
    const metrics = measurementContext.measureText(safeText || " ");
    const average = getAverageDimensions(name, size);
    width = metrics.width || average.width * safeText.length;
    height = average.height;
  }

  const vertical = resolveTextVerticalMetrics(baseMetrics.descent, height, safeText);

  return {
    width,
    height,
    ascent: vertical.ascent,
    descent: vertical.descent,
  };
}
