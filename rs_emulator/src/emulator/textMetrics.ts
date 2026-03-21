export interface MeasuredText {
  width: number;
  height: number;
  ascent: number;
  descent: number;
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

  return `"${trimmed}", sans-serif`;
}

export function getFontString(name: string, size: number): string {
  return `${size}px ${fontFamilyWithFallback(name)}`;
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

export function measureFontMetrics(name: string, size: number): MeasuredText {
  if (!measurementContext) {
    const ascent = fallbackAscent(size);
    const descent = fallbackDescent(size);
    return {
      width: size,
      height: ascent + descent,
      ascent,
      descent,
    };
  }

  measurementContext.font = getFontString(name, size);
  const metrics = measurementContext.measureText("Mg");
  const ascent = metrics.actualBoundingBoxAscent || fallbackAscent(size);
  const descent = metrics.actualBoundingBoxDescent || fallbackDescent(size);

  return {
    width: metrics.width,
    height: ascent + descent,
    ascent,
    descent,
  };
}

export function measureTextBounds(name: string, size: number, text: string): MeasuredText {
  const baseMetrics = measureFontMetrics(name, size);
  if (!measurementContext) {
    return {
      width: (text ?? "").length * size * 0.6,
      height: baseMetrics.height,
      ascent: baseMetrics.ascent,
      descent: baseMetrics.descent,
    };
  }

  measurementContext.font = getFontString(name, size);
  const metrics = measurementContext.measureText(text || " ");

  return {
    width: text ? metrics.width : 0,
    height: (metrics.actualBoundingBoxAscent || baseMetrics.ascent) + (metrics.actualBoundingBoxDescent || baseMetrics.descent),
    ascent: metrics.actualBoundingBoxAscent || baseMetrics.ascent,
    descent: metrics.actualBoundingBoxDescent || baseMetrics.descent,
  };
}
