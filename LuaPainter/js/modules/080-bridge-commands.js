// 080-bridge-commands.js - Ingame bridge via the live Lua editor page
(function hudEditorBridgeCommands() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var UNIT_SLOT_NAME = "unit";
  var UNIT_FILTER_NAME = "onStart()";
  var BOOT_DOC_MARKER = "local HUD_EDITOR_BOOT_DOCUMENT =";
  var SELECT_POLL_MS = 25;
  var SELECT_MAX_ROUNDS = 120;

  function getLuaEditorRoot() {
    return document.getElementById("dpu_editor");
  }

  function isElementVisible(node) {
    if (!node) return false;
    if (node.style && node.style.display === "none") return false;
    return node.offsetParent !== null || node === document.activeElement;
  }

  function getLuaEditorManager() {
    return window.LUAEditorManager || null;
  }

  function hasLuaEditorBridge() {
    var manager = getLuaEditorManager();
    return !!(
      manager &&
      typeof manager.setCodeLuaEditor === "function" &&
      typeof manager.apply === "function"
    );
  }

  function getEditorStatus() {
    var selection = getCurrentSelection();
    var visible = isElementVisible(getLuaEditorRoot());
    var available = hasLuaEditorBridge();
    return {
      available: available,
      visible: visible,
      selectedSlot: selection.slot,
      selectedFilter: selection.filter,
      canAccessOnStart: !!(available && visible)
    };
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getSlotNodes() {
    var root = getLuaEditorRoot();
    if (!root || !root.querySelectorAll) return [];
    var nodes = root.querySelectorAll("#slots_container .slot");
    var result = [];
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i] && !(nodes[i].classList && nodes[i].classList.contains("slotTemplate"))) {
        result.push(nodes[i]);
      }
    }
    return result;
  }

  function getFilterNodes() {
    var root = getLuaEditorRoot();
    if (!root || !root.querySelectorAll) return [];
    var nodes = root.querySelectorAll("#filters_container .filter");
    var result = [];
    for (var i = 0; i < nodes.length; i += 1) {
      if (!nodes[i] || (nodes[i].classList && nodes[i].classList.contains("filterTemplate"))) {
        continue;
      }
      if (nodes[i].classList && !nodes[i].classList.contains("view")) {
        continue;
      }
      result.push(nodes[i]);
    }
    return result;
  }

  function getSlotName(node) {
    if (!node || !node.querySelector) return "";
    var input = node.querySelector("input");
    return String(input ? (input.value || input.placeholder || input.textContent || "") : (node.textContent || "")).trim();
  }

  function getFilterEventName(node) {
    if (!node || !node.querySelector) return "";
    var label = node.querySelector(".actionName");
    return String(label ? (label.textContent || "") : "").trim();
  }

  function isSelectedNode(node) {
    if (!node || !node.classList) return false;
    return node.classList.contains("selected") ||
      node.classList.contains("active") ||
      node.classList.contains("current");
  }

  function clickNode(node) {
    if (!node) return false;
    try {
      if (typeof node.click === "function") {
        node.click();
        return true;
      }
      if (typeof MouseEvent === "function" && typeof node.dispatchEvent === "function") {
        node.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        }));
        return true;
      }
    } catch (_ignoreClick) {}
    return false;
  }

  function findSlotNodeByName(slotName) {
    var wanted = normalizeText(slotName);
    var slots = getSlotNodes();
    var fallback = null;
    for (var i = 0; i < slots.length; i += 1) {
      var current = normalizeText(getSlotName(slots[i]));
      if (!current) continue;
      if (current === wanted) return slots[i];
      if (!fallback && current.indexOf(wanted) >= 0) fallback = slots[i];
    }
    return fallback;
  }

  function normalizeFilterKey(name) {
    return normalizeText(name).replace(/\([^)]*\)/g, "").replace(/\s+/g, "");
  }

  function findFilterNodeByEvent(filterName) {
    var wanted = normalizeFilterKey(filterName);
    var filters = getFilterNodes();
    var fallback = null;
    for (var i = 0; i < filters.length; i += 1) {
      var current = normalizeFilterKey(getFilterEventName(filters[i]));
      if (!current) continue;
      if (current === wanted) return filters[i];
      if (!fallback && current.indexOf(wanted) >= 0) fallback = filters[i];
    }
    return fallback;
  }

  function getCurrentSelection() {
    var manager = getLuaEditorManager();
    var currentData = manager && manager.currentData ? manager.currentData : null;
    var currentSlot = currentData && currentData.currentSlot ? currentData.currentSlot : null;
    var currentFilter = currentData && currentData.currentFilter ? currentData.currentFilter : null;
    return {
      slot: currentSlot && currentSlot.name ? String(currentSlot.name) : null,
      filter: currentFilter && (currentFilter.signature || currentFilter.name) ? String(currentFilter.signature || currentFilter.name) : null
    };
  }

  function pollUntil(stepFn, onDone, timeoutMessage) {
    var round = 0;
    function tick() {
      var outcome = false;
      try {
        outcome = !!stepFn();
      } catch (err) {
        onDone(err);
        return;
      }
      if (outcome) {
        onDone(null);
        return;
      }
      round += 1;
      if (round >= SELECT_MAX_ROUNDS) {
        onDone(new Error(timeoutMessage || "timed out"));
        return;
      }
      window.setTimeout(tick, SELECT_POLL_MS);
    }
    tick();
  }


  function ensureUnitOnStartSelected(onDone) {
    if (!hasLuaEditorBridge()) {
      onDone(new Error("lua editor bridge unavailable"));
      return;
    }
    var root = getLuaEditorRoot();
    if (!isElementVisible(root)) {
      onDone(new Error("lua editor not visible"));
      return;
    }

    function ensureFilter() {
      pollUntil(function () {
        var selection = getCurrentSelection();
        if (normalizeText(selection.slot) !== normalizeText(UNIT_SLOT_NAME)) {
          return false;
        }
        if (normalizeFilterKey(selection.filter) === normalizeFilterKey(UNIT_FILTER_NAME)) {
          return true;
        }
        var filterNode = findFilterNodeByEvent(UNIT_FILTER_NAME);
        if (!filterNode) return false;
        clickNode(filterNode);
        return normalizeFilterKey(getCurrentSelection().filter) === normalizeFilterKey(UNIT_FILTER_NAME);
      }, onDone, "unit.onStart selection not observed");
    }

    pollUntil(function () {
      var selection = getCurrentSelection();
      if (normalizeText(selection.slot) === normalizeText(UNIT_SLOT_NAME)) {
        return true;
      }
      var slotNode = findSlotNodeByName(UNIT_SLOT_NAME);
      if (!slotNode) return false;
      clickNode(slotNode);
      return normalizeText(getCurrentSelection().slot) === normalizeText(UNIT_SLOT_NAME);
    }, function (err) {
      if (err) {
        onDone(err);
        return;
      }
      ensureFilter();
    }, "unit slot selection not observed");
  }

  function getCurrentFilterCode() {
    var manager = getLuaEditorManager();
    var currentData = manager && manager.currentData ? manager.currentData : null;
    var currentFilter = currentData && currentData.currentFilter ? currentData.currentFilter : null;
    if (currentFilter && typeof currentFilter.code === "string") {
      return currentFilter.code;
    }
    try {
      if (manager && typeof manager.getCodeLuaEditor === "function") {
        return String(manager.getCodeLuaEditor() || "");
      }
    } catch (_ignoreGetCode) {}
    try {
      if (manager && typeof manager.getLuaEditor === "function") {
        var codeMirror = manager.getLuaEditor();
        if (codeMirror && typeof codeMirror.getValue === "function") {
          return String(codeMirror.getValue() || "");
        }
      }
    } catch (_ignoreCodeMirror) {}
    return "";
  }

  function extractBootDocumentTable(code) {
    var source = String(code || "");
    var markerIndex = source.indexOf(BOOT_DOC_MARKER);
    if (markerIndex < 0) return null;

    var start = markerIndex + BOOT_DOC_MARKER.length;
    while (start < source.length && /\s/.test(source.charAt(start))) {
      start += 1;
    }
    if (source.charAt(start) !== "{") return null;

    var depth = 0;
    var quote = "";
    var escaping = false;
    for (var i = start; i < source.length; i += 1) {
      var ch = source.charAt(i);
      if (quote) {
        if (escaping) {
          escaping = false;
        } else if (ch === "\\") {
          escaping = true;
        } else if (ch === quote) {
          quote = "";
        }
        continue;
      }
      if (ch === "\"" || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return source.slice(start, i + 1);
        }
      }
    }
    return null;
  }

  function createLuaTableParser(text) {
    var source = String(text || "");
    var index = 0;

    function error(message) {
      throw new Error(message + " at " + index);
    }

    function peek() {
      return source.charAt(index);
    }

    function skipWhitespace() {
      while (index < source.length && /\s/.test(source.charAt(index))) {
        index += 1;
      }
    }

    function consume(expected) {
      skipWhitespace();
      if (source.charAt(index) !== expected) {
        error("expected " + expected);
      }
      index += 1;
    }

    function parseString() {
      skipWhitespace();
      var quote = source.charAt(index);
      if (quote !== "\"" && quote !== "'") {
        error("expected string");
      }
      index += 1;
      var out = "";
      var escaping = false;
      while (index < source.length) {
        var ch = source.charAt(index);
        index += 1;
        if (escaping) {
          if (ch === "n") out += "\n";
          else if (ch === "r") out += "\r";
          else if (ch === "t") out += "\t";
          else out += ch;
          escaping = false;
          continue;
        }
        if (ch === "\\") {
          escaping = true;
          continue;
        }
        if (ch === quote) {
          return out;
        }
        out += ch;
      }
      error("unterminated string");
    }

    function parseNumber() {
      skipWhitespace();
      var match = source.slice(index).match(/^-?(?:\d+\.\d+|\d+|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!match) error("expected number");
      index += match[0].length;
      return Number(match[0]);
    }

    function parseIdentifier() {
      skipWhitespace();
      var match = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!match) error("expected identifier");
      index += match[0].length;
      return match[0];
    }

    function parseValue() {
      skipWhitespace();
      var ch = peek();
      if (ch === "{") return parseTable();
      if (ch === "\"" || ch === "'") return parseString();
      if (ch === "-" || ch === "." || /\d/.test(ch)) return parseNumber();

      var ident = parseIdentifier();
      if (ident === "true") return true;
      if (ident === "false") return false;
      if (ident === "nil" || ident === "null") return null;
      return ident;
    }

    function tryParseKeyValue() {
      skipWhitespace();
      var start = index;
      var key = null;

      if (peek() === "[") {
        index += 1;
        key = parseValue();
        skipWhitespace();
        if (peek() !== "]") {
          index = start;
          return null;
        }
        index += 1;
      } else {
        var match = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (!match) {
          return null;
        }
        key = match[0];
        index += match[0].length;
      }

      skipWhitespace();
      if (peek() !== "=") {
        index = start;
        return null;
      }
      index += 1;
      return {
        key: String(key),
        value: parseValue()
      };
    }

    function parseTable() {
      consume("{");
      var array = [];
      var object = {};
      var hasArray = false;
      var hasObject = false;

      while (index < source.length) {
        skipWhitespace();
        if (peek() === "}") {
          index += 1;
          break;
        }

        var pair = tryParseKeyValue();
        if (pair) {
          object[pair.key] = pair.value;
          hasObject = true;
        } else {
          array.push(parseValue());
          hasArray = true;
        }

        skipWhitespace();
        if (peek() === "," || peek() === ";") {
          index += 1;
        }
      }

      if (hasObject && !hasArray) return object;
      if (hasArray && !hasObject) return array;
      for (var i = 0; i < array.length; i += 1) {
        object[String(i + 1)] = array[i];
      }
      return object;
    }

    return {
      parse: function () {
        var value = parseValue();
        skipWhitespace();
        return value;
      }
    };
  }

  function parseBootDocumentFromCode(code) {
    var tableText = extractBootDocumentTable(code);
    if (!tableText) return null;
    var parser = createLuaTableParser(tableText);
    var doc = parser.parse();
    return normalizeDocument(doc);
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.slice();
    if (!value || typeof value !== "object") return [];
    var keys = Object.keys(value).filter(function (key) {
      return /^\d+$/.test(key);
    }).sort(function (a, b) {
      return Number(a) - Number(b);
    });
    return keys.map(function (key) {
      return value[key];
    });
  }

  function toFiniteNumber(value, fallback) {
    var num = Number(value);
    return isFinite(num) ? num : fallback;
  }

  function normalizeColor(value, fallback) {
    var arr = toArray(value);
    if (!arr.length) return fallback.slice();
    return [
      toFiniteNumber(arr[0], fallback[0]),
      toFiniteNumber(arr[1], fallback[1]),
      toFiniteNumber(arr[2], fallback[2]),
      toFiniteNumber(arr[3], fallback[3])
    ];
  }

  function normalizeTextLines(value) {
    return toArray(value).map(function (line) {
      return String(line == null ? "" : line);
    });
  }

  function normalizeElement(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    var type = String(raw.type || "box");
    if (type === "rounded") type = "boxRounded";
    return {
      id: raw.id ? String(raw.id) : ("element_" + (index + 1)),
      type: type,
      visible: raw.visible !== false,
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 120),
      h: toFiniteNumber(raw.h, 80),
      radius: toFiniteNumber(raw.radius, 0),
      fill: normalizeColor(raw.fill, [0.22, 0.24, 0.28, 0.92]),
      stroke: normalizeColor(raw.stroke, [0.82, 0.84, 0.88, 1]),
      strokeWidth: toFiniteNumber(raw.strokeWidth, 2),
      textLines: normalizeTextLines(raw.textLines),
      textColor: normalizeColor(raw.textColor, [1, 1, 1, 1]),
      textSize: toFiniteNumber(raw.textSize, 16),
      textAlign: raw.textAlign ? String(raw.textAlign) : "left",
      textVAlign: raw.textVAlign ? String(raw.textVAlign) : "center",
      rotation: toFiniteNumber(raw.rotation, 0),
      shadowBlur: toFiniteNumber(raw.shadowBlur, 0),
      shadowColor: normalizeColor(raw.shadowColor, [0, 0, 0, 0]),
      imageSrc: raw.imageSrc ? String(raw.imageSrc) : "",
      imageFit: raw.imageFit ? String(raw.imageFit) : "contain",
      quadInset: toFiniteNumber(raw.quadInset, 0.125)
    };
  }

  function normalizeDocument(raw) {
    if (!raw || typeof raw !== "object") return null;
    var elements = toArray(raw.elements).map(function (element, index) {
      return normalizeElement(element, index);
    }).filter(Boolean);
    return APP.normalizeDocumentMeta({
      version: toFiniteNumber(raw.version, 1),
      revision: toFiniteNumber(raw.revision, 1),
      id: raw.id != null ? String(raw.id) : "",
      screenWidth: toFiniteNumber(raw.screenWidth, 1920),
      screenHeight: toFiniteNumber(raw.screenHeight, 1080),
      elements: elements,
      name: raw.name ? String(raw.name) : "Current Board Layout"
    });
  }

  function emitBoardError(message) {
    APP.emit("board-error", { message: message });
  }

  function emitCurrentList(doc) {
    var scripts = [];
    if (doc) {
      scripts.push({
        id: doc.id,
        name: doc.name || "Current Board Layout",
        modified: Number(doc.revision || 0)
      });
    }
    APP.emit("board-list", { scripts: scripts });
  }

  function loadCurrentDocument(eventName, failurePrefix) {
    ensureUnitOnStartSelected(function (err) {
      if (err) {
        emitBoardError(err.message || String(err));
        if (eventName === "board-load") {
          APP.emit("board-load", { document: null, error: err.message || String(err) });
        }
        return;
      }

      var code = getCurrentFilterCode();
      var doc = null;
      try {
        doc = parseBootDocumentFromCode(code);
      } catch (parseErr) {
        emitBoardError(parseErr.message || String(parseErr));
        if (eventName === "board-load") {
          APP.emit("board-load", { document: null, error: parseErr.message || String(parseErr) });
        }
        return;
      }

      if (!doc) {
        if (eventName === "board-list") {
          emitCurrentList(null);
        } else if (eventName === "board-load") {
          APP.emit("board-load", { document: null, error: failurePrefix || "no boot document found" });
        } else if (eventName === "board-sync") {
          APP.emit("board-sync", {
            mode: "start",
            selectedId: null,
            isDirty: false,
            revision: 0,
            document: null
          });
        }
        return;
      }

      if (eventName === "board-list") {
        emitCurrentList(doc);
      } else if (eventName === "board-load") {
        APP.emit("board-load", { document: doc });
      } else if (eventName === "board-sync") {
        APP.emit("board-sync", {
          mode: "loaded",
          selectedId: null,
          isDirty: false,
          revision: Number(doc.revision || 0),
          document: doc
        });
      }
    });
  }

  function saveCurrentDocument(options) {
    options = options || {};
    ensureUnitOnStartSelected(function (err) {
      if (err) {
        emitBoardError(err.message || String(err));
        APP.emit("board-save", { ok: false });
        return;
      }

      if (!APP.ideExport || typeof APP.ideExport.buildBoardOnStartCode !== "function") {
        emitBoardError("board export unavailable");
        APP.emit("board-save", { ok: false });
        return;
      }

      var doc = APP.state && APP.state.document ? APP.state.document : null;
      if (!doc) {
        emitBoardError("no document to save");
        APP.emit("board-save", { ok: false });
        return;
      }

      var manager = getLuaEditorManager();
      var closedHudForApply = false;
      var keepHudOpen = !!options.keepHudOpen;
      try {
        manager.setCodeLuaEditor(APP.ideExport.buildBoardOnStartCode(doc));
        if (!keepHudOpen && APP.state && APP.state.editModeActive && typeof APP.exitEditMode === "function") {
          APP.exitEditMode();
          if (typeof APP.updateToggleButton === "function") {
            APP.updateToggleButton();
          }
          closedHudForApply = true;
        }
        manager.apply();
        APP.emit("board-save", {
          ok: true,
          reopened: false,
          hudClosed: closedHudForApply
        });
      } catch (saveErr) {
        if (closedHudForApply && typeof APP.enterEditMode === "function") {
          APP.enterEditMode();
          if (typeof APP.updateToggleButton === "function") {
            APP.updateToggleButton();
          }
        }
        emitBoardError(saveErr && saveErr.message ? saveErr.message : String(saveErr));
        APP.emit("board-save", { ok: false });
      }
    });
  }

  APP.bridge = {
    isAvailable: hasLuaEditorBridge,
    getEditorStatus: getEditorStatus,
    ping: function () {
      APP.emit("board-pong", { version: "lua-editor-bridge" });
      return true;
    },
    sync: function () {
      loadCurrentDocument("board-sync", "no boot document found");
      return true;
    },
    newDocument: function (_screenW, _screenH) {
      return true;
    },
    loadDocument: function (_scriptId) {
      loadCurrentDocument("board-load", "no boot document found");
      return true;
    },
    saveDocument: function (options) {
      saveCurrentDocument(options);
      return true;
    },
    listScripts: function () {
      loadCurrentDocument("board-list", "no boot document found");
      return true;
    },
    pollOutput: function () { return null; },
    handleResponse: function () { return null; }
  };
})();
