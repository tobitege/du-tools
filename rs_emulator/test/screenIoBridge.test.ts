import { describe, expect, it } from "vitest";
import { DrawBuffer, createLuaEnvironment, type LuaModuleResolver } from "../src/emulator";

function createStaticModuleResolver(modules: Record<string, string>): LuaModuleResolver {
  return async (moduleName) => modules[moduleName] ?? null;
}

class ScreenUnitHarness {
  readonly buffer = new DrawBuffer();

  readonly env = createLuaEnvironment(
    this.buffer,
    createStaticModuleResolver({
      dkjson: `
        local M = {}

        function M.decode(text)
          if type(text) ~= "string" or text == "" then
            return nil
          end

          local luaText = text
          luaText = luaText:gsub("%[", "{")
          luaText = luaText:gsub("%]", "}")
          luaText = luaText:gsub('"(.-)"%s*:', '["%1"]=')
          luaText = luaText:gsub("null", "nil")

          local chunk, err = load("return " .. luaText, "@dkjson.decode", "t", _ENV)
          if not chunk then
            error(err, 0)
          end

          return chunk()
        end

        return M
      `,
    }),
  );

  setScriptInput(input: string): void {
    this.buffer.input = input;
  }

  getScriptOutput(): string {
    return this.buffer.output;
  }

  clearScriptOutput(): void {
    this.buffer.output = "";
  }

  async run(script: string) {
    return this.env.execute(script, { chunkLabel: "tests/screen-io-bridge.lua" });
  }
}

describe("screen unit string bridge semantics", () => {
  it("makes board-side script input available to render scripts as a raw string", async () => {
    const harness = new ScreenUnitHarness();
    const payload = JSON.stringify([
      {
        "123": [1200, 2400, "Bauxite", "ore-bauxite.png"],
        "456": [800, 1600, "Coal", "ore-coal.png"],
      },
      [
        [0, 3600, 123, 34.5, 91.25, 100, 87.5, 7200],
        [3, 1800, 456, 18, 75, 90, 62, 10800],
      ],
    ]);

    harness.setScriptInput(payload);
    const result = await harness.run("setOutput(getInput())");

    expect(result.success).toBe(true);
    expect(result.output).toBe(payload);
    expect(harness.getScriptOutput()).toBe(payload);
  });

  it("supports runtime-dependent JSON payloads without rewriting the render script", async () => {
    const harness = new ScreenUnitHarness();
    const renderScript = `
      local json = require("dkjson")
      local fromScript = json.decode(getInput()) or {}
      local pool = fromScript[1] or {}
      local data = fromScript[2] or {}
      local firstOre = pool["123"] or {}
      local firstMachine = data[1] or {}
      setOutput(table.concat({
        tostring(firstOre[3] or "none"),
        tostring(#data),
        tostring(firstMachine[4] or "nil")
      }, "|"))
    `;

    const payloadA = JSON.stringify([
      {
        "123": [1200, 2400, "Bauxite", "ore-bauxite.png"],
      },
      [
        [0, 3600, 123, 34.5, 91.25, 100, 87.5, 7200],
        [3, 1800, 456, 18, 75, 90, 62, 10800],
      ],
    ]);
    harness.setScriptInput(payloadA);
    const resultA = await harness.run(renderScript);

    const payloadB = JSON.stringify([
      {
        "123": [250, 500, "Quartz", "ore-quartz.png"],
      },
      [
        [1, 90, 123, 7.25, 40, 80, 24, 300],
      ],
    ]);
    harness.setScriptInput(payloadB);
    const resultB = await harness.run(renderScript);

    expect(resultA.success).toBe(true);
    expect(resultA.output).toBe("Bauxite|2|34.5");
    expect(resultB.success).toBe(true);
    expect(resultB.output).toBe("Quartz|1|7.25");
  });

  it("exposes the last render-script output and lets board-side code clear it", async () => {
    const harness = new ScreenUnitHarness();

    const first = await harness.run("setOutput('delta|rev|main_canvas')");
    expect(first.success).toBe(true);
    expect(harness.getScriptOutput()).toBe("delta|rev|main_canvas");

    harness.clearScriptOutput();
    expect(harness.getScriptOutput()).toBe("");

    const second = await harness.run("setOutput('probe|boot')");
    expect(second.success).toBe(true);
    expect(harness.getScriptOutput()).toBe("probe|boot");
  });
});
