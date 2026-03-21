
  function normalizeLegacyThemeName(themeName) {
    var map = {
      green: "monokai",
      yellow: "github-dark",
      red: "gruvbox-dark"
    };
    var key = String(themeName || "").toLowerCase();
    return map[key] || themeName;
  }

  function getThemeByName(themeName) {
    var wanted = normalizeLegacyThemeName(themeName);
    for (var i = 0; i < colorThemes.length; i += 1) {
      if (colorThemes[i].name === wanted) {
        return colorThemes[i];
      }
    }
    return colorThemes[0];
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

  function getDefaultThemeName() {
    return (colorThemes[0] && colorThemes[0].name) ? colorThemes[0].name : "monokai";
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
    root.style.setProperty("--lua-probe-cm-comment", theme.cmComment);
    root.style.setProperty("--lua-probe-cm-linenumber", theme.cmLineNumber);
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
  }

  function applyTheme(themeName, emitPacket) {
    var theme = getThemeByName(themeName);
    var roots = getThemeRoots();
    state.activeTheme = theme.name;
    for (var i = 0; i < roots.length; i += 1) {
      applyThemeToRoot(roots[i], theme);
    }
    state.lastAppliedTheme = theme.name;
    updateThemeDotSelection(theme.name);

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
  }

  function ensureScreenEditorFacelift() {
    var root = getScreenEditorRoot();
    if (!root || !root.querySelector) {
      return;
    }

    if (!isElementVisible(root)) {
      try {
        root.removeAttribute("data-lua-probe-active");
      } catch (_ignoreScreenProbeInactive) {}
      return;
    }

    root.setAttribute("data-lua-probe-active", "1");
    ensureScreenThemeSwitcher(root);
    ensureScreenIdeSyncButton(root);
    applyTheme(state.activeTheme || getDefaultThemeName(), false);
  }

