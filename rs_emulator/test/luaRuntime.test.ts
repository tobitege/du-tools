import path from "node:path";
import { describe, expect, it } from "vitest";
import example1Source from "../examples/example1.lua?raw";
import rslibFixture from "./fixtures/rslib.lua?raw";
import renderScriptSource from "../examples/du-mocks/RenderScript.lua?raw";
import simpleSignSSource from "../examples/SilverZero/SimpleSignS.lua?raw";
import simpleSignSvgScriptSource from "../examples/SilverZero/SimpleSignS-svg.lua?raw";
import simpleSignXSSource from "../examples/SilverZero/SimpleSignXS.lua?raw";
import shapeAdapterProbeSource from "../examples/SilverZero/ShapeAdapterProbe.lua?raw";
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
  "examples/SilverZero/ShapeAdapterProbe.lua": shapeAdapterProbeSource,
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

    const first = await env.execute("counter = (counter or 0) + 1\nlocal layer = createLayer()\nlocal font = loadFont('RobotoMono', 16)\naddText(layer, font, 'frame ' .. counter, 10, 20)");
    expect(first.success).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddText" && command.text === "frame 1")).toBe(true);

    const second = await env.execute("counter = (counter or 0) + 1\nlocal layer = createLayer()\nlocal font = loadFont('RobotoMono', 16)\naddText(layer, font, 'frame ' .. counter, 10, 20)");
    expect(second.success).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddText" && command.text === "frame 2")).toBe(true);
  });

  it("loads modules referenced through pcall(require, ...) patterns", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "tests/runtime/pcall-require.lua": `
        local ok, rslib = pcall(require, "rslib")
        local layer = createLayer()
        local font = loadFont('RobotoMono', 16)
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
        local html = require("lib.SimpleSignS_html")
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

  it("keeps separated closed subpaths as compound_path", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-compound.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 0 L4 0 L4 4 L0 4 z M8 0 L12 0 L12 4 L8 4 z",
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

  it("classifies nested closed subpaths as polygon_ring", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-polygon-ring.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 0 L10 0 L10 10 L0 10 z M3 3 L7 3 L7 7 L3 7 z",
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

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-polygon-ring.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("polygon_ring|2|4|4");
  });

  it("classifies nested hexagons as hex_ring", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-hex-ring.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 -10 L8.660 -5 L8.660 5 L0 10 L-8.660 5 L-8.660 -5 z M0 -6 L5.196 -3 L5.196 3 L0 6 L-5.196 3 L-5.196 -3 z",
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

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-hex-ring.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("hex_ring|2|6|6");
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

  it("assigns group hints to repeated shapes within the same SVG", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-group-hints.lua": `
        local Classifier = require("lib.SvgShapeClassifier")

        local svgEntry = {
          id = "group-test",
          items = {
            { d = "M0 0 L10 0 L10 10 L0 10 z", fill = "#fff" },
            { d = "M20 0 L30 0 L30 10 L20 10 z", fill = "#fff" },
            { d = "M0 20 L8 20 L8 28 L0 28 z", fill = "#fff" },
          }
        }

        local shapes = Classifier.classifySvg(svgEntry)
        local first = shapes[1].groupHints
        local second = shapes[2].groupHints
        local third = shapes[3].groupHints

        setOutput(table.concat({
          first and first.sameCluster or "nil",
          tostring(first and first.clusterSize or 0),
          first and table.concat(first.neighbors or {}, ",") or "nil",
          second and second.sameCluster or "nil",
          tostring(second and second.clusterSize or 0),
          second and table.concat(second.neighbors or {}, ",") or "nil",
          third and third.sameCluster or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-group-hints.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("quad_cluster_01|2|2|quad_cluster_01|2|1|nil");
  });

  it("assigns frame_outline role to a real SimpleSign board frame compound path", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/classifier-frame-outline.lua": `
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetRole

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "80vw", 1, true) then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            targetRole = shapes[20] and shapes[20].role
            break
          end
        end

        setOutput(tostring(targetRole))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-frame-outline.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("frame_outline");
  });

  it("does not assign frame_outline to large open two-subpath border traces", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-open-frame-trace.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 0 L100 0 L100 100 M0 0 L0 100 L100 100",
          fill = "#fff"
        }, {
          svgBounds = { x = 0, y = 0, w = 100, h = 100 }
        })

        setOutput(table.concat({
          shape.kind or "nil",
          tostring(shape.role)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-open-frame-trace.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("compound_path|nil");
  });

  it("assigns edge_decal role to real SimpleSign border highlight fragments", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/classifier-edge-decal.lua": `
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local svg1Role = "nil"
        local svg3Roles = {}

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width == "20vw" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            svg1Role = shapes[7] and shapes[7].role or "nil"
          elseif svg.width == "80vw" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            svg3Roles = {
              shapes[3] and shapes[3].role or "nil",
              shapes[10] and shapes[10].role or "nil",
              shapes[14] and shapes[14].role or "nil"
            }
          end
        end

        setOutput(table.concat({
          svg1Role,
          table.concat(svg3Roles, ",")
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-edge-decal.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("edge_decal|edge_decal,edge_decal,edge_decal");
  });

  it("does not assign frame_cap without a containing frame_outline", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-frame-cap-context.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local svgEntry = {
          viewBox = "0 0 100 100",
          items = {
            {
              d = "M15 0 L85 0 L100 15 L100 85 L85 100 L15 100 L0 85 L0 15 z",
              fill = "#000c"
            }
          }
        }

        local shapes = Classifier.classifySvg(svgEntry)
        setOutput(tostring(shapes[1] and shapes[1].role))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-frame-cap-context.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("nil");
  });

  it("assigns frame_cap role to a real SimpleSign board face polygon", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/classifier-frame-cap.lua": `
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetRole

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width == "80vw" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            targetRole = shapes[1] and shapes[1].role
            break
          end
        end

        setOutput(tostring(targetRole))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-frame-cap.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("frame_cap");
  });

  it("assigns logo_segment to quadrant-mirrored polygon families inside a frame outline", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-logo-segment-family.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local svgEntry = {
          viewBox = "0 0 100 100",
          items = {
            {
              d = "M0 0 L100 0 L100 100 L0 100 L0 0.1 M15 15 L85 15 L85 85 L15 85 L15 15.1",
              fill = "#555"
            },
            {
              d = "M10 10 L30 10 L30 12 L28 24 L12 24 L10 12 z",
              fill = "#c00"
            },
            {
              d = "M70 10 L90 10 L90 12 L88 24 L72 24 L70 12 z",
              fill = "#fff"
            },
            {
              d = "M10 90 L10 88 L12 76 L28 76 L30 88 L30 90 z",
              fill = "#fff"
            },
            {
              d = "M70 90 L70 88 L72 76 L88 76 L90 88 L90 90 z",
              fill = "#c00"
            }
          }
        }

        local shapes = Classifier.classifySvg(svgEntry)
        setOutput(table.concat({
          tostring(shapes[1] and shapes[1].role or "nil"),
          tostring(shapes[2] and shapes[2].role or "nil"),
          tostring(shapes[3] and shapes[3].role or "nil"),
          tostring(shapes[4] and shapes[4].role or "nil"),
          tostring(shapes[5] and shapes[5].role or "nil")
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-logo-segment-family.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("frame_outline|logo_segment|logo_segment|logo_segment|logo_segment");
  });

  it("does not assign logo_segment when the mirrored quadrant family is incomplete", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-logo-segment-incomplete.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local svgEntry = {
          viewBox = "0 0 100 100",
          items = {
            {
              d = "M0 0 L100 0 L100 100 L0 100 L0 0.1 M15 15 L85 15 L85 85 L15 85 L15 15.1",
              fill = "#555"
            },
            {
              d = "M10 10 L30 10 L30 12 L28 24 L12 24 L10 12 z",
              fill = "#c00"
            },
            {
              d = "M70 10 L90 10 L90 12 L88 24 L72 24 L70 12 z",
              fill = "#fff"
            },
            {
              d = "M70 90 L70 88 L72 76 L88 76 L90 88 L90 90 z",
              fill = "#c00"
            }
          }
        }

        local shapes = Classifier.classifySvg(svgEntry)
        setOutput(table.concat({
          tostring(shapes[2] and shapes[2].role or "nil"),
          tostring(shapes[3] and shapes[3].role or "nil"),
          tostring(shapes[4] and shapes[4].role or "nil")
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-logo-segment-incomplete.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("nil|nil|nil");
  });

  it("keeps groupHints split when identical geometry has different roles", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/classifier-role-aware-groups.lua": `
        local Classifier = require("lib.SvgShapeClassifier")
        local svgEntry = {
          viewBox = "0 0 100 100",
          items = {
            {
              d = "M0 0 L100 0 L100 100 L0 100 L0 0.1 M20 20 L80 20 L80 80 L20 80 L20 20.1",
              fill = "#888"
            },
            {
              d = "M10 2 L90 2 L98 10 L98 90 L90 98 L10 98 L2 90 L2 10 z",
              fill = "#000c"
            },
            {
              d = "M0 2 L80 2 L88 10 L88 90 L80 98 L0 98 L-8 90 L-8 10 z",
              fill = "#000c"
            }
          }
        }

        local shapes = Classifier.classifySvg(svgEntry)
        local second = shapes[2]
        local third = shapes[3]

        setOutput(table.concat({
          tostring(second.role),
          tostring(second.groupHints and second.groupHints.sameCluster),
          tostring(third.role),
          tostring(third.groupHints and third.groupHints.sameCluster)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-role-aware-groups.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("frame_cap|nil|nil|nil");
  });

  it("assigns logo_segment to the mirrored SimpleSign corner fragments without sweeping in the rings", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/classifier-logo-segment-simplesign.lua": `
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetOutput = "missing"

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width == "20vw" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            targetOutput = table.concat({
              tostring(shapes[1] and shapes[1].role or "nil"),
              tostring(shapes[2] and shapes[2].role or "nil"),
              tostring(shapes[3] and shapes[3].role or "nil"),
              tostring(shapes[4] and shapes[4].role or "nil"),
              tostring(shapes[5] and shapes[5].role or "nil"),
              tostring(shapes[6] and shapes[6].role or "nil"),
              tostring(shapes[8] and shapes[8].role or "nil"),
              tostring(shapes[9] and shapes[9].role or "nil")
            }, "|")
            break
          end
        end

        setOutput(targetOutput)
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-logo-segment-simplesign.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("logo_segment|logo_segment|nil|nil|logo_segment|logo_segment|nil|nil");
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
        local html = require("lib.SimpleSignS_html")
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

  it("classifies real SimpleSign marker rings as polygon_ring", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/classifier-marker-ring.lua": `
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local target

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.id == "master-artboard" then
            for _, item in ipairs(svg.items or {}) do
              if item.d == "m373 430c0-4.8-3.9-8.6-8.6-8.6s-8.6 3.9-8.6 8.6 3.9 8.6 8.6 8.6 8.6-3.8 8.6-8.6zm-14 0c0-3.1 2.5-5.6 5.6-5.6s5.6 2.5 5.6 5.6-2.5 5.6-5.6 5.6-5.6-2.5-5.6-5.6z" then
                target = item
                break
              end
            end
          end
        end

        local shape = Classifier.classifyItem(target)
        setOutput(table.concat({
          shape.kind,
          tostring(shape.analysis.subpathCount),
          string.format("%.3f", shape.geometry.bounds.w),
          string.format("%.3f", shape.geometry.bounds.h)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-marker-ring.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("polygon_ring|2|17.200|17.200");
  });

  it("assigns group hints to repeated real SimpleSign marker rings", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/classifier-group-hints-simplesign.lua": `
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetHints

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.id == "master-artboard" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            targetHints = shapes[102] and shapes[102].groupHints
            break
          end
        end

        setOutput(table.concat({
          targetHints and tostring(string.find(targetHints.sameCluster or "", "polygon_ring_cluster_", 1, true) == 1) or "false",
          tostring(targetHints and targetHints.clusterSize or 0),
          targetHints and tostring(targetHints.neighbors and targetHints.neighbors[1] or 0) or "nil",
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-group-hints-simplesign.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|23|103");
  });

  it("classifies real SimpleSign hex rings as hex_ring", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/classifier-simplesign-hex-ring.lua": `
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local target

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "20vw", 1, true) then
            for _, item in ipairs(svg.items or {}) do
              if item.d == "m15804 11308-495.6-286.4v-572.3l495.6-286.4 496 286.4v572.3l-496 286.4m0-61.2 442.9-255.8v-511l-442.9-255.8-442.6 255.7v511.1l442.6 255.8" then
                target = item
                break
              end
            end
          end
        end

        local shape = Classifier.classifyItem(target)
        setOutput(table.concat({
          shape.kind,
          tostring(shape.analysis.subpathCount),
          tostring(shape.geometry.subpaths[1] and shape.geometry.subpaths[1].pointCount or 0),
          tostring(shape.geometry.subpaths[2] and shape.geometry.subpaths[2].pointCount or 0)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/classifier-simplesign-hex-ring.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("hex_ring|2|6|6");
  });

  it("draws a classified SimpleSign hex_ring through the SilverZero adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-simplesign-hex-ring.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetSvg

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "20vw", 1, true) then
            targetSvg = svg
            break
          end
        end

        local shapes = Classifier.classifySvg(targetSvg, { vars = doc.vars })
        local targetShape
        for _, shape in ipairs(shapes) do
          if shape.kind == "hex_ring" then
            targetShape = shape
            break
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 248.17,
          sourceH = 286.55,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedShape(layer, layout, targetShape, {
          color = { 1, 1, 1, 1 }
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-simplesign-hex-ring.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|hex_ring");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(quads).toHaveLength(6);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("draws a classified SimpleSign board edge decal through the SilverZero adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-simplesign-board-edge.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
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
        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 231,
          sourceH = 156,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedShape(layer, layout, shape, {
          color = { 1, 1, 1, 1 }
        })
        setOutput(table.concat({
          tostring(drew),
          shape and shape.kind or "nil",
          shape and shape.role or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-simplesign-board-edge.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|quad|nil");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(quads).toHaveLength(1);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("draws a classified SimpleSign board highlight trapezoid through the SilverZero adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-simplesign-board-cap.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local target

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "80vw", 1, true) then
            for _, item in ipairs(svg.items or {}) do
              if item.d == "m836 84h566l37 35h-638l35-35" then
                target = item
                break
              end
            end
          end
        end

        local shape = Classifier.classifyItem(target)
        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 231,
          sourceH = 156,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedShape(layer, layout, shape, {
          color = { 1, 1, 1, 1 }
        })
        setOutput(table.concat({
          tostring(drew),
          shape and shape.kind or "nil",
          tostring(shape and shape.analysis and shape.analysis.pointCount or "nil")
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-simplesign-board-cap.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|trapezoid|4");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(quads).toHaveLength(1);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("draws a classified SimpleSign frame_cap polygon through the SilverZero adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-simplesign-frame-cap.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local target

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "80vw", 1, true) then
            target = svg.items and svg.items[1] or nil
            break
          end
        end

        local shape = Classifier.classifyItem(target)
        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 231,
          sourceH = 156,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedShape(layer, layout, shape, {
          color = { 1, 0, 0, 1 }
        })
        setOutput(table.concat({
          tostring(drew),
          shape and shape.kind or "nil",
          tostring(shape and shape.analysis and shape.analysis.pointCount or "nil")
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-simplesign-frame-cap.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|closed_polygon|32");
    const triangles = buffer.commands.filter((command) => command.op === "AddTriangle");
    expect(triangles).toHaveLength(30);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("draws a classified SimpleSign logo_segment polygon through the SilverZero adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-simplesign-logo-segment.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetShape

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width == "20vw" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            for _, shape in ipairs(shapes) do
              if shape.role == "logo_segment" then
                targetShape = shape
                break
              end
            end
            break
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 248.17,
          sourceH = 286.55,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedShape(layer, layout, targetShape, {
          color = { 1, 1, 1, 1 }
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil",
          targetShape and targetShape.role or "nil",
          tostring(targetShape and targetShape.analysis and targetShape.analysis.pointCount or "nil")
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-simplesign-logo-segment.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|closed_polygon|logo_segment|10");
    const triangles = buffer.commands.filter((command) => command.op === "AddTriangle");
    expect(triangles).toHaveLength(8);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("draws a fill-capable SimpleSign logo shape through the fill-only adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-fill-logo-segment.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetShape

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width == "20vw" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            for _, shape in ipairs(shapes) do
              if shape.role == "logo_segment" then
                targetShape = shape
                break
              end
            end
            break
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 248.17,
          sourceH = 286.55,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedFillShape(layer, layout, targetShape, {
          color = { 1, 1, 1, 1 }
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil",
          targetShape and targetShape.role or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-fill-logo-segment.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|closed_polygon|logo_segment");
    const triangles = buffer.commands.filter((command) => command.op === "AddTriangle");
    expect(triangles).toHaveLength(8);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("fills implicitly closed SimpleSign logo outline shapes in the fill-only adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-fill-logo-outline.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetShape

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width == "20vw" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            for _, shape in ipairs(shapes) do
              if shape.kind == "outline_path" then
                targetShape = shape
                break
              end
            end
            break
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 248.17,
          sourceH = 286.55,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedFillShape(layer, layout, targetShape, {
          color = { 1, 1, 1, 1 },
          strokeWidth = 2.0,
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil",
          targetShape and targetShape.role or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-fill-logo-outline.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|outline_path|edge_decal");
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
    expect(
      buffer.commands.some((command) => command.op === "AddQuad")
      || buffer.commands.some((command) => command.op === "AddTriangle"),
    ).toBe(true);
  });

  it("fills the right-side SimpleSign logo highlight bar through the fill-only adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-fill-logo-right-bar.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetShape

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width == "20vw" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            for itemIndex, item in ipairs(svg.items or {}) do
              if item.d == "m16295 10363-169.8-98.1-0.6-519.94-0.2-519.45 0.8-0.6 169.8-98.08 4.8-2.71v1240.1l-4.8-1.2" then
                targetShape = shapes[itemIndex]
                break
              end
            end
            break
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 248.17,
          sourceH = 286.55,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedFillShape(layer, layout, targetShape, {
          color = { 1, 1, 1, 1 },
          strokeWidth = 2.0,
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil",
          targetShape and targetShape.role or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-fill-logo-right-bar.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|outline_path|edge_decal");
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
    expect(
      buffer.commands.some((command) => command.op === "AddQuad")
      || buffer.commands.some((command) => command.op === "AddTriangle"),
    ).toBe(true);
  });

  it("draws an outline_path through the stroke-only adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/draw-classified-stroke-outline.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M-14 10 L-8 -8 L0 -2 L8 -12 L14 -4",
          fill = "#fff",
        })
        local layer = createLayer()
        local layout = {
          screenW = 100,
          screenH = 100,
          sourceW = 100,
          sourceH = 100,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedStrokeShape(layer, layout, shape, {
          color = { 1, 1, 1, 1 },
          strokeWidth = 2,
        })
        setOutput(table.concat({
          tostring(drew),
          shape and shape.kind or "nil",
          tostring(shape and shape.analysis and shape.analysis.pointCount or 0)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-stroke-outline.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|outline_path|5");
    const lines = buffer.commands.filter((command) => command.op === "AddLine");
    expect(lines).toHaveLength(4);
    expect(buffer.commands.some((command) => command.op === "AddQuad")).toBe(false);
    expect(buffer.commands.some((command) => command.op === "AddTriangle")).toBe(false);
  });

  it("draws the left SimpleSign board edge decal through the generic adapter as a filled quad", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-left-board-edge.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local target

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "80vw", 1, true) then
            for _, item in ipairs(svg.items or {}) do
              if item.d == "m42 111v38l29 34v-38" then
                target = item
                break
              end
            end
          end
        end

        local shape = Classifier.classifyItem(target)
        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 231,
          sourceH = 156,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedShape(layer, layout, shape, {
          color = { 1, 1, 1, 1 },
          strokeWidth = 2.5,
        })
        setOutput(table.concat({
          tostring(drew),
          shape and shape.kind or "nil",
          shape and shape.role or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-left-board-edge.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|outline_path|nil");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(quads).toHaveLength(1);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("draws the left SimpleSign board edge decal through the classified path-item helper", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-path-item-board-edge.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetItem

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "80vw", 1, true) then
            for _, item in ipairs(svg.items or {}) do
              if item.d == "m42 111v38l29 34v-38" then
                targetItem = item
                break
              end
            end
          end
        end

        local shape = Classifier.classifyItem(targetItem)
        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 231,
          sourceH = 156,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedPathItem(layer, layout, targetItem, shape, {
          classifiedMode = "shape",
          color = { 1, 1, 1, 1 },
          strokeWidth = 2.5,
          fallbackFirstSubpathOnly = true,
        })
        setOutput(table.concat({
          tostring(drew),
          shape and shape.kind or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-path-item-board-edge.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|outline_path");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(quads).toHaveLength(1);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("fills implicitly closed logo outline shapes through the classified path-item helper", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-path-item-logo-outline.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetItem
        local targetShape

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width == "20vw" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            for itemIndex, shape in ipairs(shapes) do
              if shape.kind == "outline_path" then
                targetItem = svg.items[itemIndex]
                targetShape = shape
                break
              end
            end
            break
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 248.17,
          sourceH = 286.55,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedPathItem(layer, layout, targetItem, targetShape, {
          classifiedMode = "fill",
          color = { 1, 1, 1, 1 },
          strokeWidth = 2.0,
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil",
          targetShape and targetShape.role or "nil"
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-path-item-logo-outline.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|outline_path|edge_decal");
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
    expect(
      buffer.commands.some((command) => command.op === "AddQuad")
      || buffer.commands.some((command) => command.op === "AddTriangle"),
    ).toBe(true);
  });

  it("draws a real master-artboard polygon_ring through the classified path-item helper", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-path-item-master-ring.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetItem
        local targetShape

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.id == "master-artboard" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            for itemIndex, shape in ipairs(shapes) do
              if shape.kind == "polygon_ring" then
                targetItem = svg.items[itemIndex]
                targetShape = shape
                break
              end
            end
            break
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 1400,
          screenH = 980,
          sourceW = 1400,
          sourceH = 980,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedPathItem(layer, layout, targetItem, targetShape, {
          classifiedMode = "fill",
          color = { 1, 1, 1, 1 },
          strokeWidth = 1.8,
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil",
          tostring(targetShape and targetShape.analysis and targetShape.analysis.pointCount or "nil")
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-path-item-master-ring.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|polygon_ring|48");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(quads).toHaveLength(24);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("falls back to raw path drawing when classified path-item kinds are filtered out", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/draw-classified-path-item-kind-filter.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Classifier = require("lib.SvgShapeClassifier")
        local item = {
          d = "M0 0 L10 0 L10 10 L0 10 z M3 3 L7 3 L7 7 L3 7 z",
          fill = "#fff",
        }
        local shape = Classifier.classifyItem(item)
        local layer = createLayer()
        local layout = {
          screenW = 100,
          screenH = 100,
          sourceW = 100,
          sourceH = 100,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedPathItem(layer, layout, item, shape, {
          classifiedMode = "fill",
          classifiedKinds = { "hex_ring" },
          color = { 1, 1, 1, 1 },
          strokeWidth = 1,
        })
        setOutput(table.concat({
          tostring(drew),
          shape.kind
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-path-item-kind-filter.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|polygon_ring");
    const lines = buffer.commands.filter((command) => command.op === "AddLine");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(lines).toHaveLength(6);
    expect(quads).toHaveLength(0);
  });

  it("draws a real master-artboard trapezoid through the classified path-item helper when the kind is allowed", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-path-item-master-trapezoid.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetItem
        local targetShape

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.id == "master-artboard" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            for itemIndex, shape in ipairs(shapes) do
              if shape.kind == "trapezoid" then
                targetItem = svg.items[itemIndex]
                targetShape = shape
                break
              end
            end
            break
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 1400,
          screenH = 980,
          sourceW = 1400,
          sourceH = 980,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedPathItem(layer, layout, targetItem, targetShape, {
          classifiedMode = "fill",
          classifiedKinds = { "polygon_ring", "quad", "trapezoid" },
          color = { 1, 1, 1, 1 },
          strokeWidth = 1.8,
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil",
          tostring(targetShape and targetShape.analysis and targetShape.analysis.pointCount or "nil")
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-path-item-master-trapezoid.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|trapezoid|4");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(quads).toHaveLength(1);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("draws a compound_path through the stroke-only adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/draw-classified-stroke-compound.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 0 L4 0 L4 4 L0 4 z M8 0 L12 0 L12 4 L8 4 z",
          fill = "#fff",
        })
        local layer = createLayer()
        local layout = {
          screenW = 100,
          screenH = 100,
          sourceW = 100,
          sourceH = 100,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedStrokeShape(layer, layout, shape, {
          color = { 1, 1, 1, 1 },
          strokeWidth = 1,
        })
        setOutput(table.concat({
          tostring(drew),
          shape and shape.kind or "nil",
          tostring(shape and shape.analysis and shape.analysis.subpathCount or 0)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-stroke-compound.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|compound_path|2");
    const lines = buffer.commands.filter((command) => command.op === "AddLine");
    expect(lines).toHaveLength(8);
  });

  it("draws a classified polygon_ring through the SilverZero adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/draw-classified-polygon-ring.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 0 L10 0 L10 10 L0 10 z M3 3 L7 3 L7 7 L3 7 z",
          fill = "#fff",
        })
        local layer = createLayer()
        local layout = {
          screenW = 100,
          screenH = 100,
          sourceW = 100,
          sourceH = 100,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedShape(layer, layout, shape, {
          color = { 1, 1, 1, 1 }
        })
        setOutput(table.concat({
          tostring(drew),
          shape.kind,
          tostring(shape.analysis.subpathCount)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-polygon-ring.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|polygon_ring|2");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(quads).toHaveLength(4);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("draws a classified SimpleSign marker polygon_ring through the SilverZero adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-simplesign-marker-ring.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetShape

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.id == "master-artboard" then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            for _, shape in ipairs(shapes) do
              if shape.kind == "polygon_ring" then
                targetShape = shape
                break
              end
            end
            break
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 1400,
          screenH = 980,
          sourceW = 1400,
          sourceH = 980,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedShape(layer, layout, targetShape, {
          color = { 1, 1, 1, 1 }
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil",
          tostring(targetShape and targetShape.analysis and targetShape.analysis.pointCount or "nil")
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-simplesign-marker-ring.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|polygon_ring|48");
    const quads = buffer.commands.filter((command) => command.op === "AddQuad");
    expect(quads).toHaveLength(24);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(false);
  });

  it("draws a disjoint closed compound_path through the SilverZero adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/tests/draw-classified-compound-disjoint.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Classifier = require("lib.SvgShapeClassifier")
        local shape = Classifier.classifyItem({
          d = "M0 0 L4 0 L4 4 L0 4 z M8 0 L12 0 L12 4 L8 4 z",
          fill = "#fff",
        })
        local layer = createLayer()
        local layout = {
          screenW = 100,
          screenH = 100,
          sourceW = 100,
          sourceH = 100,
          scale = 1,
          x = 0,
          y = 0,
        }

        local expectedLines = 0
        for _, subpath in ipairs(shape.geometry and shape.geometry.subpaths or {}) do
          expectedLines = expectedLines + math.max(0, #(subpath.points or {}) - 1)
          if subpath.closed then
            expectedLines = expectedLines + 1
          end
        end

        local drew = SZ.drawClassifiedShape(layer, layout, shape, {
          color = { 1, 1, 1, 1 },
          strokeWidth = 1,
        })
        setOutput(table.concat({
          tostring(drew),
          shape.kind,
          tostring(shape.analysis.subpathCount),
          tostring(expectedLines)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-compound-disjoint.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|compound_path|2|8");
    const lines = buffer.commands.filter((command) => command.op === "AddLine");
    expect(lines).toHaveLength(8);
  });

  it("draws a classified SimpleSign board compound edge decal through the SilverZero adapter", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver({
      "lib/SilverZeroRsLib.lua": silverZeroLibSource,
      "lib/SvgParser.lua": svgParserSource,
      "lib/SvgShapeClassifier.lua": svgShapeClassifierSource,
      "examples/SilverZero/SimpleSignS_html.lua": simpleSignSHtmlSource,
      "examples/SilverZero/tests/draw-classified-simplesign-board-compound-edge.lua": `
        local SZ = require("lib.SilverZeroRsLib")
        local Parser = require("lib.SvgParser")
        local Classifier = require("lib.SvgShapeClassifier")
        local html = require("lib.SimpleSignS_html")
        local doc = Parser.parse(html)
        local targetShape

        for _, svg in ipairs(doc.svgs or {}) do
          if svg.width and string.find(svg.width, "80vw", 1, true) then
            local shapes = Classifier.classifySvg(svg, { vars = doc.vars })
            for _, shape in ipairs(shapes) do
              if shape.kind == "compound_path" and shape.role == "edge_decal" then
                targetShape = shape
                break
              end
            end
            break
          end
        end

        local expectedLines = 0
        for _, subpath in ipairs(targetShape and targetShape.geometry and targetShape.geometry.subpaths or {}) do
          expectedLines = expectedLines + math.max(0, #(subpath.points or {}) - 1)
          if subpath.closed then
            expectedLines = expectedLines + 1
          end
        end

        local layer = createLayer()
        local layout = {
          screenW = 300,
          screenH = 300,
          sourceW = 231,
          sourceH = 156,
          scale = 1,
          x = 0,
          y = 0,
        }

        local drew = SZ.drawClassifiedShape(layer, layout, targetShape, {
          color = { 1, 1, 1, 1 },
          strokeWidth = 2.5,
        })
        setOutput(table.concat({
          tostring(drew),
          targetShape and targetShape.kind or "nil",
          targetShape and targetShape.role or "nil",
          tostring(expectedLines)
        }, "|"))
      `,
    }));

    const result = await executeLuaFile(env, "examples/SilverZero/tests/draw-classified-simplesign-board-compound-edge.lua");

    expect(result.success).toBe(true);
    expect(result.output).toBe("true|compound_path|edge_decal|14");
    const lines = buffer.commands.filter((command) => command.op === "AddLine");
    expect(lines).toHaveLength(14);
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
    const logoLayer = buffer.layerOrder[2];
    const logoCommandCounts = buffer.commands.reduce<Record<string, number>>((counts, command) => {
      if (command.layer === logoLayer) {
        counts[command.op] = (counts[command.op] ?? 0) + 1;
      }
      return counts;
    }, {});

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(0);
    expect(logoCommandCounts.AddLine ?? 0).toBe(99);
    expect(logoCommandCounts.AddQuad ?? 0).toBe(0);
    expect(logoCommandCounts.AddTriangle ?? 0).toBe(0);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBox")).toBe(true);
  });

  it("renders SimpleSignS-svg with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/SimpleSignS-svg.lua");
    const commandCounts = buffer.commands.reduce<Record<string, number>>((counts, command) => {
      counts[command.op] = (counts[command.op] ?? 0) + 1;
      return counts;
    }, {});
    const renderCommandCount = buffer.commands.filter((command) => command.op.startsWith("Add")).length;
    const logoLayer = buffer.layerOrder[2];
    const logoCommandCounts = buffer.commands.reduce<Record<string, number>>((counts, command) => {
      if (command.layer === logoLayer) {
        counts[command.op] = (counts[command.op] ?? 0) + 1;
      }
      return counts;
    }, {});

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(0);
    expect(renderCommandCount).toBe(4878);
    expect(commandCounts.AddBox ?? 0).toBe(1);
    expect(commandCounts.AddLine ?? 0).toBe(4213);
    expect(commandCounts.AddQuad ?? 0).toBe(589);
    expect(commandCounts.AddTriangle ?? 0).toBe(74);
    expect(commandCounts.AddText ?? 0).toBe(1);
    expect(logoCommandCounts.AddLine ?? 0).toBe(667);
    expect(logoCommandCounts.AddQuad ?? 0).toBe(18);
    expect(logoCommandCounts.AddTriangle ?? 0).toBe(44);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddQuad")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddTriangle")).toBe(true);
  });

  it("renders SimpleSignXS with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/SimpleSignXS.lua");
    const commandCounts = buffer.commands.reduce<Record<string, number>>((counts, command) => {
      counts[command.op] = (counts[command.op] ?? 0) + 1;
      return counts;
    }, {});
    const renderCommandCount = buffer.commands.filter((command) => command.op.startsWith("Add")).length;

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(0);
    expect(renderCommandCount).toBe(142);
    expect(commandCounts.AddBox ?? 0).toBe(1);
    expect(commandCounts.AddLine ?? 0).toBe(124);
    expect(commandCounts.AddQuad ?? 0).toBe(16);
    expect(commandCounts.AddText ?? 0).toBe(1);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
  });

  it("renders ShapeAdapterProbe with labeled classified adapter coverage", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/ShapeAdapterProbe.lua");

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(0);
    expect(result.output).toBe(
      "hex_fill=hex_ring|fill|adapter;poly_fill=polygon_ring|fill|adapter;trap_fill=trapezoid|fill|adapter;poly_closed=closed_polygon|fill|adapter;compound_stk=compound_path|stroke|adapter;outline_stk=outline_path|stroke|adapter;board_trap=trapezoid|fill|adapter;board_quad=quad|fill|adapter;board_ofill=outline_path|fill|adapter;board_ostrk=outline_path|stroke|adapter;board_cshape=compound_path|shape|adapter;board_cfill=compound_path|fill|fallback",
    );
    const textCommands = buffer.commands.filter((command) => command.op === "AddText");
    expect(textCommands.length).toBeGreaterThanOrEqual(14);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddQuad")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddTriangle")).toBe(true);
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
    const textCommands = buffer.commands.filter((command) => command.op === "AddText");
    const findText = (text: string) => textCommands.find((command) => command.text === text);
    const largestBox = buffer.commands
      .filter((command) => command.op === "AddBox")
      .sort((a, b) => (b.w * b.h) - (a.w * a.h))[0];
    const titleTexts = ["Terran", "Battlecruiser", "\"Hyperion\"", "MK1"]
      .map((text) => findText(text))
      .filter((command): command is NonNullable<typeof command> => command != null);
    const uniqueFontSizes = new Set(buffer.fonts.map((font) => font.size));

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(0);
    expect(buffer.commands.some((command) => command.op === "AddText")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddQuad")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddTriangle")).toBe(true);
    expect(titleTexts).toHaveLength(4);
    expect(Math.max(...titleTexts.map((command) => command.x)) - Math.min(...titleTexts.map((command) => command.x))).toBeLessThan(2);
    expect(titleTexts.map((command) => command.y)).toEqual([...titleTexts.map((command) => command.y)].sort((a, b) => a - b));
    expect(findText("10,000,000")).toBeDefined();
    expect(findText("ħ")).toBeDefined();
    expect(findText("ħ")?.x).toBeGreaterThan(findText("10,000,000")!.x);
    expect(findText("ħ")?.y).toBeLessThan(findText("10,000,000")!.y);
    expect(findText("DISPENSER")).toBeUndefined();
    expect(findText("Static promotional layout")).toBeUndefined();
    expect(findText("SALE")).toBeUndefined();
    expect(uniqueFontSizes.size).toBeGreaterThanOrEqual(2);
    expect(largestBox?.w).toBeGreaterThan(200);
    expect(largestBox?.h).toBeGreaterThan(200);
    expect(largestBox?.x).toBeGreaterThan(findText("\"Hyperion\"")!.x);
    expect(largestBox?.y).toBeLessThan(findText("\"Hyperion\"")!.y);
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
    const textCommands = buffer.commands.filter((command) => command.op === "AddText");
    const findText = (text: string) => textCommands.find((command) => command.text === text);
    const uniqueFontSizes = new Set(buffer.fonts.map((font) => font.size));

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(0);
    expect(textCommands.length).toBeGreaterThan(0);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddCircle")).toBe(true);
    expect(findText("Item")).toBeDefined();
    expect(findText("Amount")).toBeDefined();
    expect(findText("64%")).toBeDefined();
    expect(findText("CONTAINER SIGN")).toBeUndefined();
    expect(findText("STATE: LINKED")).toBeUndefined();
    expect(findText("SCROLL")).toBeUndefined();
    expect(findText("64%")?.x).toBeGreaterThan(findText("Amount")!.x);
    expect(uniqueFontSizes.size).toBeGreaterThanOrEqual(3);
  });

  it("renders ContainerHubHubM with SilverZero shared library", async () => {
    const buffer = new DrawBuffer();
    const env = createLuaEnvironment(buffer, createLuaFileResolver(silverZeroFileSources));

    const result = await executeLuaFile(env, "examples/SilverZero/ContainerHubHubM.lua");
    const textCommands = buffer.commands.filter((command) => command.op === "AddText");
    const topBarQuads = buffer.commands.filter(
      (command) => command.op === "AddQuad" && command.layer === 2 && Math.abs(command.y4 - command.y1) > 60,
    );
    const iconBoxes = buffer.commands.filter(
      (command) => command.op === "AddBoxRounded" && command.w > 120 && command.h > 120,
    );
    const findText = (text: string) => textCommands.find((command) => command.text === text);
    const fontSizeFor = (text: string) => {
      const command = findText(text);
      const font = buffer.fonts.find((entry) => entry.id === command?.fontId);
      return font?.size ?? 0;
    };

    expect(result.success).toBe(true);
    expect(result.requestAnimFrames).toBe(0);
    expect(textCommands.length).toBeGreaterThan(0);
    expect(buffer.commands.some((command) => command.op === "AddLine")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddQuad")).toBe(true);
    expect(buffer.commands.some((command) => command.op === "AddBoxRounded")).toBe(true);
    expect(textCommands.some((command) => command.text.includes("HUB"))).toBe(false);
    expect(textCommands.some((command) => command.text.includes("SCROLL"))).toBe(false);
    expect(fontSizeFor("53.1%")).toBeGreaterThanOrEqual(24);
    expect(fontSizeFor("478 / 900 KL")).toBeGreaterThanOrEqual(36);
    expect(fontSizeFor("478t")).toBeGreaterThanOrEqual(30);
    expect(fontSizeFor("800t")).toBeGreaterThanOrEqual(30);
    expect(topBarQuads.length).toBeGreaterThanOrEqual(5);

    const skewRatios = topBarQuads.map((command) => Math.abs((command.x1 - command.x4) / (command.y4 - command.y1)));
    expect(Math.min(...skewRatios)).toBeGreaterThan(0.45);
    expect(Math.max(...skewRatios) - Math.min(...skewRatios)).toBeLessThan(0.08);

    expect(iconBoxes.length).toBeGreaterThan(0);
    expect(findText("TA")?.x).toBeCloseTo(iconBoxes[0]!.x + iconBoxes[0]!.w * 0.5, 1);
    expect(findText("TA")?.y).toBeCloseTo(iconBoxes[0]!.y + iconBoxes[0]!.h * 0.5, 1);
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
    expect(result.requestAnimFrames).toBe(0);
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

    const result = await env.execute("local font = loadFont('RobotoMono', 20)\nlocal w, h = getTextBounds(font, 'Bottom HUD')\nsetOutput(string.format('%.1f,%.1f', w, h))");

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
