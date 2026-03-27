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
  var mcpResultChunkSize = 7000;

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
    activeTheme: "monokai",
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
    lastIdeSyncContextKey: "",
    lastIdeSyncReference: null,
    lastInitDemReference: null
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
      cmComment: "#75715e",
      cmLineNumber: "#90908a",
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
      btnCancelActiveBg: "linear-gradient(180deg,#45423a 0%,#35322d 45%,#282622 100%)"
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
      cmComment: "#8b949e",
      cmLineNumber: "#6e7681",
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
      btnCancelActiveBg: "linear-gradient(180deg,#282e35 0%,#1e242a 45%,#161b22 100%)"
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
      cmComment: "#928374",
      cmLineNumber: "#a89984",
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
      btnCancelActiveBg: "linear-gradient(180deg,#454039 0%,#363230 45%,#292726 100%)"
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

    return {
      constructId: constructId,
      editorTitle: typeof getLuaEditorTitleForDebug === "function" ? getLuaEditorTitleForDebug() : "",
      slotElementName: slotElementName,
      currentSlotName: currentSlot && typeof currentSlot.name !== "undefined" ? currentSlot.name : null,
      currentSlotKey: currentSlot && typeof currentSlot.slotKey !== "undefined" ? currentSlot.slotKey : null,
      currentFilterKey: currentFilter && typeof currentFilter.key !== "undefined" ? currentFilter.key : null,
      currentFilterSignature: currentFilter && typeof currentFilter.signature !== "undefined" ? currentFilter.signature : null
    };
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
      contextKey: getEditorContextKey(codeMirror),
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
      flashIdeImportStatus(targetKind, "Sync wartet auf richtiges Element", "#805019", "#ffffff", 1400);
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
      flashIdeImportStatus(targetKind, "Sync wartet auf richtigen Filter", "#8a2424", "#ffffff", 1400);
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
      staleBase ? "Synced from IDE (stale base)" : "Synced from IDE!",
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
      flashIdeSyncButton("Sync Blocked: Wrong Filter", "#8a2424", "#ffffff", 3000);
      return;
    }

    var codeMirror = snapshot.codeMirror || getLuaCodeMirror();
    if (!codeMirror || typeof codeMirror.setValue !== "function") {
      return;
    }

    codeMirror.setValue(newCode);
    state.lastIdeSyncContextKey = currentContextKey;
    state.lastIdeSyncReference = cloneIdeSyncObject(snapshot.reference || getLuaIdeSyncReference());
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
