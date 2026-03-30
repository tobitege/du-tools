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
  var luaEditorEnhancementModuleId = "lua-editor-enhancements";
  var themeCatalogStorageKey = "ModUiExtractor.lua.theme-catalog.flowery-daisy.v2";
  var mcpResultChunkSize = 7000;

  function cloneJsonValue(value, fallbackValue) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_ignoreCloneJson) {}
    return typeof fallbackValue === "undefined" ? null : fallbackValue;
  }

  function buildRuntimeModuleConfigMap() {
    var map = Object.create(null);
    var defs = Array.isArray(cfg.runtimeModules) ? cfg.runtimeModules : [];
    for (var i = 0; i < defs.length; i += 1) {
      var def = defs[i];
      if (!def || typeof def !== "object") {
        continue;
      }
      var id = String(def.id || "").trim();
      if (!id) {
        continue;
      }
      map[id] = def;
    }
    return map;
  }

  var runtimeModuleConfigById = buildRuntimeModuleConfigMap();

  function getRuntimeModuleConfig(moduleId) {
    var key = String(moduleId || "").trim();
    return key && runtimeModuleConfigById[key] ? runtimeModuleConfigById[key] : null;
  }

  function getRuntimeModuleStateObject(moduleId) {
    var def = getRuntimeModuleConfig(moduleId);
    if (!def) {
      return null;
    }
    if (!def.state || typeof def.state !== "object") {
      def.state = {};
    }
    return def.state;
  }

  function getRuntimeModuleStateValue(moduleId, key, fallbackValue) {
    var stateObject = getRuntimeModuleStateObject(moduleId);
    if (!stateObject) {
      return typeof fallbackValue === "undefined" ? null : fallbackValue;
    }
    if (typeof key === "undefined" || key === null || key === "") {
      return cloneJsonValue(stateObject, typeof fallbackValue === "undefined" ? {} : fallbackValue);
    }
    if (Object.prototype.hasOwnProperty.call(stateObject, key)) {
      return cloneJsonValue(stateObject[key], fallbackValue);
    }
    return typeof fallbackValue === "undefined" ? null : fallbackValue;
  }

  function persistRuntimeModuleStateValue(moduleId, key, value) {
    var stateObject = getRuntimeModuleStateObject(moduleId);
    if (!stateObject || !key) {
      return false;
    }
    stateObject[key] = cloneJsonValue(value, value);
    try {
      if (typeof sendPacket === "function") {
        sendPacket("lua_runtime_module_state_set", {
          moduleId: String(moduleId || ""),
          key: String(key),
          value: cloneJsonValue(stateObject[key], stateObject[key])
        });
      }
      return true;
    } catch (_ignoreRuntimeModulePersist) {}
    return false;
  }

  function replaceRuntimeModuleState(moduleId, nextState) {
    var def = getRuntimeModuleConfig(moduleId);
    if (!def) {
      return false;
    }
    def.state = nextState && typeof nextState === "object" ? cloneJsonValue(nextState, {}) : {};
    try {
      if (typeof sendPacket === "function") {
        sendPacket("lua_runtime_module_state_set", {
          moduleId: String(moduleId || ""),
          state: cloneJsonValue(def.state, {}),
          replace: true
        });
      }
      return true;
    } catch (_ignoreRuntimeModuleReplace) {}
    return false;
  }

  function loadCaretHighlightPreference() {
    return !!getRuntimeModuleStateValue(luaEditorEnhancementModuleId, "caretHighlightEnabled", false);
  }

  function saveCaretHighlightPreference(enabled) {
    return persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "caretHighlightEnabled", !!enabled);
  }

  function loadThemePreference() {
    var runtimeValue = getRuntimeModuleStateValue(luaEditorEnhancementModuleId, "theme", "");
    return runtimeValue ? String(runtimeValue) : "";
  }

  function saveThemePreference(themeName) {
    return persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "theme", String(themeName || ""));
  }

  function loadThemeCatalogCache() {
    try {
      if (!window.localStorage || typeof window.localStorage.getItem !== "function") {
        return null;
      }
      var raw = window.localStorage.getItem(themeCatalogStorageKey);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_ignoreThemeCatalogRead) {}
    return null;
  }

  function saveThemeCatalogCache(payload) {
    try {
      if (!window.localStorage || typeof window.localStorage.setItem !== "function") {
        return false;
      }
      window.localStorage.setItem(themeCatalogStorageKey, JSON.stringify(payload || null));
      return true;
    } catch (_ignoreThemeCatalogWrite) {}
    return false;
  }

  var state = {
    menuObserved: false,
    menuHits: 0,
    editorVisible: false,
    managerWrapped: false,
    activeTheme: loadThemePreference() || "daisy-night",
    lastAppliedTheme: "",
    scrollTopByContext: Object.create(null),
    screenScrollTopByContext: Object.create(null),
    lastContextKey: "",
    lastScreenContextKey: "",
    activeFilterFingerprint: "",
    activeFilterIndex: -1,
    currentSnippetKey: "",
    caretHighlightEnabled: loadCaretHighlightPreference(),
    caretBindingsCodeMirror: null,
    screenViewportBindingsCodeMirror: null,
    setCodeSwitchSeq: 0,
    switchInProgress: false,
    activeSwitchSeq: 0,
    intervalId: 0,
    luaEnhancementIntervalId: 0,
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
    screenEditorVisible: false,
    screenLastRestoredContextKey: "",
    screenPreferenceRestoreContextKey: "",
    lastIdeSyncContextKey: "",
    lastIdeSyncReference: null,
    lastInitDemReference: null,
    themeCatalog: null,
    themeCatalogLoading: false,
    themeCatalogRequestId: "",
    themeCatalogCallbacks: []
  };

  state.applyIdeCode = applyIdeCode;
  state.applyIdeImport = applyIdeImport;
  var colorThemes = [
    {
      name: "monokai",
      label: "Monokai",
      dot: "#a6e22e",
      accent: "rgba(166,226,46,0.92)",
      header: "rgba(39,40,34,0.97)",
      caretBg: "rgba(166,226,46,0.18)",
      accentSolid: "#a6e22e",
      onAccent: "#272822",
      surfaceMain: "#272822",
      surfaceElevated: "#3e3d32",
      surfaceRow: "#49483e",
      surfaceDeep: "#1e1f1c",
      surfaceRowAlt: "#423f36",
      borderStrong: "#75715e",
      borderHover: "#66d9ef",
      shadow: "rgba(0,0,0,0.5)",
      textMuted: "#cfcfc2",
      textDim: "#90908a",
      cmText: "#f8f8f2",
      cmComment: "#75715e",
      cmLineNumber: "#90908a",
      cmKeyword: "#f92672",
      cmAtom: "#ae81ff",
      cmString: "#e6db74",
      cmNumber: "#ae81ff",
      cmDef: "#a6e22e",
      cmBuiltin: "#66d9ef",
      cmVariable: "#f8f8f2",
      cmVariable2: "#fd971f",
      cmOperator: "#f8f8f2",
      cmProperty: "#a6e22e",
      gutterBorder: "#49483e",
      btnApplyBg: "linear-gradient(180deg,#646e52 0%,#4a5540 45%,#343c30 100%)",
      btnApplyBorder: "rgba(166,226,46,0.78)",
      btnApplyColor: "#f8f8f2",
      btnApplyHoverBg: "linear-gradient(180deg,#727c60 0%,#586348 45%,#3e4836 100%)",
      btnApplyActiveBg: "linear-gradient(180deg,#525a48 0%,#3a4236 45%,#2b3028 100%)",
      btnCancelBg: "linear-gradient(180deg,#525046 0%,#403e38 45%,#302e2a 100%)",
      btnCancelBorder: "rgba(183,174,140,0.55)",
      btnCancelColor: "#cfcfc2",
      btnCancelHoverBg: "linear-gradient(180deg,#5e5a50 0%,#4a4640 45%,#38342f 100%)",
      btnCancelActiveBg: "linear-gradient(180deg,#45423a 0%,#35322d 45%,#282622 100%)",
      btnDisabledBg: "linear-gradient(180deg,rgba(28,40,48,0.85) 0%,rgba(18,28,34,0.85) 100%)",
      btnDisabledBorder: "rgba(84,122,135,0.45)",
      btnDisabledColor: "rgba(132,160,170,0.72)"
    },
    {
      name: "github-dark",
      label: "GitHub Dark",
      dot: "#58a6ff",
      accent: "rgba(88,166,255,0.92)",
      header: "rgba(13,17,23,0.97)",
      caretBg: "rgba(88,166,255,0.15)",
      accentSolid: "#58a6ff",
      onAccent: "#0d1117",
      surfaceMain: "#0d1117",
      surfaceElevated: "#161b22",
      surfaceRow: "#21262d",
      surfaceDeep: "#010409",
      surfaceRowAlt: "#30363d",
      borderStrong: "#30363d",
      borderHover: "#58a6ff",
      shadow: "rgba(1,4,9,0.55)",
      textMuted: "#8b949e",
      textDim: "#6e7681",
      cmText: "#e6edf3",
      cmComment: "#8b949e",
      cmLineNumber: "#6e7681",
      cmKeyword: "#ff7b72",
      cmAtom: "#79c0ff",
      cmString: "#a5d6ff",
      cmNumber: "#79c0ff",
      cmDef: "#d2a8ff",
      cmBuiltin: "#d2a8ff",
      cmVariable: "#e6edf3",
      cmVariable2: "#ffa657",
      cmOperator: "#c9d1d9",
      cmProperty: "#79c0ff",
      gutterBorder: "#30363d",
      btnApplyBg: "linear-gradient(180deg,#1c4a8c 0%,#143a6e 45%,#0c2848 100%)",
      btnApplyBorder: "rgba(88,166,255,0.78)",
      btnApplyColor: "#e6edf3",
      btnApplyHoverBg: "linear-gradient(180deg,#2657a0 0%,#1a457e 45%,#12325c 100%)",
      btnApplyActiveBg: "linear-gradient(180deg,#153a6c 0%,#0f2d52 45%,#0a2040 100%)",
      btnCancelBg: "linear-gradient(180deg,#30363d 0%,#252b33 45%,#1a1f26 100%)",
      btnCancelBorder: "rgba(139,148,158,0.45)",
      btnCancelColor: "#8b949e",
      btnCancelHoverBg: "linear-gradient(180deg,#3d444d 0%,#30363d 45%,#252b32 100%)",
      btnCancelActiveBg: "linear-gradient(180deg,#282e35 0%,#1e242a 45%,#161b22 100%)",
      btnDisabledBg: "linear-gradient(180deg,rgba(28,40,48,0.85) 0%,rgba(18,28,34,0.85) 100%)",
      btnDisabledBorder: "rgba(84,122,135,0.45)",
      btnDisabledColor: "rgba(132,160,170,0.72)"
    },
    {
      name: "gruvbox-dark",
      label: "Gruvbox Dark",
      dot: "#fe8019",
      accent: "rgba(254,128,25,0.92)",
      header: "rgba(40,40,40,0.97)",
      caretBg: "rgba(254,128,25,0.18)",
      accentSolid: "#fe8019",
      onAccent: "#282828",
      surfaceMain: "#282828",
      surfaceElevated: "#3c3836",
      surfaceRow: "#504945",
      surfaceDeep: "#1d2021",
      surfaceRowAlt: "#403c3a",
      borderStrong: "#665c54",
      borderHover: "#83a598",
      shadow: "rgba(0,0,0,0.5)",
      textMuted: "#a89984",
      textDim: "#928374",
      cmText: "#ebdbb2",
      cmComment: "#928374",
      cmLineNumber: "#a89984",
      cmKeyword: "#fb4934",
      cmAtom: "#d3869b",
      cmString: "#b8bb26",
      cmNumber: "#d3869b",
      cmDef: "#fabd2f",
      cmBuiltin: "#83a598",
      cmVariable: "#ebdbb2",
      cmVariable2: "#fe8019",
      cmOperator: "#ebdbb2",
      cmProperty: "#8ec07c",
      gutterBorder: "#504945",
      btnApplyBg: "linear-gradient(180deg,#76634a 0%,#5a4a3a 45%,#423d34 100%)",
      btnApplyBorder: "rgba(254,128,25,0.82)",
      btnApplyColor: "#fbf1c7",
      btnApplyHoverBg: "linear-gradient(180deg,#857256 0%,#685442 45%,#4d4036 100%)",
      btnApplyActiveBg: "linear-gradient(180deg,#5f5142 0%,#483e32 45%,#362f28 100%)",
      btnCancelBg: "linear-gradient(180deg,#504945 0%,#403c3a 45%,#32302f 100%)",
      btnCancelBorder: "rgba(168,153,132,0.5)",
      btnCancelColor: "#a89984",
      btnCancelHoverBg: "linear-gradient(180deg,#5c534d 0%,#4a4541 45%,#3a3634 100%)",
      btnCancelActiveBg: "linear-gradient(180deg,#454039 0%,#363230 45%,#292726 100%)",
      btnDisabledBg: "linear-gradient(180deg,rgba(28,40,48,0.85) 0%,rgba(18,28,34,0.85) 100%)",
      btnDisabledBorder: "rgba(84,122,135,0.45)",
      btnDisabledColor: "rgba(132,160,170,0.72)"
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

  function splitTextIntoChunks(text, chunkSize) {
    var value = String(text || "");
    var size = typeof chunkSize === "number" && chunkSize > 0 ? chunkSize : 7000;
    var chunks = [];
    if (!value) {
      chunks.push("");
      return chunks;
    }
    for (var i = 0; i < value.length; i += size) {
      chunks.push(value.slice(i, i + size));
    }
    return chunks;
  }

  function sendJsonPacketChunked(type, payload, chunkSize) {
    var json = JSON.stringify(payload || {});
    var chunks = splitTextIntoChunks(json, chunkSize);
    var packetId = type + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
    for (var i = 0; i < chunks.length; i += 1) {
      sendPacket(type + "_chunk", {
        packetId: packetId,
        part: i + 1,
        total: chunks.length,
        jsonChunk: chunks[i]
      });
    }
  }

  function getIdeSyncButtonForTarget(targetKind) {
    var normalizedTargetKind = normalizeIdeImportTargetKind(targetKind);
    var buttonId = normalizedTargetKind === "screen_editor"
      ? "ModUiExtractor-screen-ide-sync"
      : "ModUiExtractor-lua-ide-sync";
    return document.getElementById(buttonId);
  }

  function flashIdeSyncButtonForTarget(targetKind, message, background, color, durationMs) {
    var button = getIdeSyncButtonForTarget(targetKind);
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

  function flashIdeSyncButton(message, background, color, durationMs) {
    flashIdeSyncButtonForTarget("lua_editor", message, background, color, durationMs);
  }

  function normalizeIdeImportTargetKind(targetKind) {
    return String(targetKind || "").toLowerCase() === "screen_editor" ? "screen_editor" : "lua_editor";
  }

  function normalizeIdeSyncValue(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function normalizeLuaEditorTrailingNewline(codeMirror) {
    if (!codeMirror || typeof codeMirror.getValue !== "function" || typeof codeMirror.setValue !== "function") {
      return;
    }

    try {
      var currentText = String(codeMirror.getValue() || "");
      if (!/\n\n$/.test(currentText)) {
        return;
      }
      codeMirror.setValue(currentText.replace(/\n\n$/, "\n"));
    } catch (_ignoreNormalizeLuaEditorTrailingNewline) {}
  }

  function cloneIdeSyncObject(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_ignoreCloneIdeSyncObject) {}
    return null;
  }

  function getLuaIdeSyncReference() {
    var manager = window.LUAEditorManager || null;
    var currentData = manager && manager.currentData ? manager.currentData : null;
    var currentSlot = currentData && currentData.currentSlot ? currentData.currentSlot : null;
    var currentFilter = currentData && currentData.currentFilter ? currentData.currentFilter : null;
    var currentSlotData = currentSlot && currentSlot.slotData ? currentSlot.slotData : null;
    var lastReference = state.lastInitDemReference || null;
    var parsedSelfSlot = lastReference && lastReference.parsedSelfSlot ? lastReference.parsedSelfSlot : null;
    var slotElementName = null;
    var constructId = cfg && typeof cfg.constructId !== "undefined" ? cfg.constructId : null;

    try {
      if (currentSlotData && typeof currentSlotData.slotElementName !== "undefined" && currentSlotData.slotElementName !== null) {
        slotElementName = currentSlotData.slotElementName;
      } else if (parsedSelfSlot && typeof parsedSelfSlot.slotElementName !== "undefined" && parsedSelfSlot.slotElementName !== null) {
        slotElementName = parsedSelfSlot.slotElementName;
      } else if (lastReference && typeof lastReference.currentSlotElementName !== "undefined" && lastReference.currentSlotElementName !== null) {
        slotElementName = lastReference.currentSlotElementName;
      }
    } catch (_ignoreLuaIdeSyncSlotElementName) {}

    if ((constructId === null || typeof constructId === "undefined") && lastReference && typeof lastReference.constructId !== "undefined") {
      constructId = lastReference.constructId;
    }

    var currentFilterSignature = null;
    try {
      if (typeof getResolvedActiveFilterDisplaySignature === "function") {
        var resolvedFilterSignature = String(getResolvedActiveFilterDisplaySignature() || "").replace(/\s+/g, " ").trim();
        if (resolvedFilterSignature) {
          currentFilterSignature = resolvedFilterSignature;
        }
      }
    } catch (_ignoreLuaIdeSyncResolvedFilterSignature) {}

    if (!currentFilterSignature && currentFilter && typeof currentFilter.signature !== "undefined" && currentFilter.signature !== null) {
      currentFilterSignature = String(currentFilter.signature);
    }
    if (!currentFilterSignature && currentFilter && typeof currentFilter.name !== "undefined" && currentFilter.name !== null) {
      currentFilterSignature = String(currentFilter.name);
    }
    if (!currentFilterSignature && lastReference && typeof lastReference.currentFilterSignature !== "undefined" && lastReference.currentFilterSignature !== null) {
      currentFilterSignature = String(lastReference.currentFilterSignature);
    }

    return {
      constructId: constructId,
      editorTitle: typeof getLuaEditorTitleForDebug === "function" ? getLuaEditorTitleForDebug() : "",
      slotElementName: slotElementName,
      currentSlotName: currentSlot && typeof currentSlot.name !== "undefined" ? currentSlot.name : null,
      currentSlotKey: currentSlot && typeof currentSlot.slotKey !== "undefined" ? currentSlot.slotKey : null,
      currentFilterKey: currentFilter && typeof currentFilter.key !== "undefined" ? currentFilter.key : null,
      currentFilterSignature: currentFilterSignature
    };
  }

  function buildLuaIdeSyncContextKey(luaReference, codeMirror) {
    var reference = luaReference && typeof luaReference === "object" ? luaReference : null;
    var parts = [];

    if (reference) {
      var constructId = reference.constructId !== null && typeof reference.constructId !== "undefined"
        ? normalizeIdeSyncValue(reference.constructId)
        : "";
      var slotElementName = normalizeIdeSyncValue(reference.slotElementName);
      var slotName = normalizeIdeSyncValue(reference.currentSlotName);
      var slotKey = normalizeIdeSyncValue(reference.currentSlotKey);
      var filterKey = normalizeIdeSyncValue(reference.currentFilterKey);
      var filterSignature = normalizeIdeSyncValue(reference.currentFilterSignature);

      if (constructId) {
        parts.push("construct=" + constructId);
      }
      if (slotElementName) {
        parts.push("slotElement=" + slotElementName);
      }
      if (slotName) {
        parts.push("slot=" + slotName);
      }
      if (slotKey) {
        parts.push("slotKey=" + slotKey);
      }
      if (filterKey) {
        parts.push("filterKey=" + filterKey);
      }
      if (filterSignature) {
        parts.push("filter=" + filterSignature);
      }
    }

    if (parts.length > 0) {
      return "lua:" + parts.join("|");
    }

    return getEditorContextKey(codeMirror);
  }

  function getCurrentIdeImportSnapshot(targetKind) {
    var normalizedTargetKind = normalizeIdeImportTargetKind(targetKind);
    if (normalizedTargetKind === "screen_editor") {
      var screenRoot = typeof getScreenEditorRoot === "function" ? getScreenEditorRoot() : null;
      var screenVisible = !!(screenRoot && isElementVisible(screenRoot));
      var screenCodeMirror = (screenVisible && typeof getScreenEditorCodeMirror === "function") ? getScreenEditorCodeMirror(screenRoot) : null;
      var screenPanel = typeof getScreenEditorPanel === "function" ? getScreenEditorPanel() : null;
      var screenCodeNode = (screenVisible && typeof getScreenEditorCodeNode === "function") ? getScreenEditorCodeNode(screenPanel, screenRoot) : null;
      var screenText = "";
      var screenTitle = "";
      var screenSubTitle = "";
      var screenMode = "lua";

      if (!screenVisible) {
        return {
          ready: false,
          targetKind: normalizedTargetKind,
          status: "screen_editor_not_visible"
        };
      }

      try {
        if (screenCodeMirror && typeof screenCodeMirror.getValue === "function") {
          screenText = String(screenCodeMirror.getValue() || "");
        } else if (screenCodeNode && typeof screenCodeNode.value === "string") {
          screenText = String(screenCodeNode.value || "");
        }
      } catch (_ignoreScreenIdeSyncCode) {}

      try {
        var screenTitleNode = screenRoot && screenRoot.querySelector ? screenRoot.querySelector(".header_block .panel_title") : null;
        screenTitle = screenTitleNode ? String(screenTitleNode.textContent || "").replace(/\s+/g, " ").trim() : "";
      } catch (_ignoreScreenIdeSyncTitle) {}

      try {
        var screenSubTitleNode = screenRoot && screenRoot.querySelector ? screenRoot.querySelector(".content .top_line .sub_title_wrapper .sub_title") : null;
        screenSubTitle = screenSubTitleNode ? String(screenSubTitleNode.textContent || "").replace(/\s+/g, " ").trim() : "";
      } catch (_ignoreScreenIdeSyncSubTitle) {}

      try {
        if (screenPanel && typeof screenPanel.isInHTMLMode === "boolean") {
          screenMode = screenPanel.isInHTMLMode ? "html" : "lua";
        }
      } catch (_ignoreScreenIdeSyncMode) {}

      return {
        ready: true,
        targetKind: normalizedTargetKind,
        status: "ready",
        code: screenText,
        codeHash32: hashStringFNV1a(screenText),
        contextKey: "screen:" + normalizeIdeSyncValue(screenTitle) + "::" + normalizeIdeSyncValue(screenSubTitle) + "::" + normalizeIdeSyncValue(screenMode),
        reference: {
          title: screenTitle,
          subTitle: screenSubTitle,
          mode: screenMode
        }
      };
    }

    var codeMirror = getLuaCodeMirror();
    if (!codeMirror || typeof codeMirror.getValue !== "function" || !isEditorVisible()) {
      return {
        ready: false,
        targetKind: "lua_editor",
        status: "lua_editor_not_visible"
      };
    }

    var luaReference = getLuaIdeSyncReference();
    var hasActiveFilter = !!(
      luaReference &&
      (
        normalizeIdeSyncValue(luaReference.currentFilterKey) ||
        normalizeIdeSyncValue(luaReference.currentFilterSignature)
      )
    );
    if (!hasActiveFilter) {
      return {
        ready: false,
        targetKind: "lua_editor",
        status: "lua_editor_no_active_filter",
        reference: luaReference,
        contextKey: "",
        codeHash32: null
      };
    }

    var luaText = "";
    try {
      luaText = String(codeMirror.getValue() || "");
    } catch (_ignoreLuaIdeSyncCode) {}

    return {
      ready: true,
      targetKind: "lua_editor",
      status: "ready",
      codeMirror: codeMirror,
      code: luaText,
      codeHash32: hashStringFNV1a(luaText),
      contextKey: buildLuaIdeSyncContextKey(luaReference, codeMirror),
      reference: luaReference
    };
  }

  function compareIdeImportReference(expectedReference, currentReference, targetKind) {
    var normalizedTargetKind = normalizeIdeImportTargetKind(targetKind);
    var expected = expectedReference && typeof expectedReference === "object" ? expectedReference : null;
    var current = currentReference && typeof currentReference === "object" ? currentReference : null;
    var reasons = [];
    if (!expected || !current) {
      return {
        match: true,
        reasons: reasons
      };
    }

    if (normalizedTargetKind === "screen_editor") {
      var expectedTitle = normalizeIdeSyncValue(expected.title);
      var currentTitle = normalizeIdeSyncValue(current.title);
      var expectedSubTitle = normalizeIdeSyncValue(expected.subTitle);
      var currentSubTitle = normalizeIdeSyncValue(current.subTitle);
      if (expectedTitle && currentTitle && expectedTitle !== currentTitle) {
        reasons.push("screen_title_mismatch");
      }
      if (expectedSubTitle && currentSubTitle && expectedSubTitle !== currentSubTitle) {
        reasons.push("screen_sub_title_mismatch");
      }
      return {
        match: reasons.length <= 0,
        reasons: reasons
      };
    }

    if (expected.constructId !== null &&
        typeof expected.constructId !== "undefined" &&
        current.constructId !== null &&
        typeof current.constructId !== "undefined" &&
        String(expected.constructId) !== String(current.constructId)) {
      reasons.push("construct_id_mismatch");
    }

    var expectedSlotElementName = normalizeIdeSyncValue(expected.slotElementName);
    var currentSlotElementName = normalizeIdeSyncValue(current.slotElementName);
    if (expectedSlotElementName) {
      if (!currentSlotElementName) {
        reasons.push("slot_element_name_missing");
      } else if (expectedSlotElementName !== currentSlotElementName) {
        reasons.push("slot_element_name_mismatch");
      }
    }

    var expectedEditorTitle = normalizeIdeSyncValue(expected.editorTitle);
    var currentEditorTitle = normalizeIdeSyncValue(current.editorTitle);
    if (expectedEditorTitle && currentEditorTitle && expectedEditorTitle !== currentEditorTitle) {
      reasons.push("editor_title_mismatch");
    }

    return {
      match: reasons.length <= 0,
      reasons: reasons
    };
  }

  function flashIdeImportStatus(targetKind, message, background, color, durationMs) {
    flashIdeSyncButtonForTarget(targetKind, message, background, color, durationMs);
  }

  function emitIdeImportResult(payload) {
    sendPacket("ide_import_result", payload);
  }

  function buildLegacyIdeImportPayload(newCode) {
    return {
      requestId: "legacy-" + Date.now(),
      targetKind: "lua_editor",
      code: String(newCode || ""),
      codeHash32: hashStringFNV1a(String(newCode || "")),
      contextKey: state.lastIdeSyncContextKey || "",
      reference: cloneIdeSyncObject(state.lastIdeSyncReference || getLuaIdeSyncReference())
    };
  }

  function applyIdeImport(importPayload) {
    var payload = importPayload;
    if (typeof payload === "string") {
      payload = buildLegacyIdeImportPayload(payload);
    }
    if (!payload || typeof payload !== "object") {
      emitIdeImportResult({
        requestId: "invalid-" + Date.now(),
        targetKind: "lua_editor",
        success: false,
        retryable: true,
        status: "invalid_import_payload"
      });
      return {
        success: false,
        retryable: true,
        status: "invalid_import_payload"
      };
    }

    var requestId = String(payload.requestId || ("ide-import-" + Date.now()));
    var targetKind = normalizeIdeImportTargetKind(payload.targetKind);
    var code = String(payload.code || "");
    var expectedContextKey = String(payload.contextKey || "");
    var expectedReference = payload.reference && typeof payload.reference === "object" ? payload.reference : null;
    var expectedCodeHash32 = String(payload.codeHash32 || hashStringFNV1a(code));
    var baseCodeHash32 = payload.baseCodeHash32 ? String(payload.baseCodeHash32) : "";
    var snapshot = getCurrentIdeImportSnapshot(targetKind);
    var currentReference = snapshot.reference || null;
    var currentContextKey = snapshot.contextKey || "";
    var currentCodeHash32 = snapshot.codeHash32 ? String(snapshot.codeHash32) : "";

    if (!snapshot.ready) {
      emitIdeImportResult({
        requestId: requestId,
        targetKind: targetKind,
        success: false,
        retryable: true,
        status: snapshot.status || "editor_not_ready",
        expectedReference: expectedReference,
        currentReference: currentReference,
        expectedContextKey: expectedContextKey || null,
        currentContextKey: currentContextKey || null
      });
      return {
        success: false,
        retryable: true,
        status: snapshot.status || "editor_not_ready"
      };
    }

    var referenceMatch = compareIdeImportReference(expectedReference, currentReference, targetKind);
    if (!referenceMatch.match) {
      flashIdeImportStatus(targetKind, "Warte auf Element", "#805019", "#ffffff", 1400);
      emitIdeImportResult({
        requestId: requestId,
        targetKind: targetKind,
        success: false,
        retryable: true,
        status: "target_mismatch",
        mismatchReasons: referenceMatch.reasons,
        expectedReference: expectedReference,
        currentReference: currentReference,
        expectedContextKey: expectedContextKey || null,
        currentContextKey: currentContextKey || null,
        baseCodeHash32: baseCodeHash32 || null,
        currentCodeHash32: currentCodeHash32 || null
      });
      return {
        success: false,
        retryable: true,
        status: "target_mismatch"
      };
    }

    if (expectedContextKey && currentContextKey && expectedContextKey !== currentContextKey) {
      flashIdeImportStatus(targetKind, "Warte auf Filter", "#8a2424", "#ffffff", 1400);
      emitIdeImportResult({
        requestId: requestId,
        targetKind: targetKind,
        success: false,
        retryable: true,
        status: "context_mismatch",
        expectedReference: expectedReference,
        currentReference: currentReference,
        expectedContextKey: expectedContextKey,
        currentContextKey: currentContextKey,
        baseCodeHash32: baseCodeHash32 || null,
        currentCodeHash32: currentCodeHash32 || null
      });
      return {
        success: false,
        retryable: true,
        status: "context_mismatch"
      };
    }

    var staleBase = !!(baseCodeHash32 && currentCodeHash32 && baseCodeHash32 !== currentCodeHash32);

    try {
      if (targetKind === "screen_editor") {
        if (typeof setScreenEditorCode !== "function") {
          throw new Error("screen_editor_sync_unavailable");
        }
        setScreenEditorCode(code);
      } else {
        var codeMirror = snapshot.codeMirror || getLuaCodeMirror();
        if (!codeMirror || typeof codeMirror.setValue !== "function") {
          throw new Error("lua_editor_sync_unavailable");
        }
        codeMirror.setValue(code);
        normalizeLuaEditorTrailingNewline(codeMirror);
      }
    } catch (error) {
      var applyError = error && error.message ? error.message : String(error || "ide_import_apply_failed");
      emitIdeImportResult({
        requestId: requestId,
        targetKind: targetKind,
        success: false,
        retryable: true,
        status: applyError,
        staleBase: staleBase,
        expectedReference: expectedReference,
        currentReference: currentReference,
        expectedContextKey: expectedContextKey || null,
        currentContextKey: currentContextKey || null,
        baseCodeHash32: baseCodeHash32 || null,
        currentCodeHash32: currentCodeHash32 || null
      });
      return {
        success: false,
        retryable: true,
        status: applyError
      };
    }

    var appliedSnapshot = getCurrentIdeImportSnapshot(targetKind);
    var appliedCodeHash32 = appliedSnapshot.codeHash32 ? String(appliedSnapshot.codeHash32) : "";
    var appliedSuccess = !!(appliedSnapshot.ready && appliedCodeHash32 && appliedCodeHash32 === expectedCodeHash32);

    if (!appliedSuccess) {
      emitIdeImportResult({
        requestId: requestId,
        targetKind: targetKind,
        success: false,
        retryable: true,
        status: "apply_verify_failed",
        staleBase: staleBase,
        expectedReference: expectedReference,
        currentReference: appliedSnapshot.reference || currentReference,
        expectedContextKey: expectedContextKey || null,
        currentContextKey: appliedSnapshot.contextKey || currentContextKey || null,
        baseCodeHash32: baseCodeHash32 || null,
        currentCodeHash32: currentCodeHash32 || null,
        appliedCodeHash32: appliedCodeHash32 || null
      });
      return {
        success: false,
        retryable: true,
        status: "apply_verify_failed"
      };
    }

    if (targetKind === "lua_editor") {
      state.lastIdeSyncContextKey = appliedSnapshot.contextKey || expectedContextKey || "";
      state.lastIdeSyncReference = cloneIdeSyncObject(appliedSnapshot.reference || expectedReference);
    }

    flashIdeImportStatus(
      targetKind,
      staleBase ? "Sync alt" : "Sync ok",
      staleBase ? "#7a6518" : "#2a6b36",
      "#ffffff",
      staleBase ? 2200 : 1500);

    emitIdeImportResult({
      requestId: requestId,
      targetKind: targetKind,
      success: true,
      retryable: false,
      status: staleBase ? "applied_stale_base" : "applied",
      staleBase: staleBase,
      expectedReference: expectedReference,
      currentReference: appliedSnapshot.reference || currentReference,
      expectedContextKey: expectedContextKey || null,
      currentContextKey: appliedSnapshot.contextKey || currentContextKey || null,
      baseCodeHash32: baseCodeHash32 || null,
      currentCodeHash32: currentCodeHash32 || null,
      appliedCodeHash32: appliedCodeHash32 || null,
      codeCharLength: code.length
    });

    return {
      success: true,
      retryable: false,
      status: staleBase ? "applied_stale_base" : "applied",
      staleBase: staleBase
    };
  }

  function applyIdeCode(newCode) {
    var snapshot = getCurrentIdeImportSnapshot("lua_editor");
    if (!snapshot.ready) {
      return;
    }

    var currentContextKey = snapshot.contextKey || "";
    if (state.lastIdeSyncContextKey && currentContextKey !== state.lastIdeSyncContextKey) {
      safeLog("IDE sync blocked: Context changed. Expected: " + state.lastIdeSyncContextKey + ", Got: " + currentContextKey);
      flashIdeSyncButton("Warte auf Filter", "#8a2424", "#ffffff", 3000);
      return;
    }

    var codeMirror = snapshot.codeMirror || getLuaCodeMirror();
    if (!codeMirror || typeof codeMirror.setValue !== "function") {
      return;
    }

    codeMirror.setValue(newCode);
    normalizeLuaEditorTrailingNewline(codeMirror);
    state.lastIdeSyncContextKey = currentContextKey;
    state.lastIdeSyncReference = cloneIdeSyncObject(snapshot.reference || getLuaIdeSyncReference());
    flashIdeSyncButton("Sync ok", "#2a6b36", "#ffffff", 1500);
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
      + "--lua-probe-accent:rgba(166,226,46,0.92);"
      + "--lua-probe-header-bg:rgba(39,40,34,0.97);"
      + "--lua-probe-caret-line-bg:rgba(166,226,46,0.18);"
      + "--lua-probe-accent-solid:#a6e22e;"
      + "--lua-probe-on-accent:#272822;"
      + "--lua-probe-surface-main:#272822;"
      + "--lua-probe-surface-elevated:#3e3d32;"
      + "--lua-probe-surface-row:#49483e;"
      + "--lua-probe-surface-deep:#1e1f1c;"
      + "--lua-probe-surface-row-alt:#423f36;"
      + "--lua-probe-border-strong:#75715e;"
      + "--lua-probe-border-hover:#66d9ef;"
      + "--lua-probe-shadow:rgba(0,0,0,0.5);"
      + "--lua-probe-text-muted:#cfcfc2;"
      + "--lua-probe-text-dim:#90908a;"
      + "--lua-probe-cm-text:#f8f8f2;"
      + "--lua-probe-cm-comment:#75715e;"
      + "--lua-probe-cm-linenumber:#90908a;"
      + "--lua-probe-cm-keyword:#f92672;"
      + "--lua-probe-cm-atom:#ae81ff;"
      + "--lua-probe-cm-string:#e6db74;"
      + "--lua-probe-cm-number:#ae81ff;"
      + "--lua-probe-cm-def:#a6e22e;"
      + "--lua-probe-cm-builtin:#66d9ef;"
      + "--lua-probe-cm-variable:#f8f8f2;"
      + "--lua-probe-cm-variable-2:#fd971f;"
      + "--lua-probe-cm-operator:#f8f8f2;"
      + "--lua-probe-cm-property:#a6e22e;"
      + "--lua-probe-gutter-border:#49483e;"
      + "--lua-probe-btn-apply-bg:linear-gradient(180deg,#646e52 0%,#4a5540 45%,#343c30 100%);"
      + "--lua-probe-btn-apply-border:rgba(166,226,46,0.78);"
      + "--lua-probe-btn-apply-color:#f8f8f2;"
      + "--lua-probe-btn-apply-hover-bg:linear-gradient(180deg,#727c60 0%,#586348 45%,#3e4836 100%);"
      + "--lua-probe-btn-apply-active-bg:linear-gradient(180deg,#525a48 0%,#3a4236 45%,#2b3028 100%);"
      + "--lua-probe-btn-cancel-bg:linear-gradient(180deg,#525046 0%,#403e38 45%,#302e2a 100%);"
      + "--lua-probe-btn-cancel-border:rgba(183,174,140,0.55);"
      + "--lua-probe-btn-cancel-color:#cfcfc2;"
      + "--lua-probe-btn-cancel-hover-bg:linear-gradient(180deg,#5e5a50 0%,#4a4640 45%,#38342f 100%);"
      + "--lua-probe-btn-cancel-active-bg:linear-gradient(180deg,#45423a 0%,#35322d 45%,#282622 100%);"
      + "--lua-probe-btn-disabled-bg:linear-gradient(180deg,rgba(28,40,48,0.85) 0%,rgba(18,28,34,0.85) 100%);"
      + "--lua-probe-btn-disabled-border:rgba(84,122,135,0.45);"
      + "--lua-probe-btn-disabled-color:rgba(132,160,170,0.72);}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper{"
      + "background-color:var(--lua-probe-surface-main) !important;"
      + "filter:drop-shadow(var(--lua-probe-shadow) 0 0 5px) !important;"
      + "box-shadow:0 0 0 1px var(--lua-probe-accent), 0 0 22px var(--lua-probe-accent) !important;"
      + "border-color:var(--lua-probe-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .header_col{"
      + "background-color:var(--lua-probe-surface-elevated) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .header_col *{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .header_col .header_col_description{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .editor_header .header_bar .title{"
      + "background:transparent !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot{"
      + "background-color:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-muted) !important;"
      + "border:1px solid var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:not(.disabled):not(.selected):not(.active):not(.active_tab):hover{"
      + "background-color:var(--lua-probe-surface-row) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:not(.disabled):hover{"
      + "border-color:var(--lua-probe-border-hover) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.selected{"
      + "background-color:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.selected::after{"
      + "background-color:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.active,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.active_tab{"
      + "background-color:var(--lua-probe-accent-solid) !important;color:var(--lua-probe-on-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.active .icon,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.active_tab .icon{"
      + "fill:var(--lua-probe-on-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.disabled{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.disabled input{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot input{"
      + "background-color:transparent !important;box-shadow:none !important;"
      + "border-color:var(--lua-probe-border-strong) !important;"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot input::-webkit-input-placeholder{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot input[type=\"text\"]:focus{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:nth-child(2)::before,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:nth-child(5)::before{"
      + "background-color:var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .filters_window_wrapper{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .filters_window_wrapper .lua_editor_filters_wrapper{"
      + "background-color:var(--lua-probe-surface-elevated) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter{"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "border:1px solid var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter *{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter:hover{"
      + "border-color:var(--lua-probe-border-hover) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .actionName{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_header .delete_btn{"
      + "fill:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_header .delete_btn:hover{"
      + "fill:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .action_list_button_wrapper .ddContainer svg{"
      + "fill:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionInputs input{"
      + "background-color:var(--lua-probe-surface-main) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionInputs input[type=\"text\"]:focus{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionBindList{"
      + "background-color:var(--lua-probe-surface-row) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionBindList li{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;"
      + "border-color:var(--lua-probe-text-muted) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionBindList li:hover{"
      + "background-color:var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter.selected .filter_wrapper::after{"
      + "background-color:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .lua_empty_container{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .actions_container .actions_list_wrapper .action_element{"
      + "background-color:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .action_list_button_wrapper .ddContainer .actionsList li{"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "color:var(--lua-probe-text-muted) !important;border-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .action_list_button_wrapper .ddContainer .actionsList li:hover{"
      + "background-color:var(--lua-probe-text-muted) !important;color:var(--lua-probe-surface-main) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;"
      + "border:1px solid var(--lua-probe-btn-apply-border) !important;"
      + "color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3) !important;"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;"
      + "}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:active:not(.disabled){"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-apply-active-bg) !important;"
      + "}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:hover:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:active:not(.disabled) svg,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:active:not(.disabled):hover svg{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button.disabled{"
      + "border-color:var(--lua-probe-btn-disabled-border) !important;color:var(--lua-probe-btn-disabled-color) !important;"
      + "background:var(--lua-probe-btn-disabled-bg) !important;"
      + "background-image:none !important;"
      + "text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button.disabled .icon{"
      + "fill:var(--lua-probe-btn-disabled-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button.active{"
      + "color:var(--lua-probe-btn-apply-color) !important;border-color:var(--lua-probe-btn-apply-border) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;"
      + "}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror{"
      + "background-color:var(--lua-probe-surface-deep) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror pre,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror pre{"
      + "color:var(--lua-probe-cm-text) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror .CodeMirror-gutters{"
      + "background-color:var(--lua-probe-surface-deep) !important;"
      + "border-right-color:var(--lua-probe-gutter-border) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-keyword,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-keyword{"
      + "color:var(--lua-probe-cm-keyword) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-atom,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-atom{"
      + "color:var(--lua-probe-cm-atom) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-string,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-string{"
      + "color:var(--lua-probe-cm-string) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-number,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-number{"
      + "color:var(--lua-probe-cm-number) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-def,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-def{"
      + "color:var(--lua-probe-cm-def) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-builtin,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-builtin{"
      + "color:var(--lua-probe-cm-builtin) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-variable,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-variable{"
      + "color:var(--lua-probe-cm-variable) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-variable-2,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-variable-2{"
      + "color:var(--lua-probe-cm-variable-2) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-operator,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-operator{"
      + "color:var(--lua-probe-cm-operator) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-property,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-property{"
      + "color:var(--lua-probe-cm-property) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-comment{"
      + "color:var(--lua-probe-cm-comment) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror .CodeMirror-linenumber{"
      + "color:var(--lua-probe-cm-linenumber) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .codeMirror{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .font_size_wrapper .lua_change_font_size,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .lua_change_font_size{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;"
      + "border-color:var(--lua-probe-text-muted) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .font_size_wrapper .lua_change_font_size:hover:not(.disabled),"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .lua_change_font_size:hover:not(.disabled){"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .font_size_wrapper .lua_change_font_size.active,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .lua_change_font_size.active{"
      + "background-color:var(--lua-probe-accent-solid) !important;color:var(--lua-probe-on-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .checkbox{"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "outline-color:var(--lua-probe-border-hover) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .checkbox:checked{"
      + "background-color:var(--lua-probe-accent-solid) !important;"
      + "outline-color:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list_header{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "border-bottom-color:var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list_header span{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list{"
      + "background-color:var(--lua-probe-surface-elevated) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list .error_li{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "border-top-color:var(--lua-probe-surface-main) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list .error_li:nth-child(odd){"
      + "background-color:var(--lua-probe-surface-row-alt) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list .error_li:hover{"
      + "background-color:var(--lua-probe-surface-row) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .lua_error_header_wrapper .value{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .lua_error_header_wrapper .value .lua_error_ctn_value{"
      + "color:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .lua_error_header_wrapper{"
      + "display:flex;align-items:center;gap:10px;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .lua_error_header_wrapper .lua-probe-buffer-size{"
      + "display:flex;flex:1 1 auto;justify-content:center;align-items:center;text-align:center;"
      + "margin-left:16px;color:#ffffff !important;white-space:nowrap;"
      + "font-family:Play,sans-serif;font-size:13.59814835px;font-weight:600;line-height:16px;text-transform:uppercase;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .reduce_size{"
      + "fill:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .editor_header .header_container{"
      + "position:relative;"
      + "background:var(--lua-probe-header-bg) !important;"
      + "border-bottom:1px solid var(--lua-probe-accent) !important;}"
      + "#dpu_editor #ModUiExtractor-lua-theme-dots{"
      + "position:absolute;left:12px;top:50%;transform:translateY(-50%);"
      + "display:flex;gap:8px;align-items:center;z-index:11;overflow:visible;}"
      + "#dpu_editor #ModUiExtractor-lua-theme-dots .lua-theme-dot{"
      + "width:12px;height:12px;border-radius:999px;border:1px solid rgba(255,255,255,0.6);"
      + "padding:0;cursor:pointer;opacity:0.88;}"
      + "#dpu_editor #ModUiExtractor-lua-theme-dots .lua-theme-dot[data-active=\"1\"]{"
      + "transform:scale(1.1);opacity:1;box-shadow:0 0 0 1px rgba(0,0,0,0.55),0 0 8px rgba(255,255,255,0.35);}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-trigger,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-trigger{"
      + "width:18px;height:18px;padding:0;border-radius:6px;cursor:pointer;"
      + "display:flex;align-items:center;justify-content:center;"
      + "margin-left:3px;"
      + "border:1px solid rgba(255,255,255,0.22);background:rgba(0,0,0,0.28);"
      + "color:var(--lua-probe-text-muted) !important;font-family:Play,sans-serif;font-size:11px;font-weight:900;line-height:1;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-trigger:hover,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-trigger:hover{"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-text-muted) !important;background:rgba(0,0,0,0.42);}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-panel,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-panel{"
      + "display:none;position:absolute;left:0;top:calc(100% + 8px);z-index:40;width:420px;max-height:52vh;overflow:auto;"
      + "padding:10px;border-radius:10px;background:var(--lua-probe-surface-elevated) !important;"
      + "border:1px solid var(--lua-probe-accent) !important;box-shadow:0 10px 26px rgba(0,0,0,0.42);}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-panel[data-open=\"1\"],"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-panel[data-open=\"1\"]{display:block;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-status,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-status{"
      + "color:var(--lua-probe-text-dim) !important;font-family:Play,sans-serif;font-size:12px;font-weight:700;margin-bottom:8px;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-list,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-right:-6px;margin-bottom:-8px;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-item,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-item{"
      + "display:flex;align-items:center;width:calc(100% - 6px);min-height:30px;padding:7px 10px;border-radius:8px;cursor:pointer;"
      + "margin:0 6px 8px 0;"
      + "border:1px solid transparent;background:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-muted) !important;"
      + "text-align:left;font-family:Play,sans-serif;font-size:13px;font-weight:700;outline:none;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-item:hover,"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-item:focus,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-item:hover{"
      + "border-color:var(--lua-probe-border-hover) !important;background:var(--lua-probe-surface-row-alt) !important;color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-item:focus{"
      + "border-color:var(--lua-probe-border-hover) !important;background:var(--lua-probe-surface-row-alt) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-item[data-active=\"1\"],"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-item[data-active=\"1\"]{"
      + "border-color:var(--lua-probe-accent) !important;box-shadow:0 0 0 1px rgba(0,0,0,0.25) inset;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-swatch,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-swatch{"
      + "width:12px;height:12px;border-radius:999px;flex:0 0 12px;border:1px solid rgba(255,255,255,0.55);margin-right:8px;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-label,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-label{"
      + "display:block;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase;}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle,#dpu_editor #ModUiExtractor-lua-ide-sync{"
      + "font-family:Play,sans-serif;font-size:1.11111111vh;font-weight:900;text-transform:uppercase;"
      + "display:flex;justify-content:center;align-items:center;text-align:center;overflow:hidden;"
      + "height:2.31481481vh;min-height:2.31481481vh;max-height:2.31481481vh;padding:0 1.11111111vh;"
      + "margin-left:0.37037037vh;cursor:pointer;line-height:2.12962963vh;"
      + "border-radius:0.55555556vh;"
      + "border:1px solid var(--lua-probe-btn-cancel-border);"
      + "background:var(--lua-probe-btn-cancel-bg);"
      + "color:var(--lua-probe-btn-cancel-color);"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -2px 0 rgba(0,0,0,0.46),0 1px 0 rgba(0,0,0,0.2),0 3px 10px rgba(0,0,0,0.28);"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle{"
      + "min-width:9.25925926vh;}"
      + "#dpu_editor #ModUiExtractor-lua-ide-sync{"
      + "min-width:8.7962963vh;color:var(--lua-probe-btn-apply-color);border-color:var(--lua-probe-btn-apply-border);"
      + "background:var(--lua-probe-btn-apply-bg);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle[data-on=\"1\"]{"
      + "border-color:var(--lua-probe-btn-apply-border);color:var(--lua-probe-btn-apply-color);"
      + "background:var(--lua-probe-btn-apply-bg);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:hover,#dpu_editor #ModUiExtractor-lua-ide-sync:hover{"
      + "border-color:var(--lua-probe-border-hover);color:var(--lua-probe-btn-cancel-color);"
      + "background:var(--lua-probe-btn-cancel-hover-bg);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:active,#dpu_editor #ModUiExtractor-lua-ide-sync:active{"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-cancel-active-bg);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:focus,#dpu_editor #ModUiExtractor-lua-ide-sync:focus{"
      + "outline:none;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"]{"
      + "background-color:var(--lua-probe-surface-main) !important;"
      + "border-color:var(--lua-probe-accent) !important;"
      + "filter:drop-shadow(var(--lua-probe-shadow) 0 0 5px) !important;"
      + "box-shadow:0 0 0 1px var(--lua-probe-accent),0 0 22px var(--lua-probe-accent) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .header_block{"
      + "position:relative;background:var(--lua-probe-header-bg) !important;"
      + "border-bottom:1px solid var(--lua-probe-accent) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .header_block .panel_title{"
      + "color:var(--lua-probe-text-muted) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42) !important;"
      + "padding-left:4.25925926vh !important;"
      + "padding-right:4.25925926vh !important;"
      + "box-sizing:border-box;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content{"
      + "background:var(--lua-probe-surface-main) !important;color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line{"
      + "background:var(--lua-probe-surface-elevated) !important;"
      + "border:1px solid var(--lua-probe-border-strong) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .code_editor_header{"
      + "background:transparent !important;border-bottom-color:var(--lua-probe-border-strong) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .left_wrapper,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .right_wrapper,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .mode_switch_wrapper{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .sub_title_wrapper .sub_title{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .sub_title_wrapper .icon{"
      + "fill:var(--lua-probe-accent-solid) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .wrap_line_wrapper,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .mode_switch_wrapper{"
      + "background:var(--lua-probe-surface-row) !important;"
      + "border:1px solid var(--lua-probe-border-strong) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),0 1px 0 rgba(0,0,0,0.16) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .wrap_line_wrapper:hover,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper:hover,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .mode_switch_wrapper:hover{"
      + "border-color:var(--lua-probe-border-hover) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .wrap_line_wrapper .label,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper .label,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .mode_switch_wrapper .label{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper .font_button{"
      + "background:var(--lua-probe-surface-row-alt) !important;"
      + "border-color:var(--lua-probe-border-strong) !important;"
      + "color:var(--lua-probe-text-muted) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.35) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper .font_button:hover{"
      + "background:var(--lua-probe-surface-row) !important;"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper .font_button:active{"
      + "background:var(--lua-probe-surface-deep) !important;}"
      + ".screen_content_editor_panel #ModUiExtractor-screen-theme-dots{"
      + "position:absolute;left:12px;top:50%;transform:translateY(-50%);"
      + "display:flex;gap:8px;align-items:center;z-index:11;overflow:visible;}"
      + ".screen_content_editor_panel #ModUiExtractor-screen-theme-dots .lua-theme-dot{"
      + "width:12px;height:12px;border-radius:999px;border:1px solid rgba(255,255,255,0.6);"
      + "padding:0;cursor:pointer;opacity:0.88;}"
      + ".screen_content_editor_panel #ModUiExtractor-screen-theme-dots .lua-theme-dot[data-active=\"1\"]{"
      + "transform:scale(1.1);opacity:1;box-shadow:0 0 0 1px rgba(0,0,0,0.55),0 0 8px rgba(255,255,255,0.35);}"
      + ".screen_content_editor_panel #ModUiExtractor-screen-ide-sync{"
      + "font-family:Play,sans-serif;font-size:1.11111111vh;font-weight:900;text-transform:uppercase;"
      + "display:flex;justify-content:center;align-items:center;text-align:center;overflow:hidden;"
      + "height:2.31481481vh;min-height:2.31481481vh;max-height:2.31481481vh;padding:0 1.11111111vh;"
      + "margin-left:0.37037037vh;cursor:pointer;line-height:2.12962963vh;border-radius:0.55555556vh;"
      + "border:1px solid var(--lua-probe-btn-apply-border);background:var(--lua-probe-btn-apply-bg);"
      + "color:var(--lua-probe-btn-apply-color);text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3);"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;"
      + "min-width:8.7962963vh;}"
      + ".screen_content_editor_panel #ModUiExtractor-screen-ide-sync:hover{"
      + "border-color:var(--lua-probe-border-hover);color:var(--lua-probe-btn-apply-color);"
      + "background:var(--lua-probe-btn-apply-hover-bg);}"
      + ".screen_content_editor_panel #ModUiExtractor-screen-ide-sync:active{"
      + "transform:translateY(1px);background:var(--lua-probe-btn-apply-active-bg);}"
      + ".screen_content_editor_panel #ModUiExtractor-screen-ide-sync:focus{"
      + "outline:none;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror{"
      + "background-color:var(--lua-probe-surface-deep) !important;color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror .CodeMirror-gutters{"
      + "background-color:var(--lua-probe-surface-deep) !important;"
      + "border-right-color:var(--lua-probe-gutter-border) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror .CodeMirror-linenumber{"
      + "color:var(--lua-probe-cm-linenumber) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line{"
      + "background:var(--lua-probe-surface-elevated) !important;"
      + "border-top:1px solid var(--lua-probe-border-strong) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block{"
      + "background:var(--lua-probe-surface-elevated) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block .error_header{"
      + "background:var(--lua-probe-surface-elevated) !important;"
      + "border-bottom:1px solid var(--lua-probe-border-strong) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block .error_area{"
      + "background:var(--lua-probe-surface-main) !important;"
      + "border-top:1px solid var(--lua-probe-gutter-border) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block .error_header .left_wrapper{"
      + "display:flex;align-items:center;gap:10px;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block .error_header .left_wrapper .lua-probe-screen-buffer-size{"
      + "display:flex;flex:1 1 auto;justify-content:center;align-items:center;text-align:center;"
      + "margin-left:16px;color:var(--lua-probe-text-dim) !important;white-space:nowrap;"
      + "font-family:Play,sans-serif;font-size:19.56111145px;font-weight:600;line-height:23px;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .editor_error_ctn{"
      + "background:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .editor_error_ctn .editor_error_ctn_value{"
      + "color:var(--lua-probe-accent-solid) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .wrap_line_wrapper .checkbox,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .enable_logs_wrapper .checkbox{"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "outline-color:var(--lua-probe-border-hover) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .wrap_line_wrapper .checkbox:checked,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .enable_logs_wrapper .checkbox:checked{"
      + "background-color:var(--lua-probe-accent-solid) !important;"
      + "outline-color:var(--lua-probe-accent-solid) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;"
      + "border-color:var(--lua-probe-border-strong) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch .slider{"
      + "background:var(--lua-probe-btn-cancel-bg) !important;"
      + "border-color:var(--lua-probe-btn-apply-border) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 1px 4px rgba(0,0,0,0.28) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch .switch_label{"
      + "color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch .unchecked_option{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch input:checked ~ .checked_option,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch input:not(:checked) ~ .unchecked_option{"
      + "color:var(--lua-probe-on-accent) !important;font-weight:700 !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .character_count{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button::before,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button::after{"
      + "display:none !important;content:none !important;animation:none !important;opacity:0 !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;border:1px solid var(--lua-probe-btn-apply-border) !important;"
      + "color:var(--lua-probe-btn-apply-color) !important;background:var(--lua-probe-btn-apply-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3) !important;"
      + "transition:background 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .cancel_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;border:1px solid var(--lua-probe-btn-cancel-border) !important;"
      + "color:var(--lua-probe-btn-cancel-color) !important;background:var(--lua-probe-btn-cancel-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -2px 0 rgba(0,0,0,0.46),0 1px 0 rgba(0,0,0,0.2),0 3px 10px rgba(0,0,0,0.28) !important;"
      + "transition:background 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -2px 0 rgba(0,0,0,0.38),0 2px 10px rgba(0,0,0,0.34) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .cancel_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-cancel-color) !important;"
      + "background:var(--lua-probe-btn-cancel-hover-bg) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.18),inset 0 -2px 0 rgba(0,0,0,0.4),0 2px 10px rgba(0,0,0,0.3) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button:active:not(.disabled){"
      + "transform:translateY(1px);background:var(--lua-probe-btn-apply-active-bg) !important;"
      + "box-shadow:inset 0 2px 0 rgba(0,0,0,0.38),inset 0 1px 0 rgba(255,255,255,0.08),0 1px 3px rgba(0,0,0,0.28) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .cancel_button:active:not(.disabled){"
      + "transform:translateY(1px);background:var(--lua-probe-btn-cancel-active-bg) !important;"
      + "box-shadow:inset 0 2px 0 rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06),0 1px 3px rgba(0,0,0,0.26) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button.disabled,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .cancel_button.disabled{"
      + "border-color:var(--lua-probe-btn-disabled-border) !important;color:var(--lua-probe-btn-disabled-color) !important;"
      + "background:var(--lua-probe-btn-disabled-bg) !important;"
      + "background-image:none !important;text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
      + ".main_chat #ModUiExtractor-chat-copy-plain{"
      + "position:absolute;top:2.87037037vh;right:2.59259259vh;z-index:30;"
      + "font-family:Play,sans-serif;font-size:0.92592593vh;font-weight:900;text-transform:uppercase;"
      + "display:flex;justify-content:center;align-items:center;text-align:center;overflow:hidden;"
      + "min-height:2.03703704vh;padding:0 0.92592593vh;cursor:pointer;line-height:1.85185185vh;"
      + "border-radius:0.46296296vh;border:1px solid var(--lua-probe-btn-cancel-border);"
      + "background:var(--lua-probe-btn-cancel-bg);"
      + "color:var(--lua-probe-btn-cancel-color);text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -2px 0 rgba(0,0,0,0.46),0 1px 0 rgba(0,0,0,0.2),0 3px 10px rgba(0,0,0,0.28);"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + ".main_chat #ModUiExtractor-chat-copy-plain:hover:not([data-disabled=\"1\"]){"
      + "border-color:var(--lua-probe-border-hover);color:var(--lua-probe-btn-cancel-color);"
      + "background:var(--lua-probe-btn-cancel-hover-bg);}"
      + ".main_chat #ModUiExtractor-chat-copy-plain:active:not([data-disabled=\"1\"]){"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-cancel-active-bg);}"
      + ".main_chat #ModUiExtractor-chat-copy-plain:focus{"
      + "outline:none;}"
      + ".main_chat #ModUiExtractor-chat-copy-plain[data-disabled=\"1\"],"
      + ".main_chat #ModUiExtractor-chat-copy-plain:disabled{"
      + "cursor:default;border-color:var(--lua-probe-btn-disabled-border);color:var(--lua-probe-btn-disabled-color);"
      + "background:var(--lua-probe-btn-disabled-bg);"
      + "text-shadow:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5);}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button::before,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button::after{"
      + "display:none !important;content:none !important;animation:none !important;opacity:0 !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;"
      + "border:1px solid var(--lua-probe-btn-apply-border) !important;"
      + "color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3) !important;"
      + "transition:background 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;"
      + "border:1px solid var(--lua-probe-btn-cancel-border) !important;"
      + "color:var(--lua-probe-btn-cancel-color) !important;"
      + "background:var(--lua-probe-btn-cancel-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -2px 0 rgba(0,0,0,0.46),0 1px 0 rgba(0,0,0,0.2),0 3px 10px rgba(0,0,0,0.28) !important;"
      + "transition:background 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -2px 0 rgba(0,0,0,0.38),0 2px 10px rgba(0,0,0,0.34) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-cancel-color) !important;"
      + "background:var(--lua-probe-btn-cancel-hover-bg) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.18),inset 0 -2px 0 rgba(0,0,0,0.4),0 2px 10px rgba(0,0,0,0.3) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:active:not(.disabled){"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-apply-active-bg) !important;"
      + "box-shadow:inset 0 2px 0 rgba(0,0,0,0.38),inset 0 1px 0 rgba(255,255,255,0.08),0 1px 3px rgba(0,0,0,0.28) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:active:not(.disabled){"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-cancel-active-bg) !important;"
      + "box-shadow:inset 0 2px 0 rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06),0 1px 3px rgba(0,0,0,0.26) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-cancel-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:hover:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:hover:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-cancel-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button.disabled,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button.disabled{"
      + "border-color:var(--lua-probe-btn-disabled-border) !important;color:var(--lua-probe-btn-disabled-color) !important;"
      + "background:var(--lua-probe-btn-disabled-bg) !important;"
      + "background-image:none !important;"
      + "text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button[data-lua-probe-force-disabled=\"1\"]{"
      + "pointer-events:none !important;cursor:default !important;"
      + "border-color:var(--lua-probe-btn-disabled-border) !important;color:var(--lua-probe-btn-disabled-color) !important;"
      + "background:var(--lua-probe-btn-disabled-bg) !important;"
      + "background-image:none !important;text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button[data-lua-probe-force-disabled=\"1\"] .icon{"
      + "fill:var(--lua-probe-btn-disabled-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button.active{"
      + "color:var(--lua-probe-btn-apply-color) !important;border-color:var(--lua-probe-btn-apply-border) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button.active{"
      + "color:var(--lua-probe-btn-cancel-color) !important;border-color:var(--lua-probe-btn-cancel-border) !important;"
      + "background:var(--lua-probe-btn-cancel-hover-bg) !important;}"
      + "#dpu_editor .CodeMirror .lua-probe-caret-line{"
      + "background:var(--lua-probe-caret-line-bg) !important;}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"]{"
      + "border-color:var(--lua-probe-accent) !important;"
      + "box-shadow:inset 0 0 0 1px rgba(0,0,0,0.38);}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"]::after{"
      + "content:\"\";position:absolute;top:0;left:-7px;width:4px;height:100%;"
      + "background-color:var(--lua-probe-accent);box-shadow:0 1px 2px 1px rgba(0,0,0,0.72);}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"] .actionName{"
      + "color:var(--lua-probe-text-muted) !important;}"
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

  function getFilterArgumentDisplayValues(filterNode) {
    var args = [];
    if (!filterNode || !filterNode.querySelectorAll) {
      return args;
    }

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
        var displayValue = String(rawValue || "").replace(/\s+/g, " ").trim();
        if (displayValue) {
          args.push(displayValue);
        }
      }
    } catch (_ignoreDisplayInputs) {}

    return args;
  }

  function getFilterDisplaySignature(filterNode) {
    if (!filterNode) {
      return "";
    }

    var actionName = String(getFilterActionText(filterNode) || "").replace(/\s+/g, " ").trim();
    if (!actionName) {
      return "";
    }

    var args = getFilterArgumentDisplayValues(filterNode);
    return actionName + "(" + args.join(", ") + ")";
  }

  function getFilterSignature(filterNode) {
    if (!filterNode) {
      return "";
    }

    var actionName = normalizeProbeText(getFilterActionText(filterNode));
    var displayArgs = getFilterArgumentDisplayValues(filterNode);
    var args = [];
    for (var i = 0; i < displayArgs.length; i += 1) {
      var normalized = normalizeProbeText(displayArgs[i]);
      if (normalized) {
        args.push(normalized);
      }
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
    syncLuaApplyButtonState();
  }

  function getLuaApplyButtonNode() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return null;
    }
    try {
      return root.querySelector(".btn_bar .lua_editor_apply_button");
    } catch (_ignoreApplyButton) {}
    return null;
  }

  function getResolvedActiveFilterNode() {
    var selectedNode = findDomSelectedFilterNode();
    if (selectedNode) {
      return selectedNode;
    }
    return findFilterNodeByHints(getManagerFilterHints());
  }

  function getResolvedActiveFilterDisplaySignature() {
    var filterNode = getResolvedActiveFilterNode();
    if (!filterNode) {
      return "";
    }
    return getFilterDisplaySignature(filterNode);
  }

  function syncLuaApplyButtonState() {
    var button = getLuaApplyButtonNode();
    if (!button) {
      return;
    }

    if (!button.__luaProbeForceDisableBound) {
      button.__luaProbeForceDisableBound = true;
      button.addEventListener("click", function (event) {
        if (button.getAttribute("data-lua-probe-force-disabled") !== "1") {
          return;
        }
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (event && typeof event.stopPropagation === "function") {
          event.stopPropagation();
        }
        if (event && typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
      }, true);
    }

    var hasFilters = getVisibleFilterNodes().length > 0;
    var activeFilterNode = getResolvedActiveFilterNode();
    var shouldDisable = !hasFilters || !activeFilterNode;
    button.setAttribute("data-lua-probe-force-disabled", shouldDisable ? "1" : "0");
    button.setAttribute("aria-disabled", shouldDisable ? "true" : "false");
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
    syncLuaApplyButtonState();
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
      syncLuaApplyButtonState();
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
    syncLuaApplyButtonState();
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

  function normalizeLegacyThemeName(themeName) {
    var map = {
      green: "monokai",
      yellow: "github-dark",
      red: "gruvbox-dark"
    };
    var key = String(themeName || "").toLowerCase();
    return map[key] || themeName;
  }

  function flushThemeCatalogCallbacks(payload) {
    var callbacks = state.themeCatalogCallbacks || [];
    state.themeCatalogCallbacks = [];
    for (var i = 0; i < callbacks.length; i += 1) {
      try {
        callbacks[i](payload);
      } catch (_ignoreThemeCatalogCallback) {}
    }
  }

  function receiveThemeCatalog(payload) {
    var data = payload && typeof payload === "object" ? payload : null;
    state.themeCatalogLoading = false;
    state.themeCatalogRequestId = "";
    if (!data || data.success === false || !data.catalog || typeof data.catalog !== "object") {
      flushThemeCatalogCallbacks(null);
      return null;
    }

    state.themeCatalog = data.catalog;
    saveThemeCatalogCache(data.catalog);
    flushThemeCatalogCallbacks(data.catalog);
    return data.catalog;
  }

  function ensureThemeCatalogLoaded(onReady) {
    if (typeof onReady === "function") {
      if (!state.themeCatalogCallbacks) {
        state.themeCatalogCallbacks = [];
      }
      state.themeCatalogCallbacks.push(onReady);
    }

    if (state.themeCatalog && typeof state.themeCatalog === "object") {
      flushThemeCatalogCallbacks(state.themeCatalog);
      return;
    }

    var cached = loadThemeCatalogCache();
    if (cached && typeof cached === "object") {
      state.themeCatalog = cached;
      flushThemeCatalogCallbacks(cached);
      return;
    }

    if (state.themeCatalogLoading) {
      return;
    }

    state.themeCatalogLoading = true;
    state.themeCatalogRequestId = "theme-catalog-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
    sendPacket("theme_catalog_request", {
      requestId: state.themeCatalogRequestId,
      catalogName: "flowery-daisy"
    });
  }

  function getThemeByName(themeName) {
    var wanted = normalizeLegacyThemeName(themeName);
    if (!wanted) {
      return colorThemes[0];
    }
    for (var i = 0; i < colorThemes.length; i += 1) {
      if (colorThemes[i].name === wanted) {
        return colorThemes[i];
      }
    }
    var compactTheme = findCompactThemeByName(wanted);
    if (compactTheme) {
      return buildThemeFromCompact(compactTheme);
    }
    return null;
  }

  function updateThemeDotSelection(activeThemeName) {
    var dots = document.querySelectorAll(".lua-theme-dot");
    if (!dots || !dots.length) {
      return;
    }
    for (var i = 0; i < dots.length; i += 1) {
      var dot = dots[i];
      var isActive = String(dot.getAttribute("data-theme") || "") === activeThemeName;
      dot.setAttribute("data-active", isActive ? "1" : "0");
    }
  }

  function updateThemeCatalogSelection(activeThemeName) {
    var items = document.querySelectorAll(".lua-theme-catalog-item");
    if (!items || !items.length) {
      return;
    }
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var isActive = String(item.getAttribute("data-theme") || "") === activeThemeName;
      item.setAttribute("data-active", isActive ? "1" : "0");
      item.setAttribute("tabindex", isActive ? "0" : "-1");
    }
  }

  function parseHexColor(hex) {
    var value = String(hex || "").replace(/[^0-9a-f]/gi, "");
    if (value.length === 3) {
      value = value.charAt(0) + value.charAt(0) + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2);
    }
    if (value.length !== 6) {
      return { r: 0, g: 0, b: 0 };
    }
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function clampColorByte(value) {
    var n = Math.round(Number(value) || 0);
    if (n < 0) {
      return 0;
    }
    if (n > 255) {
      return 255;
    }
    return n;
  }

  function toHexColor(rgb) {
    function toPart(value) {
      var part = clampColorByte(value).toString(16);
      return part.length < 2 ? "0" + part : part;
    }
    return "#" + toPart(rgb.r) + toPart(rgb.g) + toPart(rgb.b);
  }

  function mixHexColor(a, b, amount) {
    var left = parseHexColor(a);
    var right = parseHexColor(b);
    var t = typeof amount === "number" ? amount : 0.5;
    if (t < 0) {
      t = 0;
    }
    if (t > 1) {
      t = 1;
    }
    return toHexColor({
      r: left.r + (right.r - left.r) * t,
      g: left.g + (right.g - left.g) * t,
      b: left.b + (right.b - left.b) * t
    });
  }

  function withAlpha(hex, alpha) {
    var rgb = parseHexColor(hex);
    var a = typeof alpha === "number" ? alpha : 1;
    if (a < 0) {
      a = 0;
    }
    if (a > 1) {
      a = 1;
    }
    return "rgba(" + clampColorByte(rgb.r) + "," + clampColorByte(rgb.g) + "," + clampColorByte(rgb.b) + "," + a + ")";
  }

  function isLightHexColor(hex) {
    var rgb = parseHexColor(hex);
    var luminance = (rgb.r * 0.299) + (rgb.g * 0.587) + (rgb.b * 0.114);
    return luminance >= 160;
  }

  function getRelativeLuminance(hex) {
    var rgb = parseHexColor(hex);
    function toLinear(value) {
      var n = clampColorByte(value) / 255;
      return n <= 0.03928 ? (n / 12.92) : Math.pow((n + 0.055) / 1.055, 2.4);
    }
    return (0.2126 * toLinear(rgb.r)) + (0.7152 * toLinear(rgb.g)) + (0.0722 * toLinear(rgb.b));
  }

  function getContrastRatio(a, b) {
    var left = getRelativeLuminance(a);
    var right = getRelativeLuminance(b);
    var lighter = left > right ? left : right;
    var darker = left > right ? right : left;
    return (lighter + 0.05) / (darker + 0.05);
  }

  function pickReadableTextColor(background, preferred, dark, light, minRatio) {
    var bg = String(background || "#000000");
    var want = String(preferred || "");
    var darkText = String(dark || "#111111");
    var lightText = String(light || "#f8f8f2");
    var min = typeof minRatio === "number" ? minRatio : 4.5;
    var best = want;
    var bestRatio = best ? getContrastRatio(bg, best) : 0;
    if (best && bestRatio >= min) {
      return best;
    }
    var darkRatio = getContrastRatio(bg, darkText);
    var lightRatio = getContrastRatio(bg, lightText);
    return darkRatio >= lightRatio ? darkText : lightText;
  }

  function ensureReadableAccentColor(background, color, minRatio) {
    var bg = String(background || "#000000");
    var candidate = String(color || "");
    var min = typeof minRatio === "number" ? minRatio : 3.4;
    if (candidate && getContrastRatio(bg, candidate) >= min) {
      return candidate;
    }
    var target = isLightHexColor(bg) ? "#111111" : "#f8f8f2";
    if (!candidate) {
      candidate = target;
    }
    for (var i = 1; i <= 10; i += 1) {
      var mixed = mixHexColor(candidate, target, i / 10);
      if (getContrastRatio(bg, mixed) >= min) {
        return mixed;
      }
    }
    return pickReadableTextColor(bg, candidate, "#111111", "#f8f8f2", min);
  }

  function shadeHexColor(hex, amount) {
    return amount >= 0
      ? mixHexColor(hex, "#ffffff", amount)
      : mixHexColor(hex, "#000000", -amount);
  }

  function normalizeThemeCatalogLabel(label) {
    var text = String(label || "").replace(/^daisy\s+/i, "").trim();
    return text || "Theme";
  }

  function getEventKeyName(event) {
    var key = event && event.key ? String(event.key) : "";
    if (key) {
      if (key === "Left") { return "ArrowLeft"; }
      if (key === "Right") { return "ArrowRight"; }
      if (key === "Up") { return "ArrowUp"; }
      if (key === "Down") { return "ArrowDown"; }
      if (key === "Esc") { return "Escape"; }
      if (key === "Spacebar") { return " "; }
      if (key !== "Unidentified") {
        return key;
      }
    }
    var code = event ? (event.which || event.keyCode || event.charCode || 0) : 0;
    if (code === 37) { return "ArrowLeft"; }
    if (code === 38) { return "ArrowUp"; }
    if (code === 39) { return "ArrowRight"; }
    if (code === 40) { return "ArrowDown"; }
    if (code === 13) { return "Enter"; }
    if (code === 27) { return "Escape"; }
    if (code === 32) { return " "; }
    if (code === 36) { return "Home"; }
    if (code === 35) { return "End"; }
    return "";
  }

  function buildLinearGradient(top, mid, bottom) {
    return "linear-gradient(180deg," + top + " 0%," + mid + " 45%," + bottom + " 100%)";
  }

  function findCompactThemeByName(themeName) {
    var catalog = state.themeCatalog;
    var wanted = normalizeLegacyThemeName(themeName);
    if (!catalog || !catalog.themes || typeof catalog.themes.length !== "number") {
      return null;
    }
    for (var i = 0; i < catalog.themes.length; i += 1) {
      var entry = catalog.themes[i];
      if (entry && String(entry.n || "") === wanted) {
        return entry;
      }
    }
    return null;
  }

  function buildThemeFromCompact(compact) {
    var primary = String(compact.p || compact.d || "#58a6ff");
    var primaryFocus = String(compact.pf || primary);
    var primaryContent = pickReadableTextColor(primary, compact.pc || (isLightHexColor(primary) ? "#101418" : "#f8f8f2"), "#101418", "#f8f8f2", 4.5);
    var neutral = String(compact.nu || "#20242a");
    var base100 = String(compact.b1 || "#0d1117");
    var base200 = String(compact.b2 || shadeHexColor(base100, isLightHexColor(base100) ? -0.06 : 0.08));
    var base300 = String(compact.b3 || shadeHexColor(base200, isLightHexColor(base200) ? -0.12 : 0.12));
    var isLightBase = isLightHexColor(base100);
    var baseContent = pickReadableTextColor(base100, compact.bc || (isLightHexColor(base100) ? "#111111" : "#d8dee4"), "#111111", "#f8f8f2", 5.5);
    var neutralContent = pickReadableTextColor(neutral, compact.nc || baseContent, "#111111", "#f8f8f2", 4.5);
    var info = String(compact.i || primary);
    var warning = String(compact.w || primary);
    var row = isLightBase
      ? mixHexColor(base100, base200, 0.72)
      : mixHexColor(base200, base300, 0.38);
    var rowAlt = isLightBase
      ? mixHexColor(base200, base300, 0.32)
      : mixHexColor(base200, neutral, 0.18);
    var deep = isLightBase
      ? mixHexColor(base200, base300, 0.58)
      : mixHexColor(base100, neutral, 0.55);
    var textMuted = pickReadableTextColor(base200, baseContent, "#111111", "#f8f8f2", 4.5);
    var textDim = pickReadableTextColor(base200, mixHexColor(baseContent, base300, 0.55), shadeHexColor(textMuted, isLightHexColor(base200) ? -0.3 : 0.3), textMuted, 3.2);
    var comment = pickReadableTextColor(deep, mixHexColor(baseContent, base300, 0.68), "#4f5964", "#9ea8b3", 3.2);
    var cmText = pickReadableTextColor(deep, baseContent, "#111111", "#f8f8f2", 5.5);
    var cmKeyword = ensureReadableAccentColor(deep, primary, 4.2);
    var cmAtom = ensureReadableAccentColor(deep, info, 3.6);
    var cmString = ensureReadableAccentColor(deep, compact.g || "#2ea043", 3.6);
    var cmNumber = ensureReadableAccentColor(deep, warning, 3.6);
    var cmDef = ensureReadableAccentColor(deep, primaryFocus, 3.8);
    var cmBuiltin = ensureReadableAccentColor(deep, compact.a || primaryFocus || primary, 3.8);
    var cmVariable = cmText;
    var cmVariable2 = ensureReadableAccentColor(deep, mixHexColor(info, primary, 0.45), 3.6);
    var cmOperator = pickReadableTextColor(deep, mixHexColor(cmText, base300, 0.18), "#2b3137", "#d8dee4", 3.2);
    var cmProperty = ensureReadableAccentColor(deep, mixHexColor(primary, info, 0.25), 3.6);
    var borderStrong = isLightBase ? mixHexColor(base300, baseContent, 0.1) : mixHexColor(base300, neutral, 0.15);
    var btnDisabledBg = buildLinearGradient(shadeHexColor(base200, isLightBase ? -0.03 : 0.04), rowAlt, shadeHexColor(deep, isLightBase ? -0.08 : -0.02));
    var btnDisabledBorder = withAlpha(borderStrong, isLightBase ? 0.6 : 0.5);
    var btnDisabledColor = withAlpha(textDim, isLightBase ? 0.92 : 0.72);
    return {
      name: String(compact.n || "catalog-theme"),
      label: normalizeThemeCatalogLabel(compact.l || compact.n || "Catalog Theme"),
      dot: String(compact.d || primary),
      accent: withAlpha(primary, 0.92),
      header: withAlpha(base100, 0.97),
      caretBg: withAlpha(primary, isLightHexColor(base100) ? 0.12 : 0.18),
      accentSolid: primary,
      onAccent: primaryContent,
      surfaceMain: base100,
      surfaceElevated: base200,
      surfaceRow: row,
      surfaceDeep: deep,
      surfaceRowAlt: rowAlt,
      borderStrong: borderStrong,
      borderHover: info,
      shadow: isLightHexColor(base100) ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.5)",
      textMuted: textMuted,
      textDim: textDim,
      cmText: cmText,
      cmComment: comment,
      cmLineNumber: textDim,
      cmKeyword: cmKeyword,
      cmAtom: cmAtom,
      cmString: cmString,
      cmNumber: cmNumber,
      cmDef: cmDef,
      cmBuiltin: cmBuiltin,
      cmVariable: cmVariable,
      cmVariable2: cmVariable2,
      cmOperator: cmOperator,
      cmProperty: cmProperty,
      gutterBorder: mixHexColor(base200, base300, 0.5),
      btnApplyBg: buildLinearGradient(shadeHexColor(primary, 0.08), mixHexColor(primary, primaryFocus, 0.55), shadeHexColor(primaryFocus, -0.18)),
      btnApplyBorder: withAlpha(primary, 0.78),
      btnApplyColor: primaryContent,
      btnApplyHoverBg: buildLinearGradient(shadeHexColor(primary, 0.16), shadeHexColor(primary, 0.05), shadeHexColor(primaryFocus, -0.08)),
      btnApplyActiveBg: buildLinearGradient(shadeHexColor(primaryFocus, -0.02), shadeHexColor(primaryFocus, -0.12), shadeHexColor(primaryFocus, -0.24)),
      btnCancelBg: buildLinearGradient(shadeHexColor(neutral, 0.1), neutral, shadeHexColor(neutral, -0.12)),
      btnCancelBorder: withAlpha(base300, 0.55),
      btnCancelColor: neutralContent,
      btnCancelHoverBg: buildLinearGradient(shadeHexColor(neutral, 0.16), shadeHexColor(neutral, 0.05), shadeHexColor(neutral, -0.04)),
      btnCancelActiveBg: buildLinearGradient(shadeHexColor(neutral, -0.02), shadeHexColor(neutral, -0.1), shadeHexColor(neutral, -0.18)),
      btnDisabledBg: btnDisabledBg,
      btnDisabledBorder: btnDisabledBorder,
      btnDisabledColor: btnDisabledColor
    };
  }

  function hideThemeCatalogPanels() {
    var panels = document.querySelectorAll(".lua-theme-catalog-panel");
    if (!panels || !panels.length) {
      return;
    }
    for (var i = 0; i < panels.length; i += 1) {
      panels[i].setAttribute("data-open", "0");
    }
  }

  function getThemeCatalogItems(panel) {
    return panel && panel.querySelectorAll ? panel.querySelectorAll(".lua-theme-catalog-item") : [];
  }

  function setThemeCatalogFocus(panel, item, shouldFocus) {
    var items = getThemeCatalogItems(panel);
    for (var i = 0; i < items.length; i += 1) {
      items[i].setAttribute("tabindex", items[i] === item ? "0" : "-1");
    }
    if (shouldFocus && item && typeof item.focus === "function") {
      try {
        item.focus();
      } catch (_ignoreThemeFocus) {}
    }
  }

  function applyThemeCatalogEntry(panel, item, themeName, persist, shouldFocus) {
    if (!themeName) {
      return;
    }
    applyTheme(themeName, persist !== false);
    updateThemeCatalogSelection(state.activeTheme);
    setThemeCatalogFocus(panel, item, shouldFocus === true);
  }

  function ensureThemeCatalogDismissBinding() {
    if (state.themeCatalogDismissBound) {
      return;
    }
    state.themeCatalogDismissBound = true;
    document.addEventListener("mousedown", function (event) {
      var target = event && event.target;
      if (target && target.closest &&
          (target.closest(".lua-theme-catalog-panel") || target.closest(".lua-theme-catalog-trigger"))) {
        return;
      }
      hideThemeCatalogPanels();
    }, true);
  }

  function renderThemeCatalogPanel(panel, catalog) {
    if (!panel) {
      return;
    }

    while (panel.firstChild) {
      panel.removeChild(panel.firstChild);
    }

    var status = document.createElement("div");
    status.className = "lua-theme-catalog-status";
    panel.appendChild(status);

    if (!catalog || !catalog.themes || !catalog.themes.length) {
      status.textContent = state.themeCatalogLoading ? "Loading themes..." : "No theme catalog";
      return;
    }

    status.textContent = "Themes (" + catalog.themes.length + ")";
    var list = document.createElement("div");
    list.className = "lua-theme-catalog-list";
    var activeItem = null;

    for (var i = 0; i < catalog.themes.length; i += 1) {
      (function (entry, index) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "lua-theme-catalog-item";
        item.setAttribute("data-theme", String(entry.n || ""));
        item.setAttribute("data-active", String(entry.n || "") === state.activeTheme ? "1" : "0");
        item.setAttribute("data-index", String(index));
        item.setAttribute("tabindex", String(entry.n || "") === state.activeTheme ? "0" : "-1");

        var swatch = document.createElement("span");
        swatch.className = "lua-theme-catalog-swatch";
        swatch.style.background = String(entry.d || entry.p || "#58a6ff");

        var label = document.createElement("span");
        label.className = "lua-theme-catalog-label";
        label.textContent = normalizeThemeCatalogLabel(entry.l || entry.n || "Theme");

        item.appendChild(swatch);
        item.appendChild(label);
        item.addEventListener("mouseenter", function () {
          applyThemeCatalogEntry(panel, item, String(entry.n || ""), true, false);
        }, true);
        item.addEventListener("focus", function () {
          applyThemeCatalogEntry(panel, item, String(entry.n || ""), true, false);
        }, true);
        item.addEventListener("keydown", function (event) {
          var key = getEventKeyName(event);
          var delta = 0;
          if (key === "ArrowLeft") {
            delta = -1;
          } else if (key === "ArrowRight") {
            delta = 1;
          } else if (key === "ArrowUp") {
            delta = -3;
          } else if (key === "ArrowDown") {
            delta = 3;
          } else if (key === "Home") {
            delta = -9999;
          } else if (key === "End") {
            delta = 9999;
          } else if (key === "Escape") {
            hideThemeCatalogPanels();
            return;
          } else if (key === "Enter" || key === " ") {
            if (event && typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            applyThemeCatalogEntry(panel, item, String(entry.n || ""), true, true);
            return;
          } else {
            return;
          }

          if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }
          if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
          }
          var items = getThemeCatalogItems(panel);
          if (!items || !items.length) {
            return;
          }
          var current = index;
          var next = current + delta;
          if (delta === -9999) {
            next = 0;
          } else if (delta === 9999) {
            next = items.length - 1;
          }
          if (next < 0) {
            next = 0;
          }
          if (next >= items.length) {
            next = items.length - 1;
          }
          var target = items[next];
          if (target) {
            setThemeCatalogFocus(panel, target, true);
          }
        }, true);
        item.addEventListener("click", function () {
          applyThemeCatalogEntry(panel, item, String(entry.n || ""), true, true);
          hideThemeCatalogPanels();
        }, true);
        if (String(entry.n || "") === state.activeTheme || !activeItem) {
          activeItem = item;
        }
        list.appendChild(item);
      })(catalog.themes[i], i);
    }

    panel.appendChild(list);
    if (activeItem) {
      setThemeCatalogFocus(panel, activeItem, false);
    }
  }

  function toggleThemeCatalogPanel(switcher, panelId) {
    if (!switcher) {
      return;
    }
    ensureThemeCatalogDismissBinding();
    var panel = document.getElementById(panelId);
    if (!panel) {
      return;
    }
    var willOpen = String(panel.getAttribute("data-open") || "0") !== "1";
    hideThemeCatalogPanels();
    if (!willOpen) {
      return;
    }
    panel.setAttribute("data-open", "1");
    renderThemeCatalogPanel(panel, null);
    ensureThemeCatalogLoaded(function (catalog) {
      renderThemeCatalogPanel(panel, catalog);
      updateThemeCatalogSelection(state.activeTheme);
      var active = panel.querySelector(".lua-theme-catalog-item[data-active=\"1\"]") || panel.querySelector(".lua-theme-catalog-item");
      if (active) {
        setThemeCatalogFocus(panel, active, true);
      }
    });
  }

  function ensureThemeCatalogTrigger(switcher, baseId) {
    if (!switcher) {
      return;
    }

    var triggerId = baseId + "-catalog-trigger";
    var panelId = baseId + "-catalog-panel";
    var trigger = document.getElementById(triggerId);
    if (!trigger) {
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.id = triggerId;
      trigger.className = "lua-theme-catalog-trigger";
      trigger.textContent = "...";
      trigger.setAttribute("title", "Themes");
      trigger.setAttribute("aria-label", "Themes");
      trigger.addEventListener("click", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (event && typeof event.stopPropagation === "function") {
          event.stopPropagation();
        }
        toggleThemeCatalogPanel(switcher, panelId);
      }, true);
    }

    if (trigger.parentNode !== switcher) {
      switcher.appendChild(trigger);
    }

    var panel = document.getElementById(panelId);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = panelId;
      panel.className = "lua-theme-catalog-panel";
      panel.setAttribute("data-open", "0");
    }
    if (panel.parentNode !== switcher) {
      switcher.appendChild(panel);
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
        ensureLuaBufferSize();
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
    ensureLuaBufferSize();
  }

  function sendIdeSyncPacket(targetKind) {
    var normalizedTargetKind = normalizeIdeImportTargetKind(targetKind);
    var snapshot = typeof getCurrentIdeImportSnapshot === "function"
      ? getCurrentIdeImportSnapshot(normalizedTargetKind)
      : null;
    if (!snapshot || !snapshot.ready) {
      var blockedMessage = "Open Editor";
      if (snapshot && snapshot.status === "lua_editor_no_active_filter") {
        blockedMessage = "Select Filter";
      }
      flashIdeSyncButtonForTarget(
        normalizedTargetKind,
        blockedMessage,
        "#8a2424",
        "#ffffff",
        1400);
      return false;
    }
    if (normalizedTargetKind === "lua_editor") {
      state.lastIdeSyncContextKey = snapshot.contextKey || "";
      state.lastIdeSyncReference = cloneIdeSyncObject(snapshot.reference);
    }
    var code = typeof snapshot.code === "string" ? snapshot.code : "";
    var chunkSize = 8000;
    var total = Math.ceil(code.length / chunkSize) || 1;
    var syncId = "sync-" + Date.now();
    var codeHash32 = hashStringFNV1a(code);
    var reference = cloneIdeSyncObject(snapshot.reference);
    var exportedAtUtc = null;
    try {
      exportedAtUtc = new Date().toISOString();
    } catch (_ignoreExportedAtUtc) {}
    for (var i = 0; i < total; i += 1) {
      var chunk = code.substring(i * chunkSize, (i + 1) * chunkSize);
      sendPacket("lua_ide_sync", {
        syncId: syncId,
        part: i + 1,
        total: total,
        codeChunk: chunk,
        targetKind: normalizedTargetKind,
        contextKey: snapshot.contextKey || "",
        reference: reference,
        codeHash32: codeHash32,
        exportedAtUtc: exportedAtUtc
      });
    }
    return true;
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
        sendIdeSyncPacket("lua_editor");
      }, true);
    }

    if (syncBtn.parentNode !== wrapper) {
      wrapper.appendChild(syncBtn);
    }
  }

  function ensureScreenIdeSyncButton(root) {
    if (!root || !root.querySelector) {
      return;
    }

    var wrapper = root.querySelector(".content .top_line .font_size_wrapper");
    if (!wrapper) {
      return;
    }

    var syncBtn = document.getElementById("ModUiExtractor-screen-ide-sync");
    if (!syncBtn) {
      syncBtn = document.createElement("button");
      syncBtn.type = "button";
      syncBtn.id = "ModUiExtractor-screen-ide-sync";
      syncBtn.textContent = "IDE Sync";

      syncBtn.addEventListener("click", function () {
        sendIdeSyncPacket("screen_editor");
      }, true);
    }

    if (syncBtn.parentNode !== wrapper) {
      wrapper.appendChild(syncBtn);
    }
  }

  function formatLuaBufferSize(count) {
    var n = typeof count === "number" && isFinite(count) ? count : 0;
    if (n < 0) {
      n = 0;
    }
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function parsePixelFontSize(value) {
    var text = String(value || "").trim();
    var parsed = parseFloat(text);
    return isFinite(parsed) ? parsed : 0;
  }

  function getCodeMirrorFontSizePx(codeMirror) {
    if (!codeMirror || typeof codeMirror.getWrapperElement !== "function") {
      return 0;
    }
    try {
      var wrapper = codeMirror.getWrapperElement();
      if (!wrapper) {
        return 0;
      }
      return parsePixelFontSize(window.getComputedStyle(wrapper, null).fontSize);
    } catch (_ignoreCodeMirrorFontSize) {}
    return 0;
  }

  function scheduleDelayed(fn, delayMs) {
    return window.setTimeout(fn, typeof delayMs === "number" ? delayMs : 0);
  }

  function saveLuaEditorViewPreferences() {
    var wrapNode = document.getElementById("lua_wrap_lines");
    persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "luaWrapLines", !!(wrapNode && wrapNode.checked));

    var fontSizePx = getCodeMirrorFontSizePx(getLuaCodeMirror());
    if (fontSizePx > 0) {
      persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "luaFontSizePx", fontSizePx);
    }
  }

  function restoreLuaEditorWrapLinesPreference() {
    var wrapNode = document.getElementById("lua_wrap_lines");
    if (!wrapNode) {
      return;
    }
    var wanted = !!getRuntimeModuleStateValue(
      luaEditorEnhancementModuleId,
      "luaWrapLines",
      !!wrapNode.checked
    );
    if (!!wrapNode.checked === wanted) {
      return;
    }
    try {
      wrapNode.click();
    } catch (_ignoreWrapClick) {
      wrapNode.checked = wanted;
    }
  }

  function stepLuaEditorFontSizeToward(targetPx, remainingSteps) {
    if (!(targetPx > 0) || remainingSteps <= 0) {
      return;
    }
    var currentPx = getCodeMirrorFontSizePx(getLuaCodeMirror());
    if (!(currentPx > 0) || Math.abs(currentPx - targetPx) <= 0.35) {
      return;
    }
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }
    var selector = currentPx < targetPx
      ? '.header_editor .font_size_wrapper .lua_change_font_size[value="+"]'
      : '.header_editor .font_size_wrapper .lua_change_font_size[value="-"]';
    var button = root.querySelector(selector);
    if (!button) {
      return;
    }
    try {
      button.click();
    } catch (_ignoreFontClick) {
      if (window.LUAEditorManager && typeof window.LUAEditorManager.changeFontSize === "function") {
        try {
          window.LUAEditorManager.changeFontSize(currentPx < targetPx);
        } catch (_ignoreFontManagerCall) {}
      }
    }
    scheduleDelayed(function () {
      stepLuaEditorFontSizeToward(targetPx, remainingSteps - 1);
    }, 60);
  }

  function restoreLuaEditorFontSizePreference() {
    var targetPx = getRuntimeModuleStateValue(
      luaEditorEnhancementModuleId,
      "luaFontSizePx",
      0
    );
    if (!(targetPx > 0)) {
      return;
    }
    scheduleDelayed(function () {
      stepLuaEditorFontSizeToward(targetPx, 12);
    }, 0);
  }

  function ensureLuaEditorViewPreferenceBindings() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    var wrapNode = document.getElementById("lua_wrap_lines");
    if (wrapNode && !wrapNode.__luaProbePreferenceBound) {
      wrapNode.__luaProbePreferenceBound = true;
      wrapNode.addEventListener("change", function () {
        saveLuaEditorViewPreferences();
      }, true);
    }

    var fontButtons = root.querySelectorAll('.header_editor .font_size_wrapper .lua_change_font_size');
    for (var i = 0; i < fontButtons.length; i += 1) {
      var button = fontButtons[i];
      if (!button || button.__luaProbePreferenceBound) {
        continue;
      }
      button.__luaProbePreferenceBound = true;
      button.addEventListener("click", function () {
        scheduleDelayed(function () {
          saveLuaEditorViewPreferences();
        }, 80);
      }, true);
    }
  }

  function restoreLuaEditorViewPreferences() {
    ensureLuaEditorViewPreferenceBindings();
    restoreLuaEditorWrapLinesPreference();
    restoreLuaEditorFontSizePreference();
    scheduleDelayed(function () {
      saveLuaEditorViewPreferences();
    }, 120);
  }

  function saveScreenEditorViewPreferences(root) {
    if (!root || !root.querySelector) {
      return;
    }
    var wrapNode = null;
    try {
      wrapNode = root.querySelector('.wrap_line_wrapper .checkbox');
    } catch (_ignoreScreenWrapRead) {}
    persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "screenWrapLines", !!(wrapNode && wrapNode.checked));

    var fontSizePx = getCodeMirrorFontSizePx(getScreenEditorCodeMirror(root));
    if (!(fontSizePx > 0)) {
      try {
        var codeNode = getScreenEditorCodeNode(getScreenEditorPanel(), root);
        if (codeNode) {
          fontSizePx = parsePixelFontSize(window.getComputedStyle(codeNode, null).fontSize);
        }
      } catch (_ignoreScreenFontNode) {}
    }
    if (fontSizePx > 0) {
      persistRuntimeModuleStateValue(luaEditorEnhancementModuleId, "screenFontSizePx", fontSizePx);
    }
  }

  function restoreScreenEditorWrapLinesPreference(root) {
    if (!root || !root.querySelector) {
      return;
    }
    var wrapNode = null;
    try {
      wrapNode = root.querySelector('.wrap_line_wrapper .checkbox');
    } catch (_ignoreScreenWrap) {}
    if (!wrapNode) {
      return;
    }
    var wanted = !!getRuntimeModuleStateValue(
      luaEditorEnhancementModuleId,
      "screenWrapLines",
      !!wrapNode.checked
    );
    if (!!wrapNode.checked === wanted) {
      return;
    }
    try {
      wrapNode.click();
    } catch (_ignoreScreenWrapClick) {
      wrapNode.checked = wanted;
    }
  }

  function stepScreenEditorFontSizeToward(root, targetPx, remainingSteps) {
    if (!root || !(targetPx > 0) || remainingSteps <= 0) {
      return;
    }
    var currentPx = getCodeMirrorFontSizePx(getScreenEditorCodeMirror(root));
    if (!(currentPx > 0)) {
      try {
        var codeNode = getScreenEditorCodeNode(getScreenEditorPanel(), root);
        if (codeNode) {
          currentPx = parsePixelFontSize(window.getComputedStyle(codeNode, null).fontSize);
        }
      } catch (_ignoreScreenCurrentFont) {}
    }
    if (!(currentPx > 0) || Math.abs(currentPx - targetPx) <= 0.35) {
      return;
    }
    var selector = currentPx < targetPx
      ? '.font_size_wrapper .lua_change_font_size[value="+"]'
      : '.font_size_wrapper .lua_change_font_size[value="-"]';
    var button = root.querySelector(selector);
    if (!button) {
      return;
    }
    try {
      button.click();
    } catch (_ignoreScreenFontClick) {}
    scheduleDelayed(function () {
      stepScreenEditorFontSizeToward(root, targetPx, remainingSteps - 1);
    }, 60);
  }

  function restoreScreenEditorFontSizePreference(root) {
    var targetPx = getRuntimeModuleStateValue(
      luaEditorEnhancementModuleId,
      "screenFontSizePx",
      0
    );
    if (!(targetPx > 0)) {
      return;
    }
    scheduleDelayed(function () {
      stepScreenEditorFontSizeToward(root, targetPx, 12);
    }, 0);
  }

  function ensureScreenEditorViewPreferenceBindings(root) {
    if (!root || !root.querySelector) {
      return;
    }
    var wrapNode = null;
    try {
      wrapNode = root.querySelector('.wrap_line_wrapper .checkbox');
    } catch (_ignoreScreenWrapBind) {}
    if (wrapNode && !wrapNode.__luaProbePreferenceBound) {
      wrapNode.__luaProbePreferenceBound = true;
      wrapNode.addEventListener("change", function () {
        saveScreenEditorViewPreferences(root);
      }, true);
    }

    var buttons = root.querySelectorAll('.font_size_wrapper .lua_change_font_size');
    for (var i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      if (!button || button.__luaProbePreferenceBound) {
        continue;
      }
      button.__luaProbePreferenceBound = true;
      button.addEventListener("click", function () {
        scheduleDelayed(function () {
          saveScreenEditorViewPreferences(root);
        }, 80);
      }, true);
    }
  }

  function restoreScreenEditorViewPreferences(root) {
    ensureScreenEditorViewPreferenceBindings(root);
    restoreScreenEditorWrapLinesPreference(root);
    restoreScreenEditorFontSizePreference(root);
    scheduleDelayed(function () {
      saveScreenEditorViewPreferences(root);
    }, 120);
  }

  function ensureLuaBufferSize() {
    var root = document.getElementById("dpu_editor");
    if (!root || !root.querySelector) {
      return;
    }

    var reportNode = root.querySelector(".error_ctn .header .lua_error_header_wrapper");
    if (!reportNode) {
      return;
    }

    var sizeNode = document.getElementById("ModUiExtractor-lua-buffer-size");
    if (!sizeNode) {
      sizeNode = document.createElement("span");
      sizeNode.id = "ModUiExtractor-lua-buffer-size";
      sizeNode.className = "lua-probe-buffer-size";
    }

    var titleTextNode = document.getElementById("ModUiExtractor-lua-title-text");
    var titleNode = document.getElementById("lua_editor_title") ||
      root.querySelector(".editor_header .title, .editor_header .header_bar .title");
    if (titleNode && titleTextNode && titleTextNode.parentNode === titleNode) {
      titleNode.textContent = String(titleTextNode.textContent || titleNode.getAttribute("data-probe-title") || "").replace(/\s+/g, " ").trim();
      titleNode.removeAttribute("data-probe-title");
    }
    if (titleTextNode && titleTextNode.parentNode) {
      titleTextNode.parentNode.removeChild(titleTextNode);
    }

    if (sizeNode.parentNode !== reportNode) {
      reportNode.appendChild(sizeNode);
    }

    var code = "";
    var codeMirror = getLuaCodeMirror();
    try {
      if (codeMirror && typeof codeMirror.getValue === "function") {
        code = String(codeMirror.getValue() || "");
      } else {
        var textArea = document.getElementById("editor_window");
        code = textArea && typeof textArea.value === "string" ? textArea.value : "";
      }
    } catch (_ignoreLuaBufferSize) {}

    sizeNode.textContent = "Code: " + formatLuaBufferSize(code.length) + " chars";
    sizeNode.setAttribute("data-count", String(code.length));
  }

  function getDefaultThemeName() {
    return "daisy-night";
  }

  function createThemeDotSwitcher(switcherId) {
    var switcher = document.createElement("div");
    switcher.id = switcherId;
    switcher.className = "modui-theme-switcher";

    for (var i = 0; i < colorThemes.length; i += 1) {
      (function (theme) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "lua-theme-dot";
        dot.style.background = theme.dot;
        dot.setAttribute("data-theme", theme.name);
        dot.setAttribute("data-active", "0");
        dot.setAttribute("title", "Theme: " + (theme.label || theme.name));
        dot.setAttribute("aria-label", "Theme: " + (theme.label || theme.name));
        dot.addEventListener("click", function () {
          applyTheme(theme.name, true);
        }, true);
        switcher.appendChild(dot);
      })(colorThemes[i]);
    }

    return switcher;
  }

  function getThemeRoots() {
    var roots = [];
    var luaRoot = document.getElementById("dpu_editor");
    var screenRoot = getScreenEditorRoot();
    if (luaRoot) {
      roots.push(luaRoot);
    }
    if (screenRoot && screenRoot !== luaRoot) {
      roots.push(screenRoot);
    }
    return roots;
  }

  function applyThemeToRoot(root, theme) {
    if (!root || !root.style || typeof root.style.setProperty !== "function") {
      return;
    }
    root.style.setProperty("--lua-probe-accent", theme.accent);
    root.style.setProperty("--lua-probe-header-bg", theme.header);
    root.style.setProperty("--lua-probe-caret-line-bg", theme.caretBg);
    root.style.setProperty("--lua-probe-accent-solid", theme.accentSolid);
    root.style.setProperty("--lua-probe-on-accent", theme.onAccent);
    root.style.setProperty("--lua-probe-surface-main", theme.surfaceMain);
    root.style.setProperty("--lua-probe-surface-elevated", theme.surfaceElevated);
    root.style.setProperty("--lua-probe-surface-row", theme.surfaceRow);
    root.style.setProperty("--lua-probe-surface-deep", theme.surfaceDeep);
    root.style.setProperty("--lua-probe-surface-row-alt", theme.surfaceRowAlt);
    root.style.setProperty("--lua-probe-border-strong", theme.borderStrong);
    root.style.setProperty("--lua-probe-border-hover", theme.borderHover);
    root.style.setProperty("--lua-probe-shadow", theme.shadow);
    root.style.setProperty("--lua-probe-text-muted", theme.textMuted);
    root.style.setProperty("--lua-probe-text-dim", theme.textDim);
    root.style.setProperty("--lua-probe-cm-text", theme.cmText || theme.textMuted);
    root.style.setProperty("--lua-probe-cm-comment", theme.cmComment);
    root.style.setProperty("--lua-probe-cm-linenumber", theme.cmLineNumber);
    root.style.setProperty("--lua-probe-cm-keyword", theme.cmKeyword || theme.accentSolid);
    root.style.setProperty("--lua-probe-cm-atom", theme.cmAtom || theme.borderHover);
    root.style.setProperty("--lua-probe-cm-string", theme.cmString || theme.textMuted);
    root.style.setProperty("--lua-probe-cm-number", theme.cmNumber || theme.borderHover);
    root.style.setProperty("--lua-probe-cm-def", theme.cmDef || theme.accentSolid);
    root.style.setProperty("--lua-probe-cm-builtin", theme.cmBuiltin || theme.borderHover);
    root.style.setProperty("--lua-probe-cm-variable", theme.cmVariable || theme.textMuted);
    root.style.setProperty("--lua-probe-cm-variable-2", theme.cmVariable2 || theme.borderHover);
    root.style.setProperty("--lua-probe-cm-operator", theme.cmOperator || theme.textMuted);
    root.style.setProperty("--lua-probe-cm-property", theme.cmProperty || theme.accentSolid);
    root.style.setProperty("--lua-probe-gutter-border", theme.gutterBorder);
    root.style.setProperty("--lua-probe-btn-apply-bg", theme.btnApplyBg);
    root.style.setProperty("--lua-probe-btn-apply-border", theme.btnApplyBorder);
    root.style.setProperty("--lua-probe-btn-apply-color", theme.btnApplyColor);
    root.style.setProperty("--lua-probe-btn-apply-hover-bg", theme.btnApplyHoverBg);
    root.style.setProperty("--lua-probe-btn-apply-active-bg", theme.btnApplyActiveBg);
    root.style.setProperty("--lua-probe-btn-cancel-bg", theme.btnCancelBg);
    root.style.setProperty("--lua-probe-btn-cancel-border", theme.btnCancelBorder);
    root.style.setProperty("--lua-probe-btn-cancel-color", theme.btnCancelColor);
    root.style.setProperty("--lua-probe-btn-cancel-hover-bg", theme.btnCancelHoverBg);
    root.style.setProperty("--lua-probe-btn-cancel-active-bg", theme.btnCancelActiveBg);
    root.style.setProperty("--lua-probe-btn-disabled-bg", theme.btnDisabledBg || theme.btnCancelBg);
    root.style.setProperty("--lua-probe-btn-disabled-border", theme.btnDisabledBorder || theme.btnCancelBorder);
    root.style.setProperty("--lua-probe-btn-disabled-color", theme.btnDisabledColor || theme.textDim);
  }

  function applyTheme(themeName, emitPacket) {
    var wanted = normalizeLegacyThemeName(themeName || getDefaultThemeName());
    var theme = getThemeByName(wanted);
    if (!theme) {
      state.activeTheme = wanted;
      saveThemePreference(wanted);
      ensureThemeCatalogLoaded(function (catalog) {
        var resolved = findCompactThemeByName(wanted);
        if (resolved) {
          applyTheme(wanted, emitPacket);
          return;
        }
        applyTheme(getDefaultThemeName(), emitPacket);
      });
      return false;
    }
    var roots = getThemeRoots();
    state.activeTheme = theme.name;
    saveThemePreference(theme.name);
    for (var i = 0; i < roots.length; i += 1) {
      applyThemeToRoot(roots[i], theme);
    }
    state.lastAppliedTheme = theme.name;
    updateThemeDotSelection(theme.name);
    updateThemeCatalogSelection(theme.name);

    if (emitPacket) {
      sendPacket("lua_theme_changed", {
        theme: theme.name,
        label: theme.label,
        accent: theme.accent,
        header: theme.header,
        caretBg: theme.caretBg,
        surfaceMain: theme.surfaceMain
      });
    }
    return true;
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
      switcher = createThemeDotSwitcher("ModUiExtractor-lua-theme-dots");
    }

    if (switcher.parentNode !== header) {
      header.appendChild(switcher);
    }
    ensureThemeCatalogTrigger(switcher, "ModUiExtractor-lua-theme-dots");

    ensureLuaBufferSize();
    applyTheme(state.activeTheme || getDefaultThemeName(), false);
  }

  function ensureScreenThemeSwitcher(root) {
    if (!root || !root.querySelector) {
      return;
    }

    var header = root.querySelector(".header_block");
    if (!header) {
      return;
    }

    var switcher = document.getElementById("ModUiExtractor-screen-theme-dots");
    if (!switcher) {
      switcher = createThemeDotSwitcher("ModUiExtractor-screen-theme-dots");
    }

    if (switcher.parentNode !== header) {
      header.appendChild(switcher);
    }
    ensureThemeCatalogTrigger(switcher, "ModUiExtractor-screen-theme-dots");
  }

  function ensureScreenBufferSize(root) {
    if (!root || !root.querySelector) {
      return;
    }

    var reportNode = root.querySelector(".footer_line .error_block .error_header .left_wrapper");
    if (!reportNode) {
      return;
    }

    var sizeNode = document.getElementById("ModUiExtractor-screen-buffer-size");
    if (!sizeNode) {
      sizeNode = document.createElement("span");
      sizeNode.id = "ModUiExtractor-screen-buffer-size";
      sizeNode.className = "lua-probe-screen-buffer-size";
    }

    if (sizeNode.parentNode !== reportNode) {
      reportNode.appendChild(sizeNode);
    }

    var code = "";
    var codeMirror = typeof getScreenEditorCodeMirror === "function" ? getScreenEditorCodeMirror(root) : null;
    try {
      if (codeMirror && typeof codeMirror.getValue === "function") {
        code = String(codeMirror.getValue() || "");
      }
    } catch (_ignoreScreenBufferSize) {}

    if (!code) {
      try {
        var countNode = root.querySelector(".character_count");
        var match = countNode ? String(countNode.textContent || "").match(/^\s*(\d+)/) : null;
        if (match) {
          sizeNode.textContent = "Code: " + formatLuaBufferSize(parseInt(match[1], 10) || 0) + " chars";
          return;
        }
      } catch (_ignoreScreenCountNode) {}
    }

    sizeNode.textContent = "Code: " + formatLuaBufferSize(code.length) + " chars";
  }

  function ensureScreenEditorFacelift() {
    var root = getScreenEditorRoot();
    if (!root || !root.querySelector) {
      try {
        if (state.screenEditorVisible && state.lastScreenContextKey) {
          rememberScreenEditorViewportForKey(state.lastScreenContextKey);
        }
      } catch (_ignoreScreenRememberOnMissingRoot) {}
      try {
        if (state.screenViewportBindingsCodeMirror) {
          detachScreenViewportBindings(state.screenViewportBindingsCodeMirror);
          state.screenViewportBindingsCodeMirror = null;
        }
      } catch (_ignoreScreenBindingsOnMissingRoot) {}
      state.screenEditorVisible = false;
      state.screenLastRestoredContextKey = "";
      state.screenPreferenceRestoreContextKey = "";
      return;
    }

    if (!isElementVisible(root)) {
      try {
        if (state.screenEditorVisible && state.lastScreenContextKey) {
          rememberScreenEditorViewportForKey(state.lastScreenContextKey);
        }
      } catch (_ignoreScreenRememberOnHide) {}
      try {
        if (state.screenViewportBindingsCodeMirror) {
          detachScreenViewportBindings(state.screenViewportBindingsCodeMirror);
          state.screenViewportBindingsCodeMirror = null;
        }
      } catch (_ignoreScreenBindingsOnHide) {}
      state.screenEditorVisible = false;
      state.screenLastRestoredContextKey = "";
      state.screenPreferenceRestoreContextKey = "";
      try {
        root.removeAttribute("data-lua-probe-active");
      } catch (_ignoreScreenProbeInactive) {}
      return;
    }

    var context = getScreenEditorContextSnapshot(root);
    var contextKey = context.contextKey || "";
    state.screenEditorVisible = true;
    if (contextKey) {
      state.lastScreenContextKey = contextKey;
    }

    root.setAttribute("data-lua-probe-active", "1");
    ensureScreenThemeSwitcher(root);
    ensureScreenIdeSyncButton(root);
    ensureScreenBufferSize(root);
    var screenPrefContextKey = contextKey || "__screen-visible__";
    if (state.screenPreferenceRestoreContextKey !== screenPrefContextKey) {
      state.screenPreferenceRestoreContextKey = screenPrefContextKey;
      restoreScreenEditorViewPreferences(root);
    } else {
      ensureScreenEditorViewPreferenceBindings(root);
    }
    ensureScreenViewportBindings();

    if (contextKey) {
      var hasRememberedViewport = hasRememberedScreenViewportForKey(contextKey);
      if (state.screenLastRestoredContextKey !== contextKey) {
        if (!hasRememberedViewport || restoreScreenEditorViewportForKey(contextKey)) {
          state.screenLastRestoredContextKey = contextKey;
        }
      }

      if (state.screenLastRestoredContextKey === contextKey) {
        rememberScreenEditorViewportForKey(contextKey);
      }
    }

    applyTheme(state.activeTheme || getDefaultThemeName(), false);
  }
  function normalizeProbeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getLuaEditorRoot() {
    return document.getElementById("dpu_editor");
  }

  function ensureLuaEditorVisible() {
    var root = getLuaEditorRoot();
    if (!isElementVisible(root)) {
      throw new Error("lua_editor_not_visible");
    }
    return root;
  }

  function isElementVisible(element) {
    if (!element) {
      return false;
    }
    if (element.style && element.style.display === "none") {
      return false;
    }
    return element.offsetParent !== null || element === document.activeElement;
  }

  function getLuaEditorCodeMirror() {
    try {
      if (window.LUAEditorManager && typeof window.LUAEditorManager.getLuaEditor === "function") {
        return window.LUAEditorManager.getLuaEditor();
      }
    } catch (_ignore) {}
    return null;
  }

  function getSlotNodes() {
    var root = getLuaEditorRoot();
    if (!root || !root.querySelectorAll) {
      return [];
    }

    var nodes = root.querySelectorAll("#slots_container .slot");
    var result = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || (node.classList && node.classList.contains("slotTemplate"))) {
        continue;
      }
      result.push(node);
    }
    return result;
  }

  function getFilterNodes(visibleOnly) {
    var root = getLuaEditorRoot();
    if (!root || !root.querySelectorAll) {
      return [];
    }

    var nodes = root.querySelectorAll("#filters_container .filter");
    var result = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || (node.classList && node.classList.contains("filterTemplate"))) {
        continue;
      }
      if (visibleOnly && node.classList && !node.classList.contains("view")) {
        continue;
      }
      result.push(node);
    }
    return result;
  }

  function getSlotName(node) {
    if (!node || !node.querySelector) {
      return "";
    }
    var input = node.querySelector("input");
    if (!input) {
      return normalizeProbeText(node.textContent || "");
    }
    return String(input.value || input.placeholder || input.textContent || "").trim();
  }

  function getFilterEventName(node) {
    if (!node || !node.querySelector) {
      return "";
    }
    var label = node.querySelector(".actionName");
    return String(label ? (label.textContent || "") : "").trim();
  }

  function isSelectedNode(node) {
    if (!node || !node.classList) {
      return false;
    }
    return node.classList.contains("selected") ||
      node.classList.contains("active") ||
      node.classList.contains("current");
  }

  function clickNode(node) {
    if (!node) {
      return false;
    }
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
    } catch (_ignore) {}
    return false;
  }

  function findSlotNodeByName(slotName) {
    var expected = normalizeProbeText(slotName);
    var slots = getSlotNodes();
    var fallback = null;

    for (var i = 0; i < slots.length; i += 1) {
      var slotNode = slots[i];
      var currentName = normalizeProbeText(getSlotName(slotNode));
      if (!currentName) {
        continue;
      }
      if (currentName === expected) {
        return slotNode;
      }
      if (fallback === null && currentName.indexOf(expected) >= 0) {
        fallback = slotNode;
      }
    }

    return fallback;
  }

  function normalizeEventKey(name) {
    var s = String(name || "").trim().toLowerCase();
    s = s.replace(/\s+/g, "");
    s = s.replace(/\([^)]*\)/g, "");
    return s;
  }

  function getFilterArgumentValues(filterNode) {
    var args = [];
    if (!filterNode || !filterNode.querySelectorAll) {
      return args;
    }

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
    } catch (_ignoreFilterArgs) {}

    return args;
  }

  function buildFilterDisplaySignature(eventName, args) {
    var safeEventName = String(eventName || "").trim();
    var safeArgs = args || [];
    var parts = [];
    for (var i = 0; i < safeArgs.length; i += 1) {
      parts.push(String(safeArgs[i] || "").trim());
    }
    return safeEventName + "(" + parts.join(", ") + ")";
  }

  function parseFilterDescriptor(filterEvent) {
    var raw = String(filterEvent || "").trim();
    var eventName = raw;
    var args = [];
    var hasArgs = false;
    var match = raw.match(/^([^()]+)\((.*)\)$/);
    if (match) {
      hasArgs = true;
      eventName = String(match[1] || "").trim();
      var rawArgs = String(match[2] || "").trim();
      if (rawArgs) {
        var parts = rawArgs.split(",");
        for (var i = 0; i < parts.length; i += 1) {
          var normalized = normalizeProbeText(parts[i]);
          if (normalized) {
            args.push(normalized);
          }
        }
      }
    }

    var eventKey = normalizeEventKey(eventName);
    return {
      raw: raw,
      eventName: eventName,
      eventKey: eventKey,
      args: args,
      hasArgs: hasArgs,
      signatureKey: eventKey + "|" + args.join("|")
    };
  }

  function getFilterInfo(filterNode, index) {
    var eventName = String(getFilterEventName(filterNode) || "").trim();
    var args = getFilterArgumentValues(filterNode);
    var eventKey = normalizeEventKey(eventName);
    return {
      node: filterNode,
      index: index,
      eventName: eventName,
      eventKey: eventKey,
      args: args,
      signatureKey: eventKey + "|" + args.join("|"),
      displaySignature: buildFilterDisplaySignature(eventName, args),
      visible: isElementVisible(filterNode),
      selected: isSelectedNode(filterNode),
      className: filterNode && filterNode.className ? String(filterNode.className) : ""
    };
  }

  function getAllFilterInfos() {
    var filterNodes = getFilterNodes(false);
    var infos = [];
    for (var i = 0; i < filterNodes.length; i += 1) {
      infos.push(getFilterInfo(filterNodes[i], i));
    }
    return infos;
  }

  function findFilterMatches(filterEvent) {
    var expected = parseFilterDescriptor(filterEvent);
    var allInfos = getAllFilterInfos();
    var infos = [];
    for (var i = 0; i < allInfos.length; i += 1) {
      if (allInfos[i].visible) {
        infos.push(allInfos[i]);
      }
    }
    if (infos.length <= 0) {
      infos = allInfos;
    }
    var matches = [];

    for (var i = 0; i < infos.length; i += 1) {
      var info = infos[i];
      if (!info.eventKey || info.eventKey !== expected.eventKey) {
        continue;
      }
      if (expected.hasArgs && info.signatureKey !== expected.signatureKey) {
        continue;
      }
      matches.push(info);
    }

    return {
      expected: expected,
      matches: matches
    };
  }

  function getSelectedVisibleFilterInfo() {
    var infos = getAllFilterInfos();
    for (var i = 0; i < infos.length; i += 1) {
      if (infos[i].visible && infos[i].selected) {
        return infos[i];
      }
    }
    return null;
  }

  function waitMsAsync(waitMs) {
    return new Promise(function(resolve) {
      window.setTimeout(resolve, Math.max(0, waitMs));
    });
  }

  function selectLuaEditorContext(slotName, filterEvent, minPauseMs) {
    ensureLuaEditorVisible();
    var rawSlotName = String(slotName || "").trim();
    var rawFilterEvent = String(filterEvent || "").trim();
    if (!rawSlotName) {
      throw new Error("slot_name_required");
    }
    if (!rawFilterEvent) {
      throw new Error("filter_name_required");
    }

    var expectedSlot = normalizeProbeText(rawSlotName);
    var requiredPauseMs = Math.max(1000, parseInt(String(minPauseMs || ""), 10) || 1000);
    var expectedFilter = parseFilterDescriptor(rawFilterEvent);

    return pollUntilAsync(
      function() {
        var snapshot = describeLuaEditor();
        if (normalizeProbeText(snapshot.selectedSlot) === expectedSlot) {
          return snapshot;
        }
        var slotNode = findSlotNodeByName(rawSlotName);
        if (!slotNode) {
          throw new Error("slot_not_found:" + rawSlotName);
        }
        if (!clickNode(slotNode)) {
          throw new Error("slot_click_failed:" + rawSlotName);
        }
        return null;
      },
      200,
      25,
      function() {
        return new Error("slot_select_not_observed:" + rawSlotName);
      }
    ).then(function() {
      return waitMsAsync(requiredPauseMs);
    }).then(function() {
      return pollUntilAsync(
        function() {
          var resolved = findFilterMatches(rawFilterEvent);
          if (resolved.matches.length > 1) {
            throw new Error("filter_ambiguous:" + rawFilterEvent + ":" + resolved.matches.length);
          }
          if (resolved.matches.length <= 0) {
            return null;
          }
          return resolved.matches[0];
        },
        240,
        25,
        function() {
          return new Error("filter_not_found:" + rawFilterEvent);
        }
      );
    }).then(function(filterInfo) {
      var selectedInfo = getSelectedVisibleFilterInfo();
      if (selectedInfo && selectedInfo.signatureKey === filterInfo.signatureKey) {
        return describeLuaEditor();
      }
      if (!clickNode(filterInfo.node)) {
        throw new Error("filter_click_failed:" + rawFilterEvent);
      }
      return pollUntilAsync(
        function() {
          var currentSelected = getSelectedVisibleFilterInfo();
          if (currentSelected && currentSelected.signatureKey === expectedFilter.signatureKey) {
            return describeLuaEditor();
          }
          return null;
        },
        200,
        25,
        function() {
          return new Error("filter_select_not_observed:" + rawFilterEvent);
        }
      );
    });
  }

  function filterRowHasChosenEvent(filterNode) {
    var raw = String(getFilterEventName(filterNode) || "").trim();
    if (!raw) {
      return false;
    }
    var t = normalizeProbeText(raw);
    if (!t || t.indexOf("select event") >= 0) {
      return false;
    }
    return true;
  }

  function isPromiseLike(value) {
    return !!value && (typeof value === "object" || typeof value === "function") && typeof value.then === "function";
  }

  function pollUntilAsync(stepFn, maxRounds, delayMs, timeoutErrorFactory) {
    var rounds = typeof maxRounds === "number" && maxRounds > 0 ? maxRounds : 60;
    var waitMs = typeof delayMs === "number" && delayMs >= 0 ? delayMs : 25;
    return new Promise(function(resolve, reject) {
      var round = 0;

      function tick() {
        var outcome = null;
        try {
          outcome = stepFn(round);
        } catch (err) {
          reject(err);
          return;
        }

        if (outcome) {
          resolve(outcome);
          return;
        }

        round += 1;
        if (round >= rounds) {
          if (typeof timeoutErrorFactory === "function") {
            try {
              reject(timeoutErrorFactory());
            } catch (timeoutErr) {
              reject(timeoutErr);
            }
          } else {
            reject(new Error("poll_timeout"));
          }
          return;
        }

        window.setTimeout(tick, waitMs);
      }

      tick();
    });
  }

  function dispatchMouse(kind, el) {
    if (!el || typeof el.dispatchEvent !== "function") {
      return;
    }
    try {
      if (typeof MouseEvent === "function") {
        el.dispatchEvent(new MouseEvent(kind, { bubbles: true, cancelable: true, view: window }));
      }
    } catch (_ignoreMouse) {}
  }

  function openFilterAddMenu(anchorFilter) {
    var wrap = anchorFilter.querySelector(".action_list_button_wrapper");
    var dd = anchorFilter.querySelector(".ddContainer");
    var kebab = anchorFilter.querySelector(".icon_kebab_menu");
    var hoverTarget = wrap || dd || kebab;
    if (!hoverTarget) {
      return false;
    }
    dispatchMouse("mouseenter", hoverTarget);
    dispatchMouse("mouseover", hoverTarget);
    dispatchMouse("mousemove", hoverTarget);
    if (kebab) {
      dispatchMouse("mouseenter", kebab);
      dispatchMouse("mouseover", kebab);
    }
    return true;
  }

  function nudgeFilterMenuOpen(anchorFilter) {
    var wrap = anchorFilter.querySelector(".action_list_button_wrapper");
    var target = wrap || anchorFilter.querySelector(".ddContainer");
    if (!target) {
      return;
    }
    dispatchMouse("mousedown", target);
    dispatchMouse("mouseup", target);
    openFilterAddMenu(anchorFilter);
  }

  function queryActionMenuItems(anchorFilter) {
    var ul = anchorFilter.querySelector("ul.actionsList");
    if (!ul || !ul.querySelectorAll) {
      return [];
    }
    return ul.querySelectorAll("li");
  }

  function findActionMenuItemForEvent(anchorFilter, wantKey) {
    var lis = queryActionMenuItems(anchorFilter);
    var j;
    for (j = 0; j < lis.length; j += 1) {
      var li = lis[j];
      var label = normalizeEventKey(li.textContent || "");
      if (!label) {
        continue;
      }
      if (label === wantKey || label.indexOf(wantKey) === 0 || wantKey.indexOf(label) === 0) {
        return li;
      }
    }
    return null;
  }

  function findLuaAddFilterButton() {
    var root = getLuaEditorRoot();
    var btn = null;
    if (root && root.querySelector) {
      btn = root.querySelector(".lua_add_filter_button");
    }
    if (!btn) {
      btn = document.querySelector("#dpu_editor .lua_add_filter_button");
    }
    return btn;
  }

  function clickLuaAddFilterButton() {
    var btn = findLuaAddFilterButton();
    if (!btn) {
      return false;
    }
    return clickNode(btn);
  }

  function pickUnsettledFilterRow() {
    var filters = getFilterNodes(true);
    var i;
    for (i = filters.length - 1; i >= 0; i -= 1) {
      if (!filterRowHasChosenEvent(filters[i])) {
        return filters[i];
      }
    }
    return null;
  }

  function waitForUnsettledFilterRowAsync(maxRounds, delayMs) {
    return pollUntilAsync(
      function() {
        return pickUnsettledFilterRow();
      },
      maxRounds,
      delayMs,
      function() {
        return new Error("add_filter_no_placeholder_row");
      }
    );
  }

  function addFilterByEventName(rawEventName) {
    ensureLuaEditorVisible();
    var wantKey = normalizeEventKey(rawEventName);
    if (!wantKey) {
      throw new Error("add_filter_empty_name");
    }

    var filters = getFilterNodes(true);
    var idx;
    for (idx = 0; idx < filters.length; idx += 1) {
      var fNode = filters[idx];
      if (!filterRowHasChosenEvent(fNode)) {
        continue;
      }
      if (normalizeEventKey(getFilterEventName(fNode)) === wantKey) {
        var presentSnap = describeLuaEditor();
        presentSnap.alreadyPresent = true;
        return presentSnap;
      }
    }

    return Promise.resolve()
      .then(function() {
        var anchor = pickUnsettledFilterRow();
        if (anchor) {
          return anchor;
        }

        var countBefore = getFilterNodes(true).length;
        var clickedAdd = clickLuaAddFilterButton();
        if (!clickedAdd) {
          if (!window.LUAEditorManager || typeof window.LUAEditorManager.addNewFilter !== "function") {
            throw new Error("add_filter_no_add_button");
          }
          window.LUAEditorManager.addNewFilter(true);
        }

        return waitForUnsettledFilterRowAsync(120, 25).catch(function(initialErr) {
          var filtersAfter = getFilterNodes(true).length;
          if (filtersAfter <= countBefore) {
            throw new Error("add_filter_no_new_row");
          }
          return waitForUnsettledFilterRowAsync(60, 25).catch(function() {
            throw initialErr;
          });
        });
      })
      .then(function(anchor) {
        if (!openFilterAddMenu(anchor)) {
          throw new Error("add_filter_no_menu_anchor");
        }

        return pollUntilAsync(
          function(round) {
            var choice = findActionMenuItemForEvent(anchor, wantKey);
            if (choice) {
              return {
                anchor: anchor,
                choice: choice
              };
            }
            if (round === 6 || round === 14 || round === 28) {
              nudgeFilterMenuOpen(anchor);
            }
            return null;
          },
          90,
          25,
          function() {
            return new Error("add_filter_option_not_found:" + rawEventName);
          }
        );
      })
      .then(function(step) {
        try {
          if (!clickNode(step.choice)) {
            throw new Error("add_filter_click_failed:" + rawEventName);
          }
        } catch (clickErr) {
          throw new Error("add_filter_click_failed:" + rawEventName + ":" + String(clickErr && clickErr.message ? clickErr.message : clickErr));
        }

        return pollUntilAsync(
          function() {
            if (normalizeEventKey(getFilterEventName(step.anchor)) !== wantKey) {
              return null;
            }
            var out = describeLuaEditor();
            out.added = String(rawEventName || "").trim();
            return out;
          },
          80,
          25,
          function() {
            return new Error("add_filter_selection_not_observed:" + rawEventName);
          }
        );
      });
  }

  function describeLuaEditor() {
    var root = getLuaEditorRoot();
    if (!isElementVisible(root)) {
      return {
        visible: false,
        title: "",
        wrapLines: false,
        canApply: false,
        codeLength: 0,
        selectedSlot: null,
        selectedFilter: null,
        slots: [],
        filters: []
      };
    }
    var titleNode = document.getElementById("lua_editor_title");
    var wrapNode = document.getElementById("lua_wrap_lines");
    var applyNode = document.getElementById("applyBtn");
    var codeMirror = getLuaEditorCodeMirror();
    var code = "";

    try {
      if (codeMirror && typeof codeMirror.getValue === "function") {
        code = codeMirror.getValue();
      }
    } catch (_ignore) {}

    var slots = [];
    var slotNodes = getSlotNodes();
    for (var i = 0; i < slotNodes.length; i += 1) {
      var slotNode = slotNodes[i];
      slots.push({
        name: getSlotName(slotNode),
        selected: isSelectedNode(slotNode),
        disabled: !!(slotNode.classList && slotNode.classList.contains("disabled"))
      });
    }

    var filters = [];
    var filterNodes = getFilterNodes(true);
    for (var j = 0; j < filterNodes.length; j += 1) {
      var filterNode = filterNodes[j];
      filters.push({
        event: getFilterEventName(filterNode),
        selected: isSelectedNode(filterNode)
      });
    }

    var selectedSlot = null;
    var selectedFilter = null;
    for (var s = 0; s < slots.length; s += 1) {
      if (slots[s].selected) {
        selectedSlot = slots[s].name;
        break;
      }
    }
    for (var f = 0; f < filters.length; f += 1) {
      if (filters[f].selected) {
        selectedFilter = filters[f].event;
        break;
      }
    }

    try {
      var manager = window.LUAEditorManager || null;
      var currentData = manager && manager.currentData ? manager.currentData : null;
      var currentSlot = currentData && currentData.currentSlot ? currentData.currentSlot : null;
      var currentFilter = currentData && currentData.currentFilter ? currentData.currentFilter : null;
      if (currentSlot && typeof currentSlot.name !== "undefined" && currentSlot.name !== null) {
        selectedSlot = String(currentSlot.name);
      }
      if (currentFilter) {
        if (typeof currentFilter.signature !== "undefined" && currentFilter.signature !== null && String(currentFilter.signature)) {
          selectedFilter = String(currentFilter.signature);
        } else if (typeof currentFilter.name !== "undefined" && currentFilter.name !== null && String(currentFilter.name)) {
          selectedFilter = String(currentFilter.name);
        }
      }
    } catch (_ignoreManagerSelection) {}

    try {
      if (typeof getResolvedActiveFilterDisplaySignature === "function") {
        var resolvedSelectedFilter = String(getResolvedActiveFilterDisplaySignature() || "").replace(/\s+/g, " ").trim();
        if (resolvedSelectedFilter) {
          selectedFilter = resolvedSelectedFilter;
        }
      }
    } catch (_ignoreResolvedSelectedFilter) {}

    return {
      visible: true,
      title: titleNode ? String(titleNode.textContent || "").trim() : "",
      wrapLines: !!(wrapNode && wrapNode.checked),
      canApply: isElementVisible(applyNode),
      codeLength: code.length,
      selectedSlot: selectedSlot,
      selectedFilter: selectedFilter,
      slots: slots,
      filters: filters
    };
  }

  function listLuaEditorFilters() {
    ensureLuaEditorVisible();
    var snapshot = describeLuaEditor();
    var infos = getAllFilterInfos();
    var details = [];
    for (var i = 0; i < infos.length; i += 1) {
      var info = infos[i];
      details.push({
        index: info.index,
        event: info.eventName,
        args: info.args,
        signature: info.displaySignature,
        selected: info.selected,
        visible: info.visible,
        className: info.className
      });
    }
    snapshot.filterDetails = details;
    return snapshot;
  }

  function selectSlotByName(slotName) {
    ensureLuaEditorVisible();
    var slotNode = findSlotNodeByName(slotName);
    if (!slotNode) {
      throw new Error("slot_not_found:" + slotName);
    }
    if (!clickNode(slotNode)) {
      throw new Error("slot_click_failed:" + slotName);
    }
    return describeLuaEditor();
  }

  function selectFilterByEvent(filterEvent) {
    ensureLuaEditorVisible();
    var resolved = findFilterMatches(filterEvent);
    if (resolved.matches.length <= 0) {
      throw new Error("filter_not_found:" + filterEvent);
    }
    if (resolved.matches.length > 1) {
      throw new Error("filter_ambiguous:" + filterEvent + ":" + resolved.matches.length);
    }
    var filterInfo = resolved.matches[0];
    if (!clickNode(filterInfo.node)) {
      throw new Error("filter_click_failed:" + filterEvent);
    }
    return describeLuaEditor();
  }

  function selectFilterByIndex(filterIndex) {
    ensureLuaEditorVisible();
    var wantedIndex = parseInt(String(filterIndex || ""), 10);
    if (!isFinite(wantedIndex)) {
      throw new Error("filter_index_invalid:" + filterIndex);
    }
    var infos = getAllFilterInfos();
    var filterInfo = null;
    for (var i = 0; i < infos.length; i += 1) {
      if (infos[i].index === wantedIndex) {
        filterInfo = infos[i];
        break;
      }
    }
    if (!filterInfo) {
      throw new Error("filter_index_not_found:" + wantedIndex);
    }
    if (!clickNode(filterInfo.node)) {
      throw new Error("filter_index_click_failed:" + wantedIndex);
    }
    return describeLuaEditor();
  }

  function setLuaEditorCode(code) {
    ensureLuaEditorVisible();
    var text = String(code || "");
    try {
      if (window.LUAEditorManager && typeof window.LUAEditorManager.setCodeLuaEditor === "function") {
        window.LUAEditorManager.setCodeLuaEditor(text);
        normalizeLuaEditorTrailingNewline(getLuaCodeMirror());
        return describeLuaEditor();
      }
    } catch (_ignoreSetCode) {}

    applyIdeCode(text);
    return describeLuaEditor();
  }

  function applyLuaEditorChanges() {
    ensureLuaEditorVisible();
    if (!window.LUAEditorManager || typeof window.LUAEditorManager.apply !== "function") {
      throw new Error("apply_unavailable");
    }
    window.LUAEditorManager.apply();
    return {
      applied: true
    };
  }

  function getScreenEditorPanel() {
    try {
      if (window.screenContentEditorPanel) {
        return window.screenContentEditorPanel;
      }
    } catch (_ignoreScreenPanel) {}
    return null;
  }

  function getScreenEditorRoot() {
    var panel = getScreenEditorPanel();
    try {
      if (panel && panel.HTMLNodes) {
        if (panel.HTMLNodes.main) {
          return panel.HTMLNodes.main;
        }
        if (panel.HTMLNodes.root) {
          return panel.HTMLNodes.root;
        }
        if (panel.HTMLNodes.panel) {
          return panel.HTMLNodes.panel;
        }
      }
    } catch (_ignoreScreenHtmlNodes) {}
    try {
      return document.querySelector(".screen_content_editor_panel");
    } catch (_ignoreScreenRootQuery) {}
    return null;
  }

  function getScreenEditorCodeNode(panel, root) {
    if (panel && panel.textEditor) {
      return panel.textEditor;
    }
    if (root && root.querySelector) {
      try {
        return root.querySelector("textarea");
      } catch (_ignoreScreenTextarea) {}
    }
    return null;
  }

  function getScreenEditorCodeMirror(root) {
    if (!root || !root.querySelector) {
      return null;
    }
    try {
      var cmNode = root.querySelector(".CodeMirror");
      if (cmNode && cmNode.CodeMirror) {
        return cmNode.CodeMirror;
      }
    } catch (_ignoreScreenCodeMirror) {}
    return null;
  }

  function getScreenEditorTitle(root) {
    if (!root || !root.querySelector) {
      return "";
    }
    try {
      var titleNode = root.querySelector(".header_block .panel_title");
      return titleNode ? String(titleNode.textContent || "").replace(/\s+/g, " ").trim() : "";
    } catch (_ignoreScreenTitleText) {}
    return "";
  }

  function getScreenEditorSubTitle(root) {
    if (!root || !root.querySelector) {
      return "";
    }
    try {
      var subTitleNode = root.querySelector(".content .top_line .sub_title_wrapper .sub_title");
      return subTitleNode ? String(subTitleNode.textContent || "").replace(/\s+/g, " ").trim() : "";
    } catch (_ignoreScreenSubTitleText) {}
    return "";
  }

  function getScreenEditorMode(panel, root) {
    var modeInputNode = null;
    try {
      if (root && root.querySelector) {
        modeInputNode = root.querySelector(".mode_switch_wrapper .checkbox_switch input");
      }
    } catch (_ignoreScreenModeInputLookup) {}

    if (!modeInputNode) {
      try {
        if (panel && panel.HTMLNodes && panel.HTMLNodes.isHTMLModeCheckbox) {
          modeInputNode = panel.HTMLNodes.isHTMLModeCheckbox;
        }
      } catch (_ignoreScreenModeInputFallback) {}
    }

    try {
      if (panel && typeof panel.isInHTMLMode === "boolean") {
        return panel.isInHTMLMode ? "html" : "lua";
      }
      if (modeInputNode && typeof modeInputNode.checked === "boolean") {
        return modeInputNode.checked ? "html" : "lua";
      }
    } catch (_ignoreScreenModeValue) {}

    return "lua";
  }

  function getScreenEditorContextSnapshot(root, panel) {
    var resolvedRoot = root || getScreenEditorRoot();
    var resolvedPanel = panel || getScreenEditorPanel();
    var title = getScreenEditorTitle(resolvedRoot);
    var subTitle = getScreenEditorSubTitle(resolvedRoot);
    var mode = getScreenEditorMode(resolvedPanel, resolvedRoot);
    return {
      title: title,
      subTitle: subTitle,
      mode: mode,
      contextKey: "screen:" + normalizeIdeSyncValue(title) + "::" + normalizeIdeSyncValue(subTitle) + "::" + normalizeIdeSyncValue(mode)
    };
  }

  function getScreenEditorCursorFromTextarea(codeNode) {
    if (!codeNode || typeof codeNode.value !== "string") {
      return {
        line: 0,
        ch: 0
      };
    }

    var text = String(codeNode.value || "");
    var selectionStart = typeof codeNode.selectionStart === "number" ? codeNode.selectionStart : 0;
    if (selectionStart < 0) {
      selectionStart = 0;
    }
    if (selectionStart > text.length) {
      selectionStart = text.length;
    }

    var beforeCursor = text.slice(0, selectionStart);
    var parts = beforeCursor.split(/\r\n?|\n/);
    var line = parts.length > 0 ? parts.length - 1 : 0;
    var ch = parts.length > 0 ? parts[parts.length - 1].length : 0;
    return {
      line: line,
      ch: ch
    };
  }

  function getTextareaOffsetForLineAndCh(text, line, ch) {
    var normalized = String(text || "").replace(/\r\n?/g, "\n");
    var wantedLine = typeof line === "number" && line >= 0 ? line : 0;
    var wantedCh = typeof ch === "number" && ch >= 0 ? ch : 0;
    var currentLine = 0;
    var idx = 0;
    while (currentLine < wantedLine && idx < normalized.length) {
      var nextNewline = normalized.indexOf("\n", idx);
      if (nextNewline < 0) {
        idx = normalized.length;
        break;
      }
      idx = nextNewline + 1;
      currentLine += 1;
    }

    var lineEnd = normalized.indexOf("\n", idx);
    if (lineEnd < 0) {
      lineEnd = normalized.length;
    }
    var maxCh = lineEnd - idx;
    return idx + Math.min(wantedCh, maxCh < 0 ? 0 : maxCh);
  }

  function hasRememberedScreenViewportForKey(key) {
    if (!key) {
      return false;
    }
    var remembered = state.screenScrollTopByContext[key];
    if (typeof remembered === "number") {
      return remembered >= 0;
    }
    return !!(remembered && typeof remembered === "object" && typeof remembered.topLine === "number" && remembered.topLine >= 0);
  }

  function rememberScreenEditorViewportForKey(keyHint) {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    if (!isElementVisible(root)) {
      return false;
    }

    var codeMirror = getScreenEditorCodeMirror(root);
    var codeNode = getScreenEditorCodeNode(panel, root);
    if (!codeMirror && !codeNode) {
      return false;
    }

    var context = getScreenEditorContextSnapshot(root, panel);
    var key = keyHint || context.contextKey || state.lastScreenContextKey || "screen:default";
    state.lastScreenContextKey = key;

    try {
      var topLine = 0;
      var cursorLine = 0;
      var cursorCh = 0;
      var scrollTopPx = 0;
      var hadFocus = false;

      if (codeMirror) {
        try {
          if (typeof codeMirror.getScrollInfo === "function") {
            var scrollInfo = codeMirror.getScrollInfo();
            scrollTopPx = scrollInfo && typeof scrollInfo.top === "number" ? scrollInfo.top : 0;
          }
        } catch (_ignoreScreenScrollInfo) {}

        try {
          if (typeof codeMirror.lineAtHeight === "function") {
            topLine = codeMirror.lineAtHeight(scrollTopPx, "local");
          }
        } catch (_ignoreScreenTopLine) {}

        try {
          if (typeof codeMirror.getCursor === "function") {
            var cursor = codeMirror.getCursor();
            if (cursor && typeof cursor.line === "number") {
              cursorLine = cursor.line;
            }
            if (cursor && typeof cursor.ch === "number") {
              cursorCh = cursor.ch;
            }
          }
        } catch (_ignoreScreenCursor) {}

        try {
          if (typeof codeMirror.hasFocus === "function") {
            hadFocus = codeMirror.hasFocus();
          }
        } catch (_ignoreScreenFocus) {}
      } else if (codeNode) {
        var textCursor = getScreenEditorCursorFromTextarea(codeNode);
        topLine = textCursor.line;
        cursorLine = textCursor.line;
        cursorCh = textCursor.ch;
        scrollTopPx = typeof codeNode.scrollTop === "number" ? codeNode.scrollTop : 0;
        hadFocus = document.activeElement === codeNode;
      }

      if (typeof topLine !== "number" || topLine < 0) {
        topLine = cursorLine >= 0 ? cursorLine : 0;
      }
      if (cursorLine < 0) {
        cursorLine = topLine;
      }
      if (cursorCh < 0) {
        cursorCh = 0;
      }

      state.screenScrollTopByContext[key] = {
        topLine: topLine,
        cursorLine: cursorLine,
        cursorCh: cursorCh,
        scrollTopPx: scrollTopPx,
        hadFocus: hadFocus
      };
      return true;
    } catch (_ignoreRememberScreenViewport) {}

    return false;
  }

  function restoreScreenEditorViewportForKey(keyHint) {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    if (!isElementVisible(root)) {
      return false;
    }

    var codeMirror = getScreenEditorCodeMirror(root);
    var codeNode = getScreenEditorCodeNode(panel, root);
    if (!codeMirror && !codeNode) {
      return false;
    }

    var context = getScreenEditorContextSnapshot(root, panel);
    var key = keyHint || context.contextKey || state.lastScreenContextKey;
    if (!key) {
      return false;
    }
    state.lastScreenContextKey = key;

    var remembered = state.screenScrollTopByContext[key];
    var rememberedTopLine = -1;
    var rememberedCursorLine = -1;
    var rememberedCursorCh = 0;
    var rememberedScrollTopPx = 0;
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
      if (typeof remembered.scrollTopPx === "number") {
        rememberedScrollTopPx = remembered.scrollTopPx;
      }
      shouldFocus = !!remembered.hadFocus;
    }

    if (typeof rememberedTopLine !== "number" || rememberedTopLine < 0) {
      return false;
    }

    try {
      var applyRestore = function() {
        if (codeMirror) {
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
            codeMirror.scrollTo(null, topPx > 0 ? topPx - 5 : 0);
          } else if (typeof codeMirror.scrollTo === "function") {
            codeMirror.scrollTo(null, rememberedScrollTopPx > 0 ? rememberedScrollTopPx : 0);
          }

          if (typeof codeMirror.setCursor === "function") {
            codeMirror.setCursor({ line: rememberedCursorLine, ch: rememberedCursorCh });
          }
          if (shouldFocus && typeof codeMirror.focus === "function") {
            codeMirror.focus();
          }
          return;
        }

        if (codeNode && typeof codeNode.value === "string") {
          var offset = getTextareaOffsetForLineAndCh(codeNode.value, rememberedCursorLine, rememberedCursorCh);
          try {
            codeNode.selectionStart = offset;
            codeNode.selectionEnd = offset;
          } catch (_ignoreScreenTextareaSelection) {}
          if (typeof codeNode.scrollTop === "number") {
            codeNode.scrollTop = rememberedScrollTopPx > 0 ? rememberedScrollTopPx : 0;
          }
          if (shouldFocus && typeof codeNode.focus === "function") {
            codeNode.focus();
          }
        }
      };

      applyRestore();
      window.setTimeout(applyRestore, 40);
      return true;
    } catch (_ignoreRestoreScreenViewport) {}

    return false;
  }

  function detachScreenViewportBindings(codeMirror) {
    if (!codeMirror) {
      return;
    }

    var handlers = codeMirror.__luaProbeScreenViewportHandlers;
    if (handlers && typeof codeMirror.off === "function") {
      try {
        if (typeof handlers.cursorActivity === "function") {
          codeMirror.off("cursorActivity", handlers.cursorActivity);
        }
      } catch (_ignoreScreenOffCursor) {}
      try {
        if (typeof handlers.scroll === "function") {
          codeMirror.off("scroll", handlers.scroll);
        }
      } catch (_ignoreScreenOffScroll) {}
      try {
        if (typeof handlers.changes === "function") {
          codeMirror.off("changes", handlers.changes);
        }
      } catch (_ignoreScreenOffChanges) {}
    }

    codeMirror.__luaProbeScreenViewportHandlers = null;
    codeMirror.__luaProbeScreenViewportBindingsBound = false;
    codeMirror.__luaProbeScreenViewportOwner = "";
  }

  function rememberActiveScreenViewportIfReady() {
    var context = getScreenEditorContextSnapshot();
    var key = context.contextKey || state.lastScreenContextKey;
    if (!key) {
      return;
    }
    state.lastScreenContextKey = key;
    if (state.screenLastRestoredContextKey !== key && hasRememberedScreenViewportForKey(key)) {
      return;
    }
    rememberScreenEditorViewportForKey(key);
  }

  function ensureScreenViewportBindings() {
    var root = getScreenEditorRoot();
    var codeMirror = getScreenEditorCodeMirror(root);
    if (!codeMirror || typeof codeMirror.on !== "function") {
      if (state.screenViewportBindingsCodeMirror) {
        detachScreenViewportBindings(state.screenViewportBindingsCodeMirror);
        state.screenViewportBindingsCodeMirror = null;
      }
      return;
    }

    if (state.screenViewportBindingsCodeMirror && state.screenViewportBindingsCodeMirror !== codeMirror) {
      detachScreenViewportBindings(state.screenViewportBindingsCodeMirror);
      state.screenViewportBindingsCodeMirror = null;
    }

    var owner = String(codeMirror.__luaProbeScreenViewportOwner || "");
    if ((owner && owner !== dumpId) || (!owner && codeMirror.__luaProbeScreenViewportBindingsBound)) {
      detachScreenViewportBindings(codeMirror);
    }

    if (String(codeMirror.__luaProbeScreenViewportOwner || "") === dumpId && codeMirror.__luaProbeScreenViewportHandlers) {
      state.screenViewportBindingsCodeMirror = codeMirror;
      return;
    }

    var handlers = {};
    handlers.cursorActivity = function () {
      rememberActiveScreenViewportIfReady();
    };
    handlers.scroll = function () {
      rememberActiveScreenViewportIfReady();
    };
    handlers.changes = function () {
      window.setTimeout(function () {
        rememberActiveScreenViewportIfReady();
      }, 0);
    };

    codeMirror.on("cursorActivity", handlers.cursorActivity);
    codeMirror.on("scroll", handlers.scroll);
    codeMirror.on("changes", handlers.changes);

    codeMirror.__luaProbeScreenViewportHandlers = handlers;
    codeMirror.__luaProbeScreenViewportBindingsBound = true;
    codeMirror.__luaProbeScreenViewportOwner = dumpId;
    state.screenViewportBindingsCodeMirror = codeMirror;
  }

  function parseIntegerOrNull(value) {
    var parsed = parseInt(String(value || "").replace(/[^\d-]/g, ""), 10);
    return isNaN(parsed) ? null : parsed;
  }

  function describeScreenEditor() {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    var codeMirror = getScreenEditorCodeMirror(root);
    var isVisible = isElementVisible(root);
    var wrapNode = null;
    var saveNode = null;
    var cancelNode = null;
    var errorCountNode = null;
    var enableLogsNode = null;
    var modeSwitchNode = null;
    var modeInputNode = null;
    var codeNode = getScreenEditorCodeNode(panel, root);
    var code = "";
    var context = getScreenEditorContextSnapshot(root, panel);
    var viewport = null;

    if (!isVisible) {
      return {
        surface: "screen_editor",
        visible: false,
        title: "",
        subTitle: "",
        contextKey: "",
        wrapLines: false,
        canApply: false,
        canCancel: false,
        codeLength: 0,
        isHtmlMode: false,
        mode: "",
        htmlModeAvailable: false,
        enableOutputInLuaChannel: false,
        errorCount: null,
        viewport: null
      };
    }

    if (root && root.querySelector) {
      try {
        wrapNode = root.querySelector(".wrap_line_wrapper .checkbox");
      } catch (_ignoreScreenWrap) {}
      try {
        saveNode = root.querySelector(".footer_line .right_block .save_button");
      } catch (_ignoreScreenSave) {}
      try {
        cancelNode = root.querySelector(".footer_line .right_block .cancel_button");
      } catch (_ignoreScreenCancel) {}
      try {
        errorCountNode = root.querySelector(".editor_error_ctn_value");
      } catch (_ignoreScreenErrorCount) {}
      try {
        enableLogsNode = root.querySelector(".enable_logs_wrapper .checkbox");
      } catch (_ignoreScreenEnableLogs) {}
      try {
        modeSwitchNode = root.querySelector(".mode_switch_wrapper .checkbox_switch");
      } catch (_ignoreScreenModeSwitch) {}
      try {
        modeInputNode = root.querySelector(".mode_switch_wrapper .checkbox_switch input");
      } catch (_ignoreScreenModeInput) {}
    }

    if (!modeInputNode) {
      try {
        if (panel && panel.HTMLNodes && panel.HTMLNodes.isHTMLModeCheckbox) {
          modeInputNode = panel.HTMLNodes.isHTMLModeCheckbox;
        }
      } catch (_ignoreScreenModeCheckbox) {}
    }

    try {
      if (codeMirror && typeof codeMirror.getValue === "function") {
        code = codeMirror.getValue();
      } else if (codeNode && typeof codeNode.value === "string") {
        code = codeNode.value;
      }
    } catch (_ignoreScreenCode) {}

    var isHtmlMode = context.mode === "html";

    var htmlModeAvailable = !!modeInputNode;
    try {
      if (modeSwitchNode && modeSwitchNode.classList && modeSwitchNode.classList.contains("disabled")) {
        htmlModeAvailable = false;
      }
    } catch (_ignoreScreenModeAvailable) {}

    var canApply = !!(saveNode && isElementVisible(saveNode));
    try {
      if (saveNode && saveNode.classList && saveNode.classList.contains("disabled")) {
        canApply = false;
      }
    } catch (_ignoreScreenSaveDisabled) {}
    if (!canApply) {
      canApply = !!(panel && codeNode && window.CPPScreenContentEditor && typeof window.CPPScreenContentEditor.save === "function");
    }

    try {
      if (codeMirror) {
        var scrollInfo = typeof codeMirror.getScrollInfo === "function" ? codeMirror.getScrollInfo() : null;
        var cursor = typeof codeMirror.getCursor === "function" ? codeMirror.getCursor() : null;
        viewport = {
          scrollTopPx: scrollInfo && typeof scrollInfo.top === "number" ? scrollInfo.top : 0,
          topLine: scrollInfo && typeof scrollInfo.top === "number" && typeof codeMirror.lineAtHeight === "function"
            ? codeMirror.lineAtHeight(scrollInfo.top, "local")
            : null,
          cursorLine: cursor && typeof cursor.line === "number" ? cursor.line : null,
          cursorCh: cursor && typeof cursor.ch === "number" ? cursor.ch : null
        };
      } else if (codeNode) {
        var textCursor = getScreenEditorCursorFromTextarea(codeNode);
        viewport = {
          scrollTopPx: typeof codeNode.scrollTop === "number" ? codeNode.scrollTop : 0,
          topLine: textCursor.line,
          cursorLine: textCursor.line,
          cursorCh: textCursor.ch
        };
      }
    } catch (_ignoreScreenViewport) {}

    return {
      surface: "screen_editor",
      visible: true,
      title: context.title,
      subTitle: context.subTitle,
      contextKey: context.contextKey,
      wrapLines: !!(wrapNode && wrapNode.checked),
      canApply: canApply,
      canCancel: !!(cancelNode && isElementVisible(cancelNode)),
      codeLength: code.length,
      isHtmlMode: !!isHtmlMode,
      mode: context.mode,
      htmlModeAvailable: !!htmlModeAvailable,
      enableOutputInLuaChannel: !!(enableLogsNode && enableLogsNode.checked),
      errorCount: parseIntegerOrNull(errorCountNode ? errorCountNode.textContent : ""),
      viewport: viewport
    };
  }

  function setScreenEditorCode(code) {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    var codeMirror = getScreenEditorCodeMirror(root);
    var codeNode = getScreenEditorCodeNode(panel, root);
    var hiddenTextarea = null;
    var text = String(code || "");
    if (root && root.querySelector) {
      try {
        hiddenTextarea = root.querySelector(".textarea_editor");
      } catch (_ignoreScreenHiddenTextarea) {}
    }
    if (!isElementVisible(root)) {
      throw new Error("screen_editor_not_visible");
    }
    if (!codeMirror && !codeNode && !hiddenTextarea) {
      throw new Error("screen_editor_unavailable");
    }
    try {
      if (codeMirror && typeof codeMirror.setValue === "function") {
        codeMirror.setValue(text);
      }
    } catch (_ignoreScreenCodeMirrorSet) {}
    try {
      if (codeNode && typeof codeNode.value === "string") {
        codeNode.value = text;
      }
    } catch (_ignoreScreenCodeNodeSet) {}
    try {
      if (hiddenTextarea && typeof hiddenTextarea.value === "string") {
        hiddenTextarea.value = text;
      }
    } catch (_ignoreScreenHiddenTextareaSet) {}
    try {
      if (panel && typeof panel._onCodeChange === "function") {
        panel._onCodeChange();
      }
    } catch (_ignoreScreenCodeChange) {}
    return describeScreenEditor();
  }

  function applyScreenEditorChanges() {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    var saveNode = null;
    var codeNode = getScreenEditorCodeNode(panel, root);
    if (!isElementVisible(root)) {
      throw new Error("screen_editor_not_visible");
    }
    if (root && root.querySelector) {
      try {
        saveNode = root.querySelector(".footer_line .right_block .save_button");
      } catch (_ignoreScreenSaveButton) {}
    }
    if (saveNode && clickNode(saveNode)) {
      return {
        applied: true,
        usedDomButton: true
      };
    }
    if (!panel || !codeNode || !window.CPPScreenContentEditor || typeof window.CPPScreenContentEditor.save !== "function") {
      throw new Error("apply_unavailable");
    }
    window.CPPScreenContentEditor.save(codeNode.value, !!panel.isInHTMLMode);
    return {
      applied: true,
      usedDomButton: false
    };
  }

  function cancelScreenEditorChanges() {
    var root = getScreenEditorRoot();
    var panel = getScreenEditorPanel();
    var cancelNode = null;
    var closeNode = null;
    function waitForScreenEditorClosedAsync(resultValue) {
      return pollUntilAsync(
        function() {
          var currentRoot = getScreenEditorRoot();
          if (!isElementVisible(currentRoot || root)) {
            return resultValue;
          }
          return null;
        },
        40,
        25,
        function() {
          return new Error("screen_editor_cancel_failed");
        }
      );
    }

    if (!isElementVisible(root)) {
      throw new Error("screen_editor_not_visible");
    }

    if (root && root.querySelector) {
      try {
        cancelNode = root.querySelector(".footer_line .right_block .cancel_button");
      } catch (_ignoreScreenCancelButton) {}
      try {
        closeNode = root.querySelector(".header_block .close_button");
      } catch (_ignoreScreenCloseButton) {}
    }

    if (cancelNode && dispatchMouseSequence(cancelNode)) {
      return waitForScreenEditorClosedAsync({
        cancelled: true,
        usedDomButton: true,
        usedCloseButton: false
      });
    }

    if (closeNode && dispatchMouseSequence(closeNode)) {
      return waitForScreenEditorClosedAsync({
        cancelled: true,
        usedDomButton: false,
        usedCloseButton: true
      });
    }

    try {
      if (panel && typeof panel.close === "function") {
        panel.close();
        return waitForScreenEditorClosedAsync({
          cancelled: true,
          usedDomButton: false,
          usedCloseButton: false,
          usedPanelClose: true
        });
      }
    } catch (_ignoreScreenPanelClose) {}

    throw new Error("screen_editor_cancel_failed");
  }

  function normalizeProbeTargetKind(targetKind) {
    var normalized = String(targetKind || "").trim().toLowerCase();
    if (normalized === "screen_editor") {
      return "screen_editor";
    }
    if (normalized === "hud_chat") {
      return "hud_chat";
    }
    return "lua_editor";
  }

  function describeProbeTarget(targetKind) {
    if (normalizeProbeTargetKind(targetKind) === "screen_editor") {
      return describeScreenEditor();
    }
    var luaSnapshot = describeLuaEditor();
    luaSnapshot.surface = "lua_editor";
    return luaSnapshot;
  }

  function setCodeForProbeTarget(targetKind, code) {
    if (normalizeProbeTargetKind(targetKind) === "screen_editor") {
      return setScreenEditorCode(code);
    }
    return setLuaEditorCode(code);
  }

  function applyChangesForProbeTarget(targetKind) {
    if (normalizeProbeTargetKind(targetKind) === "screen_editor") {
      return applyScreenEditorChanges();
    }
    return applyLuaEditorChanges();
  }

  function cancelChangesForProbeTarget(targetKind) {
    var normalized = normalizeProbeTargetKind(targetKind);
    if (normalized === "screen_editor") {
      return cancelScreenEditorChanges();
    }
    if (normalized === "lua_editor") {
      return cancelLuaEditorChanges();
    }
    throw new Error("unsupported_method_for_target:" + normalized + ":cancel");
  }

  function cancelLuaEditorChanges() {
    var root = getLuaEditorRoot();
    function waitForLuaEditorClosedAsync(resultValue) {
      return pollUntilAsync(
        function() {
          var currentRoot = getLuaEditorRoot();
          if (!isElementVisible(currentRoot || root)) {
            return resultValue;
          }
          return null;
        },
        40,
        25,
        function() {
          return new Error("lua_editor_cancel_failed");
        }
      );
    }
    if (!isElementVisible(root)) {
      throw new Error("lua_editor_not_visible");
    }
    var cancelNode = null;
    if (root && root.querySelector) {
      try {
        cancelNode = root.querySelector(".btn_bar .lua_editor_cancel_button");
      } catch (_ignore) {}
    }
    if (cancelNode && typeof cancelNode.click === "function") {
      cancelNode.click();
      return waitForLuaEditorClosedAsync({
        cancelled: true,
        editorClosed: !isElementVisible(getLuaEditorRoot())
      });
    }
    throw new Error("lua_editor_cancel_button_not_found");
  }

  var MAX_OUTER_HTML_CHARS = 3000000;

  function outerHtmlForTargetSelector(targetKind, rawSelector) {
    var normalizedTarget = normalizeProbeTargetKind(targetKind);
    var sel = String(rawSelector || "").trim();
    if (!sel) {
      sel = normalizedTarget === "screen_editor" ? ".screen_content_editor_panel" : "#filters";
    }
    var root = normalizedTarget === "screen_editor" ? getScreenEditorRoot() : getLuaEditorRoot();
    var el = null;
    try {
      if (root && typeof root.matches === "function" && root.matches(sel)) {
        el = root;
      }
    } catch (_ignoreRootMatch) {}
    try {
      if (!el && root && root.querySelector) {
        el = root.querySelector(sel);
      }
    } catch (_badSel) {}
    if (!el) {
      try {
        el = document.querySelector(sel);
      } catch (_badSel2) {}
    }
    if (!el) {
      throw new Error("outer_html_not_found:" + sel);
    }
    var html = "";
    try {
      html = typeof el.outerHTML === "string" ? el.outerHTML : "";
    } catch (_ignoreOh) {}
    html = html.replace(/<svg[\s\S]*?<\/svg>/gi, "");
    var originalLength = html.length;
    var truncated = false;
    if (html.length > MAX_OUTER_HTML_CHARS) {
      html = html.slice(0, MAX_OUTER_HTML_CHARS);
      truncated = true;
    }
    return {
      selector: sel,
      outerHTML: html,
      originalLength: originalLength,
      truncated: truncated
    };
  }

  function outerHtmlForSelector(rawSelector) {
    return outerHtmlForTargetSelector("lua_editor", rawSelector);
  }

  function trimChatText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function serializeChatClassList(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    var out = [];
    for (var i = 0; i < value.length && i < 8; i += 1) {
      var text = trimChatText(value[i]);
      if (!text) {
        continue;
      }
      out.push(text);
    }
    return out;
  }

  function readDomChatMessages(limit) {
    return readDomChatMessagesForChannel(limit, null);
  }

  function getChatRoot() {
    return document.querySelector(".main_chat");
  }

  function getChatView() {
    try {
      if (window.chatViewManager) {
        return window.chatViewManager.currentChatView || null;
      }
    } catch (_ignoreChatView) {}
    return null;
  }

  function getSelectedChatChannelData() {
    var currentView = getChatView();
    try {
      if (currentView && currentView._currentSelectedChannelView) {
        return currentView._currentSelectedChannelView.channelData || null;
      }
    } catch (_ignoreSelectedChatChannel) {}
    return null;
  }

  function getSelectedDomChatInfo() {
    var root = getChatRoot();
    var currentView = getChatView();
    var info = {
      channelId: null,
      channelName: null
    };
    var tabNode = null;

    try {
      if (currentView && currentView._currentSelectedChannelView && currentView._currentSelectedChannelView.HTMLNodes) {
        tabNode = currentView._currentSelectedChannelView.HTMLNodes.channelInput || null;
      }
    } catch (_ignoreCurrentTab) {}

    if (!tabNode && root && root.querySelector) {
      tabNode = root.querySelector(".channel_box .channel_btn.active_tab");
    }

    if (tabNode && typeof tabNode.getAttribute === "function") {
      var attrChannelId = trimChatText(tabNode.getAttribute("channel-id") || "");
      if (attrChannelId) {
        info.channelId = attrChannelId;
      }
      var labelNode = tabNode.querySelector ? tabNode.querySelector(".channel_label") : null;
      var tabChannelName = trimChatText(labelNode ? (labelNode.textContent || "") : "");
      if (tabChannelName) {
        info.channelName = tabChannelName;
      }
    }

    if (!info.channelName) {
      try {
        if (currentView && currentView.HTMLNodes && currentView.HTMLNodes.currentChannelLabel) {
          info.channelName = trimChatText(currentView.HTMLNodes.currentChannelLabel.textContent || "") || null;
        }
      } catch (_ignoreCurrentLabel) {}
    }

    if (!info.channelName && root && root.querySelector) {
      var currentChannelLabel = root.querySelector(".current_channel_label");
      info.channelName = trimChatText(currentChannelLabel ? (currentChannelLabel.textContent || "") : "") || null;
    }

    return info;
  }

  function buildChatChannelInfo(channelData, fallbackInfo) {
    var baseInfo = fallbackInfo || {};
    var channelId = null;
    var channelName = null;
    if (channelData && channelData.channelId != null) {
      channelId = trimChatText(String(channelData.channelId));
    }
    if (channelData && channelData.channelName != null) {
      channelName = trimChatText(String(channelData.channelName));
    }
    if (!channelId && baseInfo.channelId != null) {
      channelId = trimChatText(String(baseInfo.channelId));
    }
    if (!channelName && baseInfo.channelName != null) {
      channelName = trimChatText(String(baseInfo.channelName));
    }
    return {
      channelId: channelId || null,
      channelName: channelName || null
    };
  }

  function resolveActiveChatChannel() {
    var selectedChannel = getSelectedChatChannelData();
    var domInfo = getSelectedDomChatInfo();
    var info = buildChatChannelInfo(selectedChannel, domInfo);
    if (selectedChannel) {
      return {
        channel: selectedChannel,
        info: info
      };
    }
    if (info.channelId) {
      var channelFromManager = getChatChannelDataById(info.channelId);
      return {
        channel: channelFromManager,
        info: buildChatChannelInfo(channelFromManager, info)
      };
    }
    return {
      channel: null,
      info: info
    };
  }

  function serializeChatMessage(message, channelInfo) {
    if (!message) {
      return null;
    }

    var info = channelInfo || {};
    var dateValue = null;
    if (typeof message.date === "number" && isFinite(message.date)) {
      dateValue = message.date;
    } else if (typeof message.date === "string" && trimChatText(message.date)) {
      dateValue = trimChatText(message.date);
    }

    return {
      channelId: typeof info.channelId === "string" && info.channelId ? info.channelId : null,
      channelName: typeof info.channelName === "string" && info.channelName ? info.channelName : null,
      fromId: typeof message.fromId === "number" && isFinite(message.fromId) ? message.fromId : null,
      fromName: trimChatText(message.fromName || "") || null,
      text: trimChatText(message.sendText || ""),
      fromMe: !!message.fromMe,
      isAdmin: !!message.isAdmin,
      isCommunityHelper: !!message.isCommunityHelper,
      isNotification: !(typeof message.fromId === "number" && message.fromId > 0),
      date: dateValue,
      className: serializeChatClassList(message.className)
    };
  }

  function readDomChatMessagesForChannel(limit, channelInfo) {
    var size = typeof limit === "number" && limit > 0 ? limit : 20;
    var nodes = document.querySelectorAll(".main_chat .chat_wrapper .message_queue li");
    var start = nodes.length > size ? nodes.length - size : 0;
    var messages = [];
    var info = channelInfo || {};
    var i;
    for (i = start; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || !node.querySelector) {
        continue;
      }
      var nameNode = node.querySelector(".name");
      var messageNode = node.querySelector(".message");
      var text = trimChatText(messageNode ? (messageNode.textContent || "") : node.textContent || "");
      if (!text) {
        continue;
      }
      messages.push({
        channelId: typeof info.channelId === "string" && info.channelId ? info.channelId : null,
        channelName: typeof info.channelName === "string" && info.channelName ? info.channelName : null,
        fromId: null,
        fromName: trimChatText(nameNode ? (nameNode.textContent || "") : "") || null,
        text: text,
        fromMe: !!(nameNode && nameNode.classList && nameNode.classList.contains("user_link")),
        isAdmin: !!(messageNode && messageNode.classList && messageNode.classList.contains("admin")),
        isCommunityHelper: !!(messageNode && messageNode.classList && messageNode.classList.contains("community_helper")),
        isNotification: !(nameNode && trimChatText(nameNode.textContent || "")),
        date: null,
        className: []
      });
    }
    return messages;
  }

  function captureChatSnapshot() {
    var root = getChatRoot();
    var wrapper = root && root.querySelector ? root.querySelector(".chat_wrapper") : null;
    var selectedChannel = null;
    var currentView = getChatView();
    var domInfo = getSelectedDomChatInfo();
    var channelInfo = null;
    var messages = [];
    var source = "dom";
    var limit = 20;
    selectedChannel = getSelectedChatChannelData();
    channelInfo = buildChatChannelInfo(selectedChannel, domInfo);

    if (selectedChannel && Array.isArray(selectedChannel.messageList)) {
      source = "chat_manager";
      var start = selectedChannel.messageList.length > limit ? selectedChannel.messageList.length - limit : 0;
      var i;
      for (i = start; i < selectedChannel.messageList.length; i += 1) {
        var serialized = serializeChatMessage(selectedChannel.messageList[i], channelInfo);
        if (!serialized || !serialized.text) {
          continue;
        }
        messages.push(serialized);
      }
    } else {
      messages = readDomChatMessagesForChannel(limit, channelInfo);
    }

    return {
      visible: isElementVisible(wrapper || root),
      open: !!(currentView && currentView.showState),
      source: source,
      selectedChannelId: channelInfo.channelId,
      selectedChannelName: channelInfo.channelName,
      messageCount: messages.length,
      messages: messages
    };
  }

  function emitChatSnapshot(commandId, snapshot) {
    sendPacket("chat_snapshot", {
      commandId: String(commandId || ""),
      snapshot: snapshot || {}
    });
  }

  function emitChatSendResult(commandId, success, result, errorMessage) {
    sendPacket("chat_send_result", {
      commandId: String(commandId || ""),
      success: !!success,
      result: success ? serializeProbeValue(result, 0) : null,
      error: success ? null : String(errorMessage || "unknown_error")
    });
  }

  function emitChatChannelResult(commandId, success, result, errorMessage) {
    sendPacket("chat_channel_result", {
      commandId: String(commandId || ""),
      success: !!success,
      result: success ? serializeProbeValue(result, 0) : null,
      error: success ? null : String(errorMessage || "unknown_error")
    });
  }

  function getChatManagerSafe() {
    try {
      if (typeof chatManager !== "undefined" && chatManager) {
        return chatManager;
      }
    } catch (_ignoreChatManagerGlobal) {}
    try {
      return window.chatManager || null;
    } catch (_ignoreChatManager) {}
    return null;
  }

  function getChatChannelDataById(channelId) {
    var normalizedId = trimChatText(channelId || "");
    if (!normalizedId) {
      return null;
    }
    var manager = getChatManagerSafe();
    if (!manager || typeof manager.getChannelData !== "function") {
      return null;
    }
    try {
      return manager.getChannelData(normalizedId) || null;
    } catch (_ignoreGetChannel) {}
    return null;
  }

  function getChatMessageInputNode() {
    var root = getChatRoot();
    if (root && root.querySelector) {
      var input = root.querySelector(".input_message");
      if (input) {
        return input;
      }
    }
    return document.querySelector(".main_chat .input_message");
  }

  function getChatSendButtonNode() {
    var root = getChatRoot();
    if (root && root.querySelector) {
      var button = root.querySelector(".buttons_chat_send_message");
      if (button) {
        return button;
      }
    }
    return document.querySelector(".main_chat .buttons_chat_send_message");
  }

  function setTextInputValue(node, value) {
    if (!node) {
      return false;
    }
    try {
      var proto = Object.getPrototypeOf(node);
      var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
      if (descriptor && typeof descriptor.set === "function") {
        descriptor.set.call(node, String(value == null ? "" : value));
      } else {
        node.value = String(value == null ? "" : value);
      }
      return true;
    } catch (_ignoreSetValue) {}
    try {
      node.value = String(value == null ? "" : value);
      return true;
    } catch (_ignoreDirectValue) {}
    return false;
  }

  function dispatchBasicDomEvent(node, type) {
    if (!node) {
      return false;
    }
    try {
      var eventObject = document.createEvent("Event");
      eventObject.initEvent(String(type || ""), true, true);
      return !!node.dispatchEvent(eventObject);
    } catch (_ignoreBasicEvent) {}
    return false;
  }

  function clickDomNodeCompat(node) {
    if (!node) {
      return false;
    }
    if (clickNode(node)) {
      return true;
    }
    try {
      var mouseEvent = document.createEvent("MouseEvents");
      mouseEvent.initMouseEvent("click", true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
      return !!node.dispatchEvent(mouseEvent);
    } catch (_ignoreMouseEvent) {}
    return false;
  }

  function dispatchMouseSequence(node) {
    if (!node) {
      return false;
    }
    dispatchMouse("mouseenter", node);
    dispatchMouse("mouseover", node);
    dispatchMouse("mousemove", node);
    dispatchMouse("mousedown", node);
    dispatchMouse("mouseup", node);
    return clickDomNodeCompat(node);
  }

  function pushUniqueNode(nodes, node) {
    if (!node) {
      return;
    }
    if (nodes.indexOf(node) >= 0) {
      return;
    }
    nodes.push(node);
  }

  function getChatTabActivationTargets(tab) {
    var nodes = [];
    if (!tab) {
      return nodes;
    }
    pushUniqueNode(nodes, tab);
    if (tab.querySelector) {
      pushUniqueNode(nodes, tab.querySelector(".channel_label"));
      pushUniqueNode(nodes, tab.querySelector(".channel_name"));
      pushUniqueNode(nodes, tab.querySelector(".channel_input"));
      pushUniqueNode(nodes, tab.querySelector("input"));
      pushUniqueNode(nodes, tab.querySelector("span"));
      pushUniqueNode(nodes, tab.querySelector("svg"));
      pushUniqueNode(nodes, tab.querySelector("use"));
    }
    if (tab.children && tab.children.length) {
      for (var i = 0; i < tab.children.length; i += 1) {
        pushUniqueNode(nodes, tab.children[i]);
      }
    }
    return nodes;
  }

  function activateDomChatTab(tab) {
    var targets = getChatTabActivationTargets(tab);
    var activated = false;
    for (var i = 0; i < targets.length; i += 1) {
      activated = dispatchMouseSequence(targets[i]) || activated;
    }
    return activated;
  }

  function waitForChatChannelAvailableAsync(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    return pollUntilAsync(
      function() {
        return getChatChannelDataById(targetChannelId) || findDomChatTabByChannelId(targetChannelId);
      },
      200,
      25,
      function() {
        return new Error("chat_channel_available_timeout:" + targetChannelId);
      }
    );
  }

  function parseJoinChannelCommand(rawMessage) {
    var message = String(rawMessage == null ? "" : rawMessage);
    var match = /^\s*\/join\s+([A-Za-z0-9+_-]{3,10})\s*$/i.exec(message);
    if (!match) {
      return null;
    }
    var channelName = validateCustomChannelName(match[1]);
    return {
      channelName: channelName,
      expectedChannelId: buildCustomChannelId(channelName)
    };
  }

  function submitChatMessageThroughUiAsync(message) {
    var input = getChatMessageInputNode();
    var sendButton = getChatSendButtonNode();
    if (!input || !sendButton || !isElementVisible(input) || !isElementVisible(sendButton)) {
      return Promise.resolve(false);
    }

    try {
      input.focus();
    } catch (_ignoreChatInputFocus) {}

    if (!setTextInputValue(input, message)) {
      return Promise.resolve(false);
    }

    dispatchBasicDomEvent(input, "input");
    dispatchBasicDomEvent(input, "change");

    if (!clickDomNodeCompat(sendButton)) {
      return Promise.resolve(false);
    }

    return new Promise(function(resolve) {
      var attempts = 0;
      var maxAttempts = 40;
      function checkCleared() {
        if (trimChatText(input.value || "") === "") {
          resolve(true);
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          resolve(false);
          return;
        }
        window.setTimeout(checkCleared, 25);
      }
      checkCleared();
    });
  }

  function buildCustomChannelId(channelName) {
    return "room_" + String(channelName || "").toLowerCase();
  }

  function validateCustomChannelName(rawName) {
    var name = trimChatText(rawName || "");
    if (!/^[A-Za-z0-9+_-]{3,10}$/.test(name)) {
      throw new Error("chat_channel_invalid_name");
    }
    return name;
  }

  function findDomChatTabByChannelId(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    if (!targetChannelId) {
      return null;
    }
    var tabs = document.querySelectorAll(".main_chat .channel_box .channel_btn");
    var i;
    for (i = 0; i < tabs.length; i += 1) {
      var tab = tabs[i];
      if (!tab || typeof tab.getAttribute !== "function") {
        continue;
      }
      if (trimChatText(tab.getAttribute("channel-id") || "") === targetChannelId) {
        return tab;
      }
    }
    return null;
  }

  function waitForSelectedChatChannelAsync(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    return pollUntilAsync(
      function() {
        var selected = getSelectedChatChannelData();
        if (selected && String(selected.channelId || "") === targetChannelId) {
          return selected;
        }
        var domInfo = getSelectedDomChatInfo();
        if (domInfo.channelId === targetChannelId) {
          return getChatChannelDataById(targetChannelId) || {
            channelId: targetChannelId,
            channelName: domInfo.channelName
          };
        }
        return null;
      },
      160,
      25,
      function() {
        return new Error("chat_select_timeout:" + targetChannelId);
      }
    );
  }

  function selectChatChannelById(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    if (!targetChannelId) {
      throw new Error("chat_select_missing_channel");
    }
    var active = resolveActiveChatChannel();
    if (active.info.channelId === targetChannelId) {
      return Promise.resolve(active.channel || {
        channelId: active.info.channelId,
        channelName: active.info.channelName
      });
    }
    var currentView = getChatView();
    var canUseCurrentView = !!(currentView && typeof currentView.selectChannel === "function");
    var domTab = findDomChatTabByChannelId(targetChannelId);
    if (!canUseCurrentView && !domTab) {
      throw new Error("chat_select_unavailable");
    }
    function triggerCurrentViewSelect() {
      if (!canUseCurrentView) {
        return false;
      }
      try {
        currentView.selectChannel(targetChannelId);
        return true;
      } catch (_ignoreSelectChannel) {}
      return false;
    }
    function triggerDomSelect(tab) {
      if (!tab) {
        return false;
      }
      return activateDomChatTab(tab);
    }

    var triggered = false;
    if (domTab) {
      triggered = triggerDomSelect(domTab);
    }
    if (!triggered && canUseCurrentView) {
      triggered = triggerCurrentViewSelect();
    }
    if (!triggered) {
      throw new Error("chat_select_click_failed:" + targetChannelId);
    }

    return waitForSelectedChatChannelAsync(targetChannelId)
      .catch(function(_firstError) {
        var refreshedTab = findDomChatTabByChannelId(targetChannelId) || domTab;
        if (refreshedTab && triggerDomSelect(refreshedTab)) {
          return waitForSelectedChatChannelAsync(targetChannelId);
        }
        throw _firstError;
      })
      .catch(function(_secondError) {
        if (!canUseCurrentView) {
          throw _secondError;
        }
        triggerCurrentViewSelect();
        return waitForSelectedChatChannelAsync(targetChannelId);
      });
  }

  function ensureChatChannelSelected(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    if (!targetChannelId) {
      throw new Error("chat_send_missing_channel");
    }
    var active = resolveActiveChatChannel();
    if (active.info.channelId === targetChannelId) {
      return Promise.resolve(active.channel || {
        channelId: active.info.channelId,
        channelName: active.info.channelName
      });
    }
    var channel = getChatChannelDataById(targetChannelId);
    if (!channel) {
      throw new Error("chat_channel_not_found:" + targetChannelId);
    }
    return selectChatChannelById(targetChannelId);
  }

  function selectExistingChatChannel(rawChannelId) {
    var targetChannelId = trimChatText(rawChannelId || "");
    if (!targetChannelId) {
      throw new Error("chat_select_missing_channel");
    }
    return ensureChatChannelSelected(targetChannelId).then(function(selectedChannel) {
      var info = buildChatChannelInfo(selectedChannel, {
        channelId: targetChannelId,
        channelName: null
      });
      return {
        requestedChannelName: info.channelName,
        expectedChannelId: targetChannelId,
        existed: true,
        selected: true,
        channelId: info.channelId,
        channelName: info.channelName
      };
    });
  }

  function sendChatMessage(rawMessage, rawChannelId) {
    var message = String(rawMessage == null ? "" : rawMessage);
    if (!trimChatText(message)) {
      throw new Error("chat_send_empty_message");
    }

    var targetChannelId = trimChatText(rawChannelId || "");
    return Promise.resolve()
      .then(function() {
        if (targetChannelId) {
          return ensureChatChannelSelected(targetChannelId);
        }
        var active = resolveActiveChatChannel();
        if (!active.info.channelId) {
          throw new Error("chat_send_no_selected_channel");
        }
        return active.channel || {
          channelId: active.info.channelId,
          channelName: active.info.channelName
        };
      })
      .then(function(selectedChannel) {
        var resolvedChannelId = trimChatText(selectedChannel && selectedChannel.channelId != null ? String(selectedChannel.channelId) : targetChannelId);
        if (!resolvedChannelId) {
          throw new Error("chat_send_no_selected_channel");
        }
        var info = buildChatChannelInfo(selectedChannel, {
          channelId: resolvedChannelId,
          channelName: null
        });
        var joinCommand = parseJoinChannelCommand(message);
        return submitChatMessageThroughUiAsync(message).then(function(sentViaUi) {
          if (!sentViaUi) {
            var manager = getChatManagerSafe();
            if (!manager || typeof manager.sendMessageToCPP !== "function") {
              throw new Error("chat_send_unavailable");
            }
            manager.sendMessageToCPP(resolvedChannelId, message);
          }
          var result = {
            sent: true,
            channelId: info.channelId,
            channelName: info.channelName,
            message: message,
            usedExplicitChannel: !!targetChannelId
          };
          if (!joinCommand) {
            return result;
          }
          return waitForChatChannelAvailableAsync(joinCommand.expectedChannelId)
            .then(function() {
              return selectChatChannelById(joinCommand.expectedChannelId);
            })
            .then(function(joinedChannel) {
              var joinedInfo = buildChatChannelInfo(joinedChannel, {
                channelId: joinCommand.expectedChannelId,
                channelName: joinCommand.channelName
              });
              result.channelId = joinedInfo.channelId;
              result.channelName = joinedInfo.channelName;
              return result;
            });
        });
      });
  }

  function createOrJoinChatChannel(rawChannelName) {
    var manager = getChatManagerSafe();
    if (!manager || typeof manager.getChannelData !== "function") {
      throw new Error("chat_channel_manager_unavailable");
    }
    var channelName = validateCustomChannelName(rawChannelName);
    var expectedChannelId = buildCustomChannelId(channelName);
    var existingChannel = getChatChannelDataById(expectedChannelId);
    if (existingChannel) {
      return selectChatChannelById(expectedChannelId).then(function(selectedChannel) {
        var info = buildChatChannelInfo(selectedChannel || existingChannel, {
          channelId: expectedChannelId,
          channelName: channelName
        });
        return {
          requestedChannelName: channelName,
          expectedChannelId: expectedChannelId,
          existed: true,
          selected: true,
          channelId: info.channelId,
          channelName: info.channelName
        };
      });
    }

    var active = resolveActiveChatChannel();
    if (!active.info.channelId) {
      throw new Error("chat_channel_no_selected_channel");
    }

    return sendChatMessage("/join " + channelName, String(active.info.channelId))
      .then(function() {
        return pollUntilAsync(
          function() {
            return getChatChannelDataById(expectedChannelId);
          },
          120,
          50,
          function() {
            return new Error("chat_channel_join_timeout:" + expectedChannelId);
          }
        );
      })
      .then(function() {
        return selectChatChannelById(expectedChannelId);
      })
      .then(function(selectedChannel) {
        var info = buildChatChannelInfo(selectedChannel, {
          channelId: expectedChannelId,
          channelName: channelName
        });
        return {
          requestedChannelName: channelName,
          expectedChannelId: expectedChannelId,
          existed: false,
          selected: true,
          channelId: info.channelId,
          channelName: info.channelName
        };
      });
  }

  function runRawProbeEval(source) {
    var src = String(source || "").trim();
    if (!src) {
      throw new Error("raw_eval_empty");
    }
    var st = window.__UI_EXTRACTOR_LUA_PROBE_STATE__;
    if (!st) {
      throw new Error("raw_eval_no_state");
    }
    var factory = new Function("state", '"use strict"; ' + src);
    return factory(st);
  }

  function serializeProbeValue(value, depth) {
    var maxDepth = typeof depth === "number" ? depth : 0;
    if (value === null || typeof value === "undefined") {
      return value;
    }
    if (maxDepth > 4) {
      return "[max-depth]";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      var out = [];
      for (var i = 0; i < value.length && i < 64; i += 1) {
        out.push(serializeProbeValue(value[i], maxDepth + 1));
      }
      return out;
    }
    if (typeof value === "object") {
      var obj = {};
      var keys = [];
      try {
        keys = Object.keys(value);
      } catch (_ignoreKeys) {
        return "[unserializable-object]";
      }
      for (var j = 0; j < keys.length && j < 64; j += 1) {
        var key = keys[j];
        obj[key] = serializeProbeValue(value[key], maxDepth + 1);
      }
      return obj;
    }
    return String(value);
  }

  function emitMcpResult(commandId, method, success, result, errorMessage, targetKind) {
    var payload = {
      commandId: String(commandId || ""),
      method: String(method || ""),
      success: !!success,
      result: success ? serializeProbeValue(result, 0) : null,
      error: success ? null : String(errorMessage || "unknown_error"),
      targetKind: normalizeProbeTargetKind(targetKind)
    };
    var payloadJson = "";
    try {
      payloadJson = JSON.stringify(payload);
    } catch (_ignoreSerialize) {}

    if (payloadJson && payloadJson.length > mcpResultChunkSize) {
      sendJsonPacketChunked("lua_mcp_result", payload, mcpResultChunkSize);
      return;
    }

    sendPacket("lua_mcp_result", payload);
  }

  function emitCommandResultForMethod(commandId, targetKind, method, success, result, errorMessage) {
    if (method === "chat_snapshot") {
      if (success) {
        emitChatSnapshot(commandId, result);
      }
      return;
    }
    if (method === "chat_send") {
      emitChatSendResult(commandId, success, result, errorMessage);
      emitMcpResult(commandId, method, success, result, errorMessage, targetKind);
      return;
    }
    if (method === "chat_join_channel" || method === "chat_select_channel") {
      emitChatChannelResult(commandId, success, result, errorMessage);
      emitMcpResult(commandId, method, success, result, errorMessage, targetKind);
      return;
    }
    emitMcpResult(commandId, method, success, result, errorMessage, targetKind);
  }

  function invokeMcpCommandForTarget(commandId, targetKind, method, args) {
    var normalizedTarget = normalizeProbeTargetKind(targetKind);
    var normalizedMethod = String(method || "").trim().toLowerCase();
    var listArgs = Array.isArray(args) ? args : [];

    try {
      var result = null;
      if (normalizedMethod === "describe") {
        if (normalizedTarget === "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = describeProbeTarget(normalizedTarget);
      } else if (normalizedMethod === "chat_snapshot") {
        if (normalizedTarget !== "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = captureChatSnapshot();
      } else if (normalizedMethod === "chat_send") {
        if (normalizedTarget !== "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = sendChatMessage(listArgs[0], listArgs[1]);
      } else if (normalizedMethod === "chat_join_channel") {
        if (normalizedTarget !== "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = createOrJoinChatChannel(listArgs[0]);
      } else if (normalizedMethod === "chat_select_channel") {
        if (normalizedTarget !== "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectExistingChatChannel(listArgs[0]);
      } else if (normalizedMethod === "select_slot") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectSlotByName(listArgs[0]);
      } else if (normalizedMethod === "select_filter") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectFilterByEvent(listArgs[0]);
      } else if (normalizedMethod === "select_context") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectLuaEditorContext(listArgs[0], listArgs[1], listArgs[2]);
      } else if (normalizedMethod === "select_filter_index") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectFilterByIndex(listArgs[0]);
      } else if (normalizedMethod === "list_filters") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = listLuaEditorFilters();
      } else if (normalizedMethod === "set_code") {
        result = setCodeForProbeTarget(normalizedTarget, listArgs[0]);
      } else if (normalizedMethod === "apply") {
        result = applyChangesForProbeTarget(normalizedTarget);
      } else if (normalizedMethod === "cancel") {
        result = cancelChangesForProbeTarget(normalizedTarget);
      } else if (normalizedMethod === "add_filter") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = addFilterByEventName(listArgs[0]);
      } else if (normalizedMethod === "outer_html") {
        result = outerHtmlForTargetSelector(normalizedTarget, listArgs[0]);
      } else if (normalizedMethod === "raw_eval") {
        result = runRawProbeEval(listArgs[0]);
      } else {
        throw new Error("unsupported_method:" + normalizedMethod);
      }

      if (isPromiseLike(result)) {
        result.then(function(asyncResult) {
          emitCommandResultForMethod(commandId, normalizedTarget, normalizedMethod, true, asyncResult, null);
        }).catch(function(asyncErr) {
          var asyncMessage = String(asyncErr && asyncErr.message ? asyncErr.message : asyncErr);
          emitCommandResultForMethod(commandId, normalizedTarget, normalizedMethod, false, null, asyncMessage);
        });
        return null;
      }

      emitCommandResultForMethod(commandId, normalizedTarget, normalizedMethod, true, result, null);
      return result;
    } catch (err) {
      var message = String(err && err.message ? err.message : err);
      emitCommandResultForMethod(commandId, normalizedTarget, normalizedMethod, false, null, message);
      throw err;
    }
  }

  function invokeMcpCommand(commandId, method, args) {
    return invokeMcpCommandForTarget(commandId, "lua_editor", method, args);
  }

  state.describeLuaEditor = describeLuaEditor;
  state.describeScreenEditor = describeScreenEditor;
  state.getScreenEditorContextSnapshot = getScreenEditorContextSnapshot;
  state.selectSlotByName = selectSlotByName;
  state.selectFilterByEvent = selectFilterByEvent;
  state.selectLuaEditorContext = selectLuaEditorContext;
  state.selectFilterByIndex = selectFilterByIndex;
  state.listLuaEditorFilters = listLuaEditorFilters;
  state.setLuaEditorCode = setLuaEditorCode;
  state.setScreenEditorCode = setScreenEditorCode;
  state.applyLuaEditorChanges = applyLuaEditorChanges;
  state.applyScreenEditorChanges = applyScreenEditorChanges;
  state.hasRememberedScreenViewportForKey = hasRememberedScreenViewportForKey;
  state.rememberScreenEditorViewportForKey = rememberScreenEditorViewportForKey;
  state.restoreScreenEditorViewportForKey = restoreScreenEditorViewportForKey;
  state.detachScreenViewportBindings = detachScreenViewportBindings;
  state.ensureScreenViewportBindings = ensureScreenViewportBindings;
  state.addFilterByEventName = addFilterByEventName;
  state.captureChatSnapshot = captureChatSnapshot;
  state.sendChatMessage = sendChatMessage;
  state.createOrJoinChatChannel = createOrJoinChatChannel;
  state.outerHtmlForSelector = outerHtmlForSelector;
  state.runRawProbeEval = runRawProbeEval;
  state.invokeMcpCommandForTarget = invokeMcpCommandForTarget;
  state.invokeMcpCommand = invokeMcpCommand;
  state.mcp = {
    invokeForTarget: invokeMcpCommandForTarget,
    invoke: invokeMcpCommand,
    describeLuaEditor: describeLuaEditor,
    describeScreenEditor: describeScreenEditor,
    selectSlotByName: selectSlotByName,
    selectFilterByEvent: selectFilterByEvent,
    selectContext: selectLuaEditorContext,
    selectFilterByIndex: selectFilterByIndex,
    listFilters: listLuaEditorFilters,
    setCode: setLuaEditorCode,
    setScreenCode: setScreenEditorCode,
    apply: applyLuaEditorChanges,
    applyScreen: applyScreenEditorChanges,
    addFilter: addFilterByEventName,
    chatSnapshot: captureChatSnapshot,
    chatSend: sendChatMessage,
    chatJoinChannel: createOrJoinChatChannel,
    outerHtml: outerHtmlForSelector,
    rawEval: runRawProbeEval
  };
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

  function waitForLuaEditorOpen(timeoutMs, pollIntervalMs) {
    var timeout = Math.max(250, Math.min(15000, parseInt(timeoutMs, 10) || 6000));
    var poll = Math.max(25, Math.min(1000, parseInt(pollIntervalMs, 10) || 100));
    var startedAt = Date.now();

    return new Promise(function (resolve) {
      function finish(opened, reason) {
        var snapshot = null;
        try {
          snapshot = typeof describeLuaEditor === "function" ? describeLuaEditor() : null;
        } catch (_ignoreDescribe) {
          snapshot = null;
        }

        resolve({
          opened: !!opened,
          reason: reason || "",
          waitedMs: Date.now() - startedAt,
          visible: !!(snapshot && snapshot.visible),
          title: snapshot && snapshot.title ? String(snapshot.title) : "",
          selectedSlot: snapshot && snapshot.selectedSlot ? String(snapshot.selectedSlot) : "",
          selectedFilter: snapshot && snapshot.selectedFilter ? String(snapshot.selectedFilter) : ""
        });
      }

      function pollOnce() {
        if (isEditorVisible()) {
          finish(true, "opened");
          return;
        }
        if (Date.now() - startedAt >= timeout) {
          finish(false, "timeout");
          return;
        }
        window.setTimeout(pollOnce, poll);
      }

      pollOnce();
    });
  }

  function hasUsableMenuRoot(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return false;
    }

    try {
      var menuEntries = menuRoot.querySelectorAll("li[helperid], li.menu, li.menu_checked, li.dev_menu, li.warning, li.info");
      if (menuEntries && menuEntries.length > 0) {
        return true;
      }
    } catch (_ignoreMenuEntries) {}

    try {
      if ((menuRoot.children && menuRoot.children.length > 0) || String(menuRoot.innerHTML || "").trim() !== "") {
        return true;
      }
    } catch (_ignoreHtml) {}

    return false;
  }

  function openLuaEditorFromMcp(options) {
    var settings = options && typeof options === "object" ? options : {};
    var timeoutMs = settings.timeoutMs;
    var pollIntervalMs = settings.pollIntervalMs;
    var allowShortcutFallback = settings.allowShortcutFallback !== false;
    var menuRoot = null;

    if (isEditorVisible()) {
      return Promise.resolve({
        opened: true,
        reason: "already_visible",
        waitedMs: 0,
        visible: true,
        title: "",
        selectedSlot: "",
        selectedFilter: "",
        usedMenuRoot: false,
        usedShortcutFallback: false
      });
    }

    try {
      menuRoot = document.getElementById("main_context_menu");
    } catch (_ignoreMenuLookup) {
      menuRoot = null;
    }

    if (hasUsableMenuRoot(menuRoot)) {
      triggerEditLuaFromQuickMenu(menuRoot);
      return waitForLuaEditorOpen(timeoutMs, pollIntervalMs).then(function (result) {
        result.usedMenuRoot = true;
        result.usedShortcutFallback = false;
        return result;
      });
    }

    if (!allowShortcutFallback) {
      return Promise.resolve({
        opened: false,
        reason: menuRoot ? "menu_root_not_usable" : "no_menu_root",
        waitedMs: 0,
        visible: false,
        title: "",
        selectedSlot: "",
        selectedFilter: "",
        usedMenuRoot: false,
        usedShortcutFallback: false
      });
    }

    var shortcutTriggered = triggerCtrlLShortcut();
    return waitForLuaEditorOpen(timeoutMs, pollIntervalMs).then(function (result) {
      result.usedMenuRoot = false;
      result.usedShortcutFallback = true;
      result.shortcutTriggered = !!shortcutTriggered;
      if (!result.opened && result.reason === "timeout" && !shortcutTriggered) {
        result.reason = "shortcut_not_triggered";
      }
      return result;
    });
  }

  state.openLuaEditorFromMcp = openLuaEditorFromMcp;

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

  function getLuaEditorEngineBindings() {
    return [
      { eventName: "DPUEditorShow", methodName: "showDEM" },
      { eventName: "DPUEditorInit", methodName: "initDEM" },
      { eventName: "DPUEditorCancel", methodName: "cancel" }
    ];
  }

  function getHudEngine() {
    try {
      if (window.engine) {
        return window.engine;
      }
    } catch (_ignoreWindowEngine) {}
    try {
      if (typeof engine !== "undefined" && engine) {
        return engine;
      }
    } catch (_ignoreGlobalEngine) {}
    return null;
  }

  function rebindLuaEditorEngineHandlers(manager, useWrappedHandlers) {
    if (!manager) {
      return false;
    }

    var engineRef = getHudEngine();
    if (!engineRef || typeof engineRef.on !== "function" || typeof engineRef.off !== "function") {
      sendPacket("lua_engine_rebind", {
        mode: useWrappedHandlers ? "wrapped" : "original",
        status: "engine_unavailable"
      });
      return false;
    }

    var bindings = getLuaEditorEngineBindings();
    var results = [];
    var reboundAny = false;

    for (var i = 0; i < bindings.length; i += 1) {
      var binding = bindings[i];
      var currentFn = manager[binding.methodName];
      var wrappedFn = typeof currentFn === "function" && currentFn.__luaProbeWrapped ? currentFn : null;
      var originalFn = wrappedFn && typeof wrappedFn.__luaProbeOriginal === "function"
        ? wrappedFn.__luaProbeOriginal
        : (typeof currentFn === "function" ? currentFn : null);
      var fromFn = useWrappedHandlers ? originalFn : wrappedFn;
      var toFn = useWrappedHandlers ? wrappedFn : originalFn;

      if (typeof fromFn !== "function" || typeof toFn !== "function" || fromFn === toFn) {
        results.push({
          eventName: binding.eventName,
          methodName: binding.methodName,
          status: "skipped"
        });
        continue;
      }

      try {
        engineRef.off(binding.eventName, fromFn);
        engineRef.on(binding.eventName, toFn);
        reboundAny = true;
        results.push({
          eventName: binding.eventName,
          methodName: binding.methodName,
          status: "rebound"
        });
      } catch (err) {
        try {
          engineRef.on(binding.eventName, fromFn);
        } catch (_ignoreRebindRollback) {}
        results.push({
          eventName: binding.eventName,
          methodName: binding.methodName,
          status: "error",
          error: String(err && err.message ? err.message : err)
        });
      }
    }

    manager.__luaProbeEngineBindingsRebound = useWrappedHandlers && reboundAny;
    sendPacket("lua_engine_rebind", {
      mode: useWrappedHandlers ? "wrapped" : "original",
      status: reboundAny ? "ok" : "noop",
      results: results
    });
    return reboundAny;
  }

  function unwrapLuaEditorManager() {
    var manager = window.LUAEditorManager;
    if (!manager) {
      return;
    }

    rebindLuaEditorEngineHandlers(manager, false);

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
    try {
      delete manager.__luaProbeEngineBindingsRebound;
    } catch (_ignoreEngineRebindFlag) {
      manager.__luaProbeEngineBindingsRebound = false;
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

  function parseInitDemJsonArg(raw) {
    if (typeof raw !== "string" || !raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (_ignoreParseInitDem) {}
    return null;
  }

  function summarizeInitDemRawArg(raw) {
    if (typeof raw !== "string") {
      return summarizeArg(raw);
    }
    return {
      type: "string",
      len: raw.length,
      hash: hashStringFNV1a(raw),
      preview: limitText(raw, 160)
    };
  }

  function getObjectOwnKeysSafe(obj, maxCount) {
    try {
      return Object.getOwnPropertyNames(obj || {}).slice(0, maxCount || 80);
    } catch (_ignoreOwnKeys) {}
    return [];
  }

  function getObjectProtoKeysSafe(obj, maxCount) {
    try {
      var proto = Object.getPrototypeOf(obj);
      return proto ? Object.getOwnPropertyNames(proto).slice(0, maxCount || 80) : [];
    } catch (_ignoreProtoKeys) {}
    return [];
  }

  function collectInterestingObjectFields(obj, maxCount) {
    var out = {};
    if (!obj) {
      return out;
    }
    var keys = getObjectOwnKeysSafe(obj, 120);
    var count = 0;
    for (var i = 0; i < keys.length; i += 1) {
      var key = String(keys[i] || "");
      var lower = key.toLowerCase();
      if (!(lower.indexOf("id") >= 0 ||
          lower.indexOf("name") >= 0 ||
          lower.indexOf("slot") >= 0 ||
          lower.indexOf("element") >= 0 ||
          lower.indexOf("uuid") >= 0 ||
          lower.indexOf("nq") >= 0 ||
          lower.indexOf("construct") >= 0 ||
          lower.indexOf("board") >= 0 ||
          lower.indexOf("item") >= 0 ||
          lower.indexOf("owner") >= 0 ||
          lower.indexOf("data") >= 0)) {
        continue;
      }
      try {
        var value = obj[key];
        if (value === null || typeof value === "undefined") {
          out[key] = null;
        } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          out[key] = limitText(String(value), 160);
        } else if (Array.isArray(value)) {
          out[key] = "array:" + value.length;
        } else if (typeof value === "function") {
          out[key] = "function";
        } else if (typeof value === "object") {
          out[key] = "object";
        } else {
          out[key] = limitText(String(value), 160);
        }
      } catch (err) {
        out[key] = "error:" + limitText(String(err && err.message ? err.message : err), 160);
      }
      count += 1;
      if (count >= (maxCount || 20)) {
        break;
      }
    }
    return out;
  }

  function summarizeInitDemObject(obj) {
    return {
      keys: getObjectOwnKeysSafe(obj, 80),
      interesting: collectInterestingObjectFields(obj, 20),
      protoKeys: getObjectProtoKeysSafe(obj, 80)
    };
  }

  function summarizeInitDemSlotRow(slot) {
    if (!slot || typeof slot !== "object") {
      return null;
    }
    var eventCount = 0;
    try {
      if (slot.events && typeof slot.events.length === "number") {
        eventCount = slot.events.length;
      }
    } catch (_ignoreSlotEventCount) {}
    return {
      slotKey: slot.slotKey,
      slotElementName: slot.slotElementName || null,
      eventCount: eventCount
    };
  }

  function findInitDemSelfSlot(slotRows) {
    if (!slotRows || typeof slotRows.length !== "number") {
      return null;
    }
    for (var i = 0; i < slotRows.length; i += 1) {
      var row = slotRows[i];
      if (row && String(row.slotKey || "") === "-1") {
        return row;
      }
    }
    return null;
  }

  function getLuaEditorTitleForDebug() {
    try {
      var root = document.getElementById("dpu_editor");
      var titleNode = root ? root.querySelector(".editor_header .title, .editor_header .header_bar .title") : null;
      return titleNode ? String(titleNode.textContent || "").replace(/\s+/g, " ").trim() : "";
    } catch (_ignoreLuaTitle) {}
    return "";
  }

  function buildInitDemReference(parsedData, parsedSlotData) {
    var manager = window.LUAEditorManager || null;
    var currentData = manager && manager.currentData ? manager.currentData : null;
    var currentSlot = currentData && currentData.currentSlot ? currentData.currentSlot : null;
    var currentFilter = currentData && currentData.currentFilter ? currentData.currentFilter : null;
    var currentSlotData = currentSlot && currentSlot.slotData ? currentSlot.slotData : null;
    var selfSlot = findInitDemSelfSlot(parsedSlotData);
    var slotRows = [];
    if (parsedSlotData && typeof parsedSlotData.length === "number") {
      for (var i = 0; i < parsedSlotData.length && i < 16; i += 1) {
        slotRows.push(summarizeInitDemSlotRow(parsedSlotData[i]));
      }
    }

    return {
      constructId: cfg && typeof cfg.constructId !== "undefined" ? cfg.constructId : null,
      editorTitle: getLuaEditorTitleForDebug(),
      currentSlotName: currentSlot && typeof currentSlot.name !== "undefined" ? currentSlot.name : null,
      currentSlotKey: currentSlot && typeof currentSlot.slotKey !== "undefined" ? currentSlot.slotKey : null,
      currentSlotElementName: currentSlotData && typeof currentSlotData.slotElementName !== "undefined" ? currentSlotData.slotElementName : null,
      currentFilterKey: currentFilter && typeof currentFilter.key !== "undefined" ? currentFilter.key : null,
      currentFilterSlotKey: currentFilter && typeof currentFilter.slotKey !== "undefined" ? currentFilter.slotKey : null,
      currentFilterSignature: currentFilter && typeof currentFilter.signature !== "undefined" ? currentFilter.signature : null,
      parsedDataInteresting: collectInterestingObjectFields(parsedData, 20),
      parsedSelfSlot: summarizeInitDemSlotRow(selfSlot),
      parsedSlotRows: slotRows,
      dpuEditorObject: summarizeInitDemObject(window.dpuEditorObject || null)
    };
  }

  function emitInitDemObserved(args, hookContext) {
    var parsedData = parseInitDemJsonArg(args && args.length > 0 ? args[0] : null);
    var parsedSlotData = parseInitDemJsonArg(args && args.length > 1 ? args[1] : null);
    var parsedLuaActions = parseInitDemJsonArg(args && args.length > 2 ? args[2] : null);
    var parsedLuaErrors = parseInitDemJsonArg(args && args.length > 3 ? args[3] : null);
    var reference = buildInitDemReference(parsedData, parsedSlotData);
    var beforeContext = hookContext && hookContext.beforeContext ? hookContext.beforeContext : null;
    var afterContext = getContextSnapshot();
    var payload = {
      beforeContext: beforeContext,
      afterContext: afterContext,
      argSummary: {
        data: summarizeInitDemRawArg(args && args.length > 0 ? args[0] : null),
        slotData: summarizeInitDemRawArg(args && args.length > 1 ? args[1] : null),
        luaActions: summarizeInitDemRawArg(args && args.length > 2 ? args[2] : null),
        luaErrors: summarizeInitDemRawArg(args && args.length > 3 ? args[3] : null)
      },
      parsedSummary: {
        data: summarizeInitDemObject(parsedData),
        slotDataCount: parsedSlotData && typeof parsedSlotData.length === "number" ? parsedSlotData.length : 0,
        luaActions: summarizeInitDemObject(parsedLuaActions),
        luaErrors: summarizeArg(parsedLuaErrors)
      },
      reference: reference
    };

    state.lastInitDemReference = cloneIdeSyncObject(reference);

    sendPacket("lua_initdem_observed", payload);

    sendJsonPacketChunked("lua_initdem_payload", {
      beforeContext: beforeContext,
      afterContext: afterContext,
      reference: reference,
      rawArgs: {
        data: typeof (args && args.length > 0 ? args[0] : null) === "string" ? args[0] : null,
        slotData: typeof (args && args.length > 1 ? args[1] : null) === "string" ? args[1] : null,
        luaActions: typeof (args && args.length > 2 ? args[2] : null) === "string" ? args[2] : null,
        luaErrors: typeof (args && args.length > 3 ? args[3] : null) === "string" ? args[3] : null
      }
    }, 6000);
  }

  function wrapLuaEditorManager() {
    var manager = window.LUAEditorManager;
    if (!manager) {
      return false;
    }

    if (manager.__luaProbeWrapped) {
      if (!manager.__luaProbeEngineBindingsRebound) {
        return rebindLuaEditorEngineHandlers(manager, true);
      }
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

    wrapManagerMethodWithHooks(manager, "initDEM", {
      before: function () {
        return {
          beforeContext: getContextSnapshot()
        };
      },
      after: function (args, _result, hookContext) {
        emitInitDemObserved(args, hookContext);
      }
    });

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

    rebindLuaEditorEngineHandlers(manager, true);

    return true;
  }

  function normalizeRuntimeModuleId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getConfiguredRuntimeModules() {
    return Array.isArray(cfg.runtimeModules) ? cfg.runtimeModules : [];
  }

  function getRuntimeModuleRecord(id) {
    if (!state.runtimeModuleRegistry) {
      state.runtimeModuleRegistry = Object.create(null);
    }
    return state.runtimeModuleRegistry[id] || null;
  }

  function runtimeModuleStorageKey(record, suffix) {
    return "ModUiExtractor.lua.runtime-module." + record.id + "." + String(suffix || "state");
  }

  function createRuntimeModuleContext(record) {
    var cleanupFns = [];

    function addCleanup(fn) {
      if (typeof fn === "function") {
        cleanupFns.push(fn);
      }
      return fn;
    }

    function safeRemoveNode(node) {
      try {
        if (node && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      } catch (_ignoreNodeRemove) {}
    }

    function safeClearTimer(handle, clearFn) {
      try {
        clearFn(handle);
      } catch (_ignoreTimerClear) {}
    }

    var ctx = {
      id: record.id,
      name: record.name,
      description: record.description,
      version: record.version,
      config: record.config || {},
      window: window,
      document: document,
      probeState: state,
      probeConfig: cfg,
      sendPacket: function (type, data) {
        var payload = data && typeof data === "object" ? data : {};
        payload.moduleId = record.id;
        sendPacket(type, payload);
      },
      log: function () {
        var args = ["[runtime-module:" + record.id + "]"];
        for (var i = 0; i < arguments.length; i += 1) {
          args.push(arguments[i]);
        }
        safeLog.apply(null, args);
      },
      cleanup: addCleanup,
      trackNode: function (node) {
        if (!node) {
          return node;
        }
        addCleanup(function () {
          safeRemoveNode(node);
        });
        return node;
      },
      addStyle: function (cssText, idSuffix) {
        var style = document.createElement("style");
        style.type = "text/css";
        style.setAttribute("data-lua-runtime-module", record.id);
        if (idSuffix) {
          style.id = "ModUiExtractor-runtime-module-" + record.id + "-" + idSuffix;
        }
        style.textContent = String(cssText || "");
        (document.head || document.documentElement || document.body).appendChild(style);
        return ctx.trackNode(style);
      },
      on: function (target, eventName, handler, options) {
        if (!target || typeof target.addEventListener !== "function" || typeof handler !== "function") {
          return handler;
        }
        target.addEventListener(eventName, handler, options || false);
        addCleanup(function () {
          try {
            target.removeEventListener(eventName, handler, options || false);
          } catch (_ignoreRemoveListener) {}
        });
        return handler;
      },
      setInterval: function (fn, ms) {
        var handle = window.setInterval(fn, ms);
        addCleanup(function () {
          safeClearTimer(handle, window.clearInterval);
        });
        return handle;
      },
      setTimeout: function (fn, ms) {
        var handle = window.setTimeout(fn, ms);
        addCleanup(function () {
          safeClearTimer(handle, window.clearTimeout);
        });
        return handle;
      },
      getState: function (key, fallbackValue) {
        if (typeof key === "undefined" || key === null || key === "") {
          return cloneJsonValue(record.state || {}, {});
        }
        if (record.state && Object.prototype.hasOwnProperty.call(record.state, key)) {
          return cloneJsonValue(record.state[key], fallbackValue);
        }
        return typeof fallbackValue === "undefined" ? null : fallbackValue;
      },
      setState: function (key, value) {
        if (!key) {
          return false;
        }
        if (!record.state || typeof record.state !== "object") {
          record.state = {};
        }
        record.state[key] = cloneJsonValue(value, value);
        ctx.sendPacket("lua_runtime_module_state_set", {
          key: String(key),
          value: cloneJsonValue(record.state[key], record.state[key])
        });
        return true;
      },
      replaceState: function (nextState) {
        record.state = nextState && typeof nextState === "object" ? cloneJsonValue(nextState, {}) : {};
        ctx.sendPacket("lua_runtime_module_state_set", {
          state: cloneJsonValue(record.state, {}),
          replace: true
        });
        return true;
      },
      getStoredValue: function (key, fallbackValue) {
        return ctx.getState(key, fallbackValue);
      },
      setStoredValue: function (key, value) {
        return ctx.setState(key, value);
      }
    };

    ctx.runCleanup = function () {
      for (var i = cleanupFns.length - 1; i >= 0; i -= 1) {
        try {
          cleanupFns[i]();
        } catch (_ignoreCleanup) {}
      }
      cleanupFns = [];
    };

    return ctx;
  }

  function compileRuntimeModule(record) {
    var source = String(record && record.source ? record.source : "").trim();
    if (!source) {
      throw new Error("runtime module has no source");
    }

    var factory = (0, eval)("(" + source + "\n)");
    if (typeof factory !== "function") {
      throw new Error("runtime module source must evaluate to a function");
    }
    return factory;
  }

  function syncRuntimeModuleCheckbox(record) {
    var checkbox = document.getElementById("ModUiExtractor-runtime-module-checkbox-" + record.id);
    if (!checkbox) {
      return;
    }
    checkbox.checked = !!record.enabled;
    checkbox.disabled = !!record.busy;
  }

  function syncRuntimeModuleRow(record) {
    var row = document.getElementById("ModUiExtractor-runtime-module-row-" + record.id);
    if (!row) {
      return;
    }

    row.setAttribute("data-enabled", record.enabled ? "1" : "0");
    row.setAttribute("data-active", record.active ? "1" : "0");
    row.setAttribute("data-error", record.lastError ? "1" : "0");

    var errorNode = row.querySelector(".ModUiExtractor-runtime-module-error");
    if (errorNode) {
      errorNode.textContent = record.lastError || "";
      errorNode.style.display = record.lastError ? "block" : "none";
    }

    syncRuntimeModuleCheckbox(record);
  }

  function syncRuntimeModuleMenuUi() {
    var button = document.getElementById("ModUiExtractor-runtime-module-button");
    var panel = document.getElementById("ModUiExtractor-runtime-module-panel");
    if (button) {
      button.setAttribute("aria-expanded", state.runtimeModuleMenuOpen ? "true" : "false");
    }
    if (panel) {
      panel.style.display = state.runtimeModuleMenuOpen ? "block" : "none";
    }

    if (!state.runtimeModuleIds) {
      return;
    }

    for (var i = 0; i < state.runtimeModuleIds.length; i += 1) {
      var record = getRuntimeModuleRecord(state.runtimeModuleIds[i]);
      if (record) {
        syncRuntimeModuleRow(record);
      }
    }
  }

  function removeRuntimeModuleMenu() {
    var ids = [
      "ModUiExtractor-runtime-module-style",
      "ModUiExtractor-runtime-module-button",
      "ModUiExtractor-runtime-module-panel"
    ];
    for (var i = 0; i < ids.length; i += 1) {
      try {
        var node = document.getElementById(ids[i]);
        if (node && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      } catch (_ignoreRemoveRuntimeUi) {}
    }
  }

  function disableRuntimeModule(record, reason) {
    if (!record) {
      return true;
    }

    record.busy = true;
    try {
      if (record.api && typeof record.api.uninstall === "function") {
        record.api.uninstall(reason || "disable");
      }
    } catch (err) {
      record.lastError = String(err && err.message ? err.message : err);
    }

    try {
      if (record.ctx && typeof record.ctx.runCleanup === "function") {
        record.ctx.runCleanup();
      }
    } catch (_ignoreModuleCleanup) {}

    record.api = null;
    record.ctx = null;
    record.active = false;
    record.busy = false;
    syncRuntimeModuleRow(record);
    return !record.lastError;
  }

  function enableRuntimeModule(record, reason) {
    if (!record) {
      return false;
    }
    if (record.active) {
      syncRuntimeModuleRow(record);
      return true;
    }

    record.busy = true;
    record.lastError = "";
    try {
      var factory = record.factory || compileRuntimeModule(record);
      record.factory = factory;
      var ctx = createRuntimeModuleContext(record);
      var api = factory(ctx) || {};
      record.ctx = ctx;
      record.api = api;
      if (typeof api.install === "function") {
        api.install(reason || "enable");
      }
      record.active = true;
      record.busy = false;
      syncRuntimeModuleRow(record);
      return true;
    } catch (err) {
      record.lastError = String(err && err.message ? err.message : err);
      try {
        if (record.ctx && typeof record.ctx.runCleanup === "function") {
          record.ctx.runCleanup();
        }
      } catch (_ignoreFailedCleanup) {}
      record.ctx = null;
      record.api = null;
      record.active = false;
      record.busy = false;
      syncRuntimeModuleRow(record);
      sendPacket("lua_runtime_module_error", {
        moduleId: record.id,
        message: record.lastError,
        during: reason || "enable"
      });
      return false;
    }
  }

  function setRuntimeModuleEnabled(moduleId, enabled, persistReason) {
    var record = getRuntimeModuleRecord(moduleId);
    if (!record) {
      return false;
    }

    var desired = !!enabled;
    record.enabled = desired;
    record.lastError = "";

    var ok = desired ? enableRuntimeModule(record, persistReason || "toggle") : disableRuntimeModule(record, persistReason || "toggle");
    if (!ok && desired) {
      record.enabled = false;
    }

    syncRuntimeModuleRow(record);

    if (persistReason === "menu") {
      sendPacket("lua_runtime_module_toggle", {
        moduleId: record.id,
        enabled: !!record.enabled
      });
    }

    return ok;
  }

  function teardownRuntimeModules(reason) {
    if (!state.runtimeModuleIds) {
      removeRuntimeModuleMenu();
      return;
    }

    for (var i = 0; i < state.runtimeModuleIds.length; i += 1) {
      var record = getRuntimeModuleRecord(state.runtimeModuleIds[i]);
      if (record) {
        disableRuntimeModule(record, reason || "uninstall");
      }
    }
    removeRuntimeModuleMenu();
  }

  function ensureRuntimeModuleMenuUi() {
    if (!state.runtimeModuleRegistry) {
      state.runtimeModuleRegistry = Object.create(null);
    }
    if (!state.runtimeModuleIds) {
      state.runtimeModuleIds = [];
    }

    var style = document.getElementById("ModUiExtractor-runtime-module-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "ModUiExtractor-runtime-module-style";
      style.textContent = ""
        + "#ModUiExtractor-runtime-module-button{position:fixed;top:10px;left:10px;z-index:2147482600;width:34px;height:34px;border:1px solid rgba(130,170,190,.7);border-radius:8px;background:rgba(14,20,24,.92);color:#d7edf6;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28);}" 
        + "#ModUiExtractor-runtime-module-button:hover{background:rgba(25,34,40,.96);border-color:rgba(170,220,240,.95);}" 
        + "#ModUiExtractor-runtime-module-panel{position:fixed;top:50px;left:10px;z-index:2147482600;min-width:260px;max-width:360px;max-height:60vh;overflow:auto;padding:10px;background:rgba(10,14,18,.97);border:1px solid rgba(100,150,170,.7);border-radius:10px;box-shadow:0 14px 36px rgba(0,0,0,.4);color:#dce8ee;font:13px/1.35 'Segoe UI',sans-serif;}"
        + ".ModUiExtractor-runtime-module-title{margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8fb3c2;}"
        + ".ModUiExtractor-runtime-module-empty{padding:8px 4px;color:#8ea2ad;}"
        + ".ModUiExtractor-runtime-module-row{display:flex;gap:0;align-items:flex-start;padding:8px 6px;border-radius:8px;cursor:pointer;}"
        + ".ModUiExtractor-runtime-module-row:hover{background:rgba(255,255,255,.05);}"
        + ".ModUiExtractor-runtime-module-row[data-active='1']{background:rgba(39,119,93,.18);}"
        + ".ModUiExtractor-runtime-module-row[data-error='1']{background:rgba(138,49,49,.18);}"
        + ".ModUiExtractor-runtime-module-row input{margin-top:2px;flex:0 0 auto;}"
        + ".ModUiExtractor-runtime-module-meta{display:flex;flex-direction:column;gap:2px;min-width:0;margin-left:6px;}"
        + ".ModUiExtractor-runtime-module-name{font-weight:600;color:#eef7fb;}"
        + ".ModUiExtractor-runtime-module-desc{color:#9ab1bc;}"
        + ".ModUiExtractor-runtime-module-error{display:none;font-size:11px;color:#f2b4b4;word-break:break-word;}";
      (document.head || document.documentElement || document.body).appendChild(style);
    }

    var button = document.getElementById("ModUiExtractor-runtime-module-button");
    if (!button) {
      button = document.createElement("button");
      button.id = "ModUiExtractor-runtime-module-button";
      button.type = "button";
      button.textContent = "⋮";
      button.title = "Runtime modules";
      button.setAttribute("aria-label", "Runtime modules");
      button.addEventListener("click", function (ev) {
        if (ev && typeof ev.preventDefault === "function") {
          ev.preventDefault();
        }
        if (ev && typeof ev.stopPropagation === "function") {
          ev.stopPropagation();
        }
        state.runtimeModuleMenuOpen = !state.runtimeModuleMenuOpen;
        syncRuntimeModuleMenuUi();
      }, true);
      (document.body || document.documentElement).appendChild(button);
    }

    var panel = document.getElementById("ModUiExtractor-runtime-module-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "ModUiExtractor-runtime-module-panel";
      panel.style.display = "none";
      panel.innerHTML = '<div class="ModUiExtractor-runtime-module-title">Runtime Modules</div><div id="ModUiExtractor-runtime-module-list"></div>';
      panel.addEventListener("click", function (ev) {
        if (ev && typeof ev.stopPropagation === "function") {
          ev.stopPropagation();
        }
      }, true);
      (document.body || document.documentElement).appendChild(panel);
    }

    if (!state.runtimeModuleGlobalClickBound) {
      document.addEventListener("click", function (ev) {
        if (!state.runtimeModuleMenuOpen) {
          return;
        }
        var target = ev && ev.target ? ev.target : null;
        var liveButton = document.getElementById("ModUiExtractor-runtime-module-button");
        var livePanel = document.getElementById("ModUiExtractor-runtime-module-panel");
        if ((liveButton && target && liveButton.contains(target)) || (livePanel && target && livePanel.contains(target))) {
          return;
        }
        state.runtimeModuleMenuOpen = false;
        syncRuntimeModuleMenuUi();
      }, true);
      state.runtimeModuleGlobalClickBound = true;
    }

    var list = document.getElementById("ModUiExtractor-runtime-module-list");
    if (!list) {
      syncRuntimeModuleMenuUi();
      return;
    }

    var expectedKey = state.runtimeModuleIds.join("|");
    var needsRebuild = list.getAttribute("data-runtime-module-key") !== expectedKey;
    if (!needsRebuild) {
      for (var checkIndex = 0; checkIndex < state.runtimeModuleIds.length; checkIndex += 1) {
        if (!document.getElementById("ModUiExtractor-runtime-module-row-" + state.runtimeModuleIds[checkIndex])) {
          needsRebuild = true;
          break;
        }
      }
    }

    if (needsRebuild) {
      list.innerHTML = "";
      list.setAttribute("data-runtime-module-key", expectedKey);

      if (!state.runtimeModuleIds.length) {
        var empty = document.createElement("div");
        empty.className = "ModUiExtractor-runtime-module-empty";
        empty.textContent = "No runtime modules detected.";
        list.appendChild(empty);
        syncRuntimeModuleMenuUi();
        return;
      }

      for (var i = 0; i < state.runtimeModuleIds.length; i += 1) {
        var record = getRuntimeModuleRecord(state.runtimeModuleIds[i]);
        if (!record) {
          continue;
        }

        var row = document.createElement("label");
        row.id = "ModUiExtractor-runtime-module-row-" + record.id;
        row.className = "ModUiExtractor-runtime-module-row";

        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = "ModUiExtractor-runtime-module-checkbox-" + record.id;
        checkbox.checked = !!record.enabled;
        checkbox.addEventListener("click", function (ev) {
          if (ev && typeof ev.stopPropagation === "function") {
            ev.stopPropagation();
          }
        }, true);
        checkbox.addEventListener("change", (function (moduleId) {
          return function (ev) {
            var nextEnabled = !!(ev && ev.target && ev.target.checked);
            setRuntimeModuleEnabled(moduleId, nextEnabled, "menu");
          };
        })(record.id), true);
        row.appendChild(checkbox);

        var meta = document.createElement("div");
        meta.className = "ModUiExtractor-runtime-module-meta";

        var name = document.createElement("div");
        name.className = "ModUiExtractor-runtime-module-name";
        name.textContent = record.name;
        meta.appendChild(name);

        if (record.description) {
          var desc = document.createElement("div");
          desc.className = "ModUiExtractor-runtime-module-desc";
          desc.textContent = record.description;
          meta.appendChild(desc);
        }

        var error = document.createElement("div");
        error.className = "ModUiExtractor-runtime-module-error";
        meta.appendChild(error);

        row.appendChild(meta);
        list.appendChild(row);
        syncRuntimeModuleRow(record);
      }
    }

    syncRuntimeModuleMenuUi();
  }

  function registerConfiguredRuntimeModules() {
    var defs = getConfiguredRuntimeModules();
    state.runtimeModuleRegistry = Object.create(null);
    state.runtimeModuleIds = [];

    for (var i = 0; i < defs.length; i += 1) {
      var def = defs[i] || {};
      var id = normalizeRuntimeModuleId(def.id || def.name || ("module-" + (i + 1)));
      if (!id || state.runtimeModuleRegistry[id]) {
        continue;
      }

      var record = {
        id: id,
        name: String(def.name || id),
        description: String(def.description || ""),
        version: String(def.version || ""),
        source: String(def.code || ""),
        config: def.config && typeof def.config === "object" ? def.config : {},
        state: def.state && typeof def.state === "object" ? cloneJsonValue(def.state, {}) : {},
        enabled: !!def.enabled,
        active: false,
        busy: false,
        lastError: "",
        factory: null,
        ctx: null,
        api: null,
        order: typeof def.order === "number" ? def.order : i
      };

      state.runtimeModuleRegistry[id] = record;
      state.runtimeModuleIds.push(id);
    }

    state.runtimeModuleIds.sort(function (a, b) {
      var ra = getRuntimeModuleRecord(a);
      var rb = getRuntimeModuleRecord(b);
      if (!ra || !rb) {
        return a < b ? -1 : 1;
      }
      if (ra.order !== rb.order) {
        return ra.order - rb.order;
      }
      return ra.name.localeCompare(rb.name);
    });

    for (var j = 0; j < state.runtimeModuleIds.length; j += 1) {
      var recordToEnable = getRuntimeModuleRecord(state.runtimeModuleIds[j]);
      if (recordToEnable && recordToEnable.enabled) {
        enableRuntimeModule(recordToEnable, "startup");
      }
    }
  }

  registerConfiguredRuntimeModules();
  ensureRuntimeModuleMenuUi();
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
    ensureLuaBufferSize();
    restoreLuaEditorViewPreferences();
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
    state.lastIdeSyncContextKey = "";
    state.lastIdeSyncReference = null;
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
      ensureLuaBufferSize();
      ensureLuaEditorViewPreferenceBindings();
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

  function runLuaEditorEnhancementMaintenance() {
    tryAttachMenuObserver();
    wrapLuaEditorManager();
    refreshEditorState();
    ensureScreenEditorFacelift();
  }

  function installLuaEditorEnhancements() {
    addProbeStyle();
    runLuaEditorEnhancementMaintenance();

    if (state.luaEnhancementIntervalId) {
      try {
        window.clearInterval(state.luaEnhancementIntervalId);
      } catch (_ignoreEnhancementIntervalClear) {}
    }

    state.luaEnhancementIntervalId = window.setInterval(function () {
      runLuaEditorEnhancementMaintenance();
    }, 750);
  }

  function uninstallLuaEditorEnhancements() {
    try {
      if (state.luaEnhancementIntervalId) {
        window.clearInterval(state.luaEnhancementIntervalId);
        state.luaEnhancementIntervalId = 0;
      }
    } catch (_ignoreEnhancementInterval) {}

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
      if (state.lastScreenContextKey) {
        rememberScreenEditorViewportForKey(state.lastScreenContextKey);
      }
    } catch (_ignoreScreenRememberOnUninstall) {}

    try {
      if (state.screenViewportBindingsCodeMirror) {
        detachScreenViewportBindings(state.screenViewportBindingsCodeMirror);
        state.screenViewportBindingsCodeMirror = null;
      }
    } catch (_ignoreScreenBindingsUninstall) {}

    state.screenEditorVisible = false;
    state.screenLastRestoredContextKey = "";
    state.screenPreferenceRestoreContextKey = "";
    state.editorVisible = false;
    state.menuObserved = false;

    state.lastIdeSyncContextKey = "";
    state.lastIdeSyncReference = null;
    state.lastInitDemReference = null;

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
      var screenRoot = getScreenEditorRoot();
      if (screenRoot) {
        screenRoot.removeAttribute("data-lua-probe-active");
      }
    } catch (_ignoreScreenRoot) {}

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
      "ModUiExtractor-lua-buffer-size",
      "ModUiExtractor-screen-buffer-size",
      "ModUiExtractor-screen-theme-dots",
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
  }

  function runMaintenance() {
    ensureRuntimeModuleMenuUi();
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
      uninstallLuaEditorEnhancements();
    } catch (_ignoreEnhancementUninstall) {}

    try {
      teardownRuntimeModules(reason || "uninstall");
    } catch (_ignoreRuntimeModules) {}

    try {
      window.__UI_EXTRACTOR_LUA_PROBE_INSTALLED__ = false;
      delete window.__UI_EXTRACTOR_LUA_PROBE_STATE__;
    } catch (_ignoreWindow) {}

    safeLog("uninstalled", reason || "");
  }

  window.__UI_EXTRACTOR_LUA_PROBE_UNINSTALL__ = uninstallProbe;
  window.__UI_EXTRACTOR_LUA_PROBE_STATE__ = state;
  state.luaEditorEnhancements = {
    install: installLuaEditorEnhancements,
    uninstall: uninstallLuaEditorEnhancements,
    runMaintenance: runLuaEditorEnhancementMaintenance
  };
  try {
    var enhancementRecord = typeof getRuntimeModuleRecord === "function"
      ? getRuntimeModuleRecord("lua-editor-enhancements")
      : null;
    if (enhancementRecord && enhancementRecord.enabled && enhancementRecord.api && typeof enhancementRecord.api.install === "function") {
      enhancementRecord.api.install("core-ready");
    }
  } catch (_ignoreEnhancementBootstrapRetry) {}
  state.receiveThemeCatalog = receiveThemeCatalog;
  state.ensureThemeCatalogLoaded = ensureThemeCatalogLoaded;
  sendPacket("lua_probe_start", {
    locationHref: String(window.location && window.location.href ? window.location.href : ""),
    userAgent: String(window.navigator && window.navigator.userAgent ? window.navigator.userAgent : "")
  });
  safeLog("installed", dumpId);
  startObservers();

})();