import type { DrawCommand, ScreenConfig } from "./types";
import { RSShape, buildDefaultLayerStyles, DEFAULT_SCREEN } from "./types";
import type { LayerStyle, FontEntry, ImageEntry } from "./types";
import { normalizeAnimationFrameCount } from "./frameTiming";
import { measureCompatFontMetrics, measureTextBounds } from "./textMetrics";
import { normalizeImageSource } from "../security/inputGuards";
import {
  DU_FONT_CATALOG,
  DU_MAX_LOADED_FONTS,
  isDUFontName,
} from "./renderScriptCompat";

const DEFAULT_DISABLED_IMAGE_URL = "/images-disabled.svg";
const DISABLED_IMAGE_TEXT = "Images disabled";
const DISABLED_IMAGE_WIDTH = 256;
const DISABLED_IMAGE_HEIGHT = 96;

export interface DrawBufferOptions {
  imageLoadingEnabled?: boolean;
  disabledImageUrl?: string;
}

type RenderableDrawCommand = Extract<DrawCommand, { style: LayerStyle }>;

export class DrawBuffer {
  commands: DrawCommand[] = [];
  screen: ScreenConfig = { ...DEFAULT_SCREEN };
  layerOrder: number[] = [];
  layerRenderCommands = new Map<number, RenderableDrawCommand[]>();
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
  readonly imageLoadingEnabled: boolean;
  readonly disabledImageUrl: string;

  constructor(options?: DrawBufferOptions) {
    this.imageLoadingEnabled = options?.imageLoadingEnabled ?? false;
    this.disabledImageUrl = options?.disabledImageUrl ?? DEFAULT_DISABLED_IMAGE_URL;
  }

  createRenderSnapshot(): DrawBuffer {
    const snapshot = new DrawBuffer({
      imageLoadingEnabled: this.imageLoadingEnabled,
      disabledImageUrl: this.disabledImageUrl,
    });

    snapshot.commands = [...this.commands];
    snapshot.screen = {
      ...this.screen,
      backgroundColor: [...this.screen.backgroundColor],
    };
    snapshot.layerOrder = [...this.layerOrder];
    snapshot.layerRenderCommands = new Map(
      [...this.layerRenderCommands.entries()].map(([layer, commands]) => [layer, [...commands]])
    );
    snapshot.layerTransforms = new Map(
      [...this.layerTransforms.entries()].map(([layer, transform]) => [
        layer,
        {
          origin: [...transform.origin] as [number, number],
          translation: [...transform.translation] as [number, number],
          scale: [...transform.scale] as [number, number],
          rotation: transform.rotation,
          clipRect: transform.clipRect ? { ...transform.clipRect } : null,
        },
      ])
    );
    snapshot.fonts = [...this.fonts];
    snapshot.images = [...this.images];
    snapshot.renderCost = this.renderCost;
    snapshot.time = this.time;
    snapshot.deltaTime = this.deltaTime;
    snapshot.output = this.output;
    snapshot.logs = [...this.logs];
    snapshot.requestAnimFrames = this.requestAnimFrames;

    return snapshot;
  }

  resetFrame() {
    this.commands = [];
    this.layerOrder = [];
    this.layerRenderCommands.clear();
    this.layerStyles.clear();
    this.nextOverrides.clear();
    this.layerTransforms.clear();
    this.nextLayerId = 1;
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
    this.screen.backgroundColor = [...DEFAULT_SCREEN.backgroundColor];
  }

  private isRenderableCommand(command: DrawCommand): command is RenderableDrawCommand {
    return command.op.startsWith("Add");
  }

  private assertLayerExists(layer: number): void {
    if (!this.layerRenderCommands.has(layer)) {
      throw new Error("invalid layer handle");
    }
  }

  private getLayerRenderCommands(layer: number): RenderableDrawCommand[] {
    this.assertLayerExists(layer);
    if (!this.layerRenderCommands.has(layer)) {
      this.layerRenderCommands.set(layer, []);
    }
    return this.layerRenderCommands.get(layer)!;
  }

  private push(cmd: DrawCommand) {
    this.commands.push(cmd);

    if (this.isRenderableCommand(cmd)) {
      this.getLayerRenderCommands(cmd.layer).push(cmd);
      this.renderCost += 1;
    }
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
    this.assertLayerExists(layer);
    if (!this.layerStyles.has(layer)) {
      this.layerStyles.set(layer, buildDefaultLayerStyles());
    }
    return this.layerStyles.get(layer)![shape];
  }

  private getFontEntry(fontId: number): FontEntry {
    const font = this.fonts.find((entry) => entry.id === fontId);
    if (!font) {
      throw new Error("invalid font handle");
    }
    return font;
  }

  private getLayerTransform(layer: number) {
    this.assertLayerExists(layer);
    if (!this.layerTransforms.has(layer)) {
      this.layerTransforms.set(layer, { origin: [0, 0], translation: [0, 0], scale: [1, 1], rotation: 0, clipRect: null });
    }
    return this.layerTransforms.get(layer)!;
  }

  // --- API functions matching RenderScript ---

  CreateLayer(): number {
    const id = this.nextLayerId++;
    this.layerOrder.push(id);
    this.layerRenderCommands.set(id, []);
    this.layerStyles.set(id, buildDefaultLayerStyles());
    return id;
  }

  GetLayerIds(): number[] {
    return [...this.layerOrder];
  }

  GetRenderableCommandsForLayer(layer: number): RenderableDrawCommand[] {
    return [...(this.layerRenderCommands.get(layer) ?? [])];
  }

  AddBezier(layer: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.push({ op: "AddBezier", layer, style: this.getResolvedStyle(layer, RSShape.Bezier), x1, y1, x2, y2, x3, y3 });
    this.consumeNextOverride(layer);
  }
  AddBox(layer: number, x: number, y: number, w: number, h: number) {
    const style = this.getResolvedStyle(layer, RSShape.Box);
    this.push({ op: "AddBox", layer, style, x, y, w, h });
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
    const style = this.getResolvedStyle(layer, RSShape.Text);
    this.getFontEntry(fontId);
    this.push({ op: "AddText", layer, style, fontId, text, x, y });
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
    this.assertLayerExists(layer);
    const o = this.nextOverrides.get(layer) ?? {};
    o.fillColor = [r, g, b, a];
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextFillColor", layer, color: [r, g, b, a] });
  }
  SetNextStrokeColor(layer: number, r: number, g: number, b: number, a: number) {
    this.assertLayerExists(layer);
    const o = this.nextOverrides.get(layer) ?? {};
    o.strokeColor = [r, g, b, a];
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextStrokeColor", layer, color: [r, g, b, a] });
  }
  SetNextStrokeWidth(layer: number, width: number) {
    this.assertLayerExists(layer);
    const o = this.nextOverrides.get(layer) ?? {};
    o.strokeWidth = width;
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextStrokeWidth", layer, width });
  }
  SetNextShadow(layer: number, radius: number, r: number, g: number, b: number, a: number) {
    this.assertLayerExists(layer);
    const o = this.nextOverrides.get(layer) ?? {};
    o.shadow = { radius, color: [r, g, b, a] };
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextShadow", layer, radius, color: [r, g, b, a] });
  }
  SetNextRotation(layer: number, rot: number) {
    this.assertLayerExists(layer);
    const o = this.nextOverrides.get(layer) ?? {};
    o.rotation = rot;
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextRotation", layer, rotation: rot });
  }
  SetNextRotationDegrees(layer: number, deg: number) {
    this.assertLayerExists(layer);
    const o = this.nextOverrides.get(layer) ?? {};
    o.rotation = (deg * Math.PI) / 180;
    this.nextOverrides.set(layer, o);
    this.push({ op: "SetNextRotationDegrees", layer, rotation: deg });
  }
  SetNextTextAlign(layer: number, hor: number, ver: number) {
    this.assertLayerExists(layer);
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
    if (!isDUFontName(name)) {
      throw new Error(`unknown font <${name}>`);
    }

    const existing = this.fonts.find((font) => font.name === name && font.size === size);
    if (existing) {
      return existing.id;
    }

    if (this.fonts.length >= DU_MAX_LOADED_FONTS) {
      throw new Error(`exceeded maximum number of loaded fonts (${DU_MAX_LOADED_FONTS})`);
    }

    const id = this.nextFontId++;
    this.fonts.push({ id, name, size });
    return id;
  }
  GetFontSize(fontId: number): number {
    return this.getFontEntry(fontId).size;
  }
  SetFontSize(fontId: number, size: number) {
    this.getFontEntry(fontId).size = size;
  }
  GetFontMetrics(fontId: number): [number, number] {
    const font = this.getFontEntry(fontId);
    const metrics = measureCompatFontMetrics(font.name, font.size);
    return [metrics.ascender, metrics.descender];
  }
  GetTextBounds(fontId: number, text: string): [number, number] {
    const font = this.getFontEntry(fontId);
    const metrics = measureTextBounds(font.name, font.size, text ?? "");
    return [metrics.width, metrics.height];
  }
  IsFontLoaded(fontId: number): boolean {
    this.getFontEntry(fontId);
    return true;
  }
  GetAvailableFontCount(): number {
    return DU_FONT_CATALOG.length;
  }
  GetAvailableFontName(index: number): string {
    const name = DU_FONT_CATALOG[index - 1];
    if (!name) {
      throw new Error("out-of-bounds font index");
    }
    return name;
  }

  private createDisabledImagePlaceholder(): number {
    const existing = this.images.find((image) => image.placeholderText === DISABLED_IMAGE_TEXT);
    if (existing) {
      return existing.id;
    }

    const id = this.nextImageId++;
    const entry: ImageEntry = {
      id,
      url: this.disabledImageUrl,
      loaded: false,
      element: null,
      width: DISABLED_IMAGE_WIDTH,
      height: DISABLED_IMAGE_HEIGHT,
      placeholderText: DISABLED_IMAGE_TEXT,
    };
    this.images.push(entry);

    const img = new Image();
    img.onload = () => {
      entry.loaded = true;
      entry.element = img;
      entry.width = img.naturalWidth || DISABLED_IMAGE_WIDTH;
      entry.height = img.naturalHeight || DISABLED_IMAGE_HEIGHT;
      this.onAssetsChanged?.();
    };
    img.onerror = () => {
      this.onAssetsChanged?.();
    };
    img.src = this.disabledImageUrl;

    return id;
  }

  LoadImage(url: string): number {
    if (!this.imageLoadingEnabled) {
      return this.createDisabledImagePlaceholder();
    }

    const normalizedUrl = normalizeImageSource(url);
    if (!normalizedUrl) {
      return 0;
    }

    const existing = this.images.find(i => i.url === normalizedUrl);
    if (existing) return existing.id;
    const id = this.nextImageId++;
    const entry: ImageEntry = { id, url: normalizedUrl, loaded: false, element: null, width: 0, height: 0 };
    this.images.push(entry);

    const img = new Image();
    img.onload = () => {
      entry.loaded = true;
      entry.element = img;
      entry.width = img.naturalWidth;
      entry.height = img.naturalHeight;
      this.onAssetsChanged?.();
    };
    img.onerror = () => {
      this.onAssetsChanged?.();
    };
    img.src = normalizedUrl;
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
  RequestAnimationFrame(frames: number) { this.requestAnimFrames = normalizeAnimationFrameCount(frames); }
}
