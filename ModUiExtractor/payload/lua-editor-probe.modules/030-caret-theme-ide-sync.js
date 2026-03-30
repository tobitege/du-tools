
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
