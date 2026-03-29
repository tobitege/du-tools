import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DrawBuffer, createLuaEnvironment } from "../src/emulator";

describe("form_editor_v2 screen startup input", () => {
  it("hydrates the initial document from chunked getInput() payload", async () => {
    const sourcePath = path.join(
      "D:",
      "github",
      "du-tobi",
      "live_lua_coding",
      "examples",
      "form_editor_v2",
      "ScreenLayoutEditor.lua",
    );
    const source = await fs.readFile(sourcePath, "utf8");

    const setupBuffer = new DrawBuffer();
    const setupEnv = createLuaEnvironment(setupBuffer);
    const setupResult = await setupEnv.execute(`
${source}
local doc = SCREEN_LAYOUT_EDITOR_MODULE.createDefaultDocument(1920, 1080)
local canvas = SCREEN_LAYOUT_EDITOR_MODULE.findElement(doc, "main_canvas")
canvas.x = 279
canvas.y = 139
canvas.w = 583
canvas.h = 332
local badge = SCREEN_LAYOUT_EDITOR_MODULE.findElement(doc, "status_badge")
badge.type = "box"
doc.revision = 9
doc.selectedId = "main_canvas"
setOutput(SCREEN_LAYOUT_EDITOR_MODULE.serializeDocument(doc))
    `, { chunkLabel: "tests/form-editor-v2-setup.lua" });

    expect(setupResult.success, setupResult.error ?? "expected setup Lua execution to succeed").toBe(true);

    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);
    const documentText = String(setupResult.output ?? "");
    const chunkSize = 64;
    const chunks = Array.from(
      { length: Math.ceil(documentText.length / chunkSize) },
      (_, index) => documentText.slice(index * chunkSize, (index + 1) * chunkSize),
    );
    const token = `${(9).toString(36)}.${(documentText.length).toString(36)}.t`;
    const packetLengths: number[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const packet = [
        "c",
        token,
        (index + 1).toString(36),
        chunks.length.toString(36),
        (9).toString(36),
        (1920).toString(36),
        (1080).toString(36),
        "main_canvas",
        chunks[index],
      ].join("|");
      packetLengths.push(Buffer.byteLength(packet, "utf8"));
      buffer.input = packet;

      const chunkResult = await env.execute(source, {
        chunkLabel: `tests/form-editor-v2-screen-chunk-${index + 1}.lua`,
      });

      expect(chunkResult.success, chunkResult.error ?? "expected Lua chunk execution to succeed").toBe(true);
    }

    const result = await env.execute(`
local doc = SCREEN_LAYOUT_EDITOR_STATE and SCREEN_LAYOUT_EDITOR_STATE.document or {}
local canvas = SCREEN_LAYOUT_EDITOR_MODULE.findElement(doc, "main_canvas")
local badge = SCREEN_LAYOUT_EDITOR_MODULE.findElement(doc, "status_badge")
setOutput(table.concat({
  tostring(doc.selectedId or ""),
  tostring(doc.revision or -1),
  tostring(math.floor((canvas and canvas.x or -1) + 0.5)),
  tostring(math.floor((canvas and canvas.y or -1) + 0.5)),
  tostring(math.floor((canvas and canvas.w or -1) + 0.5)),
  tostring(math.floor((canvas and canvas.h or -1) + 0.5)),
  tostring(badge and badge.type or "")
}, "|"))
    `, { chunkLabel: "tests/form-editor-v2-screen-inspect.lua" });

    expect(result.success, result.error ?? "expected Lua inspection to succeed").toBe(true);
    expect(Math.max(...packetLengths)).toBeLessThanOrEqual(1024);
    expect(result.output).toBe("main_canvas|9|279|139|583|332|box");
  });
});
