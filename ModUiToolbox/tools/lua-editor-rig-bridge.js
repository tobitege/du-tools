/* eslint-disable no-console */
(function () {
  "use strict";

  if (window.__UI_TOOLBOX_LUA_RIG_BRIDGE__) {
    return;
  }
  window.__UI_TOOLBOX_LUA_RIG_BRIDGE__ = true;

  var POLL_MS = 350;
  var UNKNOWN_PLAYER_ID = 0;
  var RIG_CONFIG = (window.__UI_TOOLBOX_RIG_CONFIG && typeof window.__UI_TOOLBOX_RIG_CONFIG === "object")
    ? window.__UI_TOOLBOX_RIG_CONFIG
    : {};
  var RIG_PLAYER_ID = Number(RIG_CONFIG.playerId || UNKNOWN_PLAYER_ID);
  var lastImportWriteUtc = "";
  var pendingImportInfo = null;
  var statusEl = null;
  var bridgeCodeMirror = null;
  var localeObserver = null;
  var localeApplyScheduled = false;
  var DEFAULT_LUA_SNIPPET =
    "-- Lua Editor Rig Starter Snippet\n" +
    "-- Click IDE Sync to export this to snippet.lua for external editing.\n\n" +
    "local VERSION = \"rig-1.0\"\n\n" +
    "function onStart()\n" +
    "  print(\"Lua rig ready\", VERSION)\n" +
    "end\n\n" +
    "function onStop()\n" +
    "  print(\"Lua rig stopped\")\n" +
    "end\n";
  var LOCALE_FALLBACKS = {
    ui_hud_lua_editor_slots: "Slots",
    ui_hud_lua_editor_select_slot_in_cu: "Select a slot in your Control Unit",
    ui_hud_lua_editor_filters: "Filters",
    ui_hud_lua_editor_filters_add: "Add filter to catch events from your selected slot",
    ui_hud_lua_editor_empty_filters: "Please add a filter to edit the associated code",
    ui_hud_lua_editor_error_add_filter: "Impossible to add a filter",
    ui_hud_lua_editor_select_event: "Select event",
    ui_hud_lua_editor_add_filter: "+ add filter",
    ui_hud_lua_editor_action_list: "Actions list",
    ui_hud_lua_editor_lua_editor: "Lua editor",
    ui_hud_lua_editor_edit_code: "Edit the code that will run when the filter for the selected slot activates",
    ui_hud_lua_editor_font_size: "Font size",
    ui_hud_lua_editor_report: "Report",
    ui_hud_lua_editor_filter: "Filter",
    ui_hud_lua_editor_line: "Line",
    ui_hud_lua_editor_description: "Description",
    ui_hud_lua_editor_title: "Lua editor - {0}",
    ui_hud_screen_content_editor_line_wrap: "Wrap lines",
    ui_common_label_apply: "Apply",
    ui_common_action_cancel: "Cancel",
    common_action_cancel: "Cancel",
    ui_common_action_ok: "OK",
    common_action_ok: "OK",
    ui_common_action_close: "Close",
    common_action_close: "Close"
  };

  function normalizeLocaleKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isLocaleKeyLike(value) {
    var text = String(value || "").trim();
    if (!text || text.indexOf(" ") >= 0) {
      return false;
    }
    if (!/^[a-z0-9_:.%-]+$/i.test(text) || text.indexOf("_") < 0) {
      return false;
    }
    var lowered = text.toLowerCase();
    return (
      lowered.indexOf("ui_") === 0 ||
      lowered.indexOf("common_") === 0 ||
      lowered.indexOf("hud_") === 0
    );
  }

  function needsLocaleFallback(translated, key) {
    var value = String(translated || "").trim();
    if (!value) {
      return true;
    }
    if (isLocaleKeyLike(value)) {
      return true;
    }
    var normalizedKey = normalizeLocaleKey(key);
    if (!normalizedKey) {
      return false;
    }
    var normalizedValue = normalizeLocaleKey(value);
    return normalizedValue === normalizedKey || normalizedValue.indexOf(normalizedKey + ":") === 0;
  }

  function titleCaseWords(text) {
    return String(text || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(function (word) {
        if (word.length <= 2) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  function formatFallback(template, args) {
    var out = String(template || "");
    var values = Array.isArray(args) ? args : [];
    for (var i = 0; i < values.length; i += 1) {
      var value = String(values[i] == null ? "" : values[i]);
      out = out.replace(new RegExp("\\{" + i + "\\}", "g"), value);
      out = out.replace(new RegExp("%" + (i + 1), "g"), value);
      out = out.replace("%s", value);
    }
    return out;
  }

  function humanizeLocaleKey(key) {
    var normalized = normalizeLocaleKey(key);
    if (!normalized) {
      return "";
    }
    var compact = normalized
      .replace(/^ui_hud_lua_editor_/, "")
      .replace(/^ui_hud_screen_content_editor_/, "")
      .replace(/^ui_common_label_/, "")
      .replace(/^ui_common_action_/, "")
      .replace(/^ui_common_/, "")
      .replace(/^common_action_/, "")
      .replace(/^common_/, "")
      .replace(/^ui_hud_/, "")
      .replace(/^ui_/, "");
    if (!compact) {
      compact = normalized;
    }
    return titleCaseWords(compact.replace(/_/g, " "));
  }

  function translateLocaleKey(key, args) {
    var normalized = normalizeLocaleKey(key);
    if (!normalized) {
      return "";
    }
    var mapped = LOCALE_FALLBACKS[normalized];
    if (typeof mapped === "string" && mapped) {
      return formatFallback(mapped, args);
    }
    return formatFallback(humanizeLocaleKey(normalized), args);
  }

  function setLocaleAttr(node, attrName, value) {
    if (!node || !attrName) {
      return;
    }
    if (attrName === "innerText" || attrName === "textContent" || attrName === "innerHTML") {
      if (String(node.innerText || "") !== String(value)) {
        node.innerText = String(value);
      }
      return;
    }

    var currentAttr = node.getAttribute(attrName);
    if (currentAttr == null || currentAttr !== value) {
      node.setAttribute(attrName, value);
    }
    if (typeof node[attrName] !== "undefined" && String(node[attrName] || "") !== String(value)) {
      node[attrName] = value;
    }
  }

  function applyLocaleFallbackToDom(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll ? scope.querySelectorAll("[data-locale-keys]") : [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var keysRaw = (node.dataset && node.dataset.localeKeys) ? String(node.dataset.localeKeys) : "";
      if (!keysRaw) {
        continue;
      }

      var keys = keysRaw.split(",").map(function (entry) { return String(entry || "").trim(); }).filter(Boolean);
      if (!keys.length) {
        continue;
      }

      var attrs = [];
      if (node.dataset && typeof node.dataset.localeAttr === "string" && node.dataset.localeAttr) {
        attrs = node.dataset.localeAttr.split(",").map(function (entry) { return String(entry || "").trim(); }).filter(Boolean);
      }
      if (!attrs.length) {
        attrs = ["innerText"];
      }

      if (attrs.length === 1 && keys.length > 1) {
        setLocaleAttr(node, attrs[0], translateLocaleKey(keys[0], []));
      } else {
        var count = Math.min(keys.length, attrs.length);
        for (var j = 0; j < count; j += 1) {
          setLocaleAttr(node, attrs[j], translateLocaleKey(keys[j], []));
        }
      }
    }
  }

  function scheduleLocaleFallbackApply() {
    if (localeApplyScheduled) {
      return;
    }
    localeApplyScheduled = true;
    window.setTimeout(function () {
      localeApplyScheduled = false;
      applyLocaleFallbackToDom(document);
    }, 40);
  }

  function installLocalizationFallback() {
    if (window.engine && typeof window.engine.translate === "function" && !window.engine.__rigLocaleFallbackWrapped) {
      var originalEngineTranslate = window.engine.translate.bind(window.engine);
      window.engine.translate = function (text) {
        var translated = "";
        try {
          translated = originalEngineTranslate(text);
        } catch (_ignore) {}
        if (!needsLocaleFallback(translated, text)) {
          return translated;
        }
        return translateLocaleKey(text, []);
      };
      window.engine.__rigLocaleFallbackWrapped = true;
    }

    if (typeof window.locText === "function" && !window.locText.__rigLocaleFallbackWrapped) {
      var originalLocText = window.locText;
      var wrappedLocText = function (localizationKey) {
        var args = Array.prototype.slice.call(arguments, 1);
        var translated = "";
        try {
          translated = originalLocText.apply(this, arguments);
        } catch (_ignore) {}
        if (!needsLocaleFallback(translated, localizationKey)) {
          return translated;
        }
        return translateLocaleKey(localizationKey, args);
      };
      wrappedLocText.__rigLocaleFallbackWrapped = true;
      window.locText = wrappedLocText;
    }

    applyLocaleFallbackToDom(document);
    if (window.localizationManager && typeof window.localizationManager.reload === "function") {
      try {
        window.localizationManager.reload();
      } catch (_ignore) {}
    } else {
      applyLocaleFallbackToDom(document);
    }

    if (!localeObserver && window.MutationObserver && document.body) {
      localeObserver = new window.MutationObserver(function () {
        scheduleLocaleFallbackApply();
      });
      localeObserver.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true
      });
    }
  }

  function setStatus(text) {
    if (!statusEl) {
      statusEl = document.createElement("div");
      statusEl.id = "lua-rig-status";
      statusEl.style.position = "fixed";
      statusEl.style.right = "12px";
      statusEl.style.bottom = "12px";
      statusEl.style.zIndex = "999999";
      statusEl.style.padding = "6px 10px";
      statusEl.style.fontFamily = "monospace";
      statusEl.style.fontSize = "12px";
      statusEl.style.background = "rgba(0, 0, 0, 0.75)";
      statusEl.style.color = "#cfe8ff";
      statusEl.style.border = "1px solid rgba(160, 205, 255, 0.5)";
      document.body.appendChild(statusEl);
    }
    statusEl.textContent = text;
  }

  function splitLines(text) {
    return String(text || "").split(/\r\n|\r|\n/);
  }

  function toHex32(value) {
    var hex = (value >>> 0).toString(16);
    while (hex.length < 8) {
      hex = "0" + hex;
    }
    return hex;
  }

  function hashText32(text) {
    var str = String(text || "");
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i += 1) {
      var code = str.charCodeAt(i);
      var low = code & 0xff;
      var high = (code >>> 8) & 0xff;
      hash ^= low;
      hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
      hash ^= high;
      hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
    }
    return toHex32(hash);
  }

  function makeImportStats(code) {
    var text = String(code || "");
    return {
      code: text,
      charLength: text.length,
      hash32: hashText32(text)
    };
  }

  function getCurrentEditorCode() {
    try {
      if (bridgeCodeMirror && typeof bridgeCodeMirror.getValue === "function") {
        return String(bridgeCodeMirror.getValue() || "");
      }
    } catch (_ignore) {}
    try {
      var textarea = document.getElementById("editor_window");
      if (textarea) {
        return String(textarea.value || "");
      }
    } catch (_ignore2) {}
    return "";
  }

  function sendIdeImportAck(payload) {
    try {
      window.fetch("/api/ide-import-ack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).catch(function (_ignore) {});
    } catch (_ignoreOuter) {}
  }

  function verifyImportApplied(importInfo, applied, stage) {
    var info = importInfo || {};
    var expected = makeImportStats(info.code || "");
    var actual = makeImportStats(getCurrentEditorCode());
    var isMatch = !!applied && expected.charLength === actual.charLength && expected.hash32 === actual.hash32;

    sendIdeImportAck({
      stage: String(stage || ""),
      applied: !!applied,
      match: isMatch,
      playerId: Number(info.playerId || RIG_PLAYER_ID || UNKNOWN_PLAYER_ID),
      lastWriteUtc: String(info.lastWriteUtc || lastImportWriteUtc || ""),
      expectedCharLength: expected.charLength,
      actualCharLength: actual.charLength,
      expectedHash32: expected.hash32,
      actualHash32: actual.hash32
    });

    return isMatch;
  }

  function lineChToOffset(text, line, ch) {
    var lines = splitLines(text);
    var safeLine = Math.max(0, Math.min(lines.length - 1, Number(line) || 0));
    var safeCh = Math.max(0, Number(ch) || 0);
    var offset = 0;
    for (var i = 0; i < safeLine; i += 1) {
      offset += lines[i].length + 1;
    }
    offset += Math.min(safeCh, lines[safeLine].length);
    return offset;
  }

  function offsetToLineCh(text, offset) {
    var lines = splitLines(text);
    var remaining = Math.max(0, Number(offset) || 0);
    for (var i = 0; i < lines.length; i += 1) {
      var lineLen = lines[i].length;
      if (remaining <= lineLen) {
        return { line: i, ch: remaining };
      }
      remaining -= (lineLen + 1);
    }
    var last = Math.max(0, lines.length - 1);
    return { line: last, ch: lines[last].length };
  }

  function createEmitter() {
    var handlers = Object.create(null);
    return {
      on: function (name, fn) {
        if (!handlers[name]) {
          handlers[name] = [];
        }
        handlers[name].push(fn);
      },
      off: function (name, fn) {
        var arr = handlers[name];
        if (!arr) {
          return;
        }
        for (var i = arr.length - 1; i >= 0; i -= 1) {
          if (arr[i] === fn) {
            arr.splice(i, 1);
          }
        }
      },
      emit: function (name) {
        var arr = handlers[name];
        if (!arr || arr.length <= 0) {
          return;
        }
        var copy = arr.slice(0);
        for (var i = 0; i < copy.length; i += 1) {
          try {
            copy[i]();
          } catch (_ignore) {}
        }
      }
    };
  }

  function ensureCodeMirrorShim() {
    var textarea = document.getElementById("editor_window");
    if (!textarea) {
      return null;
    }
    if (textarea.CodeMirror) {
      return textarea.CodeMirror;
    }

    var host = document.getElementById("editor_window_code");
    if (!host) {
      return null;
    }

    var wrapper = host.querySelector(".CodeMirror");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "CodeMirror";
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      wrapper.style.position = "relative";
      if (textarea.parentNode) {
        textarea.parentNode.insertBefore(wrapper, textarea);
      } else {
        host.appendChild(wrapper);
      }
      wrapper.appendChild(textarea);
    }
    wrapper.CodeMirror = null;

    var lineHeightPx = 18;
    var emitter = createEmitter();
    var caretLine = -1;

    var cm = {
      getValue: function () {
        return String(textarea.value || "");
      },
      setValue: function (value) {
        textarea.value = String(value || "");
        caretLine = -1;
        emitter.emit("changes");
        emitter.emit("cursorActivity");
      },
      lineCount: function () {
        return splitLines(textarea.value).length;
      },
      getLine: function (line) {
        var lines = splitLines(textarea.value);
        var idx = Number(line) || 0;
        if (idx < 0 || idx >= lines.length) {
          return "";
        }
        return lines[idx];
      },
      getCursor: function () {
        return offsetToLineCh(textarea.value, textarea.selectionStart || 0);
      },
      setCursor: function (cursor) {
        var line = cursor && typeof cursor.line === "number" ? cursor.line : 0;
        var ch = cursor && typeof cursor.ch === "number" ? cursor.ch : 0;
        var offset = lineChToOffset(textarea.value, line, ch);
        textarea.selectionStart = offset;
        textarea.selectionEnd = offset;
        emitter.emit("cursorActivity");
      },
      getScrollInfo: function () {
        return {
          top: Number(textarea.scrollTop) || 0
        };
      },
      lineAtHeight: function (heightPx) {
        var px = Number(heightPx) || 0;
        return Math.max(0, Math.floor(px / lineHeightPx));
      },
      heightAtLine: function (line) {
        var idx = Number(line) || 0;
        return Math.max(0, idx) * lineHeightPx;
      },
      scrollTo: function (_x, y) {
        if (typeof y === "number") {
          textarea.scrollTop = y;
        }
      },
      hasFocus: function () {
        return document.activeElement === textarea;
      },
      focus: function () {
        textarea.focus();
      },
      refresh: function () {},
      on: emitter.on,
      off: emitter.off,
      addLineClass: function (line) {
        caretLine = Number(line) || 0;
        wrapper.setAttribute("data-caret-line", String(caretLine));
        return caretLine;
      },
      removeLineClass: function () {
        caretLine = -1;
        wrapper.removeAttribute("data-caret-line");
      },
      getWrapperElement: function () {
        return wrapper;
      }
    };

    textarea.addEventListener("input", function () {
      emitter.emit("changes");
      emitter.emit("cursorActivity");
    });
    textarea.addEventListener("keyup", function () {
      emitter.emit("cursorActivity");
    });
    textarea.addEventListener("mouseup", function () {
      emitter.emit("cursorActivity");
    });
    textarea.addEventListener("click", function () {
      emitter.emit("cursorActivity");
    });
    textarea.addEventListener("focus", function () {
      emitter.emit("focus");
    });
    textarea.addEventListener("blur", function () {
      emitter.emit("blur");
    });

    textarea.CodeMirror = cm;
    wrapper.CodeMirror = cm;
    return cm;
  }

  function getText(node) {
    if (!node) {
      return "";
    }
    return String(node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function patchLuaEditorManager(cm) {
    if (!window.LUAEditorManager) {
      window.LUAEditorManager = {};
    }
    var manager = window.LUAEditorManager;

    if (!manager.currentData || typeof manager.currentData !== "object") {
      manager.currentData = {};
    }

    function updateCurrentData() {
      var selectedSlot = document.querySelector("#slots_container .slot.selected input");
      var selectedFilter = document.querySelector("#filters_container .filter.selected");
      var actionName = selectedFilter ? getText(selectedFilter.querySelector(".actionName")) : "";
      manager.currentData.slotName = selectedSlot && typeof selectedSlot.value === "string" ? selectedSlot.value : "";
      manager.currentData.filterName = actionName;
      manager.currentData.eventName = actionName;
      manager.currentData.slot = manager.currentData.slotName;
      manager.currentData.filter = actionName;
    }

    if (typeof manager.setCodeLuaEditor !== "function") {
      manager.setCodeLuaEditor = function (code) {
        cm.setValue(String(code || ""));
      };
    }

    if (typeof manager.apply !== "function") {
      manager.apply = function () {};
    }
    if (typeof manager.cancel !== "function") {
      manager.cancel = function () {};
    }
    if (typeof manager.addNewFilter !== "function") {
      manager.addNewFilter = function () {};
    }
    if (typeof manager.deleteFilter !== "function") {
      manager.deleteFilter = function () {};
    }
    if (typeof manager.reduceSizeActionsList !== "function") {
      manager.reduceSizeActionsList = function () {};
    }
    if (typeof manager.changeFontSize !== "function") {
      manager.changeFontSize = function () {};
    }
    if (typeof manager.resizeErrorList !== "function") {
      manager.resizeErrorList = function () {};
    }

    var slots = document.querySelectorAll("#slots_container .slot");
    for (var i = 0; i < slots.length; i += 1) {
      slots[i].addEventListener("click", function (ev) {
        var all = document.querySelectorAll("#slots_container .slot");
        for (var j = 0; j < all.length; j += 1) {
          all[j].classList.remove("selected");
        }
        var node = ev.currentTarget || ev.target;
        if (node && node.classList) {
          node.classList.add("selected");
        }
        updateCurrentData();
      });
    }

    var filters = document.querySelectorAll("#filters_container .filter");
    for (var k = 0; k < filters.length; k += 1) {
      filters[k].addEventListener("click", function (ev) {
        var all = document.querySelectorAll("#filters_container .filter");
        for (var j = 0; j < all.length; j += 1) {
          all[j].classList.remove("selected");
        }
        var node = ev.currentTarget || ev.target;
        while (node && node.classList && !node.classList.contains("filter")) {
          node = node.parentNode;
        }
        if (node && node.classList) {
          node.classList.add("selected");
        }
        updateCurrentData();
      });
    }

    updateCurrentData();
  }

  function installCppModBridge() {
    if (!window.CPPMod) {
      window.CPPMod = {};
    }

    window.CPPMod.sendModAction = function (modName, actionId, args, payload) {
      var body = {
        modName: modName,
        actionId: actionId,
        args: Array.isArray(args) ? args : [],
        payload: typeof payload === "string" ? payload : String(payload || ""),
        playerId: Number(RIG_PLAYER_ID || UNKNOWN_PLAYER_ID)
      };
      window.fetch("/api/mod-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res.ok) {
          return null;
        }
        return res.json();
      }).then(function (data) {
        if (!data || !data.themeCatalogPayload) {
          return;
        }
        var state = window.__UI_TOOLBOX_LUA_PROBE_STATE__;
        if (state && typeof state.receiveThemeCatalog === "function") {
          state.receiveThemeCatalog(data.themeCatalogPayload);
        }
      }).catch(function (err) {
        console.error("[rig] sendModAction failed", err);
      });
    };
  }

  function ensureContextMenuPlaceholder() {
    if (document.getElementById("main_context_menu")) {
      return;
    }
    var menu = document.createElement("div");
    menu.id = "main_context_menu";
    menu.style.display = "none";
    document.body.appendChild(menu);
  }

  function tryApplyImportedCode(importInfo) {
    var info = importInfo || {};
    var code = String(info.code || "");
    var state = window.__UI_TOOLBOX_LUA_PROBE_STATE__;
    if (!state || typeof state.applyIdeCode !== "function") {
      pendingImportInfo = info;
      return false;
    }
    state.applyIdeCode(code);
    pendingImportInfo = null;
    return true;
  }

  function pollIdeImport() {
    var url = "/api/ide-import?lastWriteUtc=" + encodeURIComponent(lastImportWriteUtc);
    window.fetch(url, {
      cache: "no-store"
    }).then(function (res) {
      if (!res.ok) {
        return null;
      }
      return res.json();
    }).then(function (data) {
      if (!data) {
        return;
      }
      if (typeof data.lastWriteUtc === "string" && data.lastWriteUtc) {
        lastImportWriteUtc = data.lastWriteUtc;
      }
      if (data.updated && typeof data.code === "string") {
        var importInfo = {
          code: String(data.code || ""),
          playerId: Number(data.playerId || RIG_PLAYER_ID || UNKNOWN_PLAYER_ID),
          lastWriteUtc: String(data.lastWriteUtc || lastImportWriteUtc || "")
        };
        if (tryApplyImportedCode(importInfo)) {
          var matched = verifyImportApplied(importInfo, true, "updated");
          setStatus((matched ? "IDE import verified MATCH " : "IDE import verified MISMATCH ") + new Date().toLocaleTimeString());
        } else {
          verifyImportApplied(importInfo, false, "probe_not_ready");
          setStatus("IDE import pending (probe not ready)");
        }
      } else if (pendingImportInfo !== null) {
        var pendingInfo = pendingImportInfo;
        if (tryApplyImportedCode(pendingInfo)) {
          var pendingMatched = verifyImportApplied(pendingInfo, true, "pending_apply");
          setStatus((pendingMatched ? "IDE import verified MATCH " : "IDE import verified MISMATCH ") + new Date().toLocaleTimeString());
        }
      }
    }).catch(function (_ignore) {
      setStatus("Waiting for rig server import endpoint...");
    }).finally(function () {
      window.setTimeout(pollIdeImport, POLL_MS);
    });
  }

  function injectProbe() {
    window.__UI_TOOLBOX_LUA_PROBE_CONFIG = {
      modName: "NQ.UIToolbox",
      actionId: 900001,
      injectActionId: 5,
      constructId: 0,
      installedAt: new Date().toISOString()
    };

    var script = document.createElement("script");
    script.src = "/probe/lua-editor-probe.js?v=" + Date.now();
    script.onload = function () {
      setStatus("Probe loaded. Click IDE Sync in editor header.");
      var pendingInfo = pendingImportInfo;
      if (pendingInfo !== null && tryApplyImportedCode(pendingInfo)) {
        var pendingMatched = verifyImportApplied(pendingInfo, true, "probe_loaded_apply");
        setStatus((pendingMatched ? "IDE import verified MATCH " : "IDE import verified MISMATCH ") + new Date().toLocaleTimeString());
      }
    };
    script.onerror = function () {
      setStatus("Probe failed to load from rig server.");
    };
    document.body.appendChild(script);
  }

  function seedDefaultEditorCode() {
    if (pendingImportInfo !== null) {
      return false;
    }

    var current = String(getCurrentEditorCode() || "");
    if (current.trim().length > 0) {
      return true;
    }

    try {
      if (bridgeCodeMirror && typeof bridgeCodeMirror.setValue === "function") {
        bridgeCodeMirror.setValue(DEFAULT_LUA_SNIPPET);
      } else {
        var textarea = document.getElementById("editor_window");
        if (!textarea) {
          return false;
        }
        textarea.value = DEFAULT_LUA_SNIPPET;
      }
      setStatus("Loaded rig starter snippet.");
      return true;
    } catch (_ignore) {
      return false;
    }
  }

  function scheduleDefaultEditorSeed() {
    var attempts = 0;
    var maxAttempts = 24;
    var delayMs = 160;

    function tick() {
      attempts += 1;
      if (seedDefaultEditorCode()) {
        return;
      }
      if (attempts < maxAttempts) {
        window.setTimeout(tick, delayMs);
      }
    }

    window.setTimeout(tick, 120);
  }

  function boot() {
    var cm = ensureCodeMirrorShim();
    if (!cm) {
      setStatus("CodeMirror shim could not attach to #editor_window.");
      return;
    }
    bridgeCodeMirror = cm;
    installLocalizationFallback();
    installCppModBridge();
    ensureContextMenuPlaceholder();
    patchLuaEditorManager(cm);
    scheduleDefaultEditorSeed();
    injectProbe();
    pollIdeImport();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
