
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

