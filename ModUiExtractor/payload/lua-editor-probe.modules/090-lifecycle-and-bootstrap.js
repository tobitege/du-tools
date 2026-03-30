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
