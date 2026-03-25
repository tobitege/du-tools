export type CompatRGBA = [number, number, number, number];

export interface CompatShadow {
  radius: number;
  color: CompatRGBA;
}

export interface CompatTextAlign {
  hor: number;
  ver: number;
}

export interface CompatLayerStyleDefaults {
  fillColor: CompatRGBA;
  strokeColor: CompatRGBA;
  strokeWidth: number;
  shadow: CompatShadow;
  rotation: number;
  textAlign: CompatTextAlign;
}

export interface DUFontMetadata {
  displayFamily: string;
  weight?: "bold" | "lighter";
  ascenderMultiplier: number;
  descenderMultiplier: number;
  averageWidthMultiplier: number;
  averageHeightMultiplier: number;
}

export const DU_RS_VERSION = 2;
export const DU_RENDER_COST_MAX = 4_000_000;
export const DU_MAX_LOADED_FONTS = 8;

export const DU_SHAPE = {
  Bezier: 0,
  Box: 1,
  BoxRounded: 2,
  Circle: 3,
  Image: 4,
  Line: 5,
  Polygon: 6,
  Text: 7,
} as const;

export const DU_ALIGN_H = {
  Left: 0,
  Center: 1,
  Right: 2,
} as const;

export const DU_ALIGN_V = {
  Ascender: 0,
  Top: 1,
  Middle: 2,
  Baseline: 3,
  Bottom: 4,
  Descender: 5,
} as const;

const DEFAULT_FILL_COLOR: CompatRGBA = [1, 1, 1, 1];
const DEFAULT_STROKE_COLOR: CompatRGBA = [1, 1, 1, 1];
const DEFAULT_SHADOW_COLOR: CompatRGBA = [1, 1, 1, 1];

export const DU_FONT_CATALOG = [
  "FiraMono",
  "FiraMono-Bold",
  "Montserrat",
  "Montserrat-Bold",
  "Montserrat-Light",
  "Play",
  "Play-Bold",
  "RefrigeratorDeluxe",
  "RefrigeratorDeluxe-Light",
  "RobotoCondensed",
  "RobotoMono",
  "RobotoMono-Bold",
] as const;

export type DUFontName = (typeof DU_FONT_CATALOG)[number];

export const DU_FONT_METADATA: Record<DUFontName, DUFontMetadata> = {
  FiraMono: {
    displayFamily: '"Fira Mono", monospace',
    ascenderMultiplier: 0.935546875,
    descenderMultiplier: -0.265625,
    averageWidthMultiplier: 0.70282573084677,
    averageHeightMultiplier: 0.92565524193548,
  },
  "FiraMono-Bold": {
    displayFamily: '"Fira Mono", monospace',
    weight: "bold",
    ascenderMultiplier: 0.935546875,
    descenderMultiplier: -0.265625,
    averageWidthMultiplier: 0.7590568296371,
    averageHeightMultiplier: 0.93699596774194,
  },
  Montserrat: {
    displayFamily: '"Montserrat", sans-serif',
    ascenderMultiplier: 0.96875,
    descenderMultiplier: -0.251953125,
    averageWidthMultiplier: 0.7839591733871,
    averageHeightMultiplier: 0.921875,
  },
  "Montserrat-Bold": {
    displayFamily: '"Montserrat", sans-serif',
    weight: "bold",
    ascenderMultiplier: 0.96875,
    descenderMultiplier: -0.251953125,
    averageWidthMultiplier: 0.82601436491935,
    averageHeightMultiplier: 0.92666330645161,
  },
  "Montserrat-Light": {
    displayFamily: '"Montserrat", sans-serif',
    weight: "lighter",
    ascenderMultiplier: 0.96875,
    descenderMultiplier: -0.251953125,
    averageWidthMultiplier: 0.7614037298387,
    averageHeightMultiplier: 0.91859879032258,
  },
  Play: {
    displayFamily: '"Play", sans-serif',
    ascenderMultiplier: 0.9375,
    descenderMultiplier: -0.220703125,
    averageWidthMultiplier: 0.7009513608871,
    averageHeightMultiplier: 0.87525201612903,
  },
  "Play-Bold": {
    displayFamily: '"Play", sans-serif',
    weight: "bold",
    ascenderMultiplier: 0.9375,
    descenderMultiplier: -0.220703125,
    averageWidthMultiplier: 0.75017326108871,
    averageHeightMultiplier: 0.87525201612903,
  },
  RefrigeratorDeluxe: {
    displayFamily: '"refrigerator-deluxe", sans-serif',
    ascenderMultiplier: 0.82421875,
    descenderMultiplier: -0.1767578125,
    averageWidthMultiplier: 0.54813508064516,
    averageHeightMultiplier: 0.88886088709677,
  },
  "RefrigeratorDeluxe-Light": {
    displayFamily: '"refrigerator-deluxe", sans-serif',
    weight: "lighter",
    ascenderMultiplier: 0.82421875,
    descenderMultiplier: -0.1767578125,
    averageWidthMultiplier: 0.52898185483871,
    averageHeightMultiplier: 0.88860887096774,
  },
  RobotoCondensed: {
    displayFamily: '"Roboto Condensed", sans-serif',
    ascenderMultiplier: 0.927734375,
    descenderMultiplier: -0.244140625,
    averageWidthMultiplier: 0.63977444556452,
    averageHeightMultiplier: 0.93220766129032,
  },
  RobotoMono: {
    displayFamily: '"Roboto Mono", monospace',
    ascenderMultiplier: 1.0478515625,
    descenderMultiplier: -0.271484375,
    averageWidthMultiplier: 0.71044921875,
    averageHeightMultiplier: 0.93245967741935,
  },
  "RobotoMono-Bold": {
    displayFamily: '"Roboto Mono", monospace',
    weight: "bold",
    ascenderMultiplier: 1.0478515625,
    descenderMultiplier: -0.271484375,
    averageWidthMultiplier: 0.73979334677419,
    averageHeightMultiplier: 0.93321572580645,
  },
};

const ROBOTO_MONO_BOUNDS_OVERRIDES = {
  "20|%": [17.55, 20.63],
  "30|.": [5.39, 20.63],
  "30|%": [26.34, 30.96],
  "30|%%%": [71.42, 30.96],
} as const;

export const DU_TEXT_BOUNDS_OVERRIDES: Partial<Record<DUFontName, Record<string, readonly [number, number]>>> = {
  RobotoMono: ROBOTO_MONO_BOUNDS_OVERRIDES,
};

export const DU_LAYER_STYLE_DEFAULTS: Record<number, CompatLayerStyleDefaults> = {
  [DU_SHAPE.Bezier]: {
    fillColor: DEFAULT_FILL_COLOR,
    strokeColor: DEFAULT_STROKE_COLOR,
    strokeWidth: 1,
    shadow: { radius: 0, color: DEFAULT_SHADOW_COLOR },
    rotation: 0,
    textAlign: { hor: DU_ALIGN_H.Left, ver: DU_ALIGN_V.Baseline },
  },
  [DU_SHAPE.Box]: {
    fillColor: DEFAULT_FILL_COLOR,
    strokeColor: DEFAULT_STROKE_COLOR,
    strokeWidth: 0,
    shadow: { radius: 0, color: DEFAULT_SHADOW_COLOR },
    rotation: 0,
    textAlign: { hor: DU_ALIGN_H.Left, ver: DU_ALIGN_V.Baseline },
  },
  [DU_SHAPE.BoxRounded]: {
    fillColor: DEFAULT_FILL_COLOR,
    strokeColor: DEFAULT_STROKE_COLOR,
    strokeWidth: 0,
    shadow: { radius: 0, color: DEFAULT_SHADOW_COLOR },
    rotation: 0,
    textAlign: { hor: DU_ALIGN_H.Left, ver: DU_ALIGN_V.Baseline },
  },
  [DU_SHAPE.Circle]: {
    fillColor: DEFAULT_FILL_COLOR,
    strokeColor: DEFAULT_STROKE_COLOR,
    strokeWidth: 0,
    shadow: { radius: 0, color: DEFAULT_SHADOW_COLOR },
    rotation: 0,
    textAlign: { hor: DU_ALIGN_H.Left, ver: DU_ALIGN_V.Baseline },
  },
  [DU_SHAPE.Image]: {
    fillColor: DEFAULT_FILL_COLOR,
    strokeColor: DEFAULT_STROKE_COLOR,
    strokeWidth: 0,
    shadow: { radius: 0, color: DEFAULT_SHADOW_COLOR },
    rotation: 0,
    textAlign: { hor: DU_ALIGN_H.Left, ver: DU_ALIGN_V.Baseline },
  },
  [DU_SHAPE.Line]: {
    fillColor: DEFAULT_FILL_COLOR,
    strokeColor: DEFAULT_STROKE_COLOR,
    strokeWidth: 1,
    shadow: { radius: 0, color: DEFAULT_SHADOW_COLOR },
    rotation: 0,
    textAlign: { hor: DU_ALIGN_H.Left, ver: DU_ALIGN_V.Baseline },
  },
  [DU_SHAPE.Polygon]: {
    fillColor: DEFAULT_FILL_COLOR,
    strokeColor: DEFAULT_STROKE_COLOR,
    strokeWidth: 0,
    shadow: { radius: 0, color: DEFAULT_SHADOW_COLOR },
    rotation: 0,
    textAlign: { hor: DU_ALIGN_H.Left, ver: DU_ALIGN_V.Baseline },
  },
  [DU_SHAPE.Text]: {
    fillColor: DEFAULT_FILL_COLOR,
    strokeColor: DEFAULT_STROKE_COLOR,
    strokeWidth: 0,
    shadow: { radius: 0, color: DEFAULT_SHADOW_COLOR },
    rotation: 0,
    textAlign: { hor: DU_ALIGN_H.Left, ver: DU_ALIGN_V.Baseline },
  },
};

export function isDUFontName(name: string): name is DUFontName {
  return Object.hasOwn(DU_FONT_METADATA, name);
}

export function getDUFontMetadata(name: string): DUFontMetadata | null {
  return isDUFontName(name) ? DU_FONT_METADATA[name] : null;
}

export function getDUTextBoundsOverride(name: string, size: number, text: string): readonly [number, number] | null {
  if (!isDUFontName(name)) {
    return null;
  }

  return DU_TEXT_BOUNDS_OVERRIDES[name]?.[`${size}|${text}`] ?? null;
}

export function costCreateLayer(): number {
  return 75_000;
}

export function renderCostSizeBump(strokeWidth: number, shadowRadius: number): number {
  return (Math.max(0, shadowRadius) + Math.max(0, strokeWidth)) * 2;
}

export function costAddBox(width: number, height: number, strokeWidth = 0, shadowRadius = 0): number {
  const sizeBump = renderCostSizeBump(strokeWidth, shadowRadius);
  return Math.max(16, (width + sizeBump) * (height + sizeBump));
}

export function costAddText(textWidth: number, textHeight: number, strokeWidth = 0, shadowRadius = 0): number {
  const sizeBump = renderCostSizeBump(strokeWidth, shadowRadius);
  return Math.floor((textWidth + sizeBump) * (textHeight + sizeBump));
}
