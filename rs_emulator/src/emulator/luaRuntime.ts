import { LuaFactory, type LuaEngine } from "wasmoon";
import { DrawBuffer } from "./drawBuffer";
import type { RuntimeFlags } from "../config/runtimeFlags";

export interface LuaExecResult {
  success: boolean;
  error?: string;
  logs: string[];
  output: string;
  requestAnimFrames: number;
}

export type LuaModuleResolver = (moduleName: string, fromModule?: string | null) => Promise<string | null>;

export interface LuaExecuteOptions {
  chunkLabel?: string;
}

const LUA_HOST_IO_DISABLED_ERROR = "Lua host I/O is disabled. Enable VITE_RS_ENABLE_LUA_HOST_IO=true to allow it.";

let factoryPromise: Promise<LuaFactory> | null = null;
const UTF8_BOM = "\uFEFF";

async function getFactory(): Promise<LuaFactory> {
  if (!factoryPromise) {
    factoryPromise = Promise.resolve(new LuaFactory());
  }
  return factoryPromise;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeLuaString(value: string): number[] {
  return Array.from(textEncoder.encode(value));
}

function decodeLuaString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value)) {
    return "";
  }
  return textDecoder.decode(Uint8Array.from(value.filter((item): item is number => typeof item === "number")));
}

function normalizeLuaSource(code: string): string {
  return code.startsWith(UTF8_BOM) ? code.slice(UTF8_BOM.length) : code;
}

function stripControlChars(value: string): string {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    const code = char.charCodeAt(0);
    if ((code >= 0 && code <= 31) || code === 127) {
      result += " ";
      continue;
    }
    result += char;
  }

  return result;
}

function normalizeChunkLabel(label?: string): string {
  const trimmed = stripControlChars(label?.trim() ?? "");
  if (!trimmed) {
    return "@session.lua";
  }
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function hasSourceLocation(message: string): boolean {
  return /:\d+(?::\d+)?/.test(message);
}

function extractRelevantStackLocation(stack: string): string | null {
  const lines = stack.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.includes(":")) {
      continue;
    }
    if (line === "Error" || line.startsWith("TypeError:") || line.startsWith("ReferenceError:")) {
      continue;
    }
    return line;
  }
  return null;
}

function formatExecutionError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const message = error.message || String(error);
  if (hasSourceLocation(message)) {
    return message;
  }

  const stackLocation = error.stack ? extractRelevantStackLocation(error.stack) : null;
  if (!stackLocation) {
    return message;
  }

  return `${message}\n${stackLocation}`;
}

async function installRuntime(lua: LuaEngine, buffer: DrawBuffer, runtimeFlags?: RuntimeFlags): Promise<void> {
  lua.global.set("createLayer", () => buffer.CreateLayer());

  lua.global.set("addBezier", (layer: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    buffer.AddBezier(layer, x1, y1, x2, y2, x3, y3);
  });
  lua.global.set("addBox", (layer: number, x: number, y: number, w: number, h: number) => {
    buffer.AddBox(layer, x, y, w, h);
  });
  lua.global.set("addBoxRounded", (layer: number, x: number, y: number, w: number, h: number, radius: number) => {
    buffer.AddBoxRounded(layer, x, y, w, h, radius);
  });
  lua.global.set("addCircle", (layer: number, x: number, y: number, radius: number) => {
    buffer.AddCircle(layer, x, y, radius);
  });
  lua.global.set("addLine", (layer: number, x1: number, y1: number, x2: number, y2: number) => {
    buffer.AddLine(layer, x1, y1, x2, y2);
  });
  lua.global.set("addQuad", (layer: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
    buffer.AddQuad(layer, x1, y1, x2, y2, x3, y3, x4, y4);
  });
  lua.global.set("addTriangle", (layer: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    buffer.AddTriangle(layer, x1, y1, x2, y2, x3, y3);
  });
  lua.global.set("__rsAddText", (layer: number, fontId: number, textBytes: unknown, x: number, y: number) => {
    buffer.AddText(layer, fontId, decodeLuaString(textBytes), x, y);
  });
  lua.global.set("addImage", (layer: number, imageId: number, x: number, y: number, w: number, h: number) => {
    buffer.AddImage(layer, imageId, x, y, w, h);
  });
  lua.global.set("addImageSub", (layer: number, imageId: number, x: number, y: number, w: number, h: number, subX: number, subY: number, subW: number, subH: number) => {
    buffer.AddImageSub(layer, imageId, x, y, w, h, subX, subY, subW, subH);
  });

  lua.global.set("setDefaultFillColor", (layer: number, shape: number, r: number, g: number, b: number, a: number) => {
    buffer.SetDefaultFillColor(layer, shape, r, g, b, a);
  });
  lua.global.set("setDefaultStrokeColor", (layer: number, shape: number, r: number, g: number, b: number, a: number) => {
    buffer.SetDefaultStrokeColor(layer, shape, r, g, b, a);
  });
  lua.global.set("setDefaultStrokeWidth", (layer: number, shape: number, width: number) => {
    buffer.SetDefaultStrokeWidth(layer, shape, width);
  });
  lua.global.set("setDefaultShadow", (layer: number, shape: number, radius: number, r: number, g: number, b: number, a: number) => {
    buffer.SetDefaultShadow(layer, shape, radius, r, g, b, a);
  });
  lua.global.set("setDefaultRotation", (layer: number, shape: number, rot: number) => {
    buffer.SetDefaultRotation(layer, shape, rot);
  });
  lua.global.set("setDefaultTextAlign", (layer: number, hor: number, ver: number) => {
    buffer.SetDefaultTextAlign(layer, hor, ver);
  });

  lua.global.set("setNextFillColor", (layer: number, r: number, g: number, b: number, a: number) => {
    buffer.SetNextFillColor(layer, r, g, b, a);
  });
  lua.global.set("setNextStrokeColor", (layer: number, r: number, g: number, b: number, a: number) => {
    buffer.SetNextStrokeColor(layer, r, g, b, a);
  });
  lua.global.set("setNextStrokeWidth", (layer: number, width: number) => {
    buffer.SetNextStrokeWidth(layer, width);
  });
  lua.global.set("setNextShadow", (layer: number, radius: number, r: number, g: number, b: number, a: number) => {
    buffer.SetNextShadow(layer, radius, r, g, b, a);
  });
  lua.global.set("setNextRotation", (layer: number, rot: number) => {
    buffer.SetNextRotation(layer, rot);
  });
  lua.global.set("setNextRotationDegrees", (layer: number, deg: number) => {
    buffer.SetNextRotationDegrees(layer, deg);
  });
  lua.global.set("setNextTextAlign", (layer: number, hor: number, ver: number) => {
    buffer.SetNextTextAlign(layer, hor, ver);
  });

  lua.global.set("setLayerClipRect", (layer: number, x: number, y: number, w: number, h: number) => {
    buffer.SetLayerClipRect(layer, x, y, w, h);
  });
  lua.global.set("setLayerOrigin", (layer: number, x: number, y: number) => {
    buffer.SetLayerOrigin(layer, x, y);
  });
  lua.global.set("setLayerRotation", (layer: number, rot: number) => {
    buffer.SetLayerRotation(layer, rot);
  });
  lua.global.set("setLayerScale", (layer: number, sx: number, sy: number) => {
    buffer.SetLayerScale(layer, sx, sy);
  });
  lua.global.set("setLayerTranslation", (layer: number, tx: number, ty: number) => {
    buffer.SetLayerTranslation(layer, tx, ty);
  });

  lua.global.set("__rsGetCursor", (): [number, number] => buffer.GetCursor());
  lua.global.set("getCursorDown", () => buffer.GetCursorDown());
  lua.global.set("getCursorPressed", () => buffer.GetCursorPressed());
  lua.global.set("getCursorReleased", () => buffer.GetCursorReleased());
  lua.global.set("getDeltaTime", () => buffer.GetDeltaTime());
  lua.global.set("getTime", () => buffer.GetTime());
  lua.global.set("__rsGetInput", () => encodeLuaString(buffer.GetInput()));
  lua.global.set("__rsGetLocale", () => encodeLuaString(buffer.GetLocale()));
  lua.global.set("getRenderCost", () => buffer.GetRenderCost());
  lua.global.set("getRenderCostMax", () => buffer.GetRenderCostMax());
  lua.global.set("__rsGetResolution", (): [number, number] => buffer.GetResolution());
  lua.global.set("__rsGetTextBounds", (fontId: number, textBytes: unknown): [number, number] => {
    return buffer.GetTextBounds(fontId, decodeLuaString(textBytes));
  });

  lua.global.set("__rsLoadFont", (nameBytes: unknown, size: number) => buffer.LoadFont(decodeLuaString(nameBytes), size));
  lua.global.set("getFontSize", (fontId: number) => buffer.GetFontSize(fontId));
  lua.global.set("setFontSize", (fontId: number, size: number) => buffer.SetFontSize(fontId, size));
  lua.global.set("__rsGetFontMetrics", (fontId: number): [number, number] => buffer.GetFontMetrics(fontId));
  lua.global.set("getAvailableFontCount", () => buffer.GetAvailableFontCount());
  lua.global.set("__rsGetAvailableFontName", (index: number) => encodeLuaString(buffer.GetAvailableFontName(index)));

  lua.global.set("__rsLoadImage", (urlBytes: unknown) => buffer.LoadImage(decodeLuaString(urlBytes)));
  lua.global.set("isImageLoaded", (imageId: number) => buffer.IsImageLoaded(imageId));
  lua.global.set("__rsGetImageSize", (imageId: number): [number, number] => buffer.GetImageSize(imageId));

  lua.global.set("setBackgroundColor", (r: number, g: number, b: number) => buffer.SetBackgroundColor(r, g, b));
  lua.global.set("__rsSetOutput", (outputBytes: unknown) => buffer.SetOutput(decodeLuaString(outputBytes)));
  lua.global.set("__rsLogMessage", (messageBytes: unknown) => buffer.Log(decodeLuaString(messageBytes)));
  lua.global.set("requestAnimationFrame", (frames: number) => buffer.RequestAnimationFrame(frames));
  await lua.doString(`
    package.preload["native/Vec2"] = function()
      local Vec2 = {}
      Vec2.__index = Vec2
      function Vec2.New(x, y)
        return setmetatable({x = x, y = y}, Vec2)
      end
      function Vec2:__tostring()
        return "Vec2(" .. self.x .. ", " .. self.y .. ")"
      end
      return Vec2
    end

    package.loaded["native/Vec2"] = nil
    Vec2 = require("native/Vec2")

    local function unpackPair(value)
      return value[1], value[2]
    end

    local function stringToBytes(value)
      local out = {}
      local text = tostring(value or "")
      for index = 1, #text do
        out[index] = string.byte(text, index)
      end
      return out
    end

    local function bytesToString(bytes)
      if bytes == nil then
        return ""
      end

      local out = {}
      local index = 1
      while bytes[index] ~= nil do
        out[index] = string.char(bytes[index])
        index = index + 1
      end
      return table.concat(out)
    end

    function addText(layer, font, text, x, y)
      return __rsAddText(layer, font, stringToBytes(text), x, y)
    end

    function getCursor()
      return unpackPair(__rsGetCursor())
    end

    function getResolution()
      return unpackPair(__rsGetResolution())
    end

    function getTextBounds(font, text)
      return unpackPair(__rsGetTextBounds(font, stringToBytes(text)))
    end

    function getFontMetrics(font)
      return unpackPair(__rsGetFontMetrics(font))
    end

    function getInput()
      return bytesToString(__rsGetInput())
    end

    function getLocale()
      return bytesToString(__rsGetLocale())
    end

    function loadFont(name, size)
      return __rsLoadFont(stringToBytes(name), size)
    end

    function getAvailableFontName(index)
      return bytesToString(__rsGetAvailableFontName(index))
    end

    function loadImage(url)
      return __rsLoadImage(stringToBytes(url))
    end

    function getImageSize(image)
      return unpackPair(__rsGetImageSize(image))
    end

    function setOutput(output)
      return __rsSetOutput(stringToBytes(output))
    end

    function logMessage(message)
      return __rsLogMessage(stringToBytes(message))
    end

    function include(name)
      local source = __rsIncludedSources and __rsIncludedSources[name]
      if not source then
        error("include not found: " .. tostring(name), 2)
      end

      local chunk, err = load(source, "@" .. tostring(name) .. ".lua", "t", _ENV)
      if not chunk then
        error(err, 2)
      end

      return chunk()
    end

    local function createLoadedFont(id)
      local font = { __id = id }
      font.GetID = function(_)
        return font.__id
      end
      return font
    end

    local function resolveFontId(font)
      if type(font) == "table" and type(font.GetID) == "function" then
        return font.GetID(font)
      end
      return font
    end

    function __rsWrapRenderScriptModule(module)
      if type(module) ~= "table" then
        return module
      end

      if type(module.Instance) ~= "function" and type(module.new) == "function" then
        module.Instance = function(...)
          return module:new(nil, ...)
        end
      end

      if type(module.Instance) ~= "function" then
        return module
      end

      local rawInstance = module.Instance

      function module.Instance(...)
        local instance = rawInstance(...)
        if instance.__rsCompatWrapped then
          return instance
        end

        for key, value in pairs(module) do
          if type(key) == "string" and type(value) == "function" then
            local compatKey = key:gsub("^%l", string.upper)
            if compatKey ~= key and instance[compatKey] == nil and type(instance[key]) == "function" then
              instance[compatKey] = function(...)
                return instance[key](instance, ...)
              end
            end
          end
        end

        local rawLoadFont = instance.LoadFont
        local rawAddText = instance.AddText
        local rawGetTextBounds = instance.GetTextBounds
        local rawGetFontSize = instance.GetFontSize
        local rawSetFontSize = instance.SetFontSize
        local rawGetFontMetrics = instance.GetFontMetrics
        local imageHandleCache = {}

        instance.LoadFont = function(name, size)
          return createLoadedFont(rawLoadFont(name, size))
        end

        instance.AddText = function(layer, font, text, x, y)
          return rawAddText(layer, resolveFontId(font), text, x, y)
        end

        instance.GetTextBounds = function(font, text)
          if type(font) == "table" and type(font.GetID) == "function" then
            return rawGetTextBounds(font, text)
          end

          local width, height = _ENV.getTextBounds(resolveFontId(font), text or "")
          return Vec2.New(width, height)
        end

        instance.GetFontSize = function(font)
          return rawGetFontSize(resolveFontId(font))
        end

        instance.SetFontSize = function(font, size)
          return rawSetFontSize(resolveFontId(font), size)
        end

        instance.GetFontMetrics = function(font)
          return rawGetFontMetrics(resolveFontId(font))
        end

        if type(instance.LoadImage) == "function" then
          local rawLoadImage = instance.LoadImage
          local compatLoadImage = function(path)
            local cacheKey = tostring(path or "")
            local cachedHandle = imageHandleCache[cacheKey]
            if cachedHandle ~= nil then
              return cachedHandle
            end

            local wrapperHandle = rawLoadImage(path)
            if type(wrapperHandle) == "number" and wrapperHandle ~= 0 then
              imageHandleCache[cacheKey] = wrapperHandle
              return wrapperHandle
            end

            local nativeHandle = _ENV.loadImage(path)
            imageHandleCache[cacheKey] = nativeHandle
            return nativeHandle
          end

          instance.LoadImage = compatLoadImage
        end

        instance.__rsCompatWrapped = true
        return instance
      end

      return module
    end

    RSShape = {
      Bezier = 0, Box = 1, BoxRounded = 2, Circle = 3,
      Image = 4, Line = 5, Polygon = 6, Text = 7,
    }
    RSAlignHor = { Left = 0, Center = 1, Right = 2 }
    RSAlignVer = { Top = 0, Middle = 1, Bottom = 2, Baseline = 3 }

    Shape_Bezier = RSShape.Bezier
    Shape_Box = RSShape.Box
    Shape_BoxRounded = RSShape.BoxRounded
    Shape_Circle = RSShape.Circle
    Shape_Image = RSShape.Image
    Shape_Line = RSShape.Line
    Shape_Polygon = RSShape.Polygon
    Shape_Text = RSShape.Text

    AlignH_Left = RSAlignHor.Left
    AlignH_Center = RSAlignHor.Center
    AlignH_Right = RSAlignHor.Right

    AlignV_Top = RSAlignVer.Top
    AlignV_Middle = RSAlignVer.Middle
    AlignV_Bottom = RSAlignVer.Bottom
    AlignV_Baseline = RSAlignVer.Baseline
    AlignV_Descender = RSAlignVer.Descender
  `);

  if (!runtimeFlags?.luaHostIoEnabled) {
    await lua.doString(`
      do
        local disabledMessage = ${JSON.stringify(LUA_HOST_IO_DISABLED_ERROR)}

        local function disabled()
          error(disabledMessage, 2)
        end

        local function safeRequire(name)
          local loaded = package.loaded[name]
          if loaded ~= nil then
            return loaded
          end

          local loader = package.preload[name]
          if type(loader) ~= "function" then
            error("module not found: " .. tostring(name), 2)
          end

          local result = loader(name)
          if result == nil then
            result = true
          end
          package.loaded[name] = result
          return result
        end

        local disabledTable = setmetatable({}, {
          __index = function()
            return disabled
          end,
          __newindex = function()
            error(disabledMessage, 2)
          end,
        })

        require = safeRequire
        io = disabledTable
        os = disabledTable
        debug = disabledTable
        dofile = disabled
        loadfile = disabled

        if type(package) == "table" then
          package.path = ""
          package.cpath = ""
          package.loadlib = disabled
          package.searchpath = disabled
        end
      end
    `);
  }
}

function getLongBracketEqualsCount(code: string, startIndex: number): number | null {
  if (code[startIndex] !== "[") {
    return null;
  }

  let cursor = startIndex + 1;
  while (code[cursor] === "=") {
    cursor += 1;
  }

  if (code[cursor] !== "[") {
    return null;
  }

  return cursor - startIndex - 1;
}

function consumeLongBracketLiteral(code: string, startIndex: number, equalsCount: number): number {
  const closingFence = `]${"=".repeat(equalsCount)}]`;
  let cursor = startIndex + equalsCount + 2;

  while (cursor < code.length) {
    if (code.startsWith(closingFence, cursor)) {
      return cursor + closingFence.length;
    }
    cursor += 1;
  }

  return code.length;
}

function consumeLuaQuotedString(code: string, startIndex: number): number {
  const quote = code[startIndex];
  let cursor = startIndex + 1;

  while (cursor < code.length) {
    if (code[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (code[cursor] === quote) {
      return cursor + 1;
    }
    cursor += 1;
  }

  return code.length;
}

function skipLuaTrivia(code: string, startIndex: number): number {
  let cursor = startIndex;

  while (cursor < code.length) {
    const current = code[cursor];
    const next = code[cursor + 1];

    if (/\s/.test(current ?? "")) {
      cursor += 1;
      continue;
    }

    if (current === "-" && next === "-") {
      const longCommentEquals = getLongBracketEqualsCount(code, cursor + 2);
      if (longCommentEquals !== null) {
        cursor = consumeLongBracketLiteral(code, cursor + 2, longCommentEquals);
        continue;
      }

      cursor += 2;
      while (cursor < code.length && code[cursor] !== "\n" && code[cursor] !== "\r") {
        cursor += 1;
      }
      continue;
    }

    break;
  }

  return cursor;
}

function readLuaIdentifier(code: string, startIndex: number): { value: string; endIndex: number } | null {
  const first = code[startIndex];
  if (!first || !/[A-Za-z_]/.test(first)) {
    return null;
  }

  let endIndex = startIndex + 1;
  while (endIndex < code.length && /\w/.test(code[endIndex] ?? "")) {
    endIndex += 1;
  }

  return {
    value: code.slice(startIndex, endIndex),
    endIndex,
  };
}

function readLuaShortString(code: string, startIndex: number): { value: string; endIndex: number } | null {
  const quote = code[startIndex];
  if (quote !== "\"" && quote !== "'") {
    return null;
  }

  let value = "";
  let cursor = startIndex + 1;

  while (cursor < code.length) {
    const current = code[cursor];
    if (current === "\\") {
      const next = code[cursor + 1];
      if (next === undefined) {
        return null;
      }
      value += next;
      cursor += 2;
      continue;
    }
    if (current === quote) {
      return { value, endIndex: cursor + 1 };
    }
    value += current;
    cursor += 1;
  }

  return null;
}

function tryCollectDirectModuleCall(code: string, startIndex: number): { moduleName: string; endIndex: number } | null {
  let cursor = skipLuaTrivia(code, startIndex);

  if (code[cursor] === "(") {
    cursor = skipLuaTrivia(code, cursor + 1);
    const moduleName = readLuaShortString(code, cursor);
    if (!moduleName) {
      return null;
    }
    cursor = skipLuaTrivia(code, moduleName.endIndex);
    if (code[cursor] !== ")") {
      return null;
    }
    return {
      moduleName: moduleName.value.trim(),
      endIndex: cursor + 1,
    };
  }

  const moduleName = readLuaShortString(code, cursor);
  if (!moduleName) {
    return null;
  }

  return {
    moduleName: moduleName.value.trim(),
    endIndex: moduleName.endIndex,
  };
}

function tryCollectPcallRequire(code: string, startIndex: number): { moduleName: string; endIndex: number } | null {
  let cursor = skipLuaTrivia(code, startIndex);
  if (code[cursor] !== "(") {
    return null;
  }

  cursor = skipLuaTrivia(code, cursor + 1);
  const callee = readLuaIdentifier(code, cursor);
  if (!callee || callee.value !== "require") {
    return null;
  }

  cursor = skipLuaTrivia(code, callee.endIndex);
  if (code[cursor] !== ",") {
    return null;
  }

  cursor = skipLuaTrivia(code, cursor + 1);
  const moduleName = readLuaShortString(code, cursor);
  if (!moduleName) {
    return null;
  }

  cursor = skipLuaTrivia(code, moduleName.endIndex);
  if (code[cursor] !== ")") {
    return null;
  }

  return {
    moduleName: moduleName.value.trim(),
    endIndex: cursor + 1,
  };
}

function collectRequiredModules(code: string): string[] {
  const normalizedCode = normalizeLuaSource(code);
  const modules = new Set<string>();
  let cursor = 0;

  while (cursor < normalizedCode.length) {
    const current = normalizedCode[cursor];
    const next = normalizedCode[cursor + 1];

    if (current === "-" && next === "-") {
      const longCommentEquals = getLongBracketEqualsCount(normalizedCode, cursor + 2);
      cursor = longCommentEquals !== null
        ? consumeLongBracketLiteral(normalizedCode, cursor + 2, longCommentEquals)
        : (() => {
            let nextCursor = cursor + 2;
            while (nextCursor < normalizedCode.length && normalizedCode[nextCursor] !== "\n" && normalizedCode[nextCursor] !== "\r") {
              nextCursor += 1;
            }
            return nextCursor;
          })();
      continue;
    }

    if (current === "\"" || current === "'") {
      cursor = consumeLuaQuotedString(normalizedCode, cursor);
      continue;
    }

    const longStringEquals = getLongBracketEqualsCount(normalizedCode, cursor);
    if (longStringEquals !== null) {
      cursor = consumeLongBracketLiteral(normalizedCode, cursor, longStringEquals);
      continue;
    }

    const identifier = readLuaIdentifier(normalizedCode, cursor);
    if (!identifier) {
      cursor += 1;
      continue;
    }

    let collected: { moduleName: string; endIndex: number } | null = null;
    if (identifier.value === "require" || identifier.value === "include") {
      collected = tryCollectDirectModuleCall(normalizedCode, identifier.endIndex);
    } else if (identifier.value === "pcall") {
      collected = tryCollectPcallRequire(normalizedCode, identifier.endIndex);
    }

    if (collected && collected.moduleName && collected.moduleName !== "native/Vec2") {
      modules.add(collected.moduleName);
      cursor = collected.endIndex;
      continue;
    }

    cursor = identifier.endIndex;
  }

  return [...modules];
}

async function collectExternalModules(code: string, resolveModule: LuaModuleResolver): Promise<Map<string, string>> {
  const loaded = new Map<string, string>();
  const pending = collectRequiredModules(code).map((moduleName) => ({ moduleName, fromModule: null as string | null }));

  while (pending.length > 0) {
    const next = pending.shift();
    const moduleName = next?.moduleName;
    if (!moduleName || loaded.has(moduleName)) {
      continue;
    }

    const source = await resolveModule(moduleName, next?.fromModule ?? null);
    if (!source) {
      continue;
    }

    loaded.set(moduleName, source);
    for (const nested of collectRequiredModules(source)) {
      if (!loaded.has(nested)) {
        pending.push({ moduleName: nested, fromModule: moduleName });
      }
    }
  }

  return loaded;
}

async function preloadExternalModules(lua: LuaEngine, modules: Map<string, string>): Promise<void> {
  const entries = [...modules.entries()]
    .map(([name, source]) => `[${JSON.stringify(name)}] = ${JSON.stringify(source)}`)
    .join(",\n");

  await lua.doString(`
    do
      local sources = {
        ${entries}
      }

      __rsIncludedSources = sources

      for name, source in pairs(sources) do
        package.loaded[name] = nil
        package.preload[name] = function()
          local chunk, err = load(source, "@" .. name .. ".lua", "t", _ENV)
          if not chunk then
            error(err)
          end
          local module = chunk()
          if name == "RenderScript" then
            return __rsWrapRenderScriptModule(module)
          end
          return module
        end
      end
    end
  `);
}

export function createLuaEnvironment(buffer: DrawBuffer, resolveModule?: LuaModuleResolver, runtimeFlags?: RuntimeFlags) {
  let enginePromise: Promise<LuaEngine> | null = null;

  async function getEngine(): Promise<LuaEngine> {
    if (!enginePromise) {
      enginePromise = (async () => {
        const factory = await getFactory();
        const engine = await factory.createEngine();
        await installRuntime(engine, buffer, runtimeFlags);
        return engine;
      })();
    }
    return enginePromise;
  }

  async function execute(code: string, options?: LuaExecuteOptions): Promise<LuaExecResult> {
    const normalizedCode = normalizeLuaSource(code);
    const chunkLabel = normalizeChunkLabel(options?.chunkLabel);
    buffer.resetFrame();
    const lua = await getEngine();
    try {
      if (resolveModule) {
        const externalModules = await collectExternalModules(normalizedCode, resolveModule);
        await preloadExternalModules(lua, externalModules);
      }
      await lua.doString('package.loaded["RenderScript"] = nil');
      lua.global.set("__rsUserCode", normalizedCode);
      lua.global.set("__rsUserChunkName", chunkLabel);
      await lua.doString(`
        do
          local chunk, err = load(__rsUserCode, __rsUserChunkName, "t", _ENV)
          if not chunk then
            error(err, 0)
          end
          return chunk()
        end
      `);
      return {
        success: true,
        logs: [...buffer.logs],
        output: buffer.output,
        requestAnimFrames: buffer.requestAnimFrames,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: formatExecutionError(error),
        logs: [...buffer.logs],
        output: buffer.output,
        requestAnimFrames: buffer.requestAnimFrames,
      };
    }
  }

  return { execute };
}
