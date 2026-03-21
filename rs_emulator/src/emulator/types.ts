export const RSShape = {
  Bezier: 0,
  Box: 1,
  BoxRounded: 2,
  Circle: 3,
  Image: 4,
  Line: 5,
  Polygon: 6,
  Text: 7,
} as const;
export type RSShape = (typeof RSShape)[keyof typeof RSShape];

export const RSAlignHor = {
  Left: 0,
  Center: 1,
  Right: 2,
} as const;
export type RSAlignHor = (typeof RSAlignHor)[keyof typeof RSAlignHor];

export const RSAlignVer = {
  Top: 0,
  Middle: 1,
  Bottom: 2,
  Baseline: 3,
  Descender: 4,
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

export function defaultLayerStyle(): LayerStyle {
  return {
    fillColor: [1, 1, 1, 1],
    strokeColor: [0, 0, 0, 1],
    strokeWidth: 0,
    shadow: { radius: 0, color: [0, 0, 0, 0.5] },
    rotation: 0,
    textAlign: { hor: RSAlignHor.Left, ver: RSAlignVer.Baseline },
  };
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
}

export interface ScreenConfig {
  width: number;
  height: number;
  backgroundColor: RGBA;
  renderCostMax: number;
}

export const DEFAULT_SCREEN: ScreenConfig = {
  width: 1024,
  height: 1024,
  backgroundColor: [0, 0, 0, 1],
  renderCostMax: 10000,
};
