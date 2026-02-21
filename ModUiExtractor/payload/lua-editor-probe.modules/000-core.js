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

