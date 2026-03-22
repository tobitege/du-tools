import { describe, expect, it } from "vitest";
import example1Source from "../examples/example1.lua?raw";
import rslibFixture from "./fixtures/rslib.lua?raw";
import renderScriptFixture from "../examples/du-mocks/RenderScript.lua?raw";
import simpleSignSSource from "../examples/SilverZero/SimpleSignS.lua?raw";
import simpleSignXSSource from "../examples/SilverZero/SimpleSignXS.lua?raw";
import welcomeScreenMSource from "../examples/SilverZero/WelcomeScreenM.lua?raw";
import shipStatsSSource from "../examples/SilverZero/ShipStatsS.lua?raw";
import shipFrameMSource from "../examples/SilverZero/ShipFrameM.lua?raw";
import dispenserSignSSource from "../examples/SilverZero/DispenserSignS.lua?raw";
import hubPanelSSource from "../examples/SilverZero/HubPanelS.lua?raw";
import hubPanelLSource from "../examples/SilverZero/HubPanelL.lua?raw";
import containerSignMSource from "../examples/SilverZero/ContainerSignM.lua?raw";
import containerHubHubMSource from "../examples/SilverZero/ContainerHubHubM.lua?raw";
import industrySelectorMSource from "../examples/SilverZero/IndustrySelectorM.lua?raw";
import oreExplorerMSource from "../examples/SilverZero/OreExplorerM.lua?raw";
import silverZeroLibFixture from "../examples/SilverZero/SilverZeroRsLib.lua?raw";
import locuraTreesSource from "../examples/Locura-Trees.lua?raw";
import { DrawBuffer, createLuaEnvironment } from "../src/emulator";

describe("lua runtime example integration", () => {
  it("executes example1 with rslib and emits text commands", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "rslib") {
        return rslibFixture;
      }
      return null;
    });

    const result = await env.execute(example1Source);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);

    const textCommands = buffer.commands.filter((command) => command.op === "AddText");
    expect(textCommands.length).toBeGreaterThan(0);
    expect(textCommands.some((command) => command.op === "AddText" && command.text.includes("rslib"))).toBe(true);
  });

  it("keeps Lua globals alive between executions in one runtime", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);

    const first = await env.execute("counter = (counter or 0) + 1\nlocal layer = createLayer()\nlocal font = loadFont('Arial', 16)\naddText(layer, font, 'frame ' .. counter, 10, 20)");
    expect(first.success).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddText" && command.text === "frame 1")).toBe(true);

    const second = await env.execute("counter = (counter or 0) + 1\nlocal layer = createLayer()\nlocal font = loadFont('Arial', 16)\naddText(layer, font, 'frame ' .. counter, 10, 20)");
    expect(second.success).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddText" && command.text === "frame 2")).toBe(true);
  });

  it("loads modules referenced through pcall(require, ...) patterns", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "rslib") {
        return rslibFixture;
      }
      return null;
    });

    const result = await env.execute("local ok, rslib = pcall(require, 'rslib')\nlocal layer = createLayer()\nlocal font = loadFont('Arial', 16)\naddText(layer, font, ok and 'loaded' or 'missing', 10, 20)");

    expect(result.success).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddText" && command.text === "loaded")).toBe(true);
  });

  it("ignores require/include statements that only appear inside comments or strings", async () => {
    const requestedModules: string[] = [];
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      requestedModules.push(moduleName);
      if (moduleName === "real_module") {
        return "return { value = 'loaded' }";
      }
      return null;
    });

    const result = await env.execute(`
      -- require("commented_line")
      --[[ include("commented_block") ]]
      local ignoredA = "require('string_literal')"
      local ignoredB = [[include("long_string_literal")]]
      local module = require("real_module")
      setOutput(module.value)
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("loaded");
    expect(requestedModules).toEqual(["real_module"]);
  });

  it("accepts a UTF-8 BOM before a first-line Lua comment", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);

    const result = await env.execute("\uFEFF-- constants for svg file\nlocal value = 7\nsetOutput(tostring(value))");

    expect(result.success).toBe(true);
    expect(result.output).toBe("7");
  });

  it("reports runtime errors with the provided chunk label and line number", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);

    const result = await env.execute("local value = {}\nreturn value.missing.field", {
      chunkLabel: "github-script.lua",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("github-script.lua:2:");
  });

  it("loads RenderScript dynamically through the module resolver", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "RenderScript") {
        return renderScriptFixture;
      }
      return null;
    }, { imageLoadingEnabled: false, luaHostIoEnabled: true });

    const result = await env.execute(`
      local RenderScript = require("RenderScript")
      local rs = RenderScript.Instance()
      local layer = rs.CreateLayer()
      local font = rs.LoadFont("Play", 16)
      rs.AddText(layer, font, "wrapper loaded", 10, 20)
      setOutput(table.concat({
        type(RenderScript.Instance),
        type(rs.CreateLayer),
        type(font.GetID),
      }, ","))
    `);

    if (!result.success) {
      throw new Error(result.error ?? "RenderScript execution failed");
    }
    expect(result.success).toBe(true);
    expect(result.output).toBe("function,function,function");
  });

  it("caches wrapper loadImage calls within one execution", async () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "RenderScript") {
        return renderScriptFixture;
      }
      return null;
    }, { imageLoadingEnabled: true, luaHostIoEnabled: true });

    const result = await env.execute(`
      local RenderScript = require("RenderScript")
      local rs = RenderScript.Instance()
      local rawLoadImage = loadImage
      local calls = 0

      loadImage = function(path)
        calls = calls + 1
        return rawLoadImage(path)
      end

      local a = rs.LoadImage("assets.prod.novaquark.com/4745/example.jpg")
      local b = rs.LoadImage("assets.prod.novaquark.com/4745/example.jpg")

      setOutput(table.concat({
        tostring(calls),
        tostring(a),
        tostring(b),
        tostring(a == b),
      }, "|"))
    `);

    if (!result.success) {
      throw new Error(result.error ?? "RenderScript loadImage execution failed");
    }
    expect(result.output).toBe("1|1|1|true");
  });

  it("prefers a working wrapper LoadImage implementation over the native fallback", async () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "RenderScript") {
        return `
          local M = {}
          function M.Instance()
            return {
              LoadImage = function(path)
                return 77
              end,
            }
          end
          return M
        `;
      }
      return null;
    }, { imageLoadingEnabled: true, luaHostIoEnabled: true });

    const result = await env.execute(`
      local RenderScript = require("RenderScript")
      local rs = RenderScript.Instance()
      local image = rs.LoadImage("assets.prod.novaquark.com/4745/example.jpg")
      setOutput(tostring(image))
    `);

    if (!result.success) {
      throw new Error(result.error ?? "RenderScript preferred LoadImage execution failed");
    }
    expect(result.output).toBe("77");
    expect(buffer.images).toHaveLength(0);
  });

  it("resets the wrapper loadImage cache on the next execution frame", async () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "RenderScript") {
        return renderScriptFixture;
      }
      return null;
    }, { imageLoadingEnabled: true, luaHostIoEnabled: true });

    const script = `
      local RenderScript = require("RenderScript")
      local rs = RenderScript.Instance()
      local rawLoadImage = loadImage
      local calls = 0

      loadImage = function(path)
        calls = calls + 1
        return rawLoadImage(path)
      end

      rs.LoadImage("assets.prod.novaquark.com/4745/example.jpg")
      setOutput(tostring(calls))
    `;

    const first = await env.execute(script);
    const second = await env.execute(script);

    if (!first.success) {
      throw new Error(first.error ?? "First RenderScript frame failed");
    }
    if (!second.success) {
      throw new Error(second.error ?? "Second RenderScript frame failed");
    }
    expect(first.output).toBe("1");
    expect(second.output).toBe("1");
  });

  it("renders SimpleSignS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(simpleSignSSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders SimpleSignXS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(simpleSignXSSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
  });

  it("renders WelcomeScreenM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(welcomeScreenMSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddCircle")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
  });

  it("renders ShipStatsS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(shipStatsSSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders ShipFrameM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(shipFrameMSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddCircle")).toBe(true);
  });

  it("renders DispenserSignS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(dispenserSignSSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
  });

  it("renders HubPanelS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(hubPanelSSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders HubPanelL with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(hubPanelLSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBox")).toBe(true);
  });

  it("renders ContainerSignM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(containerSignMSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders ContainerHubHubM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(containerHubHubMSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders IndustrySelectorM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(industrySelectorMSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders OreExplorerM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "SilverZeroRsLib") {
        return silverZeroLibFixture;
      }
      return null;
    });

    const result = await env.execute(oreExplorerMSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddCircle")).toBe(true);
  });

  it("renders Locura-Trees with embedded base64 image layers", async () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(locuraTreesSource);

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.images.length).toBeGreaterThanOrEqual(4);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
  });

  it("returns non-zero text bounds for Lua strings", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);

    const result = await env.execute("local font = loadFont('Arial', 20)\nlocal w, h = getTextBounds(font, 'Bottom HUD')\nsetOutput(string.format('%.1f,%.1f', w, h))");

    expect(result.success).toBe(true);
    const [width, height] = result.output.split(",").map(Number);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("exposes loadImage for allowed Novaquark asset URLs", async () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(`
      local image = loadImage("assets.prod.novaquark.com/4745/example.jpg")
      setOutput(tostring(image))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("1");
    expect(buffer.images[0]?.url).toBe("https://assets.prod.novaquark.com/4745/example.jpg");
  });

  it("exposes loadImage for allowed PNG data image URLs", async () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(`
      local image = loadImage("data:image/png;base64,iVBORw0KGgo=")
      setOutput(tostring(image))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("1");
    expect(buffer.images[0]?.url).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("rejects loadImage calls for disallowed image URLs", async () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(`
      local image = loadImage("assets.prod.novaquark.com.evil.com/4745/example.jpg")
      setOutput(tostring(image))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("0");
    expect(buffer.images).toHaveLength(0);
  });

  it("rejects loadImage calls for non-png/jpeg image formats", async () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(`
      local a = loadImage("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
      local b = loadImage("assets.prod.novaquark.com/4745/example.gif")
      setOutput(table.concat({ tostring(a), tostring(b) }, ","))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("0,0");
    expect(buffer.images).toHaveLength(0);
  });

  it("rejects loadImage calls for traversal and local-path payloads", async () => {
    const buffer = new DrawBuffer({ imageLoadingEnabled: true });
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(`
      local a = loadImage("assets.prod.novaquark.com/../secret.jpg")
      local b = loadImage("\\\\server\\\\share\\\\secret.png")
      local c = loadImage("C:\\\\temp\\\\secret.png")
      setOutput(table.concat({ tostring(a), tostring(b), tostring(c) }, ","))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("0,0,0");
    expect(buffer.images).toHaveLength(0);
  });

  it("returns a shared placeholder image when image loading is disabled", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(`
      local a = loadImage("assets.prod.novaquark.com/4745/example.jpg")
      local b = loadImage("data:image/png;base64,iVBORw0KGgo=")
      local w, h = getImageSize(a)
      setOutput(table.concat({ tostring(a), tostring(b), tostring(w), tostring(h) }, ","))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("1,1,256,96");
    expect(buffer.images[0]?.url).toBe("/images-disabled.svg");
  });

  it("blocks Lua host I/O by default while keeping require available", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "rslib") {
        return rslibFixture;
      }
      return null;
    });

    const result = await env.execute(`
      local okRequire, moduleValue = pcall(require, "rslib")
      local okIo, ioError = pcall(function()
        return io.open("test.txt", "r")
      end)
      setOutput(table.concat({
        tostring(okRequire),
        tostring(type(moduleValue)),
        tostring(okIo),
        tostring(ioError),
      }, "|"))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toContain("true|table|false|");
    expect(result.output).toContain("Lua host I/O is disabled");
  });

  it("allows Lua host I/O only when explicitly enabled", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, undefined, {
      imageLoadingEnabled: false,
      luaHostIoEnabled: true,
    });

    const result = await env.execute(`
      local okIo, ioValue = pcall(function()
        return io
      end)
      setOutput(table.concat({ tostring(okIo), tostring(type(ioValue)) }, "|"))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|table");
  });
});
