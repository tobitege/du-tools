import { describe, expect, it, vi } from "vitest";
import { DrawBuffer } from "../src/emulator";

describe("drawBuffer style snapshotting", () => {
  it("locks next-fill color to the shape that consumed it", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();

    buffer.SetNextFillColor(layer, 0.12, 0.16, 0.24, 0.92);
    buffer.AddBoxRounded(layer, 10, 10, 100, 60, 12);

    buffer.SetNextFillColor(layer, 0.98, 0.84, 0.24, 1);
    buffer.AddCircle(layer, 80, 80, 12);

    const box = buffer.commands.find((command) => command.op === "AddBoxRounded");
    const circle = buffer.commands.find((command) => command.op === "AddCircle");

    expect(box?.style.fillColor).toEqual([0.12, 0.16, 0.24, 0.92]);
    expect(circle?.style.fillColor).toEqual([0.98, 0.84, 0.24, 1]);
  });

  it("consumes next overrides after a single draw command", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();

    buffer.SetNextFillColor(layer, 1, 0, 0, 1);
    buffer.AddBox(layer, 0, 0, 20, 20);
    buffer.AddBox(layer, 30, 0, 20, 20);

    const boxes = buffer.commands.filter((command) => command.op === "AddBox");

    expect(boxes[0]?.style.fillColor).toEqual([1, 0, 0, 1]);
    expect(boxes[1]?.style.fillColor).toEqual([1, 1, 1, 1]);
  });

  it("resets the background color to the default on runtime reset", () => {
    const buffer = new DrawBuffer();

    buffer.SetBackgroundColor(0.2, 0.4, 0.6);
    expect(buffer.screen.backgroundColor).toEqual([0.2, 0.4, 0.6, 1]);

    buffer.resetRuntimeState();

    expect(buffer.screen.backgroundColor).toEqual([0, 0, 0, 1]);
  });

  it("stores requestAnimationFrame counts as positive whole frames", () => {
    const buffer = new DrawBuffer();

    buffer.RequestAnimationFrame(5.9);
    expect(buffer.requestAnimFrames).toBe(5);

    buffer.RequestAnimationFrame(-1);
    expect(buffer.requestAnimFrames).toBe(0);
  });

  it("keeps explicit per-layer render buckets separate from style bookkeeping", () => {
    const buffer = new DrawBuffer();
    const baseLayer = buffer.CreateLayer();
    const emptyLayer = buffer.CreateLayer();

    buffer.SetDefaultFillColor(baseLayer, 1, 0.2, 0.3, 0.4, 1);
    buffer.AddBox(baseLayer, 0, 0, 20, 20);

    expect(buffer.GetLayerIds()).toEqual([baseLayer, emptyLayer]);
    expect(buffer.commands.some((command) => command.op === "SetDefaultFillColor")).toBe(true);
    expect(buffer.GetRenderableCommandsForLayer(baseLayer).map((command) => command.op)).toEqual(["AddBox"]);
    expect(buffer.GetRenderableCommandsForLayer(emptyLayer)).toEqual([]);
  });

  it("clears explicit layer buckets on frame reset", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();

    buffer.AddCircle(layer, 10, 10, 4);
    expect(buffer.GetLayerIds()).toEqual([layer]);
    expect(buffer.GetRenderableCommandsForLayer(layer)).toHaveLength(1);

    buffer.resetFrame();

    expect(buffer.GetLayerIds()).toEqual([]);
    expect(buffer.GetRenderableCommandsForLayer(layer)).toEqual([]);
  });

  it("restarts frame-local layer handles after a frame reset", () => {
    const buffer = new DrawBuffer();

    const firstLayer = buffer.CreateLayer();
    buffer.resetFrame();
    const secondLayer = buffer.CreateLayer();

    expect(firstLayer).toBe(1);
    expect(secondLayer).toBe(1);
  });

  it("keeps a completed render snapshot stable after the live buffer is reset", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();

    buffer.SetBackgroundColor(0.2, 0.4, 0.6);
    buffer.AddBox(layer, 5, 6, 70, 80);

    const snapshot = buffer.createRenderSnapshot();

    buffer.resetFrame();
    const nextLayer = buffer.CreateLayer();
    buffer.AddCircle(nextLayer, 40, 50, 12);

    expect(snapshot.screen.backgroundColor).toEqual([0.2, 0.4, 0.6, 1]);
    expect(snapshot.GetLayerIds()).toEqual([layer]);
    expect(snapshot.GetRenderableCommandsForLayer(layer).map((command) => command.op)).toEqual(["AddBox"]);
    expect(snapshot.commands.map((command) => command.op)).toContain("AddBox");
  });

  it("throws for invalid layer handles instead of silently creating hidden render state", () => {
    const buffer = new DrawBuffer();

    expect(() => buffer.AddBox(99, 0, 0, 10, 10)).toThrow("invalid layer handle");
    expect(() => buffer.SetNextFillColor(99, 1, 0, 0, 1)).toThrow("invalid layer handle");
    expect(() => buffer.SetLayerTranslation(99, 10, 20)).toThrow("invalid layer handle");
  });

  it("normalizes allowed Novaquark asset URLs and reuses their handles", () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });

    const firstId = buffer.LoadImage("assets.prod.novaquark.com/4745/example.jpg");
    const secondId = buffer.LoadImage("assets.prod.novaquark.com/4745/example.jpg");

    expect(firstId).toBe(1);
    expect(secondId).toBe(firstId);
    expect(buffer.images).toHaveLength(1);
    expect(buffer.images[0]?.url).toBe("https://assets.prod.novaquark.com/4745/example.jpg");
  });

  it("accepts data image URLs and reuses their handles", () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";

    const firstId = buffer.LoadImage(dataUrl);
    const secondId = buffer.LoadImage(dataUrl);

    expect(firstId).toBe(1);
    expect(secondId).toBe(firstId);
    expect(buffer.images).toHaveLength(1);
    expect(buffer.images[0]?.url).toBe(dataUrl);
  });

  it("does not create a second browser image load for the same URL after a frame reset", () => {
    const createdImages: Array<{ assignedSrc: string | null }> = [];

    class MockImage {
      naturalWidth = 0;
      naturalHeight = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = "";

      constructor() {
        createdImages.push({ assignedSrc: null });
      }

      set src(value: string) {
        this._src = value;
        createdImages[createdImages.length - 1]!.assignedSrc = value;
      }

      get src() {
        return this._src;
      }
    }

    const originalImage = globalThis.Image;
    vi.stubGlobal("Image", MockImage);

    try {
      const buffer = new DrawBuffer({ imageLoadingEnabled: true });
      const url = "assets.prod.novaquark.com/4745/example.jpg";

      const firstId = buffer.LoadImage(url);
      buffer.resetFrame();
      const secondId = buffer.LoadImage(url);

      expect(firstId).toBe(1);
      expect(secondId).toBe(firstId);
      expect(createdImages).toEqual([
        { assignedSrc: "https://assets.prod.novaquark.com/4745/example.jpg" },
      ]);
    } finally {
      vi.unstubAllGlobals();
      globalThis.Image = originalImage;
    }
  });

  it("reuses the same font handle for identical fonts across frame resets", () => {
    const buffer = new DrawBuffer();

    const firstId = buffer.LoadFont("Arial", 24);
    buffer.resetFrame();
    const secondId = buffer.LoadFont("Arial", 24);

    expect(firstId).toBe(1);
    expect(secondId).toBe(firstId);
    expect(buffer.fonts).toHaveLength(1);
  });

  it("rejects image URLs outside the allowed Novaquark asset host", () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });

    expect(buffer.LoadImage("https://assets.prod.novaquark.com/4745/example.jpg")).toBe(0);
    expect(buffer.LoadImage("cdn.example.com/example.jpg")).toBe(0);
    expect(buffer.LoadImage("assets.prod.novaquark.com.evil.com/example.jpg")).toBe(0);
    expect(buffer.LoadImage("data:text/plain;base64,SGVsbG8=")).toBe(0);
    expect(buffer.LoadImage("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")).toBe(0);
    expect(buffer.LoadImage("assets.prod.novaquark.com/4745/example.gif")).toBe(0);
    expect(buffer.LoadImage("assets.prod.novaquark.com/../secret.jpg")).toBe(0);
    expect(buffer.LoadImage("\\\\server\\share\\example.jpg")).toBe(0);
    expect(buffer.LoadImage("C:\\temp\\example.jpg")).toBe(0);
    expect(buffer.images).toHaveLength(0);
  });

  it("returns a shared disabled-image placeholder when image loading is off", () => {
    const buffer = new DrawBuffer();

    const firstId = buffer.LoadImage("assets.prod.novaquark.com/4745/example.jpg");
    const secondId = buffer.LoadImage("data:image/png;base64,iVBORw0KGgo=");

    expect(firstId).toBe(1);
    expect(secondId).toBe(firstId);
    expect(buffer.images).toHaveLength(1);
    expect(buffer.images[0]?.url).toBe("/images-disabled.svg");
    expect(buffer.images[0]?.placeholderText).toBe("Images disabled");
    expect(buffer.GetImageSize(firstId)).toEqual([256, 96]);
  });
});
