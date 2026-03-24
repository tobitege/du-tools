import path from "node:path";
import { describe, expect, it } from "vitest";
import example1Source from "../examples/example1.lua?raw";
import rslibFixture from "./fixtures/rslib.lua?raw";
import renderScriptSource from "../examples/du-mocks/RenderScript.lua?raw";
import simpleSignSSource from "../examples/SilverZero/SimpleSignS.lua?raw";
import simpleSignSvgScriptSource from "../examples/SilverZero/SimpleSignS-svg.lua?raw";
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
import silverZeroLibSource from "../lib/SilverZeroRsLib.lua?raw";
import svgParserSource from "../lib/SvgParser.lua?raw";
import svgShapeClassifierSource from "../lib/SvgShapeClassifier.lua?raw";
import simpleSignSHtmlSource from "../examples/SilverZero/SimpleSignS_html.lua?raw";
import locuraTreesSource from "../examples/Locura-Trees.lua?raw";
import { DrawBuffer, createLuaEnvironment, type LuaModuleResolver } from "../src/emulator";

function createStaticModuleResolver(modules: Record<string, string>): LuaModuleResolver {
  return async (moduleName) => modules[moduleName] ?? null;
}

function normalizeLuaFilePath(filePath: string): string {
  const normalized = path.posix.normalize(filePath.replace(/\\/g, "/"));
  return normalized.replace(/^\.\//, "");
}

function withLuaExtension(filePath: string): string {
  return filePath.endsWith(".lua") ? filePath : `${filePath}.lua`;
}

function buildLuaModuleCandidates(moduleName: string): string[] {
  const normalized = moduleName.replace(/\\/g, "/");
  const pathRequest = normalized.replace(/\.lua$/i, "");
  const pathParts = pathRequest.split("/").filter(Boolean);
  const dotParts = normalized.startsWith("./") || normalized.startsWith("../") || normalized.includes("/")
    ? []
    : normalized.split(".").filter(Boolean);
  const seen = new Set<string>();
  const candidates: string[] = [];

  const pushModulePath = (parts: string[]) => {
    if (parts.length === 0) {
      return;
    }

    for (const variant of [parts, [...parts, "init"]]) {
      const candidate = variant.join("/");
      if (!seen.has(candidate)) {
        seen.add(candidate);
        candidates.push(candidate);
      }
    }
  };

  pushModulePath(pathParts);
  pushModulePath(dotParts);

  return candidates;
}

function createLuaFileResolver(files: Record<string, string>): LuaModuleResolver {
  const normalizedFiles = Object.fromEntries(
    Object.entries(files).map(([filePath, source]) => [normalizeLuaFilePath(filePath), source]),
  );
  const resolvedPaths: Record<string, string> = {};
  const basenameIndex = new Map<string, string[]>();

  for (const filePath of Object.keys(normalizedFiles)) {
    const bareName = path.posix.basename(filePath, ".lua");
    const fullName = path.posix.basename(filePath);
    basenameIndex.set(bareName, [...(basenameIndex.get(bareName) ?? []), filePath]);
    basenameIndex.set(fullName, [...(basenameIndex.get(fullName) ?? []), filePath]);
  }

  const pushCandidate = (list: string[], candidate: string | null | undefined) => {
    if (!candidate) {
      return;
    }
    const normalized = normalizeLuaFilePath(candidate);
    if (!list.includes(normalized)) {
      list.push(normalized);
    }
    const withExtension = withLuaExtension(normalized);
    if (!list.includes(withExtension)) {
      list.push(withExtension);
    }
  };

  return async (moduleName, fromModule) => {
    const candidates: string[] = [];
    const fromResolved = fromModule ? resolvedPaths[fromModule] ?? normalizeLuaFilePath(fromModule) : null;
    const normalizedRequest = moduleName.replace(/\\/g, "/");

    if (normalizedRequest.startsWith("./") || normalizedRequest.startsWith("../")) {
      pushCandidate(
        candidates,
        fromResolved
          ? path.posix.join(path.posix.dirname(fromResolved), normalizedRequest)
          : normalizedRequest,
      );
    } else {
      for (const moduleCandidate of buildLuaModuleCandidates(normalizedRequest)) {
        if (fromResolved) {
          pushCandidate(candidates, path.posix.join(path.posix.dirname(fromResolved), moduleCandidate));
        }
        pushCandidate(candidates, moduleCandidate);
      }
    }

    for (const candidate of candidates) {
      const source = normalizedFiles[candidate];
      if (source != null) {
        resolvedPaths[moduleName] = candidate;
        return source;
      }
    }

    if (!normalizedRequest.includes("/") && !normalizedRequest.startsWith(".")) {
      const basenameMatches = basenameIndex.get(normalizedRequest) ?? basenameIndex.get(withLuaExtension(normalizedRequest));
      if (basenameMatches?.length === 1) {
        const resolvedPath = basenameMatches[0];
        resolvedPaths[moduleName] = resolvedPath;
        return normalizedFiles[resolvedPath] ?? null;
      }
    }

    return null;
  };
}

async function executeLuaFile(
  env: ReturnType<typeof createLuaEnvironment>,
  filePath: string,
  chunkLabel = "tests/runtime-entry.lua",
) {
  return env.execute(`include("${filePath}")`, { chunkLabel });
}

const silverZeroFileSources = {
  "examples/SilverZero/SimpleSignS.lua": simpleSignSSource,
  "examples/SilverZero/SimpleSignS-svg.lua": simpleSignSvgScriptSource,
  "examples/SilverZero/SimpleSignXS.lua": simpleSignXSSource,
  "examples/SilverZero/WelcomeScreenM.lua": welcomeScreenMSource,
  "examples/SilverZero/ShipStatsS.lua": shipStatsSSource,
  "examples/SilverZero/ShipFrameM.lua": shipFrameMSource,
  "examples/SilverZero/DispenserSignS.lua": dispenserSignSSource,
  "examples/SilverZero/HubPanelS.lua": hubPanelSSource,
  "examples/SilverZero/HubPanelL.lua": hubPanelLSource,
  "examples/SilverZero/ContainerSignM.lua": containerSignMSource,
  "examples/SilverZero/ContainerHubHubM.lua": containerHubHubMSource,
  "examples/SilverZero/IndustrySelectorM.lua": industrySelectorMSource,
  "examples/SilverZero/OreExplorerM.lua": oreExplorerMSource,
  "lib/SilverZeroRsLib.lua": silverZeroLibSource,
  "lib/SvgParser.lua": svgParserSource,
  "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
  "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
};

describe("lua runtime example integration", () => {
  it("executes example1 with rslib and emits text commands", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "examples/example1.lua": example1Source,
      "examples/rslib.lua": rslibFixture,
    }));

    const result = await executeLuaFile(env, "examples/example1.lua");

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
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "tests/runtime/pcall-require.lua": `
        local ok, rslib = pcall(require, "rslib")
        local layer = createLayer()
        local font = loadFont('Arial', 16)
        addText(layer, font, ok and 'loaded' or 'missing', 10, 20)
      `,
      "tests/runtime/rslib.lua": rslibFixture,
    }));

    const result = await executeLuaFile(env, "tests/runtime/pcall-require.lua");

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

  it("parses implicit line segments after moveto in SilverZero drawPath", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "examples/SilverZero/tests/drawpath-implicit.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local layer = createLayer()
        local layout = {
          screenW = 200,
          screenH = 200,
          sourceW = 200,
          sourceH = 200,
          scale = 1,
          x = 0,
          y = 0,
        }

        SZ.drawPath(layer, layout, "M10 10 20 20 30 10", {1, 1, 1, 1}, 1)
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/drawpath-implicit.lua");

    expect(result.success).toBe(true);
    const lines = buffer.commands.filter((command) => command.op === "AddLine");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ x1: 10, y1: 10, x2: 20, y2: 20 });
    expect(lines[1]).toMatchObject({ x1: 20, y1: 20, x2: 30, y2: 10 });
  });

  it("parses cubic curves and scientific notation in SilverZero drawPath", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "examples/SilverZero/tests/drawpath-cubic.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local layer = createLayer()
        local layout = {
          screenW = 200,
          screenH = 200,
          sourceW = 200,
          sourceH = 200,
          scale = 1,
          x = 0,
          y = 0,
        }

        SZ.drawPath(layer, layout, "M1e2 10 C110 10 120 20 130 20", {1, 1, 1, 1}, 1)
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/drawpath-cubic.lua");

    expect(result.success).toBe(true);
    const lines = buffer.commands.filter((command) => command.op === "AddLine");
    expect(lines.length).toBeGreaterThan(3);
    expect(lines[0]).toMatchObject({ x1: 100, y1: 10 });
    expect(lines[lines.length - 1]?.x2).toBeCloseTo(130, 6);
    expect(lines[lines.length - 1]?.y2).toBeCloseTo(20, 6);
  });

  it("applies optional affine transforms in SilverZero drawPath", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "examples/SilverZero/tests/drawpath-transform.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local layer = createLayer()
        local layout = {
          screenW = 200,
          screenH = 200,
          sourceW = 200,
          sourceH = 200,
          scale = 1,
          x = 0,
          y = 0,
        }

        SZ.drawPath(layer, layout, "M1 2 L3 4", {1, 1, 1, 1}, 1, {2, 0, 0, 3, 5, 7})
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/drawpath-transform.lua");

    expect(result.success).toBe(true);
    const lines = buffer.commands.filter((command) => command.op === "AddLine");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ x1: 7, y1: 13, x2: 11, y2: 19 });
  });

  it("supports non-uniform layout scaling in SilverZero helpers", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "examples/SilverZero/tests/layout-scale.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local layout = {
          screenW = 300,
          screenH = 200,
          sourceW = 100,
          sourceH = 100,
          scale = 1,
          scaleX = 3,
          scaleY = 2,
          x = 10,
          y = 20,
        }

        setOutput(table.concat({
          tostring(SZ.toScreenX(layout, 5)),
          tostring(SZ.toScreenY(layout, 5)),
          tostring(SZ.toScreenW(layout, 7)),
          tostring(SZ.toScreenH(layout, 7))
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/layout-scale.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("25|30|21|14");
  });

  it("parses full SVG transform lists for the SimpleSign parser", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "examples/SilverZero/tests/parser-transform.lua": `
        local Parser = require("lib.SvgParser")
        local t = Parser.parseTransform("translate(156,-71) matrix(.98 0 0 -.98 -159 232) scale(.1)")
        setOutput(table.concat({
          string.format("%.3f", t[1]),
          string.format("%.3f", t[2]),
          string.format("%.3f", t[3]),
          string.format("%.3f", t[4]),
          string.format("%.3f", t[5]),
          string.format("%.3f", t[6])
        }, ","))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/parser-transform.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("0.098,0.000,0.000,-0.098,-3.000,161.000");
  });

  it("keeps nested SVG groups intact for the SimpleSign board art", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/parser-board.lua": `
        local Parser = require("lib.SvgParser")
        local html = require("examples.SilverZero.SimpleSignS_html")
        local doc = Parser.parse(html)
        local board
        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "80vw", 1, true) then
            board = svg
            break
          end
        end

        local first = board and board.items and board.items[1]
        setOutput(table.concat({
          tostring(board and #board.items or 0),
          first and string.format("%.3f", first.transform[1]) or "nil",
          first and string.format("%.3f", first.transform[4]) or "nil",
          first and string.format("%.3f", first.transform[5]) or "nil",
          first and string.format("%.3f", first.transform[6]) or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/parser-board.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("20|0.098|-0.098|-3.000|161.000");
  });

  it("classifies open paths as outline paths", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-open.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 0 L10 0 L10 5",
          fill = "#fff",
        })
        setOutput(table.concat({
          shape.kind,
          tostring(shape.analysis.closed),
          tostring(shape.analysis.subpathCount),
          tostring(#(shape.geometry.points or {}))
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-open.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("outline_path|false|1|3");
  });

  it("classifies single closed quads and trapezoids from simplified polygon points", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-trapezoid.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 0 L10 0 L8 6 L2 6 z",
          fill = "#fff",
        })
        setOutput(table.concat({
          shape.kind,
          tostring(shape.analysis.closed),
          tostring(#(shape.geometry.points or {})),
          string.format("%.3f", shape.geometry.bounds.w),
          string.format("%.3f", shape.geometry.bounds.h)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-trapezoid.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("trapezoid|true|4|10.000|6.000");
  });

  it("marks multiple closed subpaths as compound_path", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-compound.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 0 L10 0 L10 10 L0 10 z M2 2 L8 2 L8 8 L2 8 z",
          fill = "#fff",
        })
        setOutput(table.concat({
          shape.kind,
          tostring(shape.analysis.subpathCount),
          tostring(shape.geometry.subpaths[1] and shape.geometry.subpaths[1].pointCount or 0),
          tostring(shape.geometry.subpaths[2] and shape.geometry.subpaths[2].pointCount or 0)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-compound.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("compound_path|2|4|4");
  });

  it("passes classifier options through classifySvg and classify", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-options.lua": `
        local Classifier = require("lib.SvgShapeClassifier")

        local svgEntry = {
          id = "test-svg",
          items = {
            { d = "M0 0 L10 0 L8 5.1 L1 5 z", fill = "#fff" }
          }
        }

        local viaSvg = Classifier.classifySvg(svgEntry, { parallelTolerance = 0.001 })
        local viaDoc = Classifier.classify({
          vars = {},
          svgs = { svgEntry },
        }, { parallelTolerance = 0.001 })

        setOutput(table.concat({
          viaSvg[1].kind,
          viaDoc[1].kind,
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-options.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("quad|quad");
  });

  it("applies SVG transforms before classifying real SimpleSign board decals", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/classifier-board-decal.lua": `
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("examples.SilverZero.SimpleSignS_html")
        local doc = Parser.parse(html)
        local target

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "80vw", 1, true) then
            for _, item in ipairs(svg.items or {}) do
              if item.d == "m2330 1473 29 34v-38l-29-34v38" then
                target = item
                break
              end
            end
          end
        end

        local shape = Classifier.classifyItem(target)
        local points = shape.geometry.points
        setOutput(table.concat({
          shape.kind,
          tostring(shape.analysis.subpathCount),
          string.format("%.3f", points[1].x),
          string.format("%.3f", points[1].y),
          string.format("%.3f", points[2].x),
          string.format("%.3f", points[2].y),
          string.format("%.3f", points[3].x),
          string.format("%.3f", points[3].y),
          string.format("%.3f", points[4].x),
          string.format("%.3f", points[4].y)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-board-decal.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("quad|1|226.095|16.646|228.937|13.314|228.937|17.038|226.095|20.370");
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
    const env = createLuaEnvironment(buffer, createStaticModuleResolver({
      RenderScript: renderScriptSource,
    }), { imageLoadingEnabled: false, luaHostIoEnabled: true });

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
    const env = createLuaEnvironment(buffer, createStaticModuleResolver({
      RenderScript: renderScriptSource,
    }), { imageLoadingEnabled: true, luaHostIoEnabled: true });

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
    const env = createLuaEnvironment(buffer, createStaticModuleResolver({
      RenderScript: `
        local M = {}
        function M.Instance()
          return {
            LoadImage = function(path)
              return 77
            end,
          }
        end
        return M
      `,
    }), { imageLoadingEnabled: true, luaHostIoEnabled: true });

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
    const env = createLuaEnvironment(buffer, createStaticModuleResolver({
      RenderScript: renderScriptSource,
    }), { imageLoadingEnabled: true, luaHostIoEnabled: true });

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
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/SimpleSignS.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(0);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBox")).toBe(true);
  });

  it("renders SimpleSignS-svg with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/SimpleSignS-svg.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(0);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddQuad")).toBe(true);
  });

  it("renders SimpleSignXS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/SimpleSignXS.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
  });

  it("renders WelcomeScreenM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/WelcomeScreenM.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddCircle")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
  });

  it("renders ShipStatsS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/ShipStatsS.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders ShipFrameM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/ShipFrameM.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddCircle")).toBe(true);
  });

  it("renders DispenserSignS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/DispenserSignS.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
  });

  it("renders HubPanelS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/HubPanelS.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders HubPanelL with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/HubPanelL.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBox")).toBe(true);
  });

  it("renders ContainerSignM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/ContainerSignM.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders ContainerHubHubM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/ContainerHubHubM.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders IndustrySelectorM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/IndustrySelectorM.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
  });

  it("renders OreExplorerM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/OreExplorerM.lua");

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
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "tests/runtime/io-blocked.lua": `
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
      `,
      "tests/runtime/rslib.lua": rslibFixture,
    }));

    const result = await executeLuaFile(env, "tests/runtime/io-blocked.lua");

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

  it("times out stalled Lua execution and remains usable afterwards", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer);

    const stalled = await env.execute("while true do end");

    expect(stalled.success).toBe(false);
    expect(stalled.error).toContain("timed out");

    const recovered = await env.execute("setOutput('ok')");

    expect(recovered.success).toBe(true);
    expect(recovered.output).toBe("ok");
  });
});
