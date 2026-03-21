import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LuaFactory } from "wasmoon";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const modulePath = path.join(repoRoot, "ScreenLayoutEditor.lua");
const moduleSource = await readFile(modulePath, "utf8");
const factory = new LuaFactory();

async function runLua(script) {
  const engine = await factory.createEngine();
  try {
    engine.global.set("__MODULE_SOURCE", moduleSource);
    await engine.doString(`
      package.preload["ScreenLayoutEditor"] = function()
        local loader = assert(load(__MODULE_SOURCE, "@ScreenLayoutEditor.lua", "t", _ENV))
        return loader()
      end
    `);
    return await engine.doString(script);
  } finally {
    if (typeof engine.close === "function") {
      await engine.close();
    }
  }
}

test("creates the default document", async () => {
  const result = await runLua(`
    local editor = require("ScreenLayoutEditor")
    local doc = editor.createDefaultDocument(1920, 1080)
    local function expect(value, message)
      if not value then
        error(message)
      end
    end

    expect(doc.version == 1, "expected version 1")
    expect(doc.revision == 0, "expected revision 0")
    expect(doc.selectedId == "main_canvas", "expected default selection")
    expect(#doc.elements >= 10, "expected multiple default elements")
    expect(doc.elements[1].id == "frame", "expected frame element first")
    return "ok"
  `);
  assert.equal(result, "ok");
});

test("picks the topmost element", async () => {
  const result = await runLua(`
    local editor = require("ScreenLayoutEditor")
    local doc = editor.normalizeDocument({
      version = 1,
      revision = 0,
      elements = {
        { id = "bottom", type = "boxRounded", x = 20, y = 20, w = 120, h = 120 },
        { id = "top", type = "boxRounded", x = 40, y = 40, w = 120, h = 120 }
      }
    }, 400, 300)

    local hit = editor.pickTopmostElement(doc, 60, 60)
    if not hit or hit.id ~= "top" then
      error("expected topmost hit")
    end
    return hit.id
  `);
  assert.equal(result, "top");
});

test("drags an element within bounds and commits one revision", async () => {
  const result = await runLua(`
    local editor = require("ScreenLayoutEditor")
    local state = editor.createState(300, 200, {
      version = 1,
      revision = 0,
      elements = {
        {
          id = "movable",
          type = "boxRounded",
          x = 10,
          y = 20,
          w = 100,
          h = 80,
          movable = true,
          resizable = true
        }
      }
    })

    editor.applyPointerFrame(state, { cursorX = 20, cursorY = 30, pressed = true })
    editor.applyPointerFrame(state, { cursorX = 290, cursorY = 190, down = true })
    editor.applyPointerFrame(state, { cursorX = 290, cursorY = 190, released = true })

    local element = state.document.elements[1]
    if element.x ~= 192 then
      error("expected clamped x=192, got " .. tostring(element.x))
    end
    if element.y ~= 112 then
      error("expected clamped y=112, got " .. tostring(element.y))
    end
    if state.document.revision ~= 1 then
      error("expected revision 1 after drag commit")
    end
    if state.lastOutputEnvelope == "" then
      error("expected persisted output envelope after drag commit")
    end
    return "ok"
  `);
  assert.equal(result, "ok");
});

test("resizes from each corner", async () => {
  const result = await runLua(`
    local editor = require("ScreenLayoutEditor")

    local function runCorner(handleX, handleY, dragX, dragY)
      local state = editor.createState(400, 300, {
        version = 1,
        revision = 0,
        selectedId = "box",
        elements = {
          {
            id = "box",
            type = "boxRounded",
            x = 100,
            y = 100,
            w = 100,
            h = 80,
            movable = true,
            resizable = true
          }
        }
      })
      editor.applyPointerFrame(state, { cursorX = handleX, cursorY = handleY, pressed = true })
      editor.applyPointerFrame(state, { cursorX = dragX, cursorY = dragY, down = true })
      editor.applyPointerFrame(state, { cursorX = dragX, cursorY = dragY, released = true })
      return state.document.elements[1]
    end

    local se = runCorner(200, 180, 240, 220)
    if se.w ~= 140 or se.h ~= 120 then
      error("unexpected se resize result")
    end

    local sw = runCorner(100, 180, 60, 220)
    if sw.x ~= 60 or sw.w ~= 140 or sw.h ~= 120 then
      error("unexpected sw resize result")
    end

    local ne = runCorner(200, 100, 240, 70)
    if ne.y ~= 70 or ne.w ~= 140 or ne.h ~= 110 then
      error("unexpected ne resize result")
    end

    local nw = runCorner(100, 100, 60, 70)
    if nw.x ~= 60 or nw.y ~= 70 or nw.w ~= 140 or nw.h ~= 110 then
      error("unexpected nw resize result")
    end

    return "ok"
  `);
  assert.equal(result, "ok");
});

test("enforces minimum width and height", async () => {
  const result = await runLua(`
    local editor = require("ScreenLayoutEditor")
    local state = editor.createState(400, 300, {
      version = 1,
      revision = 0,
      selectedId = "box",
      elements = {
        {
          id = "box",
          type = "boxRounded",
          x = 100,
          y = 100,
          w = 100,
          h = 80,
          movable = true,
          resizable = true
        }
      }
    })

    local minWidth = state.metrics.minWidth
    local minHeight = state.metrics.minHeight

    editor.applyPointerFrame(state, { cursorX = 100, cursorY = 100, pressed = true })
    editor.applyPointerFrame(state, { cursorX = 260, cursorY = 260, down = true })
    editor.applyPointerFrame(state, { cursorX = 260, cursorY = 260, released = true })

    local element = state.document.elements[1]
    if element.w ~= minWidth then
      error("expected min width clamp")
    end
    if element.h ~= minHeight then
      error("expected min height clamp")
    end
    return "ok"
  `);
  assert.equal(result, "ok");
});

test("serializes and reloads the same document", async () => {
  const result = await runLua(`
    local editor = require("ScreenLayoutEditor")
    local doc = editor.createDefaultDocument(1920, 1080)
    doc.revision = 7
    doc.selectedId = "title_badge"
    doc.elements[2].x = doc.elements[2].x + 33
    doc.elements[2].y = doc.elements[2].y + 11

    local serialized = editor.serializeDocument(doc)
    local restored, err = editor.deserializeDocument(serialized, 1920, 1080)
    if not restored then
      error(err or "failed to deserialize")
    end
    local reserialized = editor.serializeDocument(restored)
    if serialized ~= reserialized then
      error("serialize -> deserialize -> serialize roundtrip mismatch")
    end
    if restored.revision ~= 7 then
      error("expected revision to survive roundtrip")
    end
    if restored.selectedId ~= "title_badge" then
      error("expected selectedId to survive roundtrip")
    end
    return "ok"
  `);
  assert.equal(result, "ok");
});

test("builds a single-key persistence record and restores it", async () => {
  const result = await runLua(`
    local editor = require("ScreenLayoutEditor")
    local doc = editor.createDefaultDocument(1920, 1080)
    doc.revision = 3

    local fitsDefault, recordDefault = editor.canPersistDocument(doc)
    if not fitsDefault then
      error("expected default screen limit to accept document")
    end
    if recordDefault.key ~= "screen_layout_editor:document" then
      error("unexpected databank key")
    end
    if recordDefault.length ~= string.len(recordDefault.text) then
      error("record length metadata mismatch")
    end
    if recordDefault.hash ~= editor.hashText(recordDefault.serializedDocument) then
      error("record hash must match serialized document")
    end

    local persistedEnvelope, envelopeError = editor.readPersistedEnvelope(recordDefault.text, 1920, 1080)
    if not persistedEnvelope then
      error(envelopeError or "failed to read persisted envelope")
    end
    if persistedEnvelope.revision ~= 3 then
      error("expected persisted envelope revision 3")
    end
    if persistedEnvelope.hash ~= recordDefault.hash then
      error("persisted envelope hash mismatch")
    end
    if persistedEnvelope.serializedDocument ~= recordDefault.serializedDocument then
      error("persisted envelope serialized document mismatch")
    end
    if persistedEnvelope.text ~= recordDefault.text then
      error("persisted envelope text should stay canonical")
    end

    local recordFromOutput, recordFromOutputError = editor.buildPersistenceRecordFromOutput(recordDefault.text, nil, 1920, 1080)
    if not recordFromOutput then
      error(recordFromOutputError or "failed to rebuild persistence record from output")
    end
    if recordFromOutput.text ~= recordDefault.text then
      error("rebuilt record text mismatch")
    end
    if recordFromOutput.hash ~= recordDefault.hash then
      error("rebuilt record hash mismatch")
    end

    local fitsTiny, recordTiny = editor.canPersistDocument(doc, 128)
    if fitsTiny or recordTiny.fits then
      error("expected tiny max screen limit to reject document")
    end
    if recordTiny.maxLength ~= 128 then
      error("expected explicit max screen code chars to be preserved")
    end

    local restored, restoreError = editor.restorePersistedDocument(recordDefault.text, 1920, 1080)
    if not restored then
      error(restoreError or "failed to restore persisted document")
    end
    if restored.revision ~= 3 then
      error("expected revision 3 after restore")
    end
    return "ok"
  `);
  assert.equal(result, "ok");
});

test("tracks revision and dirty state without font cache in pure logic", async () => {
  const result = await runLua(`
    local editor = require("ScreenLayoutEditor")
    local state = editor.createState(320, 240, {
      version = 1,
      revision = 0,
      elements = {
        {
          id = "box",
          type = "boxRounded",
          x = 20,
          y = 20,
          w = 100,
          h = 80,
          movable = true,
          resizable = true
        }
      }
    })

    if state.font ~= nil or state.fontCache ~= nil or state.lastFont ~= nil then
      error("pure logic state must not carry font handles")
    end
    if state.lastOutputEnvelope ~= "" then
      error("expected no output envelope before a committed edit")
    end

    editor.applyPointerFrame(state, { cursorX = 30, cursorY = 30, pressed = true })
    editor.applyPointerFrame(state, { cursorX = 30, cursorY = 30, released = true })

    if state.document.revision ~= 0 then
      error("selection without geometry change must not bump revision")
    end
    if state.lastOutputEnvelope ~= "" then
      error("selection without geometry change must not emit persistence envelope")
    end

    editor.applyPointerFrame(state, { cursorX = 30, cursorY = 30, pressed = true })
    editor.applyPointerFrame(state, { cursorX = 60, cursorY = 70, down = true })
    editor.applyPointerFrame(state, { cursorX = 60, cursorY = 70, released = true })

    if state.document.revision ~= 1 then
      error("drag change must bump revision once")
    end
    if state.lastOutputEnvelope == "" then
      error("drag change must emit persistence envelope")
    end

    local envelope, envelopeError = editor.parseOutputEnvelope(state.lastOutputEnvelope, 320, 240)
    if not envelope then
      error(envelopeError or "failed to parse output envelope")
    end
    if envelope.revision ~= 1 then
      error("expected envelope revision 1")
    end
    return "ok"
  `);
  assert.equal(result, "ok");
});

test("caches font discovery, handles, and text bounds across renders", async () => {
  const result = await runLua(`
    local loadFontCalls = 0
    local availableFontCountCalls = 0
    local availableFontNameCalls = 0
    local textBoundsCalls = 0
    local outputCount = 0

    function loadFont(name, size)
      loadFontCalls = loadFontCalls + 1
      if name == "Cacheable" then
        return string.format("%s@%d", tostring(name), tonumber(size) or 0)
      end
      return nil
    end

    function getAvailableFontCount()
      availableFontCountCalls = availableFontCountCalls + 1
      return 1
    end

    function getAvailableFontName(index)
      availableFontNameCalls = availableFontNameCalls + 1
      if index == 0 then
        return "Cacheable"
      end
      return nil
    end

    function getTextBounds(_font, text)
      textBoundsCalls = textBoundsCalls + 1
      return string.len(tostring(text or "")) * 8
    end

    function setNextFillColor(...) end
    function setNextStrokeColor(...) end
    function setNextStrokeWidth(...) end
    function addBox(...) end
    function addBoxRounded(...) end
    function addText(...) end
    function setBackgroundColor(...) end
    function createLayer()
      return 1
    end
    function getCursor()
      return -1, -1
    end
    function getCursorPressed()
      return false
    end
    function getCursorDown()
      return false
    end
    function getCursorReleased()
      return false
    end
    function getResolution()
      return 1280, 840
    end
    function setOutput(_value)
      outputCount = outputCount + 1
    end
    function requestAnimationFrame(...) end

    SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT = [[
      {version=1,revision=0,elements={
        {id="label",type="boxRounded",x=10,y=10,w=200,h=80,textLines={"Hello"},textSize=20,textAlign="center"}
      }}
    ]]
    SCREEN_LAYOUT_EDITOR_STATE = nil
    SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE = nil
    SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE = nil
    SCREEN_LAYOUT_EDITOR_AVAILABLE_FONT_NAMES = nil

    local loader = assert(load(__MODULE_SOURCE, "@ScreenLayoutEditor.lua", "t", _ENV))
    loader()
    loader()

    if loadFontCalls ~= 5 then
      error("expected 5 loadFont calls across two renders, got " .. tostring(loadFontCalls))
    end
    if availableFontCountCalls ~= 1 then
      error("expected available font count lookup once, got " .. tostring(availableFontCountCalls))
    end
    if availableFontNameCalls ~= 1 then
      error("expected available font name lookup once, got " .. tostring(availableFontNameCalls))
    end
    if textBoundsCalls ~= 1 then
      error("expected text bounds lookup once across two renders, got " .. tostring(textBoundsCalls))
    end
    if outputCount ~= 0 then
      error("render without edits must not emit output envelope")
    end
    return "ok"
  `);
  assert.equal(result, "ok");
});

test("reloads a cached font handle when addText rejects it", async () => {
  const result = await runLua(`
    local loadFontCalls = 0
    local getTextBoundsCalls = 0
    local addTextCalls = 0
    local outputCount = 0

    function loadFont(name, size)
      loadFontCalls = loadFontCalls + 1
      if name == "Cacheable" then
        return string.format("%s@%d#%d", tostring(name), tonumber(size) or 0, loadFontCalls)
      end
      return nil
    end

    function getAvailableFontCount()
      return 1
    end

    function getAvailableFontName(index)
      if index == 0 then
        return "Cacheable"
      end
      return nil
    end

    function getTextBounds(_font, text)
      getTextBoundsCalls = getTextBoundsCalls + 1
      return string.len(tostring(text or "")) * 8
    end

    function setNextFillColor(...) end
    function setNextStrokeColor(...) end
    function setNextStrokeWidth(...) end
    function addBox(...) end
    function addBoxRounded(...) end
    function addText(_layer, font, _text, _x, _y)
      addTextCalls = addTextCalls + 1
      if font == "Cacheable@20#5" then
        error("stale handle")
      end
    end
    function setBackgroundColor(...) end
    function createLayer()
      return 1
    end
    function getCursor()
      return -1, -1
    end
    function getCursorPressed()
      return false
    end
    function getCursorDown()
      return false
    end
    function getCursorReleased()
      return false
    end
    function getResolution()
      return 1280, 840
    end
    function setOutput(_value)
      outputCount = outputCount + 1
    end
    function requestAnimationFrame(...) end

    SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT = [[
      {version=1,revision=0,elements={
        {id="label",type="boxRounded",x=10,y=10,w=200,h=80,textLines={"Hello"},textSize=20,textAlign="center"}
      }}
    ]]
    SCREEN_LAYOUT_EDITOR_STATE = nil
    SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE = nil
    SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE = nil
    SCREEN_LAYOUT_EDITOR_AVAILABLE_FONT_NAMES = nil

    local loader = assert(load(__MODULE_SOURCE, "@ScreenLayoutEditor.lua", "t", _ENV))
    loader()
    loader()

    if loadFontCalls ~= 6 then
      error("expected 6 loadFont calls with one retry, got " .. tostring(loadFontCalls))
    end
    if getTextBoundsCalls ~= 3 then
      error("expected 3 text bounds lookups after retry rebuild, got " .. tostring(getTextBoundsCalls))
    end
    if addTextCalls ~= 7 then
      error("expected 7 addText calls across retry + two renders, got " .. tostring(addTextCalls))
    end
    if outputCount ~= 0 then
      error("render without edits must not emit output envelope")
    end
    return "ok"
  `);
  assert.equal(result, "ok");
});
