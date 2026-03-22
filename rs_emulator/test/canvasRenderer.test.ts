import { describe, expect, it, vi } from "vitest";
import { DrawBuffer, renderBuffer } from "../src/emulator";

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

    expect(context.strokeText).toHaveBeenCalledWith("Hello RenderScript", 180, 560);
    expect(context.fillText).toHaveBeenCalledWith("Hello RenderScript", 180, 560);
    expect(context.font).toContain("24px");
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
});
