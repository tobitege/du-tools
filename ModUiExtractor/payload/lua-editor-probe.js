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
  var caretHighlightPrefStorageKey = "ModUiExtractor.lua.caret-highlight-enabled.v1";

  function loadCaretHighlightPreference() {
    try {
      if (!window.localStorage || typeof window.localStorage.getItem !== "function") {
        return false;
      }
      var raw = window.localStorage.getItem(caretHighlightPrefStorageKey);
      if (raw === "1" || raw === "true") {
        return true;
      }
      if (raw === "0" || raw === "false") {
        return false;
      }
    } catch (_ignorePrefRead) {}
    return false;
  }

  function saveCaretHighlightPreference(enabled) {
    try {
      if (!window.localStorage || typeof window.localStorage.setItem !== "function") {
        return false;
      }
      window.localStorage.setItem(caretHighlightPrefStorageKey, enabled ? "1" : "0");
      return true;
    } catch (_ignorePrefWrite) {}
    return false;
  }

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
    caretHighlightEnabled: loadCaretHighlightPreference(),
    caretBindingsCodeMirror: null,
    setCodeSwitchSeq: 0,
    switchInProgress: false,
    activeSwitchSeq: 0,
    intervalId: 0,
    menuObserver: null,
    filtersObserver: null,
    filtersObserverRoot: null,
    pendingSlotAutoOpen: null,
    pendingSlotAutoOpenSeq: 0,
    pendingSlotAutoOpenTimeoutId: 0,
    pendingSlotAutoOpenRetryTimeoutId: 0,
    forceEditorFocusOnNextSwitch: false,
    skipNextSetCodeRestore: false,
    suppressRestoreUntilInteraction: true,
    cursorGuardCodeMirror: null,
    lastIdeSyncContextKey: ""
  };

  state.applyIdeCode = applyIdeCode;
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
  var quickEditLuaMenuItemId = "ModUiExtractor-quick-edit-lua";
  var quickInjectProbeMenuItemId = "ModUiExtractor-quick-inject-lua";
  var SLOT_SELECTORS = [
    "#slots_container .slot.selected",
    "#slots_container .slot.active",
    "#slots_container .slot.current",
    "#slots_container .slot.focus",
    "#slots_container .slot[data-selected=\"true\"]",
    "#slots_container .slot[aria-selected=\"true\"]"
  ];
  var FILTER_SELECTORS = [
    "#filters_container .filter.selected",
    "#filters_container .filter.active",
    "#filters_container .filter.current",
    "#filters_container .filter.focus",
    "#filters_container .filter[data-selected=\"true\"]",
    "#filters_container .filter[aria-selected=\"true\"]"
  ];

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

  function flashIdeSyncButton(message, background, color, durationMs) {
    var button = document.getElementById("ModUiExtractor-lua-ide-sync");
    if (!button) {
      return;
    }
    var oldBackground = button.style.background;
    var oldColor = button.style.color;
    var oldText = button.textContent;
    button.style.background = background;
    button.style.color = color;
    button.textContent = message;
    window.setTimeout(function () {
      button.style.background = oldBackground;
      button.style.color = oldColor;
      button.textContent = oldText;
    }, durationMs);
  }

  function applyIdeCode(newCode) {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror || typeof codeMirror.setValue !== "function") {
      return;
    }

    var currentContextKey = getEditorContextKey(codeMirror);
    if (state.lastIdeSyncContextKey && currentContextKey !== state.lastIdeSyncContextKey) {
      safeLog("IDE sync blocked: Context changed. Expected: " + state.lastIdeSyncContextKey + ", Got: " + currentContextKey);
      flashIdeSyncButton("Sync Blocked: Wrong Filter", "#8a2424", "#ffffff", 3000);
      return;
    }

    codeMirror.setValue(newCode);
    flashIdeSyncButton("Synced from IDE!", "#2a6b36", "#ffffff", 1500);
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

  function getEditorViewportSnapshot() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return null;
    }

    var out = {};
    try {
      if (typeof codeMirror.getScrollInfo === "function") {
        var s = codeMirror.getScrollInfo();
        if (s) {
          if (typeof s.top === "number") { out.scrollTopPx = s.top; }
          if (typeof s.left === "number") { out.scrollLeftPx = s.left; }
          if (typeof s.height === "number") { out.scrollHeightPx = s.height; }
          if (typeof s.clientHeight === "number") { out.clientHeightPx = s.clientHeight; }
          if (typeof s.width === "number") { out.scrollWidthPx = s.width; }
          if (typeof s.clientWidth === "number") { out.clientWidthPx = s.clientWidth; }
        }
      }
    } catch (_ignoreScrollInfo) {}

    try {
      if (typeof codeMirror.lineCount === "function") {
        out.lineCount = codeMirror.lineCount();
      }
    } catch (_ignoreLineCount) {}

    try {
      if (typeof out.scrollTopPx === "number" && typeof codeMirror.lineAtHeight === "function") {
        out.topLine = codeMirror.lineAtHeight(out.scrollTopPx, "local");
      }
    } catch (_ignoreTopLine) {}

    try {
      if (typeof codeMirror.getScrollerElement === "function") {
        var cmScroller = codeMirror.getScrollerElement();
        if (cmScroller) {
          out.cmScrollerTopPx = cmScroller.scrollTop;
          out.cmScrollerLeftPx = cmScroller.scrollLeft;
          out.cmScrollerHeightPx = cmScroller.scrollHeight;
          out.cmScrollerClientHeightPx = cmScroller.clientHeight;
        }
      }
    } catch (_ignoreCmScroller) {}

    try {
      var wrapper = typeof codeMirror.getWrapperElement === "function" ? codeMirror.getWrapperElement() : null;
      var root = wrapper && wrapper.parentNode ? wrapper.parentNode : wrapper;
      if (root && root.querySelector) {
        var vScrollbar = root.querySelector(".CodeMirror-vscrollbar");
        if (vScrollbar) {
          out.cmVScrollbarTopPx = vScrollbar.scrollTop;
          out.cmVScrollbarHeightPx = vScrollbar.scrollHeight;
          out.cmVScrollbarClientHeightPx = vScrollbar.clientHeight;
        }
      }
    } catch (_ignoreVScrollbar) {}

    try {
      var textArea = document.getElementById("editor_window");
      if (textArea) {
        out.textAreaTopPx = textArea.scrollTop;
      }
    } catch (_ignoreTextAreaTop) {}

    try {
      if (typeof codeMirror.getCursor === "function") {
        var c = codeMirror.getCursor();
        if (c && typeof c.line === "number") { out.cursorLine = c.line; }
        if (c && typeof c.ch === "number") { out.cursorCh = c.ch; }
      }
    } catch (_ignoreCursor) {}

    return out;
  }

  function addProbeStyle() {
    if (document.getElementById("ModUiExtractor-lua-probe-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "ModUiExtractor-lua-probe-style";
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
      + "#dpu_editor #ModUiExtractor-lua-theme-dots{"
      + "position:absolute;left:12px;top:50%;transform:translateY(-50%);"
      + "display:flex;gap:8px;align-items:center;z-index:11;}"
      + "#dpu_editor #ModUiExtractor-lua-theme-dots .lua-theme-dot{"
      + "width:12px;height:12px;border-radius:999px;border:1px solid rgba(255,255,255,0.6);"
      + "padding:0;cursor:pointer;opacity:0.88;}"
      + "#dpu_editor #ModUiExtractor-lua-theme-dots .lua-theme-dot[data-active=\"1\"]{"
      + "transform:scale(1.1);opacity:1;box-shadow:0 0 0 1px rgba(0,0,0,0.55),0 0 8px rgba(255,255,255,0.35);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle,#dpu_editor #ModUiExtractor-lua-ide-sync{"
      + "font-family:Play,sans-serif;font-size:1.11111111vh;font-weight:900;text-transform:uppercase;"
      + "display:flex;justify-content:center;align-items:center;text-align:center;overflow:hidden;"
      + "height:2.31481481vh;min-height:2.31481481vh;max-height:2.31481481vh;padding:0 1.11111111vh;"
      + "margin-left:0.37037037vh;cursor:pointer;line-height:2.12962963vh;"
      + "border-radius:0.55555556vh;"
      + "border:1px solid rgba(165,194,210,0.52);"
      + "background:linear-gradient(180deg,rgba(42,62,75,0.96) 0%,rgba(18,33,43,0.96) 100%);"
      + "color:rgb(199,227,240);"
      + "text-shadow:rgba(20,40,52,0.9) 0px 1px 0px;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),inset 0 -1px 0 rgba(0,0,0,0.58),0 0 0 1px rgba(0,0,0,0.28);"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle{"
      + "min-width:9.25925926vh;}"
      + "#dpu_editor #ModUiExtractor-lua-ide-sync{"
      + "min-width:8.7962963vh;color:rgb(250,222,145);border-color:rgba(250,212,122,0.58);"
      + "background:linear-gradient(180deg,rgba(64,67,58,0.96) 0%,rgba(37,43,34,0.96) 100%);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle[data-on=\"1\"]{"
      + "border-color:rgba(103,214,141,0.82);color:#ffffff;"
      + "background:linear-gradient(180deg,rgba(64,148,89,0.96) 0%,rgba(41,110,66,0.96) 100%);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -1px 0 rgba(0,0,0,0.45),0 0 10px rgba(103,214,141,0.22);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:hover,#dpu_editor #ModUiExtractor-lua-ide-sync:hover{"
      + "border-color:rgba(228,244,252,0.85);color:rgb(245,252,255);"
      + "background:linear-gradient(180deg,rgba(56,82,99,0.98) 0%,rgba(26,48,61,0.98) 100%);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:active,#dpu_editor #ModUiExtractor-lua-ide-sync:active{"
      + "transform:translateY(1px);"
      + "background:linear-gradient(180deg,rgba(30,48,60,0.98) 0%,rgba(18,32,41,0.98) 100%);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:focus,#dpu_editor #ModUiExtractor-lua-ide-sync:focus{"
      + "outline:none;}"
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
    var existing = document.getElementById("ModUiExtractor-lua-probe-badge");
    if (existing) {
      return;
    }

    var badge = document.createElement("div");
    badge.id = "ModUiExtractor-lua-probe-badge";
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

  function findFirstNode(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var node = document.querySelector(selectors[i]);
        if (node) {
          return node;
        }
      } catch (_ignore) {}
    }
    return null;
  }

  function getNodeIdentity(node, prefix) {
    if (!node) {
      return "";
    }
    var parts = [];
    try {
      var text = limitText(textOf(node), 64);
      if (text) {
        parts.push("text=" + text);
      }
    } catch (_ignoreText) {}
    try {
      var id = node.getAttribute ? String(node.getAttribute("id") || "") : "";
      if (id) {
        parts.push("id=" + limitText(id, 48));
      }
    } catch (_ignoreId) {}
    try {
      var ds = node.getAttribute ? String(node.getAttribute("data-slot") || node.getAttribute("data-name") || node.getAttribute("data-index") || "") : "";
      if (ds) {
        parts.push("data=" + limitText(ds, 48));
      }
    } catch (_ignoreData) {}
    try {
      var className = node.className ? String(node.className) : "";
      if (className) {
        parts.push("class=" + limitText(className, 64));
      }
    } catch (_ignoreClass) {}
    try {
      if (node.parentNode && node.parentNode.children) {
        var idx = Array.prototype.indexOf.call(node.parentNode.children, node);
        if (idx >= 0) {
          parts.push("idx=" + idx);
        }
      }
    } catch (_ignoreIdx) {}
    if (parts.length <= 0) {
      return "";
    }
    return prefix + "{" + parts.join("|") + "}";
  }

  function getDomContextKey() {
    var slotNode = findFirstNode(SLOT_SELECTORS);
    var filterNode = findFirstNode(FILTER_SELECTORS);
    var slotText = findFirstText(SLOT_SELECTORS);
    var filterText = findFirstText(FILTER_SELECTORS);
    var slotIdentity = getNodeIdentity(slotNode, "slot");
    var filterIdentity = getNodeIdentity(filterNode, "filter");

    if (!slotText && !filterText && !slotIdentity && !filterIdentity) {
      return "";
    }

    return "dom:" + (slotText || slotIdentity) + "::" + (filterText || filterIdentity);
  }

  function getDomSelectedSlotNode() {
    return findFirstNode(SLOT_SELECTORS);
  }

  function getSlotStableKey(slotNode) {
    if (!slotNode) {
      return "";
    }
    var parts = [];
    try {
      var id = slotNode.getAttribute ? String(slotNode.getAttribute("id") || "") : "";
      if (id) {
        parts.push("id=" + limitText(id, 48));
      }
    } catch (_ignoreSlotId) {}
    try {
      var dataValue = slotNode.getAttribute ? String(
        slotNode.getAttribute("data-slot") ||
        slotNode.getAttribute("data-name") ||
        slotNode.getAttribute("data-index") ||
        ""
      ) : "";
      if (dataValue) {
        parts.push("data=" + limitText(dataValue, 48));
      }
    } catch (_ignoreSlotData) {}
    try {
      if (slotNode.parentNode && slotNode.parentNode.children) {
        var idx = Array.prototype.indexOf.call(slotNode.parentNode.children, slotNode);
        if (idx >= 0) {
          parts.push("idx=" + idx);
        }
      }
    } catch (_ignoreSlotIdx) {}
    return parts.join("|");
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
    var visibleNodes = getVisibleFilterNodes();
    for (var i = 0; i < visibleNodes.length; i += 1) {
      var visibleNode = visibleNodes[i];
      if (!visibleNode || !visibleNode.classList) {
        continue;
      }
      if (visibleNode.classList.contains("selected") ||
          visibleNode.classList.contains("active") ||
          visibleNode.classList.contains("current") ||
          visibleNode.classList.contains("focus")) {
        return visibleNode;
      }
      try {
        if (visibleNode.getAttribute("data-selected") === "true" ||
            visibleNode.getAttribute("aria-selected") === "true") {
          return visibleNode;
        }
      } catch (_ignoreVisibleAttr) {}
    }

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
          try {
            var computed = window.getComputedStyle ? window.getComputedStyle(node, null) : null;
            if (computed && (computed.display === "none" || computed.visibility === "hidden")) {
              continue;
            }
          } catch (_ignoreNodeComputed) {}
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

  function hasRememberedTopLineForKey(key) {
    if (!key) {
      return false;
    }
    var remembered = state.scrollTopByContext[key];
    if (typeof remembered === "number") {
      return remembered >= 0;
    }
    return !!(remembered && typeof remembered === "object" && typeof remembered.topLine === "number" && remembered.topLine >= 0);
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

      var performScroll = function() {
        if (typeof codeMirror.heightAtLine === "function" && typeof codeMirror.scrollTo === "function") {
          var topPx = codeMirror.heightAtLine(rememberedTopLine, "local");
          // Add small vertical offset buffer so top line isn't exactly at 0px
          codeMirror.scrollTo(null, topPx > 0 ? topPx - 5 : 0);
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
      };

      // Single apply here; switch lifecycle settles before restore runs.
      performScroll();

    } catch (_ignore) {}

    if (state.caretHighlightEnabled) {
      window.setTimeout(function () {
        updateCaretLineHighlight();
      }, 0);
    }
    return true;
  }

  function resetEditorViewportToTop() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }

    try {
      if (typeof codeMirror.setCursor === "function") {
        codeMirror.setCursor({ line: 0, ch: 0 });
      }
    } catch (_ignoreCursorTop) {}

    try {
      if (typeof codeMirror.scrollTo === "function") {
        codeMirror.scrollTo(0, 0);
        codeMirror.scrollTo(null, 0);
      }
    } catch (_ignoreScrollTop) {}

    try {
      if (typeof codeMirror.getScrollerElement === "function") {
        var scroller = codeMirror.getScrollerElement();
        if (scroller) {
          scroller.scrollTop = 0;
          scroller.scrollLeft = 0;
        }
      }
    } catch (_ignoreScroller) {}

    try {
      var wrapper = typeof codeMirror.getWrapperElement === "function" ? codeMirror.getWrapperElement() : null;
      var root = wrapper && wrapper.parentNode ? wrapper.parentNode : wrapper;
      if (root && root.querySelector) {
        var vScrollbar = root.querySelector(".CodeMirror-vscrollbar");
        if (vScrollbar) {
          vScrollbar.scrollTop = 0;
        }
      }
    } catch (_ignoreVScrollbarReset) {}

    try {
      var textArea = document.getElementById("editor_window");
      if (textArea) {
        textArea.scrollTop = 0;
        textArea.selectionStart = 0;
        textArea.selectionEnd = 0;
      }
    } catch (_ignoreTextArea) {}
  }

  function installFreshOpenViewportGuard() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }

    if (state.cursorGuardCodeMirror && state.cursorGuardCodeMirror !== codeMirror) {
      removeFreshOpenViewportGuard();
    }

    if (state.cursorGuardCodeMirror === codeMirror) {
      return;
    }

    try {
      if (typeof codeMirror.setCursor === "function" &&
          typeof codeMirror.__luaProbeOriginalSetCursor !== "function") {
        codeMirror.__luaProbeOriginalSetCursor = codeMirror.setCursor;
        codeMirror.setCursor = function (cursor) {
          if (state.suppressRestoreUntilInteraction) {
            return codeMirror.__luaProbeOriginalSetCursor.call(this, { line: 0, ch: 0 });
          }
          return codeMirror.__luaProbeOriginalSetCursor.apply(this, arguments);
        };
      }
    } catch (_ignoreWrapSetCursor) {}

    try {
      if (typeof codeMirror.scrollTo === "function" &&
          typeof codeMirror.__luaProbeOriginalScrollTo !== "function") {
        codeMirror.__luaProbeOriginalScrollTo = codeMirror.scrollTo;
        codeMirror.scrollTo = function (_x, _y) {
          if (state.suppressRestoreUntilInteraction) {
            return codeMirror.__luaProbeOriginalScrollTo.call(this, 0, 0);
          }
          return codeMirror.__luaProbeOriginalScrollTo.apply(this, arguments);
        };
      }
    } catch (_ignoreWrapScrollTo) {}

    state.cursorGuardCodeMirror = codeMirror;
  }

  function removeFreshOpenViewportGuard() {
    var codeMirror = state.cursorGuardCodeMirror || getLuaCodeMirror();
    if (!codeMirror) {
      state.cursorGuardCodeMirror = null;
      return;
    }

    try {
      if (typeof codeMirror.__luaProbeOriginalSetCursor === "function") {
        codeMirror.setCursor = codeMirror.__luaProbeOriginalSetCursor;
      }
      codeMirror.__luaProbeOriginalSetCursor = null;
    } catch (_ignoreUnwrapSetCursor) {}

    try {
      if (typeof codeMirror.__luaProbeOriginalScrollTo === "function") {
        codeMirror.scrollTo = codeMirror.__luaProbeOriginalScrollTo;
      }
      codeMirror.__luaProbeOriginalScrollTo = null;
    } catch (_ignoreUnwrapScrollTo) {}

    state.cursorGuardCodeMirror = null;
  }

  function enforceEditorFocusAndCaret() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }

    var apply = function () {
      try {
        if (typeof codeMirror.focus === "function") {
          codeMirror.focus();
        }
      } catch (_ignoreFocus) {}

      try {
        if (typeof codeMirror.getCursor === "function" && typeof codeMirror.setCursor === "function") {
          var cursor = codeMirror.getCursor();
          var line = cursor && typeof cursor.line === "number" ? cursor.line : 0;
          var ch = cursor && typeof cursor.ch === "number" ? cursor.ch : 0;
          codeMirror.setCursor({ line: line, ch: ch });
        }
      } catch (_ignoreCursorRestore) {}

      updateCaretLineHighlight();
    };

    apply();
    window.setTimeout(apply, 50);
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

      var editorNode = target.closest("#editor_window_code") || target.closest(".CodeMirror") || target.closest("#editor_window");
      if (editorNode) {
        if (state.suppressRestoreUntilInteraction) {
          state.suppressRestoreUntilInteraction = false;
          removeFreshOpenViewportGuard();
        }
        syncCurrentContextKey();
        syncCurrentSnippetKeyFromEditor();
        if (state.currentSnippetKey) {
          rememberTopLineForKey(state.currentSnippetKey);
        }
        rememberTopLineForKey(state.lastContextKey);
        return;
      }

      var slotNode = target.closest("#slots_container .slot");
      var filterNode = target.closest("#filters_container .filter");
      if (slotNode || filterNode) {
        var selectedSlotNode = slotNode ? getDomSelectedSlotNode() : null;
        var selectedSlotKey = slotNode ? getSlotStableKey(selectedSlotNode) : "";
        var clickedSlotKey = slotNode ? getSlotStableKey(slotNode) : "";
        var isSlotTransition = !!slotNode && (
          (selectedSlotKey && clickedSlotKey && selectedSlotKey !== clickedSlotKey) ||
          (!selectedSlotKey || !clickedSlotKey) ||
          (selectedSlotNode && slotNode && selectedSlotNode !== slotNode)
        );
        var wasSuppressed = !!state.suppressRestoreUntilInteraction;
        if (wasSuppressed && (filterNode || isSlotTransition)) {
          // First interaction after open/reinject must never inherit stale viewport state.
          state.skipNextSetCodeRestore = true;
          resetEditorViewportToTop();
        }

        if (filterNode) {
          state.suppressRestoreUntilInteraction = false;
          removeFreshOpenViewportGuard();
          // Manual filter navigation should return focus to editor once code loads.
          state.forceEditorFocusOnNextSwitch = true;
        } else if (isSlotTransition) {
          // Keep suppression active through slot click until a concrete filter is selected.
          state.suppressRestoreUntilInteraction = true;
          installFreshOpenViewportGuard();
        }

        if (!wasSuppressed) {
          syncCurrentSnippetKeyFromEditor();
          if (state.currentSnippetKey) {
            rememberTopLineForKey(state.currentSnippetKey);
          }

          var codeMirror = getLuaCodeMirror();
          var currentContextKey = getEditorContextKey(codeMirror) || state.lastContextKey;
          if (currentContextKey) {
            rememberTopLineForKey(currentContextKey);
          }
        }

        if (filterNode) {
          clearPendingSlotAutoOpen();
          setActiveFilterMarker(filterNode);
        } else if (slotNode) {
          if (isSlotTransition) {
            clearActiveFilterMarker();
            state.activeFilterIndex = -1;
            state.activeFilterFingerprint = "";
            armPendingSlotAutoOpen(slotNode, selectedSlotNode);
          } else {
            clearPendingSlotAutoOpen();
          }
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

  function clearPendingSlotAutoOpen() {
    if (state.pendingSlotAutoOpenTimeoutId) {
      try {
        window.clearTimeout(state.pendingSlotAutoOpenTimeoutId);
      } catch (_ignorePendingTimeout) {}
      state.pendingSlotAutoOpenTimeoutId = 0;
    }
    if (state.pendingSlotAutoOpenRetryTimeoutId) {
      try {
        window.clearTimeout(state.pendingSlotAutoOpenRetryTimeoutId);
      } catch (_ignorePendingRetryTimeout) {}
      state.pendingSlotAutoOpenRetryTimeoutId = 0;
    }
    state.pendingSlotAutoOpen = null;
  }

  function isNodeInsideFiltersContainer(node) {
    if (!node) {
      return false;
    }
    var container = document.getElementById("filters_container");
    if (!container) {
      return false;
    }
    var current = node;
    while (current) {
      if (current === container) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  function resolveAutoOpenFilterCandidate(pending) {
    var selected = findDomSelectedFilterNode();
    var hasStaleSelected = !!(pending && pending.oldSelected && selected === pending.oldSelected);
    if (selected && isNodeInsideFiltersContainer(selected) && !hasStaleSelected) {
      return selected;
    }

    var hinted = findFilterNodeByHints(getManagerFilterHints());
    if (hinted && isNodeInsideFiltersContainer(hinted)) {
      if (pending && pending.oldSelected && hinted === pending.oldSelected) {
        // Hint still points to previous slot node; keep searching for a fresh candidate.
      } else {
        return hinted;
      }
    }

    var nodes = getVisibleFilterNodes();
    if (nodes.length <= 0) {
      return null;
    }

    if (hasStaleSelected && nodes.length > 1) {
      return nodes[1];
    }

    if (!hasStaleSelected) {
      return nodes[0];
    }

    var elapsedMs = Date.now() - pending.startedAt;
    if (elapsedMs < 180 && pending.mutationCount <= 0) {
      return null;
    }
    return nodes[0];
  }

  function tryAutoOpenSelectedFilter() {
    var pending = state.pendingSlotAutoOpen;
    if (!pending || state.switchInProgress) {
      return false;
    }

    pending.attempts = (pending.attempts || 0) + 1;

    if (Date.now() > pending.expiresAt) {
      sendPacket("lua_slot_auto_open", {
        seq: pending.seq,
        attempts: pending.attempts || 0,
        status: "expired",
        mutationCount: pending.mutationCount || 0
      });
      clearPendingSlotAutoOpen();
      return false;
    }

    var elapsedMs = Date.now() - pending.startedAt;
    var currentSelectedSlotNode = getDomSelectedSlotNode();
    var currentSelectedSlotIdentity = getNodeIdentity(currentSelectedSlotNode, "slot");
    var currentSelectedSlotKey = getSlotStableKey(currentSelectedSlotNode);
    if (pending.targetSlotKey && currentSelectedSlotKey && currentSelectedSlotKey !== pending.targetSlotKey) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "waiting-target-slot",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }
    if (!pending.targetSlotKey && pending.targetSlotIdentity && currentSelectedSlotIdentity && currentSelectedSlotIdentity !== pending.targetSlotIdentity) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "waiting-target-slot-identity",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }

    if (pending.previousSlotKey && currentSelectedSlotKey && currentSelectedSlotKey === pending.previousSlotKey && elapsedMs < 600) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "waiting-slot-switch",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }
    if (!pending.previousSlotKey && pending.previousSlotIdentity && currentSelectedSlotIdentity && currentSelectedSlotIdentity === pending.previousSlotIdentity && elapsedMs < 600) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "waiting-slot-switch-identity",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }

    var candidate = resolveAutoOpenFilterCandidate(pending);
    if (!candidate) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "no-candidate",
          mutationCount: pending.mutationCount || 0
        });
      }
      return false;
    }

    var sameAsOld = !!pending.oldSelected && candidate === pending.oldSelected;
    // Guard against stale pre-switch selected node during asynchronous list rebuild.
    if (sameAsOld && elapsedMs < 220 && pending.mutationCount < 2) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "stale-selected",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }

    if (triggerElementClick(candidate)) {
      // Slot-driven auto-open should start at top for the new filter.
      state.skipNextSetCodeRestore = true;
      state.forceEditorFocusOnNextSwitch = true;
      sendPacket("lua_slot_auto_open", {
        seq: pending.seq,
        attempts: pending.attempts,
        status: "clicked",
        mutationCount: pending.mutationCount || 0,
        text: limitText(textOf(candidate), 96)
      });
      setActiveFilterMarker(candidate);
      clearPendingSlotAutoOpen();
      return true;
    }

    return false;
  }

  function armPendingSlotAutoOpen(slotNode, previousSelectedSlotNode) {
    clearPendingSlotAutoOpen();
    ensureAutoClickObserver();

    state.pendingSlotAutoOpenSeq += 1;
    var seq = state.pendingSlotAutoOpenSeq;
    var targetSlotIdentity = getNodeIdentity(slotNode, "slot");
    var previousSlotIdentity = getNodeIdentity(previousSelectedSlotNode, "slot");
    var targetSlotKey = getSlotStableKey(slotNode);
    var previousSlotKey = getSlotStableKey(previousSelectedSlotNode);
    state.pendingSlotAutoOpen = {
      seq: seq,
      startedAt: Date.now(),
      expiresAt: Date.now() + 5000,
      mutationCount: 0,
      attempts: 0,
      oldSelected: findDomSelectedFilterNode(),
      targetSlotKey: targetSlotKey || "",
      previousSlotKey: previousSlotKey || "",
      targetSlotIdentity: targetSlotIdentity || "",
      previousSlotIdentity: previousSlotIdentity || ""
    };

    sendPacket("lua_slot_auto_open", {
      seq: seq,
      status: "armed",
      targetSlotKey: targetSlotKey || "",
      previousSlotKey: previousSlotKey || "",
      targetSlotIdentity: targetSlotIdentity || "",
      previousSlotIdentity: previousSlotIdentity || ""
    });

    var scheduleRetry = function (delayMs) {
      state.pendingSlotAutoOpenRetryTimeoutId = window.setTimeout(function () {
        if (!state.pendingSlotAutoOpen || state.pendingSlotAutoOpen.seq !== seq) {
          return;
        }
        if (tryAutoOpenSelectedFilter()) {
          return;
        }
        if (Date.now() > state.pendingSlotAutoOpen.expiresAt) {
          clearPendingSlotAutoOpen();
          return;
        }
        scheduleRetry(120);
      }, delayMs);
    };

    // Initial delayed kick + persistent retry loop for sluggish Coherent GT refreshes.
    state.pendingSlotAutoOpenTimeoutId = window.setTimeout(function () {
      if (!state.pendingSlotAutoOpen || state.pendingSlotAutoOpen.seq !== seq) {
        return;
      }
      if (tryAutoOpenSelectedFilter()) {
        return;
      }
      scheduleRetry(120);
    }, 70);
  }

  function ensureAutoClickObserver() {
    var root = document.getElementById("dpu_editor");
    if (!root) {
      return;
    }

    if (!window.MutationObserver) {
      return;
    }

    if (state.filtersObserver && state.filtersObserverRoot === root) {
      return;
    }

    try {
      if (state.filtersObserver && typeof state.filtersObserver.disconnect === "function") {
        state.filtersObserver.disconnect();
      }
    } catch (_ignoreReconnectObserver) {}

    var observer = new MutationObserver(function (mutations) {
      var pending = state.pendingSlotAutoOpen;
      if (!pending) {
        return;
      }

      if (Date.now() > pending.expiresAt) {
        clearPendingSlotAutoOpen();
        return;
      }

      if (mutations && typeof mutations.length === "number") {
        pending.mutationCount += mutations.length;
      }

      if (!tryAutoOpenSelectedFilter()) {
        return;
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-selected", "aria-selected"]
    });

    state.filtersObserver = observer;
    state.filtersObserverRoot = root;
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
    var dotsRoot = document.getElementById("ModUiExtractor-lua-theme-dots");
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
    var toggle = document.getElementById("ModUiExtractor-lua-caret-toggle");
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
    var persisted = saveCaretHighlightPreference(state.caretHighlightEnabled);
    updateCaretToggleVisual();
    updateCaretLineHighlight();

    if (emitPacket) {
      sendPacket("lua_caret_highlight_toggle", {
        enabled: state.caretHighlightEnabled,
        persisted: persisted
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

    var toggle = document.getElementById("ModUiExtractor-lua-caret-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.id = "ModUiExtractor-lua-caret-toggle";
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

  function sendIdeSyncPacket() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }
    state.lastIdeSyncContextKey = getEditorContextKey(codeMirror);
    var code = typeof codeMirror.getValue === "function" ? codeMirror.getValue() : "";
    var chunkSize = 8000;
    var total = Math.ceil(code.length / chunkSize) || 1;
    var syncId = "sync-" + Date.now();
    for (var i = 0; i < total; i += 1) {
      var chunk = code.substring(i * chunkSize, (i + 1) * chunkSize);
      sendPacket("lua_ide_sync", {
        syncId: syncId,
        part: i + 1,
        total: total,
        codeChunk: chunk
      });
    }
  }

  function ensureIdeSyncButton() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    // Use the native font_size_wrapper container where the other buttons (like LINE HL OFF) live!
    var wrapper = root.querySelector(".header_editor .font_size_wrapper");
    if (!wrapper) {
      return;
    }

    var syncBtn = document.getElementById("ModUiExtractor-lua-ide-sync");
    if (!syncBtn) {
      syncBtn = document.createElement("button");
      syncBtn.type = "button";
      syncBtn.id = "ModUiExtractor-lua-ide-sync";
      syncBtn.textContent = "IDE Sync";

      syncBtn.addEventListener("click", function () {
        sendIdeSyncPacket();
      }, true);
    }

    if (syncBtn.parentNode !== wrapper) {
      wrapper.appendChild(syncBtn);
    }
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

    var switcher = document.getElementById("ModUiExtractor-lua-theme-dots");
    if (!switcher) {
      switcher = document.createElement("div");
      switcher.id = "ModUiExtractor-lua-theme-dots";

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
      var txt = normalizeProbeText(getMenuEntryLabel(entry) || textOf(entry));
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

  function isQuickInjectedMenuEntry(entry) {
    if (!entry) {
      return false;
    }
    if (entry.id === quickEditLuaMenuItemId || entry.id === quickInjectProbeMenuItemId) {
      return true;
    }
    try {
      return entry.getAttribute && entry.getAttribute("data-ModUiExtractor-quick") === "1";
    } catch (_ignoreQuickAttr) {}
    return false;
  }

  function findNativeMenuEntryByText(menuRoot, textNeedle) {
    if (!menuRoot || !menuRoot.querySelectorAll || !textNeedle) {
      return null;
    }

    var needle = normalizeProbeText(textNeedle);
    var entries = menuRoot.querySelectorAll("li.menu");
    var best = null;
    var bestLength = Number.MAX_SAFE_INTEGER;

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (isQuickInjectedMenuEntry(entry)) {
        continue;
      }
      var txt = normalizeProbeText(getMenuEntryLabel(entry) || textOf(entry));
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

  function findNativeEditLuaEntry(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return null;
    }

    var entries = menuRoot.querySelectorAll("li.menu");
    var best = null;
    var bestScore = -1;

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (isQuickInjectedMenuEntry(entry)) {
        continue;
      }

      var label = normalizeProbeText(getMenuEntryLabel(entry));
      if (!label || label.indexOf("edit lua script") !== 0) {
        continue;
      }

      var score = 0;
      if (label === "edit lua script") {
        score += 3;
      }
      if (label.indexOf("ctrl") >= 0) {
        score += 2;
      }
      if (entry.classList && !entry.classList.contains("right_dropdown")) {
        score += 2;
      }
      if (isNodeVisible(entry)) {
        score += 1;
      }

      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }

    return best || findNativeMenuEntryByText(menuRoot, "edit lua script");
  }

  function isNodeVisible(node) {
    if (!node) {
      return false;
    }
    try {
      var computed = window.getComputedStyle ? window.getComputedStyle(node, null) : null;
      if (!computed) {
        return true;
      }
      return computed.display !== "none" && computed.visibility !== "hidden" && computed.opacity !== "0";
    } catch (_ignoreVisibleCheck) {}
    return true;
  }

  function findAdvancedMenuEntry(menuRoot) {
    if (!menuRoot) {
      return null;
    }

    // Important: only target top-level "Advanced", never nested submenus like Construct -> Advanced.
    var topContainer = findTopLevelMenuContainer(menuRoot);
    var entries = getDirectMenuEntries(topContainer);
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (isQuickInjectedMenuEntry(entry)) {
        continue;
      }
      var label = normalizeProbeText(getMenuEntryLabel(entry));
      if (!label || label.indexOf("advanced") < 0) {
        continue;
      }

      var score = 0;
      if (label === "advanced") {
        score += 4;
      } else if (label.indexOf("advanced") === 0) {
        score += 2;
      }
      if (entry.classList && entry.classList.contains("right_dropdown")) {
        score += 1;
      }
      if (isNodeVisible(entry)) {
        score += 1;
      }

      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }

    return best;
  }

  function getDirectSubmenuContainer(entry) {
    if (!entry || !entry.children) {
      return null;
    }
    for (var i = 0; i < entry.children.length; i += 1) {
      var child = entry.children[i];
      if (!child || !child.tagName) {
        continue;
      }
      var tag = String(child.tagName).toUpperCase();
      if (tag === "UL" || tag === "OL") {
        return child;
      }
    }
    return null;
  }

  function findDirectMenuEntryByText(container, textNeedle) {
    if (!container || !container.children || !textNeedle) {
      return null;
    }
    var needle = normalizeProbeText(textNeedle);
    var best = null;
    var bestLength = Number.MAX_SAFE_INTEGER;
    for (var i = 0; i < container.children.length; i += 1) {
      var child = container.children[i];
      if (!isMenuEntryNode(child) || isQuickInjectedMenuEntry(child)) {
        continue;
      }
      var label = normalizeProbeText(getMenuEntryLabel(child) || textOf(child));
      if (!label || label.indexOf(needle) < 0) {
        continue;
      }
      if (label.length < bestLength) {
        best = child;
        bestLength = label.length;
      }
    }
    return best;
  }

  function findEditLuaEntryUnderAdvanced(advancedEntry) {
    if (!advancedEntry) {
      return null;
    }
    var sub = getDirectSubmenuContainer(advancedEntry);
    if (!sub) {
      return null;
    }
    return findDirectMenuEntryByText(sub, "edit lua script");
  }

  function findEditLuaEntryInside(rootNode) {
    if (!rootNode || !rootNode.querySelectorAll) {
      return null;
    }

    var entries = rootNode.querySelectorAll("li.menu");
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (isQuickInjectedMenuEntry(entry)) {
        continue;
      }
      var txt = normalizeProbeText(textOf(entry));
      if (!txt || txt.indexOf("edit lua script") < 0) {
        continue;
      }
      var score = 0;
      if (txt.indexOf("ctrl") >= 0) {
        score += 2;
      }
      if (txt.indexOf("advanced") < 0) {
        score += 1;
      }
      if (score > bestScore) {
        best = entry;
        bestScore = score;
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

  function triggerElementClick(el) {
    if (!el) {
      return false;
    }

    var clickable = null;
    try {
      clickable = el.querySelector("a");
    } catch (_ignoreClickable) {}
    if (!clickable) {
      clickable = el;
    }

    var dispatched = false;
    var clientX = 0;
    var clientY = 0;
    var screenX = 0;
    var screenY = 0;
    try {
      if (clickable && typeof clickable.getBoundingClientRect === "function") {
        var rect = clickable.getBoundingClientRect();
        clientX = Math.floor(rect.left + (rect.width / 2));
        clientY = Math.floor(rect.top + (rect.height / 2));
        screenX = clientX;
        screenY = clientY;
      }
    } catch (_ignoreCoords) {}

    // Older in-game UI handlers may rely on full mouse sequence.
    try {
      var evDown = document.createEvent("MouseEvents");
      evDown.initMouseEvent("mousedown", true, true, window, 1, screenX, screenY, clientX, clientY, false, false, false, false, 0, null);
      clickable.dispatchEvent(evDown);
      dispatched = true;
    } catch (_ignoreDown) {}

    try {
      var evUp = document.createEvent("MouseEvents");
      evUp.initMouseEvent("mouseup", true, true, window, 1, screenX, screenY, clientX, clientY, false, false, false, false, 0, null);
      clickable.dispatchEvent(evUp);
      dispatched = true;
    } catch (_ignoreUp) {}

    try {
      var evClick = document.createEvent("MouseEvents");
      evClick.initMouseEvent("click", true, true, window, 1, screenX, screenY, clientX, clientY, false, false, false, false, 0, null);
      clickable.dispatchEvent(evClick);
      dispatched = true;
    } catch (_ignoreDispatch) {}

    try {
      if (typeof clickable.click === "function") {
        clickable.click();
        dispatched = true;
      }
    } catch (_ignoreClick) {}
    return dispatched;
  }

  function activateAdvancedEntry(advancedEntry) {
    if (!advancedEntry) {
      return;
    }
    try {
      if (advancedEntry.classList) {
        advancedEntry.classList.add("hover");
      }
    } catch (_ignoreHoverClass) {}

    var target = advancedEntry;
    try {
      var anchor = advancedEntry.querySelector("a");
      if (anchor) {
        target = anchor;
      }
    } catch (_ignoreAnchorLookup) {}

    try {
      var rect = target && typeof target.getBoundingClientRect === "function"
        ? target.getBoundingClientRect()
        : null;
      var clientX = rect ? Math.floor(rect.left + (rect.width / 2)) : 0;
      var clientY = rect ? Math.floor(rect.top + (rect.height / 2)) : 0;
      var screenX = clientX;
      var screenY = clientY;

      var evEnter = document.createEvent("MouseEvents");
      evEnter.initMouseEvent("mouseenter", true, true, window, 1, screenX, screenY, clientX, clientY, false, false, false, false, 0, null);
      target.dispatchEvent(evEnter);
    } catch (_ignoreEnter) {}

    try {
      var evMove = document.createEvent("MouseEvents");
      var rectMove = target && typeof target.getBoundingClientRect === "function"
        ? target.getBoundingClientRect()
        : null;
      var clientXMove = rectMove ? Math.floor(rectMove.left + (rectMove.width / 2)) : 0;
      var clientYMove = rectMove ? Math.floor(rectMove.top + (rectMove.height / 2)) : 0;
      evMove.initMouseEvent("mousemove", true, true, window, 1, clientXMove, clientYMove, clientXMove, clientYMove, false, false, false, false, 0, null);
      target.dispatchEvent(evMove);
    } catch (_ignoreMove) {}
  }

  function triggerNativeMenuHandlers(entry) {
    if (!entry) {
      return false;
    }

    var triggered = false;
    var clickable = null;
    try {
      clickable = entry.querySelector("a");
    } catch (_ignoreClickable) {}
    if (!clickable) {
      clickable = entry;
    }

    try {
      if (typeof entry.onclick === "function") {
        entry.onclick.call(entry);
        triggered = true;
      }
    } catch (_ignoreEntryOnClick) {}

    try {
      if (clickable && typeof clickable.onclick === "function") {
        clickable.onclick.call(clickable);
        triggered = true;
      }
    } catch (_ignoreClickableOnClick) {}

    return triggered;
  }

  function tryInvokeContextMenuBridge(helperId) {
    var bridges = [
      { name: "CPPMainContextMenu", obj: window.CPPMainContextMenu },
      { name: "CPPContextMenu", obj: window.CPPContextMenu },
      { name: "ContextMenu", obj: window.ContextMenu }
    ];

    var attempts = [];
    var invoked = false;
    var helperIndex = NaN;
    try {
      var parsed = String(helperId || "").match(/(\d+)/);
      if (parsed && parsed[1]) {
        helperIndex = parseInt(parsed[1], 10);
      }
    } catch (_ignoreHelperIndex) {
      helperIndex = NaN;
    }

    function tryCall(bridgeName, fnName, fn, args, signatureName, callThis) {
      try {
        fn.apply(callThis || null, args);
        attempts.push({
          bridge: bridgeName,
          method: fnName,
          signature: signatureName,
          ok: true
        });
        return true;
      } catch (err) {
        attempts.push({
          bridge: bridgeName,
          method: fnName,
          signature: signatureName,
          ok: false,
          err: limitText(String(err && err.message ? err.message : err), 260)
        });
        return false;
      }
    }

    for (var i = 0; i < bridges.length; i += 1) {
      var bridge = bridges[i];
      var obj = bridge.obj;
      if (!obj || isNaN(helperIndex)) {
        continue;
      }

      var executeAction = null;
      try {
        executeAction = obj.executeAction;
      } catch (_ignoreExecuteActionRead) {
        executeAction = null;
      }
      if (typeof executeAction !== "function") {
        continue;
      }

      // Breakthrough: executeAction expects numeric action id.
      invoked = tryCall(bridge.name, "executeAction", executeAction, [helperIndex], "helperIndex", obj) || invoked;
      if (!invoked) {
        invoked = tryCall(bridge.name, "executeAction", executeAction, [helperIndex, true], "helperIndex,true", obj) || invoked;
        invoked = tryCall(bridge.name, "executeAction", executeAction, [helperIndex, false], "helperIndex,false", obj) || invoked;
      }
    }

    return {
      invoked: invoked,
      attempts: attempts
    };
  }

  function triggerCtrlLShortcut() {
    var triggered = false;

    function dispatchKeyEvent(target, type, key, keyCode, ctrlKey) {
      if (!target || typeof target.dispatchEvent !== "function") {
        return false;
      }

      var sent = false;
      try {
        var keyboardCtor = window.KeyboardEvent;
        if (typeof keyboardCtor === "function") {
          var ke = new keyboardCtor(type, {
            key: key,
            code: key === "Control" ? "ControlLeft" : "KeyL",
            keyCode: keyCode,
            which: keyCode,
            ctrlKey: !!ctrlKey,
            bubbles: true,
            cancelable: true
          });
          target.dispatchEvent(ke);
          sent = true;
        }
      } catch (_ignoreCtor) {}

      if (sent) {
        return true;
      }

      try {
        var ev = document.createEvent("Event");
        ev.initEvent(type, true, true);
        ev.key = key;
        ev.keyCode = keyCode;
        ev.which = keyCode;
        ev.ctrlKey = !!ctrlKey;
        ev.shiftKey = false;
        ev.altKey = false;
        ev.metaKey = false;
        target.dispatchEvent(ev);
        return true;
      } catch (_ignoreLegacy) {}

      return false;
    }

    try {
      var targets = [];
      var active = null;
      try {
        active = document && document.activeElement ? document.activeElement : null;
      } catch (_ignoreActive) {
        active = null;
      }
      if (active) {
        targets.push(active);
      }
      if (document && document.body) {
        targets.push(document.body);
      }
      if (document) {
        targets.push(document);
      }
      if (window) {
        targets.push(window);
      }

      for (var i = 0; i < targets.length; i += 1) {
        var t = targets[i];
        var sentAny = false;
        sentAny = dispatchKeyEvent(t, "keydown", "Control", 17, false) || sentAny;
        sentAny = dispatchKeyEvent(t, "keydown", "l", 76, true) || sentAny;
        sentAny = dispatchKeyEvent(t, "keypress", "l", 76, true) || sentAny;
        sentAny = dispatchKeyEvent(t, "keyup", "l", 76, true) || sentAny;
        sentAny = dispatchKeyEvent(t, "keyup", "Control", 17, false) || sentAny;
        triggered = triggered || sentAny;
      }
    } catch (_ignoreShortcut) {}

    return triggered;
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

  function triggerEditLuaFromQuickMenu(menuRoot) {
    sendPacket("lua_quick_menu_edit_lua", {
      source: "quick-menu"
    });

    var clicked = false;
    var nativeAttempt = 0;
    var maxNativeAttempts = 1;

    function getMenuRootForAttempt() {
      var liveMenuRoot = null;
      try {
        liveMenuRoot = document.getElementById("main_context_menu");
      } catch (_ignoreMenuLookup) {
        liveMenuRoot = null;
      }
      return liveMenuRoot || menuRoot || null;
    }

    function runFallbackPath() {
      if (isEditorVisible()) {
        sendPacket("lua_quick_menu_edit_lua_result", {
          step: "fallback-skip-visible",
          clicked: !!clicked
        });
        return;
      }

      var shortcutTriggered = triggerCtrlLShortcut();
      sendPacket("lua_quick_menu_edit_lua_result", {
        step: "fallback-ctrl-l",
        clicked: !!clicked,
        shortcutTriggered: !!shortcutTriggered
      });
    }

    function runNativeAttempt() {
      if (isEditorVisible()) {
        sendPacket("lua_quick_menu_edit_lua_result", {
          step: "native-already-open",
          attempt: nativeAttempt,
          clicked: !!clicked
        });
        return;
      }

      nativeAttempt += 1;
      var bridgeInvokedThisAttempt = false;
      var advancedEntryUsed = null;
      var targetPathUsed = "fallback-any";
      var targetForAttempt = null;

      try {
        var menuRootNow = getMenuRootForAttempt();
        if (!menuRootNow) {
          sendPacket("lua_quick_menu_edit_lua_result", {
            step: "native-click",
            attempt: nativeAttempt,
            clicked: false,
            reason: "no-menu-root"
          });
        } else {
          var advancedEntry = findAdvancedMenuEntry(menuRootNow);
          advancedEntryUsed = advancedEntry;
          var target = null;
          var targetPath = "fallback-any";
          if (advancedEntry) {
            target = findEditLuaEntryUnderAdvanced(advancedEntry);
            targetPath = "advanced-direct";
            if (!target) {
              activateAdvancedEntry(advancedEntry);
              target = findEditLuaEntryUnderAdvanced(advancedEntry);
              targetPath = "advanced-after-activate";
            }
          }

          target = target || findEditLuaEntryInside(advancedEntry || menuRootNow) ||
            findNativeEditLuaEntry(menuRootNow);
          targetForAttempt = target;
          targetPathUsed = targetPath;
          if (target) {
            var helperId = "";
            try {
              helperId = String(target.getAttribute("helperid") || "");
            } catch (_ignoreHelperId) {
              helperId = "";
            }

            var bridgeResult = tryInvokeContextMenuBridge(helperId);
            bridgeInvokedThisAttempt = !!(bridgeResult && bridgeResult.invoked);
            var clickDispatched = false;
            var handlerTriggered = false;
            if (!bridgeInvokedThisAttempt) {
              clickDispatched = triggerElementClick(target);
              handlerTriggered = triggerNativeMenuHandlers(target);
            }
            clicked = bridgeInvokedThisAttempt || clickDispatched || handlerTriggered || clicked;
            sendPacket("lua_quick_menu_edit_lua_result", {
              step: "native-click",
              attempt: nativeAttempt,
              clicked: !!clicked,
              clickDispatched: !!clickDispatched,
              handlerTriggered: !!handlerTriggered,
              bridgeInvoked: !!(bridgeResult && bridgeResult.invoked),
              bridgeAttempts: bridgeResult ? bridgeResult.attempts : [],
              targetText: limitText(textOf(target), 96)
            });
          } else {
            sendPacket("lua_quick_menu_edit_lua_result", {
              step: "native-click",
              attempt: nativeAttempt,
              clicked: false,
              reason: "no-native-target"
            });
          }
        }
      } catch (_ignoreNativeEdit) {}

      if (!bridgeInvokedThisAttempt && !isEditorVisible() && advancedEntryUsed && targetForAttempt && targetPathUsed.indexOf("advanced") === 0) {
        window.setTimeout(function () {
          if (isEditorVisible()) {
            return;
          }
          try {
            var delayedTarget = findEditLuaEntryUnderAdvanced(advancedEntryUsed) || targetForAttempt;
            var delayedClickDispatched = triggerElementClick(delayedTarget);
            var delayedHandlerTriggered = triggerNativeMenuHandlers(delayedTarget);
            clicked = delayedClickDispatched || delayedHandlerTriggered || clicked;
            sendPacket("lua_quick_menu_edit_lua_result", {
              step: "native-delayed-click",
              attempt: nativeAttempt,
              clicked: !!clicked,
              clickDispatched: !!delayedClickDispatched,
              handlerTriggered: !!delayedHandlerTriggered
            });
          } catch (_ignoreDelayedNative) {}
        }, 220);
      }

      var settleDelayMs = bridgeInvokedThisAttempt ? 750 : 140;
      window.setTimeout(function () {
        if (isEditorVisible()) {
          state.suppressRestoreUntilInteraction = true;
          state.skipNextSetCodeRestore = true;
          installFreshOpenViewportGuard();
          resetEditorViewportToTop();
          sendPacket("lua_quick_menu_edit_lua_result", {
            step: "native-opened",
            attempt: nativeAttempt,
            clicked: !!clicked,
            bridgeInvoked: !!bridgeInvokedThisAttempt
          });
          return;
        }

        if (nativeAttempt < maxNativeAttempts) {
          runNativeAttempt();
          return;
        }

        runFallbackPath();
      }, settleDelayMs);
    }

    // Defer to next tick so we don't compete with the current menu click stack.
    window.setTimeout(function () {
      var shortcutTriggered = triggerCtrlLShortcut();
      sendPacket("lua_quick_menu_edit_lua_result", {
        step: "shortcut-first",
        shortcutTriggered: !!shortcutTriggered
      });

      window.setTimeout(function () {
        if (isEditorVisible()) {
          sendPacket("lua_quick_menu_edit_lua_result", {
            step: "shortcut-first-opened",
            clicked: !!clicked
          });
          return;
        }
        runNativeAttempt();
      }, 120);
    }, 0);
  }

  function createQuickMenuEntry(id, label, onClick, templateEntry) {
    var li = document.createElement("li");
    li.id = id;

    var className = templateEntry ? String(templateEntry.className || "") : "menu";
    className = className.replace(/\bright_dropdown\b/g, "").replace(/\s+/g, " ").trim();
    li.className = className || "menu";
    li.setAttribute("data-ModUiExtractor-quick", "1");
    li.style.textAlign = "left";

    var a = null;
    try {
      var templateAnchor = templateEntry && templateEntry.querySelector
        ? templateEntry.querySelector(":scope > a")
        : null;
      if (templateAnchor && templateAnchor.cloneNode) {
        a = templateAnchor.cloneNode(false);
      }
    } catch (_ignoreTemplateAnchor) {
      a = null;
    }
    if (!a) {
      a = document.createElement("a");
    }
    a.textContent = label;
    a.style.textAlign = "left";
    a.style.display = "block";
    a.style.width = "100%";
    li.appendChild(a);

    var handleActivation = function (ev) {
      if (ev && typeof ev.preventDefault === "function") {
        ev.preventDefault();
      }
      if (ev && typeof ev.stopPropagation === "function") {
        ev.stopPropagation();
      }
      if (li.__luaProbeActivating) {
        return;
      }
      li.__luaProbeActivating = true;
      try {
        onClick();
      } catch (_ignoreQuickClick) {}
      window.setTimeout(function () {
        li.__luaProbeActivating = false;
      }, 180);
    };

    li.addEventListener("click", handleActivation, true);

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
    var editLuaEntry = findNativeMenuEntryByText(menuRoot, "edit lua script");
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
          triggerEditLuaFromQuickMenu(menuRoot);
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
        if (insertionPoint) {
          topContainer.insertBefore(quickEdit, insertionPoint);
        } else {
          topContainer.appendChild(quickEdit);
        }
      }
    }

    if (quickInject) {
      if (quickInject.parentNode !== topContainer) {
        var injectAnchor = quickEdit && quickEdit.parentNode === topContainer
          ? quickEdit.nextSibling
          : insertionPoint;
        if (injectAnchor) {
          topContainer.insertBefore(quickInject, injectAnchor);
        } else {
          topContainer.appendChild(quickInject);
        }
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
      "showDEM",
      "initDEM",
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
      var result = null;
      try {
        result = fn.apply(this, arguments);
      } catch (err) {
        sendPacket("lua_manager_call_error", {
          method: methodName,
          error: String(err && err.message ? err.message : err),
          context: getContextSnapshot()
        });
        throw err;
      }
      sendPacket("lua_manager_call_result", {
        method: methodName,
        result: summarizeArg(result),
        context: getContextSnapshot()
      });
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

  function waitForCodeMirrorSettle(info, onReady) {
    var seq = info && info.seq ? info.seq : 0;
    var targetSnippetKey = info && typeof info.targetSnippetKey === "string" ? info.targetSnippetKey : "";
    var startedAt = Date.now();
    var maxWaitMs = 5000;
    var quietWindowMs = 250;
    var pollIntervalMs = 40;
    var signalCount = 0;
    var lastSignalAt = startedAt;
    var lastViewportSignature = "";
    var currentCodeMirror = null;
    var currentHandlers = null;
    var targetSnippetSeen = !targetSnippetKey;
    var active = true;
    var timerId = 0;

    var isStaleSeq = function () {
      return !!(seq && state.activeSwitchSeq && seq !== state.activeSwitchSeq);
    };

    var markSignal = function (kind) {
      signalCount += 1;
      lastSignalAt = Date.now();
      if (signalCount <= 6 || signalCount % 20 === 0) {
        sendPacket("lua_cm_settle_signal", {
          seq: seq,
          kind: kind,
          signalCount: signalCount,
          elapsedMs: lastSignalAt - startedAt
        });
      }
    };

    var detachFromCodeMirror = function (codeMirror) {
      if (!codeMirror || !currentHandlers || typeof codeMirror.off !== "function") {
        return;
      }
      try { codeMirror.off("changes", currentHandlers.changes); } catch (_ignoreOffChanges) {}
      try { codeMirror.off("scroll", currentHandlers.scroll); } catch (_ignoreOffScroll) {}
      try { codeMirror.off("viewportChange", currentHandlers.viewportChange); } catch (_ignoreOffViewport) {}
      try { codeMirror.off("refresh", currentHandlers.refresh); } catch (_ignoreOffRefresh) {}
      try { codeMirror.off("update", currentHandlers.update); } catch (_ignoreOffUpdate) {}
      currentHandlers = null;
    };

    var attachToCodeMirror = function (codeMirror) {
      if (!codeMirror || codeMirror === currentCodeMirror) {
        return;
      }

      if (currentCodeMirror) {
        detachFromCodeMirror(currentCodeMirror);
      }
      currentCodeMirror = codeMirror;

      if (typeof codeMirror.on !== "function") {
        markSignal("cm-no-on");
        return;
      }

      currentHandlers = {
        changes: function () { markSignal("changes"); },
        scroll: function () { markSignal("scroll"); },
        viewportChange: function () { markSignal("viewportChange"); },
        refresh: function () { markSignal("refresh"); },
        update: function () { markSignal("update"); }
      };

      try { codeMirror.on("changes", currentHandlers.changes); } catch (_ignoreOnChanges) {}
      try { codeMirror.on("scroll", currentHandlers.scroll); } catch (_ignoreOnScroll) {}
      try { codeMirror.on("viewportChange", currentHandlers.viewportChange); } catch (_ignoreOnViewport) {}
      try { codeMirror.on("refresh", currentHandlers.refresh); } catch (_ignoreOnRefresh) {}
      try { codeMirror.on("update", currentHandlers.update); } catch (_ignoreOnUpdate) {}
      markSignal("cm-attached");
    };

    var getViewportSignature = function () {
      var viewport = getEditorViewportSnapshot();
      if (!viewport) {
        return "";
      }
      return [
        typeof viewport.lineCount === "number" ? viewport.lineCount : "na",
        typeof viewport.scrollTopPx === "number" ? viewport.scrollTopPx : "na",
        typeof viewport.cmScrollerTopPx === "number" ? viewport.cmScrollerTopPx : "na",
        typeof viewport.cmVScrollbarTopPx === "number" ? viewport.cmVScrollbarTopPx : "na",
        typeof viewport.scrollHeightPx === "number" ? viewport.scrollHeightPx : "na",
        typeof viewport.clientHeightPx === "number" ? viewport.clientHeightPx : "na",
        typeof viewport.cursorLine === "number" ? viewport.cursorLine : "na"
      ].join("|");
    };

    var finish = function (reason) {
      if (!active) {
        return;
      }
      active = false;
      if (timerId) {
        try {
          window.clearTimeout(timerId);
        } catch (_ignoreClearSettleTimer) {}
        timerId = 0;
      }
      if (currentCodeMirror) {
        detachFromCodeMirror(currentCodeMirror);
      }
      onReady({
        reason: reason,
        elapsedMs: Date.now() - startedAt,
        signalCount: signalCount,
        quietForMs: Date.now() - lastSignalAt
      });
    };

    var tick = function () {
      if (!active) {
        return;
      }
      if (isStaleSeq()) {
        finish("stale-seq");
        return;
      }

      var codeMirror = getLuaCodeMirror();
      if (codeMirror !== currentCodeMirror) {
        attachToCodeMirror(codeMirror);
        markSignal("cm-instance");
      }

      var signature = getViewportSignature();
      if (signature && signature !== lastViewportSignature) {
        lastViewportSignature = signature;
        markSignal("viewport");
      }

      if (!targetSnippetSeen && currentCodeMirror) {
        var currentSnippetKey = getSnippetMemoryKeyFromEditor(currentCodeMirror);
        if (currentSnippetKey && currentSnippetKey === targetSnippetKey) {
          targetSnippetSeen = true;
          markSignal("target-snippet");
        }
      }

      var now = Date.now();
      if (targetSnippetSeen && lastViewportSignature && (now - lastSignalAt) >= quietWindowMs) {
        finish("quiet-window");
        return;
      }
      if ((now - startedAt) >= maxWaitMs) {
        finish(targetSnippetSeen ? "timeout" : "timeout-no-target");
        return;
      }

      timerId = window.setTimeout(tick, pollIntervalMs);
    };

    attachToCodeMirror(getLuaCodeMirror());
    markSignal("start");
    tick();
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
        var targetSnippetKey = getSnippetMemoryKeyFromCode(args && args.length > 0 ? args[0] : null);
        var hasRememberedTarget = hasRememberedTopLineForKey(targetSnippetKey);
        var suppressRestore = (!!state.skipNextSetCodeRestore || !!state.suppressRestoreUntilInteraction) && !hasRememberedTarget;
        state.skipNextSetCodeRestore = false;
        if (hasRememberedTarget && state.suppressRestoreUntilInteraction) {
          state.suppressRestoreUntilInteraction = false;
          removeFreshOpenViewportGuard();
        }
        var forceEditorFocus = !!state.forceEditorFocusOnNextSwitch;
        if (forceEditorFocus) {
          state.forceEditorFocusOnNextSwitch = false;
        }

        syncCurrentSnippetKeyFromEditor();
        if (!suppressRestore && state.currentSnippetKey) {
          rememberTopLineForKey(state.currentSnippetKey);
        }
        if (!suppressRestore) {
          rememberTopLineForKey(state.lastContextKey);
        }
        var seq = state.setCodeSwitchSeq + 1;
        state.setCodeSwitchSeq = seq;
        state.switchInProgress = true;
        state.activeSwitchSeq = seq;
        var switchInfo = {
          seq: seq,
          before: getContextSnapshot(),
          beforeViewport: getEditorViewportSnapshot(),
          code: summarizeCodeForSwitch(args && args.length > 0 ? args[0] : null),
          targetSnippetKey: targetSnippetKey,
          targetHasRememberedTopLine: hasRememberedTarget,
          suppressRestore: suppressRestore,
          forceEditorFocus: forceEditorFocus
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

        waitForCodeMirrorSettle(info, function (settle) {
          if (info.seq && state.activeSwitchSeq && info.seq !== state.activeSwitchSeq) {
            return;
          }

          var settleInfo = settle || {
            reason: "unknown",
            elapsedMs: 0,
            signalCount: 0,
            quietForMs: 0
          };

          try {
            ensureCaretHighlightBindings();

            // Refresh once at settle point so we work on the final CodeMirror instance.
            var currentCm = getLuaCodeMirror();
            if (currentCm && typeof currentCm.refresh === "function") {
              try {
                currentCm.refresh();
              } catch (_ignoreRefreshAtSettle) {}
            }

            if (info && info.suppressRestore) {
              syncCurrentSnippetKeyFromEditor();
              syncCurrentContextKey(true);
              refreshActiveFilterMarker();
              resetEditorViewportToTop();
              updateCaretLineHighlight();
            } else {
              restoreSnippetAfterSwitch(info);
            }

            sendPacket("lua_snippet_switch_end", {
              seq: info.seq,
              before: info.before,
              beforeViewport: info.beforeViewport || null,
              after: getContextSnapshot(),
              afterViewport: getEditorViewportSnapshot(),
              restoreDelayMs: settleInfo.elapsedMs,
              settleReason: settleInfo.reason,
              settleSignalCount: settleInfo.signalCount,
              settleQuietForMs: settleInfo.quietForMs,
              code: info.code
            });

            sendPacket("lua_snippet_switch_settled", {
              seq: info.seq,
              after: getContextSnapshot(),
              afterViewport: getEditorViewportSnapshot(),
              settleReason: settleInfo.reason,
              settleSignalCount: settleInfo.signalCount
            });
          } catch (_ignoreRestoreAfterSettle) {
          } finally {
            var isActiveSeq = !info.seq || state.activeSwitchSeq === info.seq;
            if (isActiveSeq) {
              state.switchInProgress = false;
              if (info && info.forceEditorFocus) {
                enforceEditorFocusAndCaret();
              } else {
                updateCaretLineHighlight();
              }
            }
          }
        });
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
    state.scrollTopByContext = Object.create(null);
    state.lastContextKey = "";
    state.currentSnippetKey = "";
    state.forceEditorFocusOnNextSwitch = false;
    state.skipNextSetCodeRestore = true;
    state.suppressRestoreUntilInteraction = true;
    installFreshOpenViewportGuard();
    resetEditorViewportToTop();

    addProbeBadge();
    ensureThemeSwitcher();
    ensureIdeSyncButton();
    ensureEditorSwitchHooks();
    ensureAutoClickObserver();
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
    clearPendingSlotAutoOpen();
    clearActiveFilterMarker();
    state.activeFilterIndex = -1;
    state.activeFilterFingerprint = "";
    state.currentSnippetKey = "";
    state.lastContextKey = "";
    state.scrollTopByContext = Object.create(null);
    state.forceEditorFocusOnNextSwitch = false;
    state.skipNextSetCodeRestore = false;
    state.suppressRestoreUntilInteraction = true;
    removeFreshOpenViewportGuard();
    try {
      clearCaretLineHighlight(getLuaCodeMirror());
    } catch (_ignore) {}
    sendPacket("lua_editor_closed", {});
  }

  function refreshEditorState() {
    var visible = isEditorVisible();
    if (visible && !state.editorVisible) {
      state.editorVisible = true;
      onEditorOpened();
    } else if (visible && state.editorVisible) {
      ensureThemeSwitcher();
      ensureIdeSyncButton();
      ensureEditorSwitchHooks();
      ensureAutoClickObserver();
      ensureCaretHighlightToggle();
      ensureCaretHighlightBindings();
      if (state.suppressRestoreUntilInteraction) {
        installFreshOpenViewportGuard();
      } else {
        removeFreshOpenViewportGuard();
      }
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
      if (state.filtersObserver && typeof state.filtersObserver.disconnect === "function") {
        state.filtersObserver.disconnect();
      }
      state.filtersObserver = null;
      state.filtersObserverRoot = null;
    } catch (_ignoreFiltersObserver) {}

    clearPendingSlotAutoOpen();
    removeFreshOpenViewportGuard();

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
      "ModUiExtractor-lua-probe-style",
      "ModUiExtractor-lua-probe-badge",
      "ModUiExtractor-lua-theme-dots",
      "ModUiExtractor-lua-caret-toggle",
      "ModUiExtractor-lua-ide-sync",
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
