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
});
