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

  it("loads RenderScript dynamically through the module resolver", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, async (moduleName) => {
      if (moduleName === "RenderScript") {
        return renderScriptFixture;
      }
      return null;
    });

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
    const buffer = new DrawBuffer();
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
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(`
      local image = loadImage("assets.prod.novaquark.com/4745/example.jpg")
      setOutput(tostring(image))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("1");
    expect(buffer.images[0]?.url).toBe("https://assets.prod.novaquark.com/4745/example.jpg");
  });

  it("exposes loadImage for allowed data image URLs", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(`
      local image = loadImage("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
      setOutput(tostring(image))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("1");
    expect(buffer.images[0]?.url).toBe("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==");
  });

  it("rejects loadImage calls for disallowed image URLs", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);

    const result = await env.execute(`
      local image = loadImage("assets.prod.novaquark.com.evil.com/4745/example.jpg")
      setOutput(tostring(image))
    `);

    expect(result.success).toBe(true);
    expect(result.output).toBe("0");
    expect(buffer.images).toHaveLength(0);
  });
});
