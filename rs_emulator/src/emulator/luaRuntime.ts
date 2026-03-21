import { LuaFactory, type LuaEngine } from "wasmoon";
import { DrawBuffer } from "./drawBuffer";
import RENDER_SCRIPT_SOURCE from "../../RenderScript.lua?raw";

export interface LuaExecResult {
  success: boolean;
  error?: string;
  logs: string[];
  output: string;
  requestAnimFrames: number;
}

let factoryPromise: Promise<LuaFactory> | null = null;

async function getFactory(): Promise<LuaFactory> {
  if (!factoryPromise) {
    factoryPromise = Promise.resolve(new LuaFactory());
  }
  return factoryPromise;
}

async function installRuntime(lua: LuaEngine, buffer: DrawBuffer): Promise<void> {
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
  lua.global.set("addText", (layer: number, fontId: number, text: string, x: number, y: number) => {
    buffer.AddText(layer, fontId, text, x, y);
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

  lua.global.set("getCursor", (): [number, number] => buffer.GetCursor());
  lua.global.set("getCursorDown", () => buffer.GetCursorDown());
  lua.global.set("getCursorPressed", () => buffer.GetCursorPressed());
  lua.global.set("getCursorReleased", () => buffer.GetCursorReleased());
  lua.global.set("getDeltaTime", () => buffer.GetDeltaTime());
  lua.global.set("getTime", () => buffer.GetTime());
  lua.global.set("getInput", () => buffer.GetInput());
  lua.global.set("getLocale", () => buffer.GetLocale());
  lua.global.set("getRenderCost", () => buffer.GetRenderCost());
  lua.global.set("getRenderCostMax", () => buffer.GetRenderCostMax());
  lua.global.set("getResolution", (): [number, number] => buffer.GetResolution());
  lua.global.set("getTextBounds", (fontId: number, text: string): [number, number] => {
    const fontSize = buffer.GetFontSize(fontId);
    const width = (text ?? "").length * fontSize * 0.6;
    return [width, fontSize];
  });

  lua.global.set("loadFont", (name: string, size: number) => buffer.LoadFont(name, size));
  lua.global.set("getFontSize", (fontId: number) => buffer.GetFontSize(fontId));
  lua.global.set("setFontSize", (fontId: number, size: number) => buffer.SetFontSize(fontId, size));
  lua.global.set("getFontMetrics", (fontId: number): [number, number] => buffer.GetFontMetrics(fontId));
  lua.global.set("getAvailableFontCount", () => buffer.GetAvailableFontCount());
  lua.global.set("getAvailableFontName", (index: number) => buffer.GetAvailableFontName(index));

  lua.global.set("loadImage", (url: string) => buffer.LoadImage(url));
  lua.global.set("isImageLoaded", (imageId: number) => buffer.IsImageLoaded(imageId));
  lua.global.set("getImageSize", (imageId: number): [number, number] => buffer.GetImageSize(imageId));

  lua.global.set("setBackgroundColor", (r: number, g: number, b: number) => buffer.SetBackgroundColor(r, g, b));
  lua.global.set("setOutput", (output: string) => buffer.SetOutput(output));
  lua.global.set("logMessage", (message: string) => buffer.Log(message));
  lua.global.set("requestAnimationFrame", (frames: number) => buffer.RequestAnimationFrame(frames));
  lua.global.set("__rsRenderScriptSource", RENDER_SCRIPT_SOURCE);

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

    package.preload["RenderScript"] = function()
      local chunk, err = load(__rsRenderScriptSource, "@RenderScript.lua", "t", _ENV)
      if not chunk then
        error(err)
      end

      local module = chunk()
      local rawInstance = module.Instance

      function module.Instance()
        local instance = rawInstance()
        if instance.__rsCompatWrapped then
          return instance
        end

        local rawLoadFont = instance.LoadFont
        local rawAddText = instance.AddText
        local rawGetTextBounds = instance.GetTextBounds
        local rawGetFontSize = instance.GetFontSize
        local rawSetFontSize = instance.SetFontSize
        local rawGetFontMetrics = instance.GetFontMetrics

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
  `);
}

export function createLuaEnvironment(buffer: DrawBuffer) {
  let enginePromise: Promise<LuaEngine> | null = null;

  async function getEngine(): Promise<LuaEngine> {
    if (!enginePromise) {
      enginePromise = (async () => {
        const factory = await getFactory();
        const engine = await factory.createEngine();
        await installRuntime(engine, buffer);
        return engine;
      })();
    }
    return enginePromise;
  }

  async function execute(code: string): Promise<LuaExecResult> {
    buffer.reset();
    const lua = await getEngine();
    try {
      await lua.doString('package.loaded["RenderScript"] = nil');
      await lua.doString(code);
      return {
        success: true,
        logs: [...buffer.logs],
        output: buffer.output,
        requestAnimFrames: buffer.requestAnimFrames,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs: [...buffer.logs],
        output: buffer.output,
        requestAnimFrames: buffer.requestAnimFrames,
      };
    }
  }

  return { execute };
}
