(function () {
  "use strict";

  if (typeof window.__UI_EXTRACTOR_LUA_PROBE_UNINSTALL__ === "function") {
    try {
      window.__UI_EXTRACTOR_LUA_PROBE_UNINSTALL__("reinject");
    } catch (_ignore) {}
  }

  if (window.__UI_EXTRACTOR_LUA_PROBE_INSTALLED__) {
    return;
  }

  window.__UI_EXTRACTOR_LUA_PROBE_INSTALLED__ = true;

  var cfg = window.__UI_EXTRACTOR_LUA_PROBE_CONFIG || {};
  var modName = cfg.modName || "NQ.UIExtractor";
  var actionId = cfg.actionId || 900001;
  var dumpId = "lua-probe-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
  var state = {
    menuObserved: false,
    menuHits: 0,
    editorVisible: false,
    managerWrapped: false,
    activeTheme: "yellow",
    lastAppliedTheme: "",
    scrollTopByContext: Object.create(null),
    lastContextKey: "",
    activeFilterFingerprint: "",
    activeFilterIndex: -1,
    currentSnippetKey: "",
    caretHighlightEnabled: false,
    caretBindingsCodeMirror: null,
    setCodeSwitchSeq: 0,
    switchInProgress: false,
    activeSwitchSeq: 0,
    intervalId: 0,
    menuObserver: null
  };
  var colorThemes = [
    {
      name: "green",
      dot: "#5ce890",
      accent: "rgba(92,232,144,0.95)",
      header: "rgba(14,54,39,0.96)",
      caretBg: "rgba(92,232,144,0.20)"
    },
    {
      name: "yellow",
      dot: "#f4d25d",
      accent: "rgba(244,210,93,0.95)",
      header: "rgba(54,45,18,0.96)",
      caretBg: "rgba(244,210,93,0.20)"
    },
    {
      name: "red",
      dot: "#ec6b6b",
      accent: "rgba(236,107,107,0.95)",
      header: "rgba(58,20,24,0.96)",
      caretBg: "rgba(236,107,107,0.20)"
    }
  ];
  var quickEditLuaMenuItemId = "ui-extractor-quick-edit-lua";
  var quickInjectProbeMenuItemId = "ui-extractor-quick-inject-lua";

  function nowIso() {
    return new Date().toISOString();
  }

  function safeLog() {
    try {
      if (window.console && typeof window.console.log === "function") {
        var args = ["[lua-probe]"];
        for (var i = 0; i < arguments.length; i += 1) {
          args.push(arguments[i]);
        }
        window.console.log.apply(window.console, args);
      }
    } catch (_ignore) {}
  }

  function sendPacket(type, data) {
    try {
      if (!window.CPPMod || typeof window.CPPMod.sendModAction !== "function") {
        return;
      }
      var payload = JSON.stringify({
        type: type,
        extractor: "lua-editor-probe",
        dumpId: dumpId,
        timestamp: nowIso(),
        data: data || {}
      });
      window.CPPMod.sendModAction(modName, actionId, [], payload);
    } catch (err) {
      safeLog("sendPacket failed", String(err && err.message ? err.message : err));
    }
  }

  function summarizeArg(arg) {
    var kind = typeof arg;
    if (arg === null || kind === "undefined") {
      return arg;
    }
    if (kind === "string") {
      return {
        type: "string",
        len: arg.length,
        preview: arg.slice(0, 96)
      };
    }
    if (kind === "number" || kind === "boolean") {
      return arg;
    }
    if (Array.isArray(arg)) {
      return {
        type: "array",
        len: arg.length
      };
    }
    if (kind === "object") {
      var keys = [];
      try {
        keys = Object.keys(arg).slice(0, 8);
      } catch (_ignore) {
        keys = [];
      }
      return {
        type: "object",
        keys: keys
      };
    }
    return String(arg);
  }

  function summarizeArgs(args) {
    var out = [];
    for (var i = 0; i < args.length; i += 1) {
      out.push(summarizeArg(args[i]));
    }
    return out;
  }

  function collectManagerIdentifiers() {
    var manager = window.LUAEditorManager;
    if (!manager || !manager.currentData || typeof manager.currentData !== "object") {
      return null;
    }

    var data = manager.currentData;
    var keys = [];
    try {
      keys = Object.keys(data);
    } catch (_ignoreKeys) {
      keys = [];
    }

    var identifiers = {};
    var count = 0;
    for (var i = 0; i < keys.length; i += 1) {
      var key = String(keys[i] || "");
      if (!key) {
        continue;
      }

      var lower = key.toLowerCase();
      var isInteresting = lower === "slot" ||
        lower === "filter" ||
        lower === "event" ||
        lower === "action" ||
        lower.indexOf("id") >= 0 ||
        lower.indexOf("uuid") >= 0 ||
        lower.indexOf("name") >= 0;
      if (!isInteresting) {
        continue;
      }

      var value = data[key];
      if (value === null || typeof value === "undefined") {
        continue;
      }

      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        identifiers[key] = limitText(String(value), 96);
        count += 1;
      } else if (Array.isArray(value)) {
        identifiers[key] = "array:" + value.length;
        count += 1;
      }

      if (count >= 20) {
        break;
      }
    }

    if (count <= 0) {
      return {
        keys: keys.slice(0, 24)
      };
    }

    return {
      keys: keys.slice(0, 24),
      identifiers: identifiers
    };
  }

  function hashStringFNV1a(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  function summarizeCodeForSwitch(value) {
    if (typeof value !== "string") {
      return summarizeArg(value);
    }

    var wasSampled = value.length > 16384;
    var sample = wasSampled ? (value.slice(0, 8192) + "\n...\n" + value.slice(value.length - 8192)) : value;
    return {
      type: "string",
      len: value.length,
      hash: hashStringFNV1a(sample),
      sampled: wasSampled,
      preview: value.slice(0, 96)
    };
  }

  function getSnippetMemoryKeyFromCode(code) {
    if (typeof code !== "string") {
      return "";
    }

    var normalized = code.replace(/\r\n?/g, "\n");
    var sample = normalized;
    if (sample.length > 65536) {
      sample = sample.slice(0, 32768) + "\n...\n" + sample.slice(sample.length - 32768);
    }
    return "snippet:" + normalized.length + ":" + hashStringFNV1a(sample);
  }

  function getSnippetMemoryKeyFromEditor(codeMirror) {
    if (!codeMirror || typeof codeMirror.getValue !== "function") {
      return "";
    }
    try {
      return getSnippetMemoryKeyFromCode(String(codeMirror.getValue() || ""));
    } catch (_ignoreGetValue) {
      return "";
    }
  }

  function syncCurrentSnippetKeyFromEditor() {
    var key = getSnippetMemoryKeyFromEditor(getLuaCodeMirror());
    if (key) {
      state.currentSnippetKey = key;
    }
  }

  function getContextSnapshot() {
    var codeMirror = getLuaCodeMirror();
    var managerKey = getManagerContextKey();
    var domKey = getDomContextKey();
    var contextKey = managerKey || domKey || getEditorContextKey(codeMirror) || state.lastContextKey || "";
    var snapshot = {
      contextKey: contextKey
    };

    if (managerKey) {
      snapshot.managerKey = managerKey;
    }
    if (domKey) {
      snapshot.domKey = domKey;
    }

    var managerData = collectManagerIdentifiers();
    if (managerData) {
      snapshot.managerData = managerData;
    }

    if (codeMirror && typeof codeMirror.getCursor === "function") {
      try {
        var cursor = codeMirror.getCursor();
        if (cursor && typeof cursor.line === "number") {
          snapshot.cursor = {
            line: cursor.line,
            ch: typeof cursor.ch === "number" ? cursor.ch : 0
          };
        }
      } catch (_ignoreCursor) {}
    }

    return snapshot;
  }

  function addProbeStyle() {
    if (document.getElementById("ui-extractor-lua-probe-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "ui-extractor-lua-probe-style";
    style.type = "text/css";
    style.textContent = ""
      + "#dpu_editor[data-lua-probe-active=\"1\"]{"
      + "--lua-probe-accent:rgba(244,210,93,0.95);"
      + "--lua-probe-header-bg:rgba(54,45,18,0.96);"
      + "--lua-probe-caret-line-bg:rgba(244,210,93,0.20);}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper{"
      + "box-shadow:0 0 0 1px var(--lua-probe-accent), 0 0 22px var(--lua-probe-accent) !important;"
      + "border-color:var(--lua-probe-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .editor_header .header_container{"
      + "position:relative;"
      + "background:var(--lua-probe-header-bg) !important;"
      + "border-bottom:1px solid var(--lua-probe-accent) !important;}"
      + "#dpu_editor #ui-extractor-lua-theme-dots{"
      + "position:absolute;left:12px;top:50%;transform:translateY(-50%);"
      + "display:flex;gap:8px;align-items:center;z-index:11;}"
      + "#dpu_editor #ui-extractor-lua-theme-dots .lua-theme-dot{"
      + "width:12px;height:12px;border-radius:999px;border:1px solid rgba(255,255,255,0.6);"
      + "padding:0;cursor:pointer;opacity:0.88;}"
      + "#dpu_editor #ui-extractor-lua-theme-dots .lua-theme-dot[data-active=\"1\"]{"
      + "transform:scale(1.1);opacity:1;box-shadow:0 0 0 1px rgba(0,0,0,0.55),0 0 8px rgba(255,255,255,0.35);}"
      + "#dpu_editor #ui-extractor-lua-caret-toggle{"
      + "margin-left:8px;min-width:128px;height:34px;padding:0 12px;cursor:pointer;"
      + "border:1px solid rgba(190,225,235,0.35);background:rgba(9,19,24,0.8);color:#b7d8e0;"
      + "font-size:17px;line-height:32px;font-family:monospace;letter-spacing:0.3px;}"
      + "#dpu_editor #ui-extractor-lua-caret-toggle[data-on=\"1\"]{"
      + "border-color:var(--lua-probe-accent);color:#ffffff;"
      + "box-shadow:0 0 0 1px rgba(0,0,0,0.35) inset;}"
      + "#dpu_editor .CodeMirror .lua-probe-caret-line{"
      + "background:var(--lua-probe-caret-line-bg) !important;}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"]{"
      + "border-color:var(--lua-probe-accent) !important;"
      + "box-shadow:inset 0 0 0 1px rgba(0,0,0,0.38);}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"]::after{"
      + "content:\"\";position:absolute;top:0;left:-7px;width:4px;height:100%;"
      + "background-color:var(--lua-probe-accent);box-shadow:0 1px 2px 1px rgba(0,0,0,0.72);}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"] .actionName{"
      + "color:#ffffff;}"
      + "#main_context_menu [data-lua-probe-hit=\"1\"]{"
      + "outline:1px dashed rgba(250,212,122,0.75);outline-offset:-1px;}";

    (document.head || document.documentElement).appendChild(style);
  }

  function addProbeBadge() {
    var existing = document.getElementById("ui-extractor-lua-probe-badge");
    if (existing) {
      return;
    }

    var badge = document.createElement("div");
    badge.id = "ui-extractor-lua-probe-badge";
    badge.textContent = "LUA PROBE ACTIVE";
    badge.style.position = "fixed";
    badge.style.top = "14px";
    badge.style.right = "14px";
    badge.style.zIndex = "999999";
    badge.style.background = "rgba(8,16,20,0.9)";
    badge.style.color = "#fad47a";
    badge.style.border = "2px solid rgba(250,212,122,0.9)";
    badge.style.padding = "8px 14px";
    badge.style.fontSize = "15px";
    badge.style.letterSpacing = "0.6px";
    badge.style.fontFamily = "monospace";
    badge.style.pointerEvents = "none";

    document.body.appendChild(badge);
  }

  function textOf(node) {
    if (!node) {
      return "";
    }
    var txt = "";
    try {
      txt = node.textContent || node.innerText || "";
    } catch (_ignore) {
      txt = "";
    }
    return String(txt).replace(/\s+/g, " ").trim();
  }

  function limitText(value, maxLength) {
    var s = String(value || "");
    if (s.length <= maxLength) {
      return s;
    }
    return s.slice(0, maxLength);
  }

  function getLuaCodeMirror() {
    try {
      var textArea = document.getElementById("editor_window");
      if (textArea && textArea.CodeMirror) {
        return textArea.CodeMirror;
      }
    } catch (_ignore1) {}

    try {
      var wrapper = document.querySelector("#editor_window_code .CodeMirror");
      if (wrapper && wrapper.CodeMirror) {
        return wrapper.CodeMirror;
      }
    } catch (_ignore2) {}

    return null;
  }

  function getManagerContextKey() {
    var manager = window.LUAEditorManager;
    if (!manager || !manager.currentData) {
      return "";
    }

    var data = manager.currentData;
    var keys = [
      "slotId",
      "slot",
      "slotName",
      "slotUuid",
      "slotIndex",
      "filterId",
      "filter",
      "filterName",
      "action",
      "actionName",
      "eventName",
      "event",
      "eventId"
    ];
    var parts = [];

    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var value = data[key];
      if (value === null || typeof value === "undefined") {
        continue;
      }
      var strValue = String(value);
      if (!strValue) {
        continue;
      }
      parts.push(key + "=" + limitText(strValue, 48));
    }

    if (parts.length > 0) {
      return "mgr:" + parts.join("|");
    }

    try {
      var json = JSON.stringify(data);
      if (json) {
        return "mgrjson:" + limitText(json, 180);
      }
    } catch (_ignore) {}

    return "";
  }

  function findFirstText(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var node = document.querySelector(selectors[i]);
        var text = textOf(node);
        if (text) {
          return limitText(text, 64);
        }
      } catch (_ignore) {}
    }
    return "";
  }

  function getDomContextKey() {
    var slotText = findFirstText([
      "#slots_container .slot.selected",
      "#slots_container .slot.active",
      "#slots_container .slot.current",
      "#slots_container .slot.focus",
      "#slots_container .slot[data-selected=\"true\"]",
      "#slots_container .slot[aria-selected=\"true\"]"
    ]);
    var filterText = findFirstText([
      "#filters_container .filter.selected",
      "#filters_container .filter.active",
      "#filters_container .filter.current",
      "#filters_container .filter.focus",
      "#filters_container .filter[data-selected=\"true\"]",
      "#filters_container .filter[aria-selected=\"true\"]"
    ]);

    if (!slotText && !filterText) {
      return "";
    }

    return "dom:" + slotText + "::" + filterText;
  }

  function normalizeProbeText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function getVisibleFilterNodes() {
    var root = document.getElementById("filters_container");
    if (!root || !root.querySelectorAll) {
      return [];
    }

    var nodes = root.querySelectorAll(".filter");
    var out = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || !node.classList) {
        continue;
      }
      if (node.classList.contains("filterTemplate")) {
        continue;
      }
      try {
        var computed = window.getComputedStyle ? window.getComputedStyle(node, null) : null;
        if (computed && computed.display === "none") {
          continue;
        }
      } catch (_ignoreComputed) {}
      out.push(node);
    }
    return out;
  }

  function getFilterActionText(filterNode) {
    if (!filterNode || !filterNode.querySelector) {
      return "";
    }
    return textOf(filterNode.querySelector(".actionName"));
  }

  function getFilterSignature(filterNode) {
    if (!filterNode) {
      return "";
    }

    var actionName = normalizeProbeText(getFilterActionText(filterNode));
    var args = [];
    if (filterNode.querySelectorAll) {
      try {
        var inputs = filterNode.querySelectorAll(".actionInputs input");
        for (var i = 0; i < inputs.length; i += 1) {
          var input = inputs[i];
          if (!input) {
            continue;
          }
          var rawValue = "";
          if (typeof input.value !== "undefined") {
            rawValue = input.value;
          } else if (typeof input.getAttribute === "function") {
            rawValue = input.getAttribute("value") || "";
          }
          var normalized = normalizeProbeText(rawValue);
          if (normalized) {
            args.push(normalized);
          }
        }
      } catch (_ignoreInputs) {}
    }

    return actionName + "|" + args.join("|");
  }

  function clearActiveFilterMarker() {
    var nodes = getVisibleFilterNodes();
    for (var i = 0; i < nodes.length; i += 1) {
      try {
        nodes[i].removeAttribute("data-lua-probe-active-filter");
      } catch (_ignoreAttr) {}
    }
  }

  function setActiveFilterMarker(filterNode) {
    var nodes = getVisibleFilterNodes();
    var activeIndex = -1;
    var found = false;

    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var isActive = node === filterNode;
      if (isActive) {
        activeIndex = i;
        found = true;
      }
      try {
        if (isActive) {
          node.setAttribute("data-lua-probe-active-filter", "1");
        } else {
          node.removeAttribute("data-lua-probe-active-filter");
        }
      } catch (_ignoreSetAttr) {}
    }

    if (found) {
      state.activeFilterIndex = activeIndex;
      state.activeFilterFingerprint = getFilterSignature(filterNode);
    } else {
      state.activeFilterIndex = -1;
      state.activeFilterFingerprint = "";
    }
  }

  function getManagerFilterHints() {
    var manager = window.LUAEditorManager;
    if (!manager || !manager.currentData || typeof manager.currentData !== "object") {
      return [];
    }

    var data = manager.currentData;
    var keys = ["filterName", "filter", "actionName", "action", "eventName", "event", "filterId", "eventId"];
    var hints = [];

    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var value = data[key];
      if (value === null || typeof value === "undefined") {
        continue;
      }
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        continue;
      }
      var normalized = normalizeProbeText(String(value));
      if (!normalized) {
        continue;
      }

      var alreadyPresent = false;
      for (var j = 0; j < hints.length; j += 1) {
        if (hints[j] === normalized) {
          alreadyPresent = true;
          break;
        }
      }
      if (!alreadyPresent) {
        hints.push(normalized);
      }
    }

    return hints;
  }

  function findDomSelectedFilterNode() {
    var selectors = [
      "#filters_container .filter.selected",
      "#filters_container .filter.active",
      "#filters_container .filter.current",
      "#filters_container .filter.focus",
      "#filters_container .filter[data-selected=\"true\"]",
      "#filters_container .filter[aria-selected=\"true\"]"
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var node = document.querySelector(selectors[i]);
        if (node && node.classList && !node.classList.contains("filterTemplate")) {
          return node;
        }
      } catch (_ignoreSelector) {}
    }
    return null;
  }

  function findFilterNodeByHints(hints) {
    if (!hints || hints.length <= 0) {
      return null;
    }

    var nodes = getVisibleFilterNodes();
    if (nodes.length <= 0) {
      return null;
    }

    for (var i = 0; i < nodes.length; i += 1) {
      var actionText = normalizeProbeText(getFilterActionText(nodes[i]));
      if (!actionText) {
        continue;
      }
      for (var j = 0; j < hints.length; j += 1) {
        if (actionText === hints[j]) {
          return nodes[i];
        }
      }
    }

    for (var k = 0; k < nodes.length; k += 1) {
      var rowText = normalizeProbeText(textOf(nodes[k]));
      if (!rowText) {
        continue;
      }
      for (var h = 0; h < hints.length; h += 1) {
        if (rowText.indexOf(hints[h]) >= 0) {
          return nodes[k];
        }
      }
    }

    return null;
  }

  function refreshActiveFilterMarker() {
    var selectedNode = findDomSelectedFilterNode();
    if (selectedNode) {
      setActiveFilterMarker(selectedNode);
      return;
    }

    var hintedNode = findFilterNodeByHints(getManagerFilterHints());
    if (hintedNode) {
      setActiveFilterMarker(hintedNode);
      return;
    }

    var nodes = getVisibleFilterNodes();
    if (nodes.length <= 0) {
      state.activeFilterIndex = -1;
      state.activeFilterFingerprint = "";
      return;
    }

    if (state.activeFilterFingerprint) {
      for (var i = 0; i < nodes.length; i += 1) {
        if (getFilterSignature(nodes[i]) === state.activeFilterFingerprint) {
          setActiveFilterMarker(nodes[i]);
          return;
        }
      }
    }

    if (state.activeFilterIndex >= 0 && state.activeFilterIndex < nodes.length) {
      setActiveFilterMarker(nodes[state.activeFilterIndex]);
      return;
    }

    clearActiveFilterMarker();
  }

  function getEditorContextKey(codeMirror) {
    var managerKey = getManagerContextKey();
    if (managerKey) {
      return managerKey;
    }

    var domKey = getDomContextKey();
    if (domKey) {
      return domKey;
    }

    if (codeMirror) {
      try {
        var lineCount = typeof codeMirror.lineCount === "function" ? codeMirror.lineCount() : 0;
        var firstLine = lineCount > 0 && typeof codeMirror.getLine === "function" ? codeMirror.getLine(0) : "";
        return "code:" + lineCount + ":" + limitText(firstLine, 64);
      } catch (_ignore) {}
    }

    return "";
  }

  function syncCurrentContextKey(forceDuringSwitch) {
    if (!forceDuringSwitch && state.switchInProgress) {
      return;
    }
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }
    var snippetKey = getSnippetMemoryKeyFromEditor(codeMirror);
    if (snippetKey) {
      state.currentSnippetKey = snippetKey;
    }
    var key = getEditorContextKey(codeMirror);
    if (key) {
      state.lastContextKey = key;
    }
  }

  function rememberTopLineForKey(keyHint) {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror || typeof codeMirror.getScrollInfo !== "function") {
      return;
    }

    var key = keyHint || getEditorContextKey(codeMirror) || state.lastContextKey || "default";
    state.lastContextKey = key;

    try {
      var scrollInfo = codeMirror.getScrollInfo();
      var topPx = scrollInfo && typeof scrollInfo.top === "number" ? scrollInfo.top : 0;
      var topLine = 0;
      var hasTopLine = false;
      var cursorLine = 0;
      var cursorCh = 0;
      var hadFocus = false;

      if (typeof codeMirror.lineAtHeight === "function") {
        topLine = codeMirror.lineAtHeight(topPx, "local");
        hasTopLine = typeof topLine === "number" && topLine >= 0;
      }

      if (typeof codeMirror.getCursor === "function") {
        var cursor = codeMirror.getCursor();
        if (cursor && typeof cursor.line === "number") {
          cursorLine = cursor.line;
        }
        if (cursor && typeof cursor.ch === "number") {
          cursorCh = cursor.ch;
        }
        if (!hasTopLine) {
          topLine = cursorLine;
        }
      }

      if (typeof codeMirror.hasFocus === "function") {
        hadFocus = codeMirror.hasFocus();
      }

      if (typeof topLine === "number" && topLine >= 0) {
        state.scrollTopByContext[key] = {
          topLine: topLine,
          cursorLine: cursorLine,
          cursorCh: cursorCh,
          hadFocus: hadFocus
        };
      }
    } catch (_ignore) {}
  }

  function restoreTopLineForCurrentKey(keyHint) {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return false;
    }

    var key = keyHint || getEditorContextKey(codeMirror) || state.lastContextKey;
    if (!key) {
      return false;
    }
    state.lastContextKey = key;

    var remembered = state.scrollTopByContext[key];
    var rememberedTopLine = -1;
    var rememberedCursorLine = -1;
    var rememberedCursorCh = 0;
    var shouldFocus = false;

    if (typeof remembered === "number") {
      rememberedTopLine = remembered;
      rememberedCursorLine = remembered;
    } else if (remembered && typeof remembered === "object") {
      if (typeof remembered.topLine === "number") {
        rememberedTopLine = remembered.topLine;
      }
      if (typeof remembered.cursorLine === "number") {
        rememberedCursorLine = remembered.cursorLine;
      }
      if (typeof remembered.cursorCh === "number") {
        rememberedCursorCh = remembered.cursorCh;
      }
      shouldFocus = !!remembered.hadFocus;
    }

    if (typeof rememberedTopLine !== "number" || rememberedTopLine < 0) {
      return false;
    }

    try {
      var lineCount = typeof codeMirror.lineCount === "function" ? codeMirror.lineCount() : 0;
      if (lineCount > 0) {
        if (rememberedTopLine >= lineCount) {
          rememberedTopLine = lineCount - 1;
        }
        if (rememberedCursorLine < 0 || rememberedCursorLine >= lineCount) {
          rememberedCursorLine = rememberedTopLine;
        }
      }

      if (rememberedCursorLine < 0) {
        rememberedCursorLine = rememberedTopLine;
      }
      if (rememberedCursorCh < 0) {
        rememberedCursorCh = 0;
      }

      if (typeof codeMirror.heightAtLine === "function" && typeof codeMirror.scrollTo === "function") {
        var topPx = codeMirror.heightAtLine(rememberedTopLine, "local");
        codeMirror.scrollTo(null, topPx);
      }

      var allowCursorRestore = shouldFocus;
      if (!allowCursorRestore && typeof codeMirror.hasFocus === "function") {
        allowCursorRestore = codeMirror.hasFocus();
      }

      if (allowCursorRestore && typeof codeMirror.setCursor === "function") {
        codeMirror.setCursor({ line: rememberedCursorLine, ch: rememberedCursorCh });
      }
      if (shouldFocus && typeof codeMirror.focus === "function") {
        codeMirror.focus();
      }
    } catch (_ignore) {}

    if (state.caretHighlightEnabled) {
      window.setTimeout(function () {
        updateCaretLineHighlight();
      }, 0);
    }
    return true;
  }

  function captureTopLineFromUiInteraction(ev) {
    try {
      var target = ev.target;
      if (!target || target.nodeType !== 1 || typeof target.closest !== "function") {
        return;
      }

      if (ev && ev.type && ev.type !== "mousedown") {
        return;
      }

      var slotNode = target.closest("#slots_container .slot");
      var filterNode = target.closest("#filters_container .filter");
      if (slotNode || filterNode) {
        syncCurrentSnippetKeyFromEditor();
        if (state.currentSnippetKey) {
          rememberTopLineForKey(state.currentSnippetKey);
        }

        var codeMirror = getLuaCodeMirror();
        var currentContextKey = getEditorContextKey(codeMirror) || state.lastContextKey;
        if (currentContextKey) {
          rememberTopLineForKey(currentContextKey);
        }

        if (filterNode) {
          setActiveFilterMarker(filterNode);
        } else if (slotNode) {
          clearActiveFilterMarker();
          state.activeFilterIndex = -1;
          state.activeFilterFingerprint = "";
        }
        sendPacket("lua_ui_snippet_nav_click", {
          kind: slotNode ? "slot" : "filter",
          text: limitText(textOf(slotNode || filterNode), 96),
          contextBefore: getContextSnapshot()
        });
      }
    } catch (_ignore) {}
  }

  function ensureEditorSwitchHooks() {
    var root = document.getElementById("dpu_editor");
    if (!root || root.__luaProbeSwitchHooksBound) {
      return;
    }

    root.__luaProbeSwitchHooksBound = true;
    root.addEventListener("mousedown", captureTopLineFromUiInteraction, true);
  }

  function getThemeByName(themeName) {
    for (var i = 0; i < colorThemes.length; i += 1) {
      if (colorThemes[i].name === themeName) {
        return colorThemes[i];
      }
    }
    return colorThemes[1];
  }

  function updateThemeDotSelection(activeThemeName) {
    var dotsRoot = document.getElementById("ui-extractor-lua-theme-dots");
    if (!dotsRoot || !dotsRoot.querySelectorAll) {
      return;
    }
    var dots = dotsRoot.querySelectorAll(".lua-theme-dot");
    for (var i = 0; i < dots.length; i += 1) {
      var dot = dots[i];
      var isActive = String(dot.getAttribute("data-theme") || "") === activeThemeName;
      dot.setAttribute("data-active", isActive ? "1" : "0");
    }
  }

  function updateCaretToggleVisual() {
    var toggle = document.getElementById("ui-extractor-lua-caret-toggle");
    if (!toggle) {
      return;
    }
    toggle.setAttribute("data-on", state.caretHighlightEnabled ? "1" : "0");
    toggle.textContent = state.caretHighlightEnabled ? "Line HL On" : "Line HL Off";
  }

  function clearCaretLineHighlight(codeMirror) {
    if (!codeMirror) {
      return;
    }
    if (codeMirror.__luaProbeCaretLineHandle !== null &&
        typeof codeMirror.__luaProbeCaretLineHandle !== "undefined" &&
        typeof codeMirror.removeLineClass === "function") {
      try {
        codeMirror.removeLineClass(codeMirror.__luaProbeCaretLineHandle, "background", "lua-probe-caret-line");
      } catch (_ignore) {}
    }

    try {
      var wrapper = typeof codeMirror.getWrapperElement === "function" ? codeMirror.getWrapperElement() : null;
      if (wrapper && wrapper.querySelectorAll) {
        var nodes = wrapper.querySelectorAll(".lua-probe-caret-line");
        for (var i = 0; i < nodes.length; i += 1) {
          var node = nodes[i];
          if (node && node.classList && typeof node.classList.remove === "function") {
            node.classList.remove("lua-probe-caret-line");
          } else if (node && typeof node.className === "string") {
            node.className = node.className.replace(/\blua-probe-caret-line\b/g, "").replace(/\s+/g, " ").trim();
          }
        }
      }
    } catch (_ignoreDomClear) {}

    codeMirror.__luaProbeCaretLineHandle = null;
  }

  function updateCaretLineHighlight() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }

    clearCaretLineHighlight(codeMirror);

    if (state.switchInProgress) {
      return;
    }

    if (!state.caretHighlightEnabled ||
        typeof codeMirror.getCursor !== "function" ||
        typeof codeMirror.addLineClass !== "function") {
      return;
    }

    try {
      var cursor = codeMirror.getCursor();
      if (!cursor || typeof cursor.line !== "number") {
        return;
      }
      codeMirror.__luaProbeCaretLineHandle = codeMirror.addLineClass(cursor.line, "background", "lua-probe-caret-line");
    } catch (_ignore) {}
  }

  function setCaretHighlightEnabled(enabled, emitPacket) {
    state.caretHighlightEnabled = !!enabled;
    updateCaretToggleVisual();
    updateCaretLineHighlight();

    if (emitPacket) {
      sendPacket("lua_caret_highlight_toggle", {
        enabled: state.caretHighlightEnabled
      });
    }
  }

  function detachCaretHighlightBindings(codeMirror) {
    if (!codeMirror) {
      return;
    }

    var handlers = codeMirror.__luaProbeCaretHandlers;
    if (handlers && typeof codeMirror.off === "function") {
      try {
        if (typeof handlers.cursorActivity === "function") {
          codeMirror.off("cursorActivity", handlers.cursorActivity);
        }
      } catch (_ignoreOffCursor) {}
      try {
        if (typeof handlers.scroll === "function") {
          codeMirror.off("scroll", handlers.scroll);
        }
      } catch (_ignoreOffScroll) {}
      try {
        if (typeof handlers.changes === "function") {
          codeMirror.off("changes", handlers.changes);
        }
      } catch (_ignoreOffChanges) {}
    }

    codeMirror.__luaProbeCaretHandlers = null;
    codeMirror.__luaProbeCaretBindingsBound = false;
    codeMirror.__luaProbeCaretBindingsOwner = "";
  }

  function ensureCaretHighlightBindings() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror || typeof codeMirror.on !== "function") {
      return;
    }

    if (state.caretBindingsCodeMirror && state.caretBindingsCodeMirror !== codeMirror) {
      detachCaretHighlightBindings(state.caretBindingsCodeMirror);
      state.caretBindingsCodeMirror = null;
    }

    var owner = String(codeMirror.__luaProbeCaretBindingsOwner || "");
    if ((owner && owner !== dumpId) || (!owner && codeMirror.__luaProbeCaretBindingsBound)) {
      detachCaretHighlightBindings(codeMirror);
    }

    if (String(codeMirror.__luaProbeCaretBindingsOwner || "") === dumpId && codeMirror.__luaProbeCaretHandlers) {
      state.caretBindingsCodeMirror = codeMirror;
      return;
    }

    var handlers = {};

    handlers.cursorActivity = function () {
      if (state.switchInProgress) {
        return;
      }
      syncCurrentContextKey();
      rememberTopLineForKey(state.lastContextKey);
      if (state.currentSnippetKey) {
        rememberTopLineForKey(state.currentSnippetKey);
      }
      updateCaretLineHighlight();
      if (!state.caretHighlightEnabled) {
        window.setTimeout(function () {
          if (!state.caretHighlightEnabled) {
            clearCaretLineHighlight(getLuaCodeMirror());
          }
        }, 0);
      }
    };

    handlers.scroll = function () {
      if (state.switchInProgress) {
        return;
      }
      syncCurrentContextKey();
      rememberTopLineForKey(state.lastContextKey);
      if (state.currentSnippetKey) {
        rememberTopLineForKey(state.currentSnippetKey);
      }
      if (!state.caretHighlightEnabled) {
        clearCaretLineHighlight(getLuaCodeMirror());
      }
    };

    handlers.changes = function () {
      window.setTimeout(function () {
        updateCaretLineHighlight();
      }, 0);
    };

    codeMirror.on("cursorActivity", handlers.cursorActivity);
    codeMirror.on("scroll", handlers.scroll);
    codeMirror.on("changes", handlers.changes);

    codeMirror.__luaProbeCaretHandlers = handlers;
    codeMirror.__luaProbeCaretBindingsBound = true;
    codeMirror.__luaProbeCaretBindingsOwner = dumpId;
    state.caretBindingsCodeMirror = codeMirror;
  }

  function ensureCaretHighlightToggle() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    var fontSizeWrapper = root.querySelector(".header_editor .font_size_wrapper");
    if (!fontSizeWrapper) {
      return;
    }

    var toggle = document.getElementById("ui-extractor-lua-caret-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.id = "ui-extractor-lua-caret-toggle";
      toggle.addEventListener("click", function () {
        setCaretHighlightEnabled(!state.caretHighlightEnabled, true);
      }, true);
    }

    if (toggle.parentNode !== fontSizeWrapper) {
      fontSizeWrapper.appendChild(toggle);
    }

    updateCaretToggleVisual();
    ensureCaretHighlightBindings();
    updateCaretLineHighlight();
  }

  function applyTheme(themeName, emitPacket) {
    var root = document.getElementById("dpu_editor");
    if (!root) {
      return;
    }

    var theme = getThemeByName(themeName);
    var sameTheme = state.lastAppliedTheme === theme.name;
    state.activeTheme = theme.name;

    if (!sameTheme || emitPacket) {
      root.style.setProperty("--lua-probe-accent", theme.accent);
      root.style.setProperty("--lua-probe-header-bg", theme.header);
      root.style.setProperty("--lua-probe-caret-line-bg", theme.caretBg);
      state.lastAppliedTheme = theme.name;
    }
    updateThemeDotSelection(theme.name);

    if (emitPacket) {
      sendPacket("lua_theme_changed", {
        theme: theme.name,
        accent: theme.accent,
        header: theme.header,
        caretBg: theme.caretBg
      });
    }
  }

  function ensureThemeSwitcher() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    var header = root.querySelector(".editor_header .header_container");
    if (!header) {
      return;
    }

    var switcher = document.getElementById("ui-extractor-lua-theme-dots");
    if (!switcher) {
      switcher = document.createElement("div");
      switcher.id = "ui-extractor-lua-theme-dots";

      for (var i = 0; i < colorThemes.length; i += 1) {
        (function (theme) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "lua-theme-dot";
          dot.style.background = theme.dot;
          dot.setAttribute("data-theme", theme.name);
          dot.setAttribute("data-active", "0");
          dot.setAttribute("title", "Probe color: " + theme.name);
          dot.addEventListener("click", function () {
            applyTheme(theme.name, true);
          }, true);
          switcher.appendChild(dot);
        })(colorThemes[i]);
      }
    }

    if (switcher.parentNode !== header) {
      header.appendChild(switcher);
    }

    if (state.lastAppliedTheme !== (state.activeTheme || "yellow")) {
      applyTheme(state.activeTheme || "yellow", false);
    } else {
      updateThemeDotSelection(state.activeTheme || "yellow");
    }
  }

  function isInterestingMenuText(txtLower) {
    return txtLower.indexOf("lua") >= 0 ||
      txtLower.indexOf("script") >= 0 ||
      txtLower.indexOf("program") >= 0;
  }

  function getInjectProbeActionId() {
    var raw = cfg.injectActionId;
    if (typeof raw === "number" && raw > 0) {
      return raw;
    }

    var parsed = parseInt(String(raw || ""), 10);
    if (parsed > 0) {
      return parsed;
    }

    return 5;
  }

  function isMenuEntryNode(node) {
    if (!node || node.nodeType !== 1) {
      return false;
    }
    if (String(node.tagName || "").toUpperCase() !== "LI") {
      return false;
    }
    if (!node.classList) {
      return false;
    }
    return node.classList.contains("menu");
  }

  function findMenuEntryByText(menuRoot, textNeedle) {
    if (!menuRoot || !menuRoot.querySelectorAll || !textNeedle) {
      return null;
    }

    var needle = normalizeProbeText(textNeedle);
    var entries = menuRoot.querySelectorAll("li.menu");
    var best = null;
    var bestLength = Number.MAX_SAFE_INTEGER;

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      var txt = normalizeProbeText(textOf(entry));
      if (!txt || txt.indexOf(needle) < 0) {
        continue;
      }

      if (txt.length < bestLength) {
        best = entry;
        bestLength = txt.length;
      }
    }

    return best;
  }

  function findTopLevelMenuContainer(menuRoot) {
    if (!menuRoot) {
      return null;
    }

    var anchorTexts = ["activate", "inspect item", "advanced", "report abuse"];
    for (var i = 0; i < anchorTexts.length; i += 1) {
      var anchorEntry = findMenuEntryByText(menuRoot, anchorTexts[i]);
      if (anchorEntry && anchorEntry.parentElement) {
        return anchorEntry.parentElement;
      }
    }

    try {
      var directChildList = menuRoot.querySelector(":scope > ul, :scope > ol");
      if (directChildList) {
        return directChildList;
      }
    } catch (_ignoreScope) {}

    return menuRoot;
  }

  function removeQuickLuaMenuEntries(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return;
    }

    var ids = [quickEditLuaMenuItemId, quickInjectProbeMenuItemId];
    for (var i = 0; i < ids.length; i += 1) {
      try {
        var node = menuRoot.querySelector("#" + ids[i]);
        if (node && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      } catch (_ignoreRemoveQuick) {}
    }
  }

  function triggerMenuEntry(menuEntry) {
    if (!menuEntry) {
      return false;
    }

    var clickable = null;
    try {
      clickable = menuEntry.querySelector("a");
    } catch (_ignoreClickable) {
      clickable = null;
    }
    if (!clickable) {
      clickable = menuEntry;
    }

    try {
      if (typeof clickable.click === "function") {
        clickable.click();
        return true;
      }
    } catch (_ignoreClick) {}

    try {
      var ev = document.createEvent("MouseEvents");
      ev.initMouseEvent("click", true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
      clickable.dispatchEvent(ev);
      return true;
    } catch (_ignoreDispatch) {}

    return false;
  }

  function triggerInjectProbeFromQuickMenu() {
    try {
      if (!window.CPPMod || typeof window.CPPMod.sendModAction !== "function") {
        return false;
      }

      var injectActionId = getInjectProbeActionId();
      window.CPPMod.sendModAction(modName, injectActionId, [], "");
      sendPacket("lua_quick_menu_inject_probe", {
        injectActionId: injectActionId
      });
      return true;
    } catch (err) {
      safeLog("quick inject failed", String(err && err.message ? err.message : err));
      return false;
    }
  }

  function createQuickMenuEntry(id, label, onClick, templateEntry) {
    var li = document.createElement("li");
    li.id = id;

    var className = templateEntry ? String(templateEntry.className || "") : "menu";
    className = className.replace(/\bright_dropdown\b/g, "").replace(/\s+/g, " ").trim();
    li.className = className || "menu";
    li.setAttribute("data-ui-extractor-quick", "1");

    var a = document.createElement("a");
    a.textContent = label;
    li.appendChild(a);

    li.addEventListener("click", function () {
      try {
        onClick();
      } catch (_ignoreQuickClick) {}
    }, true);

    return li;
  }

  function getDirectMenuEntries(container) {
    var out = [];
    if (!container || !container.children) {
      return out;
    }
    for (var i = 0; i < container.children.length; i += 1) {
      var child = container.children[i];
      if (!isMenuEntryNode(child)) {
        continue;
      }
      if (child.id === quickEditLuaMenuItemId || child.id === quickInjectProbeMenuItemId) {
        continue;
      }
      out.push(child);
    }
    return out;
  }

  function getMenuEntryLabel(entry) {
    if (!entry) {
      return "";
    }

    var labelNode = null;
    try {
      labelNode = entry.querySelector(":scope > a, :scope > span, :scope > div");
    } catch (_ignoreScopeQuery) {
      labelNode = null;
    }

    if (!labelNode) {
      var first = entry.firstElementChild;
      if (first) {
        var tag = String(first.tagName || "").toUpperCase();
        if (tag !== "UL" && tag !== "OL") {
          labelNode = first;
        }
      }
    }

    if (labelNode) {
      return textOf(labelNode);
    }

    try {
      var clone = entry.cloneNode(true);
      var nestedLists = clone.querySelectorAll("ul,ol");
      for (var i = 0; i < nestedLists.length; i += 1) {
        var list = nestedLists[i];
        if (list && list.parentNode) {
          list.parentNode.removeChild(list);
        }
      }
      return textOf(clone);
    } catch (_ignoreClone) {}

    return textOf(entry);
  }

  function ensureQuickLuaMenuEntries(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return;
    }

    var topContainer = findTopLevelMenuContainer(menuRoot);
    var editLuaEntry = findMenuEntryByText(menuRoot, "edit lua script");
    if (!topContainer || !editLuaEntry) {
      removeQuickLuaMenuEntries(menuRoot);
      return;
    }

    var topEntries = getDirectMenuEntries(topContainer);
    if (topEntries.length <= 0) {
      removeQuickLuaMenuEntries(menuRoot);
      return;
    }

    var hasTopLevelEdit = false;
    for (var i = 0; i < topEntries.length; i += 1) {
      var normalized = normalizeProbeText(getMenuEntryLabel(topEntries[i]));
      if (normalized.indexOf("edit lua script") >= 0) {
        hasTopLevelEdit = true;
        break;
      }
    }

    var templateEntry = topEntries[0];
    var quickEdit = menuRoot.querySelector("#" + quickEditLuaMenuItemId);
    if (!hasTopLevelEdit && !quickEdit) {
      quickEdit = createQuickMenuEntry(
        quickEditLuaMenuItemId,
        "Edit Lua script",
        function () {
          sendPacket("lua_quick_menu_edit_lua", {
            source: "quick-menu"
          });
          triggerMenuEntry(editLuaEntry);
        },
        templateEntry);
    }
    if (hasTopLevelEdit && quickEdit && quickEdit.parentNode) {
      quickEdit.parentNode.removeChild(quickEdit);
      quickEdit = null;
    }

    var quickInject = menuRoot.querySelector("#" + quickInjectProbeMenuItemId);
    if (!quickInject) {
      quickInject = createQuickMenuEntry(
        quickInjectProbeMenuItemId,
        "Inject LUA editor probe",
        function () {
          triggerInjectProbeFromQuickMenu();
        },
        templateEntry);
    }

    var insertionEntries = getDirectMenuEntries(topContainer);
    var insertionPoint = insertionEntries.length > 1 ? insertionEntries[1] : null;

    if (quickEdit) {
      if (quickEdit.parentNode !== topContainer) {
        topContainer.insertBefore(quickEdit, insertionPoint);
      } else if (insertionPoint && quickEdit !== insertionPoint.previousElementSibling) {
        topContainer.insertBefore(quickEdit, insertionPoint);
      }
    }

    var injectAnchor = quickEdit && quickEdit.parentNode === topContainer
      ? quickEdit.nextSibling
      : insertionPoint;
    if (quickInject.parentNode !== topContainer) {
      topContainer.insertBefore(quickInject, injectAnchor);
    } else {
      var desiredPrevious = quickEdit && quickEdit.parentNode === topContainer ? quickEdit : null;
      if (desiredPrevious && quickInject.previousElementSibling !== desiredPrevious) {
        topContainer.insertBefore(quickInject, desiredPrevious.nextSibling);
      }
    }
  }

  function markMenuHits(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return;
    }

    ensureQuickLuaMenuEntries(menuRoot);

    var nodes = menuRoot.querySelectorAll("li,a,span,div");
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (node.__luaProbeBound) {
        continue;
      }

      var txt = textOf(node);
      if (!txt) {
        continue;
      }

      var txtLower = txt.toLowerCase();
      if (!isInterestingMenuText(txtLower)) {
        continue;
      }

      node.__luaProbeBound = true;
      node.setAttribute("data-lua-probe-hit", "1");
      state.menuHits += 1;

      sendPacket("lua_menu_item_seen", {
        text: txt,
        tag: node.tagName || "",
        className: String(node.className || "")
      });

      node.addEventListener("click", function (ev) {
        var target = ev.currentTarget || ev.target;
        sendPacket("lua_menu_click", {
          text: textOf(target),
          tag: target && target.tagName ? target.tagName : "",
          className: target ? String(target.className || "") : ""
        });
      }, true);
    }
  }

  function observeMenuRoot(menuRoot) {
    if (!menuRoot || menuRoot.__luaProbeObserverAttached) {
      return;
    }
    menuRoot.__luaProbeObserverAttached = true;
    state.menuObserved = true;

    sendPacket("context_menu_observed", {
      id: menuRoot.id || "",
      className: String(menuRoot.className || "")
    });

    markMenuHits(menuRoot);

    if (window.MutationObserver) {
      if (state.menuObserver && typeof state.menuObserver.disconnect === "function") {
        try {
          state.menuObserver.disconnect();
        } catch (_ignoreDisconnect) {}
      }

      var menuObserver = new MutationObserver(function () {
        ensureQuickLuaMenuEntries(menuRoot);
        markMenuHits(menuRoot);
      });
      menuObserver.observe(menuRoot, {
        childList: true,
        subtree: true
      });
      state.menuObserver = menuObserver;
    }
  }

  function tryAttachMenuObserver() {
    var menuRoot = document.getElementById("main_context_menu");
    if (!menuRoot) {
      return false;
    }
    observeMenuRoot(menuRoot);
    return true;
  }

  function getWrappedMethodNames() {
    return [
      "apply",
      "cancel",
      "addNewFilter",
      "deleteFilter",
      "changeFontSize",
      "reduceSizeActionsList",
      "resizeErrorList",
      "setCodeLuaEditor"
    ];
  }

  function unwrapLuaEditorManager() {
    var manager = window.LUAEditorManager;
    if (!manager) {
      return;
    }

    var methodNames = getWrappedMethodNames();
    for (var i = 0; i < methodNames.length; i += 1) {
      var methodName = methodNames[i];
      var fn = manager[methodName];
      if (typeof fn === "function" && typeof fn.__luaProbeOriginal === "function") {
        manager[methodName] = fn.__luaProbeOriginal;
      }
    }

    try {
      delete manager.__luaProbeWrapped;
    } catch (_ignore) {
      manager.__luaProbeWrapped = false;
    }
  }

  function wrapManagerMethodWithHooks(manager, methodName, hooks) {
    if (!manager) {
      return;
    }
    var fn = manager[methodName];
    if (typeof fn !== "function" || fn.__luaProbeWrapped) {
      return;
    }

    var wrapped = function () {
      var args = [];
      for (var i = 0; i < arguments.length; i += 1) {
        args.push(arguments[i]);
      }
      var hookContext = null;
      if (hooks && typeof hooks.before === "function") {
        try {
          hookContext = hooks.before(args);
        } catch (_ignoreBefore) {}
      }
      sendPacket("lua_manager_call", {
        method: methodName,
        args: summarizeArgs(args),
        context: getContextSnapshot()
      });
      var result = fn.apply(this, arguments);
      if (hooks && typeof hooks.after === "function") {
        try {
          hooks.after(args, result, hookContext);
        } catch (_ignoreAfter) {}
      }
      return result;
    };

    wrapped.__luaProbeWrapped = true;
    wrapped.__luaProbeOriginal = fn;
    manager[methodName] = wrapped;
  }

  function wrapManagerMethod(manager, methodName) {
    wrapManagerMethodWithHooks(manager, methodName, null);
  }

  function restoreSnippetAfterSwitch(info) {
    var restored = false;
    if (info && info.targetSnippetKey) {
      state.currentSnippetKey = info.targetSnippetKey;
      restored = restoreTopLineForCurrentKey(info.targetSnippetKey);
    } else {
      syncCurrentSnippetKeyFromEditor();
    }

    if (!restored) {
      syncCurrentContextKey(true);
      restoreTopLineForCurrentKey();
    }

    refreshActiveFilterMarker();
    updateCaretLineHighlight();
  }

  function wrapLuaEditorManager() {
    var manager = window.LUAEditorManager;
    if (!manager || manager.__luaProbeWrapped) {
      return false;
    }

    manager.__luaProbeWrapped = true;
    state.managerWrapped = true;

    var keys = [];
    try {
      keys = Object.keys(manager);
    } catch (_ignore) {
      keys = [];
    }

    sendPacket("lua_manager_found", {
      keys: keys
    });

    var methodNames = getWrappedMethodNames();

    wrapManagerMethodWithHooks(manager, "setCodeLuaEditor", {
      before: function (args) {
        syncCurrentSnippetKeyFromEditor();
        if (state.currentSnippetKey) {
          rememberTopLineForKey(state.currentSnippetKey);
        }
        rememberTopLineForKey(state.lastContextKey);
        var seq = state.setCodeSwitchSeq + 1;
        state.setCodeSwitchSeq = seq;
        state.switchInProgress = true;
        state.activeSwitchSeq = seq;
        var targetSnippetKey = getSnippetMemoryKeyFromCode(args && args.length > 0 ? args[0] : null);
        var switchInfo = {
          seq: seq,
          before: getContextSnapshot(),
          code: summarizeCodeForSwitch(args && args.length > 0 ? args[0] : null),
          targetSnippetKey: targetSnippetKey
        };
        sendPacket("lua_snippet_switch_begin", switchInfo);
        return switchInfo;
      },
      after: function (args, _result, switchInfo) {
        var info = switchInfo || {
          seq: 0,
          before: getContextSnapshot(),
          code: summarizeCodeForSwitch(args && args.length > 0 ? args[0] : null)
        };

        var runRestoreAttempt = function (delayMs, emitSwitchEnd, finalize) {
          window.setTimeout(function () {
            if (info.seq && state.activeSwitchSeq && info.seq !== state.activeSwitchSeq) {
              return;
            }
            try {
              ensureCaretHighlightBindings();
              restoreSnippetAfterSwitch(info);

              if (emitSwitchEnd) {
                sendPacket("lua_snippet_switch_end", {
                  seq: info.seq,
                  before: info.before,
                  after: getContextSnapshot(),
                  code: info.code
                });
              }
            } catch (_ignoreRestoreAttempt) {
            } finally {
              if (finalize && (!info.seq || state.activeSwitchSeq === info.seq)) {
                state.switchInProgress = false;
              }
            }
          }, delayMs);
        };

        runRestoreAttempt(0, true, false);
        runRestoreAttempt(60, false, false);
        runRestoreAttempt(180, false, true);
      }
    });

    for (var i = 0; i < methodNames.length; i += 1) {
      wrapManagerMethod(manager, methodNames[i]);
    }

    return true;
  }

  function isEditorVisible() {
    var root = document.getElementById("dpu_editor");
    if (!root) {
      return false;
    }
    if (root.style && root.style.display === "none") {
      return false;
    }
    try {
      var computed = window.getComputedStyle ? window.getComputedStyle(root, null) : null;
      if (computed && (computed.display === "none" || computed.visibility === "hidden")) {
        return false;
      }
    } catch (_ignore) {}
    return true;
  }

  function onEditorOpened() {
    var root = document.getElementById("dpu_editor");
    if (root) {
      root.setAttribute("data-lua-probe-active", "1");
    }
    addProbeBadge();
    ensureThemeSwitcher();
    ensureEditorSwitchHooks();
    ensureCaretHighlightToggle();
    ensureCaretHighlightBindings();
    syncCurrentContextKey();
    syncCurrentSnippetKeyFromEditor();
    refreshActiveFilterMarker();
    updateCaretLineHighlight();
    wrapLuaEditorManager();
    sendPacket("lua_editor_opened", {});
  }

  function onEditorClosed() {
    clearActiveFilterMarker();
    state.activeFilterIndex = -1;
    state.activeFilterFingerprint = "";
    state.currentSnippetKey = "";
    clearCaretLineHighlight(getLuaCodeMirror());
    sendPacket("lua_editor_closed", {});
  }

  function refreshEditorState() {
    var visible = isEditorVisible();
    if (visible && !state.editorVisible) {
      state.editorVisible = true;
      onEditorOpened();
    } else if (visible && state.editorVisible) {
      ensureThemeSwitcher();
      ensureEditorSwitchHooks();
      ensureCaretHighlightToggle();
      ensureCaretHighlightBindings();
      syncCurrentContextKey();
      refreshActiveFilterMarker();
    } else if (!visible && state.editorVisible) {
      state.editorVisible = false;
      onEditorClosed();
    }
  }

  function runMaintenance() {
    tryAttachMenuObserver();
    wrapLuaEditorManager();
    refreshEditorState();
  }

  function startObservers() {
    addProbeStyle();
    runMaintenance();

    if (state.intervalId) {
      try {
        window.clearInterval(state.intervalId);
      } catch (_ignoreIntervalClear) {}
    }

    state.intervalId = window.setInterval(function () {
      runMaintenance();
    }, 750);
  }

  function uninstallProbe(reason) {
    try {
      if (state.intervalId) {
        window.clearInterval(state.intervalId);
        state.intervalId = 0;
      }
    } catch (_ignoreInterval) {}

    try {
      if (state.menuObserver && typeof state.menuObserver.disconnect === "function") {
        state.menuObserver.disconnect();
      }
      state.menuObserver = null;
    } catch (_ignoreObserver) {}

    try {
      clearActiveFilterMarker();
      state.activeFilterIndex = -1;
      state.activeFilterFingerprint = "";
    } catch (_ignoreFilterMarker) {}

    try {
      state.caretHighlightEnabled = false;
      updateCaretToggleVisual();
    } catch (_ignoreCaretState) {}

    try {
      if (state.caretBindingsCodeMirror) {
        detachCaretHighlightBindings(state.caretBindingsCodeMirror);
        state.caretBindingsCodeMirror = null;
      }
      var activeCodeMirror = getLuaCodeMirror();
      if (activeCodeMirror) {
        detachCaretHighlightBindings(activeCodeMirror);
      }
    } catch (_ignoreCaretBindings) {}

    try {
      clearCaretLineHighlight(getLuaCodeMirror());
    } catch (_ignoreCaret) {}

    try {
      var manager = window.LUAEditorManager;
      if (manager && manager.currentData) {
        rememberTopLineForKey(getManagerContextKey());
      }
    } catch (_ignoreRemember) {}

    try {
      unwrapLuaEditorManager();
    } catch (_ignoreUnwrap) {}

    try {
      var root = document.getElementById("dpu_editor");
      if (root) {
        root.removeEventListener("mousedown", captureTopLineFromUiInteraction, true);
        root.__luaProbeSwitchHooksBound = false;
        root.removeAttribute("data-lua-probe-active");
      }
    } catch (_ignoreRoot) {}

    try {
      var menuRoot = document.getElementById("main_context_menu");
      if (menuRoot) {
        removeQuickLuaMenuEntries(menuRoot);
        menuRoot.__luaProbeObserverAttached = false;
      }
    } catch (_ignoreMenuRoot) {}

    var removableIds = [
      "ui-extractor-lua-probe-style",
      "ui-extractor-lua-probe-badge",
      "ui-extractor-lua-theme-dots",
      "ui-extractor-lua-caret-toggle",
      quickEditLuaMenuItemId,
      quickInjectProbeMenuItemId
    ];

    for (var i = 0; i < removableIds.length; i += 1) {
      try {
        var node = document.getElementById(removableIds[i]);
        if (node && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      } catch (_ignoreRemove) {}
    }

    try {
      window.__UI_EXTRACTOR_LUA_PROBE_INSTALLED__ = false;
      delete window.__UI_EXTRACTOR_LUA_PROBE_STATE__;
    } catch (_ignoreWindow) {}

    safeLog("uninstalled", reason || "");
  }

  window.__UI_EXTRACTOR_LUA_PROBE_UNINSTALL__ = uninstallProbe;
  window.__UI_EXTRACTOR_LUA_PROBE_STATE__ = state;
  sendPacket("lua_probe_start", {
    locationHref: String(window.location && window.location.href ? window.location.href : ""),
    userAgent: String(window.navigator && window.navigator.userAgent ? window.navigator.userAgent : "")
  });
  safeLog("installed", dumpId);
  startObservers();
})();
