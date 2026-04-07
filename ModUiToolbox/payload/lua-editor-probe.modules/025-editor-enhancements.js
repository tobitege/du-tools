function updateCaretToggleVisual() {
  var toggle = document.getElementById("ModUiToolbox-lua-caret-toggle");
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

  var toggle = document.getElementById("ModUiToolbox-lua-caret-toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "ModUiToolbox-lua-caret-toggle";
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

  var syncBtn = document.getElementById("ModUiToolbox-lua-ide-sync");
  if (!syncBtn) {
    syncBtn = document.createElement("button");
    syncBtn.type = "button";
    syncBtn.id = "ModUiToolbox-lua-ide-sync";
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

  var syncBtn = document.getElementById("ModUiToolbox-screen-ide-sync");
  if (!syncBtn) {
    syncBtn = document.createElement("button");
    syncBtn.type = "button";
    syncBtn.id = "ModUiToolbox-screen-ide-sync";
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

  var sizeNode = document.getElementById("ModUiToolbox-lua-buffer-size");
  if (!sizeNode) {
    sizeNode = document.createElement("span");
    sizeNode.id = "ModUiToolbox-lua-buffer-size";
    sizeNode.className = "lua-probe-buffer-size";
  }

  var titleTextNode = document.getElementById("ModUiToolbox-lua-title-text");
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

function ensureScreenBufferSize(root) {
  if (!root || !root.querySelector) {
    return;
  }

  var reportNode = root.querySelector(".footer_line .error_block .error_header .left_wrapper");
  if (!reportNode) {
    return;
  }

  var sizeNode = document.getElementById("ModUiToolbox-screen-buffer-size");
  if (!sizeNode) {
    sizeNode = document.createElement("span");
    sizeNode.id = "ModUiToolbox-screen-buffer-size";
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
      setThemeRootActive(root, false);
    } catch (_ignoreScreenProbeInactive) {}
    return;
  }

  var context = getScreenEditorContextSnapshot(root);
  var contextKey = context.contextKey || "";
  state.screenEditorVisible = true;
  if (contextKey) {
    state.lastScreenContextKey = contextKey;
  }

  setThemeRootActive(root, !!state.themeEnabled);
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
