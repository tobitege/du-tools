import { describe, expect, it, vi } from "vitest";
import { DrawBuffer, renderBuffer } from "../src/emulator";
import { DEFAULT_SCREEN } from "../src/emulator/types";

function createMockContext() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowBlur: 0,
    shadowColor: "",
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    drawImage: vi.fn(),
    strokeText: vi.fn(),
    fillText: vi.fn(),
  };
}

describe("canvasRenderer text rendering", () => {
  it("renders AddText commands onto the canvas context", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();
    const fontId = buffer.LoadFont("Arial", 24);

    buffer.SetNextFillColor(layer, 1, 1, 1, 1);
    buffer.AddText(layer, fontId, "Hello RenderScript", 180, 560);

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    renderBuffer(canvas, buffer);

    expect(context.fillText).toHaveBeenCalledWith("Hello RenderScript", 180, 560);
    expect(context.font).toContain("24px");
  });

  it("uses Shape_Text fill and stroke defaults for text rendering", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();
    const fontId = buffer.LoadFont("Arial", 24);

    buffer.SetDefaultFillColor(layer, 7, 0.1, 0.2, 0.3, 0.4);
    buffer.SetDefaultStrokeColor(layer, 7, 0.7, 0.8, 0.9, 1);
    buffer.SetDefaultStrokeWidth(layer, 7, 2);
    buffer.AddText(layer, fontId, "Styled", 100, 120);

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    renderBuffer(canvas, buffer);

    expect(context.fillStyle).toBe("rgba(26,51,77,0.4)");
    expect(context.strokeStyle).toBe("rgba(179,204,230,1)");
    expect(context.lineWidth).toBe(2);
    expect(context.strokeText).toHaveBeenCalledWith("Styled", 100, 120);
    expect(context.fillText).toHaveBeenCalledWith("Styled", 100, 120);
  });

  it("moves descender-aligned text upward to avoid bottom clipping", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();
    const fontId = buffer.LoadFont("Arial", 20);

    buffer.SetNextTextAlign(layer, 0, 4);
    buffer.AddText(layer, fontId, "Bottom HUD", 16, 100);

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    renderBuffer(canvas, buffer);

    expect(context.fillText).toHaveBeenCalledWith("Bottom HUD", 16, 96);
  });

  it("renders lower layers before higher layers even when commands were added later", () => {
    const buffer = new DrawBuffer();
    const background = buffer.CreateLayer();
    const foreground = buffer.CreateLayer();
    const backgroundImage = { tag: "background" } as unknown as HTMLImageElement;
    const foregroundImage = { tag: "foreground" } as unknown as HTMLImageElement;

    buffer.images.push(
      { id: 1, url: "https://assets.prod.novaquark.com/1/background.jpg", loaded: true, element: backgroundImage, width: 10, height: 10 },
      { id: 2, url: "https://assets.prod.novaquark.com/1/foreground.jpg", loaded: true, element: foregroundImage, width: 10, height: 10 }
    );

    buffer.AddImage(foreground, 2, 0, 0, 10, 10);
    buffer.AddImage(background, 1, 0, 0, 10, 10);

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    renderBuffer(canvas, buffer);

    expect(context.drawImage).toHaveBeenNthCalledWith(1, backgroundImage, 0, 0, 10, 10);
    expect(context.drawImage).toHaveBeenNthCalledWith(2, foregroundImage, 0, 0, 10, 10);
  });

  it("uses documented same-layer shape buckets instead of raw insertion order", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();
    const fontId = buffer.LoadFont("Arial", 16);
    const image = { tag: "layer-image" } as unknown as HTMLImageElement;

    buffer.images.push({
      id: 1,
      url: "https://assets.prod.novaquark.com/1/layer-image.jpg",
      loaded: true,
      element: image,
      width: 10,
      height: 10,
    });

    buffer.AddText(layer, fontId, "Top text", 12, 24);
    buffer.AddImage(layer, 1, 0, 0, 10, 10);

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    renderBuffer(canvas, buffer);

    expect(context.drawImage.mock.invocationCallOrder[0]).toBeLessThan(context.fillText.mock.invocationCallOrder[0]);
  });

  it("still prioritizes layer order when interleaved commands use different shape buckets", () => {
    const buffer = new DrawBuffer();
    const background = buffer.CreateLayer();
    const foreground = buffer.CreateLayer();
    const fontId = buffer.LoadFont("Arial", 16);
    const image = { tag: "foreground-layer-image" } as unknown as HTMLImageElement;

    buffer.images.push({
      id: 1,
      url: "https://assets.prod.novaquark.com/1/foreground-layer-image.jpg",
      loaded: true,
      element: image,
      width: 10,
      height: 10,
    });

    buffer.AddImage(foreground, 1, 0, 0, 10, 10);
    buffer.AddText(background, fontId, "Background text", 20, 20);

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    renderBuffer(canvas, buffer);

    expect(context.fillText.mock.invocationCallOrder[0]).toBeLessThan(context.drawImage.mock.invocationCallOrder[0]);
  });

  it("renders a placeholder panel for disabled images before the asset has loaded", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();
    const imageId = buffer.LoadImage("assets.prod.novaquark.com/4745/example.jpg");

    buffer.AddImage(layer, imageId, 10, 20, 160, 60);

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    renderBuffer(canvas, buffer);

    expect(context.fillRect).toHaveBeenCalledWith(10, 20, 160, 60);
    expect(context.fillText).toHaveBeenCalledWith("Images disabled", 90, 50);
  });

  it("draws through a back buffer before presenting a completed frame on the visible canvas", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();
    const { width, height } = DEFAULT_SCREEN;

    buffer.SetBackgroundColor(0.31, 0, 0.03);
    buffer.AddBox(layer, 0, 0, 20, 20);

    const screenContext = createMockContext();
    const backBufferContext = createMockContext();
    const backBufferCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => backBufferContext),
    } as unknown as HTMLCanvasElement;
    const canvas = {
      width: 0,
      height: 0,
      ownerDocument: {
        createElement: vi.fn(() => backBufferCanvas),
      },
      getContext: vi.fn(() => screenContext),
    } as unknown as HTMLCanvasElement;

    renderBuffer(canvas, buffer);

    expect(backBufferContext.fillRect).toHaveBeenCalledWith(0, 0, width, height);
    expect(screenContext.fillRect).not.toHaveBeenCalled();
    expect(screenContext.drawImage).toHaveBeenCalledWith(backBufferCanvas, 0, 0, width, height);
  });
});
