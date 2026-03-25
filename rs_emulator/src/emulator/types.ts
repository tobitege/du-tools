import {
  DU_ALIGN_H,
  DU_ALIGN_V,
  DU_LAYER_STYLE_DEFAULTS,
  DU_RENDER_COST_MAX,
  DU_SHAPE,
} from "./renderScriptCompat";

export const RSShape = {
  ...DU_SHAPE,
} as const;
export type RSShape = (typeof RSShape)[keyof typeof RSShape];

export const RSAlignHor = {
  ...DU_ALIGN_H,
} as const;
export type RSAlignHor = (typeof RSAlignHor)[keyof typeof RSAlignHor];

export const RSAlignVer = {
  ...DU_ALIGN_V,
} as const;
export type RSAlignVer = (typeof RSAlignVer)[keyof typeof RSAlignVer];

export type RGBA = [number, number, number, number];

export interface LayerStyle {
  fillColor: RGBA;
  strokeColor: RGBA;
  strokeWidth: number;
  shadow: { radius: number; color: RGBA };
  rotation: number;
  textAlign: { hor: number; ver: number };
}

export function defaultLayerStyleForShape(shape: number): LayerStyle {
  const base = DU_LAYER_STYLE_DEFAULTS[shape] ?? DU_LAYER_STYLE_DEFAULTS[RSShape.Box];
  return {
    fillColor: [...base.fillColor],
    strokeColor: [...base.strokeColor],
    strokeWidth: base.strokeWidth,
    shadow: { radius: base.shadow.radius, color: [...base.shadow.color] },
    rotation: base.rotation,
    textAlign: { ...base.textAlign },
  };
}

export function defaultLayerStyle(): LayerStyle {
  return defaultLayerStyleForShape(RSShape.Box);
}

export function buildDefaultLayerStyles(): Record<number, LayerStyle> {
  return Object.fromEntries(
    Object.keys(DU_LAYER_STYLE_DEFAULTS).map((shape) => {
      const numericShape = Number(shape);
      return [numericShape, defaultLayerStyleForShape(numericShape)];
    }),
  );
}

export type DrawCommand =
  | { op: "AddBezier"; layer: number; style: LayerStyle; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
  | { op: "AddBox"; layer: number; style: LayerStyle; x: number; y: number; w: number; h: number }
  | { op: "AddBoxRounded"; layer: number; style: LayerStyle; x: number; y: number; w: number; h: number; radius: number }
  | { op: "AddCircle"; layer: number; style: LayerStyle; x: number; y: number; radius: number }
  | { op: "AddLine"; layer: number; style: LayerStyle; x1: number; y1: number; x2: number; y2: number }
  | { op: "AddQuad"; layer: number; style: LayerStyle; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; x4: number; y4: number }
  | { op: "AddTriangle"; layer: number; style: LayerStyle; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
  | { op: "AddText"; layer: number; style: LayerStyle; fontId: number; text: string; x: number; y: number }
  | { op: "AddImage"; layer: number; style: LayerStyle; imageId: number; x: number; y: number; w: number; h: number }
  | { op: "AddImageSub"; layer: number; style: LayerStyle; imageId: number; x: number; y: number; w: number; h: number; subX: number; subY: number; subW: number; subH: number }
  | { op: "SetDefaultFillColor"; layer: number; shape: number; color: RGBA }
  | { op: "SetDefaultStrokeColor"; layer: number; shape: number; color: RGBA }
  | { op: "SetDefaultStrokeWidth"; layer: number; shape: number; width: number }
  | { op: "SetDefaultShadow"; layer: number; shape: number; radius: number; color: RGBA }
  | { op: "SetDefaultRotation"; layer: number; shape: number; rotation: number }
  | { op: "SetDefaultTextAlign"; layer: number; hor: number; ver: number }
  | { op: "SetNextFillColor"; layer: number; color: RGBA }
  | { op: "SetNextStrokeColor"; layer: number; color: RGBA }
  | { op: "SetNextStrokeWidth"; layer: number; width: number }
  | { op: "SetNextShadow"; layer: number; radius: number; color: RGBA }
  | { op: "SetNextRotation"; layer: number; rotation: number }
  | { op: "SetNextRotationDegrees"; layer: number; rotation: number }
  | { op: "SetNextTextAlign"; layer: number; hor: number; ver: number }
  | { op: "SetLayerClipRect"; layer: number; x: number; y: number; w: number; h: number }
  | { op: "SetLayerOrigin"; layer: number; x: number; y: number }
  | { op: "SetLayerRotation"; layer: number; rotation: number }
  | { op: "SetLayerScale"; layer: number; sx: number; sy: number }
  | { op: "SetLayerTranslation"; layer: number; tx: number; ty: number };

export interface FontEntry {
  id: number;
  name: string;
  size: number;
}

export interface ImageEntry {
  id: number;
  url: string;
  loaded: boolean;
  element: HTMLImageElement | null;
  width: number;
  height: number;
  placeholderText?: string;
}

export interface ScreenConfig {
  width: number;
  height: number;
  backgroundColor: RGBA;
  renderCostMax: number;
}

export const DEFAULT_SCREEN: ScreenConfig = {
  width: 1920,
  height: 1080,
  backgroundColor: [0, 0, 0, 1],
  renderCostMax: DU_RENDER_COST_MAX,
};
