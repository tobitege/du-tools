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
});
