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

    const firstId = buffer.LoadFont("RobotoMono", 24);
    buffer.resetFrame();
    const secondId = buffer.LoadFont("RobotoMono", 24);

    expect(firstId).toBe(1);
    expect(secondId).toBe(firstId);
    expect(buffer.fonts).toHaveLength(1);
  });

  it("exposes the DU font catalog in the documented order", () => {
    const buffer = new DrawBuffer();

    expect(buffer.GetAvailableFontCount()).toBe(12);
    expect(buffer.GetAvailableFontName(1)).toBe("FiraMono");
    expect(buffer.GetAvailableFontName(12)).toBe("RobotoMono-Bold");
    expect(() => buffer.GetAvailableFontName(0)).toThrow("out-of-bounds font index");
    expect(() => buffer.GetAvailableFontName(13)).toThrow("out-of-bounds font index");
  });

  it("limits loaded fonts to eight unique handles", () => {
    const buffer = new DrawBuffer();
    const names = [
      "FiraMono",
      "FiraMono-Bold",
      "Montserrat",
      "Montserrat-Bold",
      "Montserrat-Light",
      "Play",
      "Play-Bold",
      "RefrigeratorDeluxe",
      "RobotoMono",
    ] as const;

    for (const name of names.slice(0, 8)) {
      buffer.LoadFont(name, 20);
    }

    expect(() => buffer.LoadFont(names[8], 20)).toThrow("exceeded maximum number of loaded fonts (8)");
  });

  it("uses DU default stroke widths for lines and beziers", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();

    buffer.AddLine(layer, 0, 0, 10, 10);
    buffer.AddBezier(layer, 0, 10, 5, 0, 10, 10);

    const line = buffer.commands.find((command) => command.op === "AddLine");
    const bezier = buffer.commands.find((command) => command.op === "AddBezier");

    expect(line?.style.strokeWidth).toBe(1);
    expect(bezier?.style.strokeWidth).toBe(1);
    expect(line?.style.strokeColor).toEqual([1, 1, 1, 1]);
    expect(bezier?.style.strokeColor).toEqual([1, 1, 1, 1]);
  });

  it("returns negative descenders from font metrics", () => {
    const buffer = new DrawBuffer();
    const font = buffer.LoadFont("RobotoMono", 20);
    const [ascender, descender] = buffer.GetFontMetrics(font);

    expect(ascender).toBeGreaterThan(0);
    expect(descender).toBeLessThan(0);
  });

  it("uses DU render cost max and createLayer cost", () => {
    const buffer = new DrawBuffer();

    expect(buffer.GetRenderCostMax()).toBe(4_000_000);
    expect(buffer.GetRenderCost()).toBe(0);

    buffer.CreateLayer();

    expect(buffer.GetRenderCost()).toBe(75_000);
  });

  it("uses DU addBox render cost formulas", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();

    let before = buffer.GetRenderCost();
    buffer.AddBox(layer, 0, 0, 10, 10);
    expect(buffer.GetRenderCost() - before).toBe(100);

    buffer.SetNextStrokeWidth(layer, 1);
    before = buffer.GetRenderCost();
    buffer.AddBox(layer, 0, 0, 10, 10);
    expect(buffer.GetRenderCost() - before).toBe(144);

    buffer.SetNextStrokeWidth(layer, 5);
    buffer.SetNextShadow(layer, 5, 1, 1, 1, 1);
    before = buffer.GetRenderCost();
    buffer.AddBox(layer, 0, 0, 10, 10);
    expect(buffer.GetRenderCost() - before).toBe(900);
  });

  it("uses deterministic DU addText render cost formulas", () => {
    const buffer = new DrawBuffer();
    const layer = buffer.CreateLayer();
    const font = buffer.LoadFont("RobotoMono", 30);

    let before = buffer.GetRenderCost();
    buffer.AddText(layer, font, ".", 0, 0);
    expect(buffer.GetRenderCost() - before).toBe(111);

    before = buffer.GetRenderCost();
    buffer.AddText(layer, font, "%", 0, 0);
    expect(buffer.GetRenderCost() - before).toBe(815);

    before = buffer.GetRenderCost();
    buffer.AddText(layer, font, "%%%", 0, 0);
    expect(buffer.GetRenderCost() - before).toBe(2211);

    buffer.SetFontSize(font, 20);
    before = buffer.GetRenderCost();
    buffer.AddText(layer, font, "%", 0, 0);
    expect(buffer.GetRenderCost() - before).toBe(362);

    buffer.SetNextStrokeWidth(layer, 1);
    before = buffer.GetRenderCost();
    buffer.AddText(layer, font, "%", 0, 0);
    expect(buffer.GetRenderCost() - before).toBe(442);

    buffer.SetNextStrokeWidth(layer, 5);
    buffer.SetNextShadow(layer, 5, 1, 1, 1, 1);
    before = buffer.GetRenderCost();
    buffer.AddText(layer, font, "%", 0, 0);
    expect(buffer.GetRenderCost() - before).toBe(1525);
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
