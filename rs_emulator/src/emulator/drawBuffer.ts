import type { DrawCommand, ScreenConfig } from "./types";
import { RSShape, defaultLayerStyle, DEFAULT_SCREEN } from "./types";
import type { LayerStyle, FontEntry, ImageEntry } from "./types";
import { measureFontMetrics, measureTextBounds } from "./textMetrics";

export class DrawBuffer {
  commands: DrawCommand[] = [];
  screen: ScreenConfig = { ...DEFAULT_SCREEN };
  layerStyles = new Map<number, Record<number, LayerStyle>>();
  nextOverrides = new Map<number, Partial<LayerStyle>>();
  layerTransforms = new Map<number, { origin: [number, number]; translation: [number, number]; scale: [number, number]; rotation: number; clipRect: { x: number; y: number; w: number; h: number } | null }>();
  fonts: FontEntry[] = [];
  images: ImageEntry[] = [];
  private nextFontId = 1;
  private nextImageId = 1;
  private nextLayerId = 1;
  renderCost = 0;
  time = 0;
  deltaTime = 0;
  cursorX = -1;
  cursorY = -1;
  cursorDown = false;
  cursorPressed = false;
  cursorReleased = false;
  input = "";
  locale = "en-US";
  output = "";
  logs: string[] = [];
  requestAnimFrames = 0;
  onAssetsChanged: (() => void) | null = null;

  resetFrame() {
    this.commands = [];
    this.layerStyles.clear();
    this.nextOverrides.clear();
    this.layerTransforms.clear();
    this.renderCost = 0;
    this.output = "";
    this.logs = [];
    this.requestAnimFrames = 0;
  }

  resetRuntimeState() {
    this.resetFrame();
    this.fonts = [];
    this.images = [];
    this.nextFontId = 1;
    this.nextImageId = 1;
    this.nextLayerId = 1;
    this.time = 0;
    this.deltaTime = 0;
  }

  private push(cmd: DrawCommand) {
    this.commands.push(cmd);
    // cost each draw call as 1 unit (simplified)
    const shapeOps = ["AddBezier","AddBox","AddBoxRounded","AddCircle","AddLine","AddQuad","AddTriangle","AddText","AddImage","AddImageSub"];
    if (shapeOps.includes(cmd.op)) this.renderCost += 1;
  }

  private cloneStyle(style: LayerStyle): LayerStyle {
    return {
      fillColor: [...style.fillColor] as LayerStyle["fillColor"],
      strokeColor: [...style.strokeColor] as LayerStyle["strokeColor"],
      strokeWidth: style.strokeWidth,
      shadow: {
        radius: style.shadow.radius,
        color: [...style.shadow.color] as LayerStyle["shadow"]["color"],
      },
      rotation: style.rotation,
      textAlign: { ...style.textAlign },
    };
  }

  private getResolvedStyle(layer: number, shape: number): LayerStyle {
    const base = this.getLayerShapeStyle(layer, shape);
    const next = this.nextOverrides.get(layer);

    if (!next) {
      return this.cloneStyle(base);
    }

    return this.cloneStyle({
      fillColor: next.fillColor ?? base.fillColor,
      strokeColor: next.strokeColor ?? base.strokeColor,
      strokeWidth: next.strokeWidth ?? base.strokeWidth,
      shadow: next.shadow ?? base.shadow,
      rotation: next.rotation ?? base.rotation,
      textAlign: next.textAlign ?? base.textAlign,
    });
  }

  private consumeNextOverride(layer: number): void {
    this.nextOverrides.delete(layer);
  }

  // --- layer style helpers ---
  private getLayerShapeStyle(layer: number, shape: number): LayerStyle {
    if (!this.layerStyles.has(layer)) {
      const shapes = {} as Record<number, LayerStyle>;
      for (let s = 0; s <= 7; s++) shapes[s] = defaultLayerStyle();
      this.layerStyles.set(layer, shapes);
    }
    return this.layerStyles.get(layer)![shape];
  }

  private getLayerTransform(layer: number) {
    if (!this.layerTransforms.has(layer)) {
      this.layerTransforms.set(layer, { origin: [0, 0], translation: [0, 0], scale: [1, 1], rotation: 0, clipRect: null });
    }
    return this.layerTransforms.get(layer)!;
  }

  // --- API functions matching RenderScript ---

  CreateLayer(): number {
    const id = this.nextLayerId++;
    // initialize default styles for this layer
    this.getLayerShapeStyle(id, RSShape.Box);
    return id;
  }

  AddBezier(layer: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.push({ op: "AddBezier", layer, style: this.getResolvedStyle(layer, RSShape.Bezier), x1, y1, x2, y2, x3, y3 });
    this.consumeNextOverride(layer);
  }
  AddBox(layer: number, x: number, y: number, w: number, h: number) {
    this.push({ op: "AddBox", layer, style: this.getResolvedStyle(layer, RSShape.Box), x, y, w, h });
    this.consumeNextOverride(layer);
  }
  AddBoxRounded(layer: number, x: number, y: number, w: number, h: number, radius: number) {
    this.push({ op: "AddBoxRounded", layer, style: this.getResolvedStyle(layer, RSShape.BoxRounded), x, y, w, h, radius });
    this.consumeNextOverride(layer);
  }
  AddCircle(layer: number, x: number, y: number, radius: number) {
    this.push({ op: "AddCircle", layer, style: this.getResolvedStyle(layer, RSShape.Circle), x, y, radius });
    this.consumeNextOverride(layer);
  }
  AddLine(layer: number, x1: number, y1: number, x2: number, y2: number) {
    this.push({ op: "AddLine", layer, style: this.getResolvedStyle(layer, RSShape.Line), x1, y1, x2, y2 });
    this.consumeNextOverride(layer);
  }
  AddQuad(layer: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
    this.push({ op: "AddQuad", layer, style: this.getResolvedStyle(layer, RSShape.Polygon), x1, y1, x2, y2, x3, y3, x4, y4 });
    this.consumeNextOverride(layer);
  }
  AddTriangle(layer: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.push({ op: "AddTriangle", layer, style: this.getResolvedStyle(layer, RSShape.Polygon), x1, y1, x2, y2, x3, y3 });
    this.consumeNextOverride(layer);
  }
  AddText(layer: number, fontId: number, text: string, x: number, y: number) {
    this.push({ op: "AddText", layer, style: this.getResolvedStyle(layer, RSShape.Text), fontId, text, x, y });
    this.consumeNextOverride(layer);
  }
  AddImage(layer: number, imageId: number, x: number, y: number, w: number, h: number) {
    this.push({ op: "AddImage", layer, style: this.getResolvedStyle(layer, RSShape.Image), imageId, x, y, w, h });
    this.consumeNextOverride(layer);
  }
  AddImageSub(layer: number, imageId: number, x: number, y: number, w: number, h: number, subX: number, subY: number, subW: number, subH: number) {
    this.push({ op: "AddImageSub", layer, style: this.getResolvedStyle(layer, RSShape.Image), imageId, x, y, w, h, subX, subY, subW, subH });
    this.consumeNextOverride(layer);
  }

  // --- style setters ---
  SetDefaultFillColor(layer: number, shape: number, r: number, g: number, b: number, a: number) {
    const s = this.getLayerShapeStyle(layer, shape);
    s.fillColor = [r, g, b, a];
    this.push({ op: "SetDefaultFillColor", layer, shape, color: [r, g, b, a] });
  }
  SetDefaultStrokeColor(layer: number, shape: number, r: number, g: number, b: number, a: number) {
    const s = this.getLayerShapeStyle(layer, shape);
    s.strokeColor = [r, g, b, a];
    this.push({ op: "SetDefaultStrokeColor", layer, shape, color: [r, g, b, a] });
  }
  SetDefaultStrokeWidth(layer: number, shape: number, width: number) {
    const s = this.getLayerShapeStyle(layer, shape);
    s.strokeWidth = width;
    this.push({ op: "SetDefaultStrokeWidth", layer, shape, width });
  }
  SetDefaultShadow(layer: number, shape: number, radius: number, r: number, g: number, b: number, a: number) {
    const s = this.getLayerShapeStyle(layer, shape);
    s.shadow = { radius, color: [r, g, b, a] };
    this.push({ op: "SetDefaultShadow", layer, shape, radius, color: [r, g, b, a] });
  }
  SetDefaultRotation(layer: number, shape: number, rot: number) {
    const s = this.getLayerShapeStyle(layer, shape);
    s.rotation = rot;
    this.push({ op: "SetDefaultRotation", layer, shape, rotation: rot });
  }
  SetDefaultTextAlign(layer: number, hor: number, ver: number) {
    const s = this.getLayerShapeStyle(layer, RSShape.Text);
    s.textAlign = { hor, ver };
    this.push({ op: "SetDefaultTextAlign", layer, hor, ver });
  }

  SetNextFillColor(layer: number, r: number, g: number, b: number, a: number) {
    const o = this.nextOverrides.get(layer) ?? {};
    o.fillColor = [r, g, b, a];
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextFillColor", layer, color: [r, g, b, a] });
  }
  SetNextStrokeColor(layer: number, r: number, g: number, b: number, a: number) {
    const o = this.nextOverrides.get(layer) ?? {};
    o.strokeColor = [r, g, b, a];
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextStrokeColor", layer, color: [r, g, b, a] });
  }
  SetNextStrokeWidth(layer: number, width: number) {
    const o = this.nextOverrides.get(layer) ?? {};
    o.strokeWidth = width;
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextStrokeWidth", layer, width });
  }
  SetNextShadow(layer: number, radius: number, r: number, g: number, b: number, a: number) {
    const o = this.nextOverrides.get(layer) ?? {};
    o.shadow = { radius, color: [r, g, b, a] };
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextShadow", layer, radius, color: [r, g, b, a] });
  }
  SetNextRotation(layer: number, rot: number) {
    const o = this.nextOverrides.get(layer) ?? {};
    o.rotation = rot;
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextRotation", layer, rotation: rot });
  }
  SetNextRotationDegrees(layer: number, deg: number) {
    const o = this.nextOverrides.get(layer) ?? {};
    o.rotation = (deg * Math.PI) / 180;
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextRotationDegrees", layer, rotation: deg });
  }
  SetNextTextAlign(layer: number, hor: number, ver: number) {
    const o = this.nextOverrides.get(layer) ?? {};
    o.textAlign = { hor, ver };
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextTextAlign", layer, hor, ver });
  }

  // --- layer transforms ---
  SetLayerClipRect(layer: number, x: number, y: number, w: number, h: number) {
    this.getLayerTransform(layer).clipRect = { x, y, w, h };
    this.push({ op: "SetLayerClipRect", layer, x, y, w, h });
  }
  SetLayerOrigin(layer: number, x: number, y: number) {
    this.getLayerTransform(layer).origin = [x, y];
    this.push({ op: "SetLayerOrigin", layer, x, y });
  }
  SetLayerRotation(layer: number, rot: number) {
    this.getLayerTransform(layer).rotation = rot;
    this.push({ op: "SetLayerRotation", layer, rotation: rot });
  }
  SetLayerScale(layer: number, sx: number, sy: number) {
    this.getLayerTransform(layer).scale = [sx, sy];
    this.push({ op: "SetLayerScale", layer, sx, sy });
  }
  SetLayerTranslation(layer: number, tx: number, ty: number) {
    this.getLayerTransform(layer).translation = [tx, ty];
    this.push({ op: "SetLayerTranslation", layer, tx, ty });
  }

  // --- fonts & images ---
  LoadFont(name: string, size: number): number {
    const id = this.nextFontId++;
    this.fonts.push({ id, name, size });
    return id;
  }
  GetFontSize(fontId: number): number {
    return this.fonts.find(f => f.id === fontId)?.size ?? 0;
  }
  SetFontSize(fontId: number, size: number) {
    const f = this.fonts.find(f => f.id === fontId);
    if (f) f.size = size;
  }
  GetFontMetrics(fontId: number): [number, number] {
    const f = this.fonts.find(f => f.id === fontId);
    if (!f) return [0, 0];
    const metrics = measureFontMetrics(f.name, f.size);
    return [metrics.ascent, metrics.descent];
  }
  GetTextBounds(fontId: number, text: string): [number, number] {
    const f = this.fonts.find(font => font.id === fontId);
    if (!f) return [0, 0];
    const metrics = measureTextBounds(f.name, f.size, text ?? "");
    return [metrics.width, metrics.height];
  }
  GetAvailableFontCount(): number {
    return 5; // pretend we have some system fonts
  }
  GetAvailableFontName(index: number): string {
    const names = ["Arial", "Courier New", "Georgia", "Times New Roman", "Verdana"];
    return names[index] ?? "";
  }

  LoadImage(url: string): number {
    const existing = this.images.find(i => i.url === url);
    if (existing) return existing.id;
    const id = this.nextImageId++;
    const entry: ImageEntry = { id, url, loaded: false, element: null, width: 0, height: 0 };
    this.images.push(entry);
    // start async load
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      entry.loaded = true;
      entry.element = img;
      entry.width = img.naturalWidth;
      entry.height = img.naturalHeight;
      this.onAssetsChanged?.();
    };
    img.src = url;
    return id;
  }
  IsImageLoaded(imageId: number): boolean {
    return this.images.find(i => i.id === imageId)?.loaded ?? false;
  }
  GetImageSize(imageId: number): [number, number] {
    const img = this.images.find(i => i.id === imageId);
    return img ? [img.width, img.height] : [0, 0];
  }

  // --- query helpers ---
  GetCursor(): [number, number] { return [this.cursorX, this.cursorY]; }
  GetCursorDown(): boolean { return this.cursorDown; }
  GetCursorPressed(): boolean { return this.cursorPressed; }
  GetCursorReleased(): boolean { return this.cursorReleased; }
  GetDeltaTime(): number { return this.deltaTime; }
  GetTime(): number { return this.time; }
  GetInput(): string { return this.input; }
  GetLocale(): string { return this.locale; }
  GetRenderCost(): number { return this.renderCost; }
  GetRenderCostMax(): number { return this.screen.renderCostMax; }
  GetResolution(): [number, number] { return [this.screen.width, this.screen.height]; }
  SetBackgroundColor(r: number, g: number, b: number) {
    this.screen.backgroundColor = [r, g, b, 1];
  }
  SetOutput(output: string) { this.output = output; }
  Log(message: string) { this.logs.push(message); }
  RequestAnimationFrame(frames: number) { this.requestAnimFrames = frames; }
}
