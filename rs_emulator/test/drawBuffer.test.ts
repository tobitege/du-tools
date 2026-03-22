import { describe, expect, it } from "vitest";
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

  it("normalizes allowed Novaquark asset URLs and reuses their handles", () => {
    const buffer = new DrawBuffer();

    const firstId = buffer.LoadImage("assets.prod.novaquark.com/4745/example.jpg");
    const secondId = buffer.LoadImage("assets.prod.novaquark.com/4745/example.jpg");

    expect(firstId).toBe(1);
    expect(secondId).toBe(firstId);
    expect(buffer.images).toHaveLength(1);
    expect(buffer.images[0]?.url).toBe("https://assets.prod.novaquark.com/4745/example.jpg");
  });

  it("accepts data image URLs and reuses their handles", () => {
    const buffer = new DrawBuffer();
    const dataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    const firstId = buffer.LoadImage(dataUrl);
    const secondId = buffer.LoadImage(dataUrl);

    expect(firstId).toBe(1);
    expect(secondId).toBe(firstId);
    expect(buffer.images).toHaveLength(1);
    expect(buffer.images[0]?.url).toBe(dataUrl);
  });

  it("rejects image URLs outside the allowed Novaquark asset host", () => {
    const buffer = new DrawBuffer();

    expect(buffer.LoadImage("https://assets.prod.novaquark.com/4745/example.jpg")).toBe(0);
    expect(buffer.LoadImage("cdn.example.com/example.jpg")).toBe(0);
    expect(buffer.LoadImage("assets.prod.novaquark.com.evil.com/example.jpg")).toBe(0);
    expect(buffer.LoadImage("data:text/plain;base64,SGVsbG8=")).toBe(0);
    expect(buffer.images).toHaveLength(0);
  });
});
