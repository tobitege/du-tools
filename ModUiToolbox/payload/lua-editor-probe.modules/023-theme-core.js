function normalizeLegacyThemeName(themeName) {
  var map = {
    green: "monokai",
    yellow: "github-dark",
    red: "gruvbox-dark",
    black: "daisy-black",
    forest: "daisy-forest",
    smooth: "daisy-smooth"
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
    return normalizeThemeDefinition(colorThemes[0]);
  }
  for (var i = 0; i < colorThemes.length; i += 1) {
    if (colorThemes[i].name === wanted) {
      return normalizeThemeDefinition(colorThemes[i]);
    }
  }
  var compactTheme = findCompactThemeByName(wanted);
  if (compactTheme) {
    return normalizeThemeDefinition(buildThemeFromCompact(compactTheme));
  }
  return null;
}

function setThemeRootActive(root, enabled) {
  if (!root) {
    return;
  }
  try {
    if (enabled) {
      root.setAttribute("data-lua-probe-active", "1");
    } else {
      root.removeAttribute("data-lua-probe-active");
    }
  } catch (_ignoreThemeRootActive) {}
}

function getGlobalMenuThemeRoot() {
  var root = document.querySelector(".global_inputs_wrapper");
  if (!root || !root.style || typeof root.style.setProperty !== "function") {
    return null;
  }
  return root;
}

function syncEditorThemeActivation() {
  var luaRoot = document.getElementById("dpu_editor");
  var screenRoot = getScreenEditorRoot();
  var bodyRoot = document.body || null;
  var globalMenuRoot = getGlobalMenuThemeRoot();
  var inventoryRoots = getInventoryThemeRoots();
  var extraRoots = document.querySelectorAll("[data-modui-theme-target=\"1\"]");
  setThemeRootActive(bodyRoot, !!state.themeEnabled);
  setThemeRootActive(luaRoot, !!state.themeEnabled);
  setThemeRootActive(screenRoot, !!state.themeEnabled && !!screenRoot && isElementVisible(screenRoot));
  setThemeRootActive(globalMenuRoot, !!state.themeEnabled && !!globalMenuRoot);
  for (var i = 0; i < inventoryRoots.length; i += 1) {
    setThemeRootActive(inventoryRoots[i], !!state.themeEnabled && isElementVisible(inventoryRoots[i]));
  }
  if (extraRoots && typeof extraRoots.length === "number") {
    for (var j = 0; j < extraRoots.length; j += 1) {
      setThemeRootActive(extraRoots[j], !!state.themeEnabled);
    }
  }
  updateThemeOffButtonSelection();
}

function setThemeEnabled(enabled, persist) {
  state.themeEnabled = !!enabled;
  if (persist !== false) {
    saveThemeEnabledPreference(state.themeEnabled);
  }
  syncEditorThemeActivation();
  return state.themeEnabled;
}

function isThemeEnabled() {
  return !!state.themeEnabled;
}

function resolveThemeLightFlag(theme, fallbackHex) {
  if (theme && typeof theme === "object") {
    if (typeof theme.isLight === "boolean") {
      return theme.isLight;
    }
    if (typeof theme.il === "boolean") {
      return theme.il;
    }
  }
  return isLightHexColor(fallbackHex || (theme && (theme.surfaceMain || theme.surfaceElevated || theme.dot)) || "#000000");
}

function normalizeThemeDefinition(theme, fallbackHex) {
  if (!theme || typeof theme !== "object") {
    return theme;
  }
  var isLight = resolveThemeLightFlag(theme, fallbackHex);
  theme.isLight = isLight;
  return theme;
}

function normalizeThemeCatalogLabel(label) {
  var text = String(label || "").replace(/^daisy\s+/i, "").trim();
  return text || "Theme";
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
  var themeName = String(compact.n || "catalog-theme");
  var primary = String(compact.p || compact.d || "#58a6ff");
  var primaryFocus = String(compact.pf || primary);
  var primaryContent = pickReadableTextColor(primary, compact.pc || (isLightHexColor(primary) ? "#101418" : "#f8f8f2"), "#101418", "#f8f8f2", 4.5);
  var neutral = String(compact.nu || "#20242a");
  var base100 = String(compact.b1 || "#0d1117");
  var base200 = String(compact.b2 || shadeHexColor(base100, isLightHexColor(base100) ? -0.06 : 0.08));
  var base300 = String(compact.b3 || shadeHexColor(base200, isLightHexColor(base200) ? -0.12 : 0.12));
  var isLightBase = resolveThemeLightFlag(compact, base100);
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
  var surfaceBackdrop = mixHexColor(base200, deep, isLightBase ? 0.52 : 0.42);
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
  var borderHover = info;
  var selectionBorder = withAlpha(primary, 0.92);
  var modeSelectedTop = shadeHexColor(primary, 0.16);
  var modeSelectedMid = shadeHexColor(primary, 0.05);
  var modeSelectedBottom = shadeHexColor(primaryFocus, -0.08);
  var modeSelectedBg = buildLinearGradient(modeSelectedTop, modeSelectedMid, modeSelectedBottom);
  var modeSelectedBorder = withAlpha(primary, 0.78);
  var modeSelectedColor;
  var btnApplyColor = primaryContent;
  if (themeName === "daisy-black") {
    borderHover = "#6fbfff";
    selectionBorder = "rgba(111,191,255,0.92)";
    modeSelectedTop = "#7fd0ff";
    modeSelectedMid = "#58a9ff";
    modeSelectedBottom = "#2f76d9";
    modeSelectedBg = buildLinearGradient(modeSelectedTop, modeSelectedMid, modeSelectedBottom);
    modeSelectedBorder = "rgba(111,191,255,0.92)";
  }
  modeSelectedColor = pickReadableTextColorForBackgrounds(
    [modeSelectedTop, modeSelectedMid, modeSelectedBottom],
    compact.pc || primaryContent,
    "#101418",
    "#f8f8f2",
    4.5
  );
  if (isLightBase) {
    btnApplyColor = "#ffffff";
  }
  var btnDisabledBg = buildLinearGradient(shadeHexColor(base200, isLightBase ? -0.03 : 0.04), rowAlt, shadeHexColor(deep, isLightBase ? -0.08 : -0.02));
  var btnDisabledBorder = withAlpha(borderStrong, isLightBase ? 0.6 : 0.5);
  var btnDisabledColor = withAlpha(textDim, isLightBase ? 0.92 : 0.72);
  var surfaceShine = isLightBase ? "rgba(255,255,255,0)" : "rgba(255,255,255,0.02)";
  var elevationShadow = isLightBase ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.25)";
  return {
    name: themeName,
    label: normalizeThemeCatalogLabel(compact.l || compact.n || "Catalog Theme"),
    isLight: isLightBase,
    dot: String(compact.d || primary),
    accent: withAlpha(primary, 0.92),
    warning: warning,
    header: withAlpha(base100, 0.97),
    caretBg: withAlpha(primary, isLightHexColor(base100) ? 0.12 : 0.18),
    accentSolid: primary,
    onAccent: primaryContent,
    surfaceMain: base100,
    surfaceElevated: base200,
    surfaceBackdrop: surfaceBackdrop,
    surfaceRow: row,
    surfaceDeep: deep,
    surfaceRowAlt: rowAlt,
    borderStrong: borderStrong,
    borderHover: borderHover,
    selectionBorder: selectionBorder,
    shadow: isLightHexColor(base100) ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.5)",
    surfaceShine: surfaceShine,
    elevationShadow: elevationShadow,
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
    btnApplyColor: btnApplyColor,
    btnApplyHoverBg: buildLinearGradient(shadeHexColor(primary, 0.16), shadeHexColor(primary, 0.05), shadeHexColor(primaryFocus, -0.08)),
    btnApplyActiveBg: buildLinearGradient(shadeHexColor(primaryFocus, -0.02), shadeHexColor(primaryFocus, -0.12), shadeHexColor(primaryFocus, -0.24)),
    modeSelectedBg: modeSelectedBg,
    modeSelectedBorder: modeSelectedBorder,
    modeSelectedColor: modeSelectedColor,
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

function getDefaultThemeName() {
  return "daisy-black";
}

function getThemeRoots() {
  var roots = [];
  var bodyRoot = document.body || null;
  var luaRoot = document.getElementById("dpu_editor");
  var screenRoot = getScreenEditorRoot();
  var globalMenuRoot = getGlobalMenuThemeRoot();
  var inventoryRoots = getInventoryThemeRoots();
  var extraRoots = document.querySelectorAll("[data-modui-theme-target=\"1\"]");
  function pushRoot(node) {
    if (!node || !node.style || typeof node.style.setProperty !== "function") {
      return;
    }
    if (roots.indexOf(node) >= 0) {
      return;
    }
    roots.push(node);
  }
  if (bodyRoot) {
    pushRoot(bodyRoot);
  }
  if (luaRoot) {
    pushRoot(luaRoot);
  }
  if (screenRoot && screenRoot !== luaRoot) {
    pushRoot(screenRoot);
  }
  if (globalMenuRoot) {
    pushRoot(globalMenuRoot);
  }
  for (var i = 0; i < inventoryRoots.length; i += 1) {
    pushRoot(inventoryRoots[i]);
  }
  if (extraRoots && typeof extraRoots.length === "number") {
    for (var j = 0; j < extraRoots.length; j += 1) {
      pushRoot(extraRoots[j]);
    }
  }
  return roots;
}

function applyThemeToRoot(root, theme) {
  if (!root || !root.style || typeof root.style.setProperty !== "function") {
    return;
  }
  var isLight = !!(theme && theme.isLight);
  try {
    root.setAttribute("data-lua-probe-theme-light", isLight ? "1" : "0");
  } catch (_ignoreThemeLightAttr) {}
  root.style.setProperty("--lua-probe-theme-is-light", isLight ? "1" : "0");
  root.style.setProperty("--lua-probe-accent", theme.accent);
  root.style.setProperty("--lua-probe-header-bg", theme.header);
  root.style.setProperty("--lua-probe-caret-line-bg", theme.caretBg);
  root.style.setProperty("--lua-probe-accent-solid", theme.accentSolid);
  root.style.setProperty("--lua-probe-on-accent", theme.onAccent);
  root.style.setProperty("--lua-probe-surface-main", theme.surfaceMain);
  root.style.setProperty("--lua-probe-surface-elevated", theme.surfaceElevated);
  root.style.setProperty("--lua-probe-surface-backdrop", theme.surfaceBackdrop || theme.surfaceMain);
  root.style.setProperty("--lua-probe-surface-row", theme.surfaceRow);
  root.style.setProperty("--lua-probe-surface-deep", theme.surfaceDeep);
  root.style.setProperty("--lua-probe-surface-row-alt", theme.surfaceRowAlt);
  root.style.setProperty("--lua-probe-border-strong", theme.borderStrong);
  root.style.setProperty("--lua-probe-border-hover", theme.borderHover);
  root.style.setProperty("--lua-probe-selection-border", theme.selectionBorder || theme.accent);
  root.style.setProperty("--lua-probe-shadow", theme.shadow);
  root.style.setProperty("--lua-probe-surface-shine", theme.surfaceShine || "rgba(255,255,255,0.02)");
  root.style.setProperty("--lua-probe-elevation-shadow", theme.elevationShadow || "rgba(0,0,0,0.25)");
  root.style.setProperty("--lua-probe-text-main", theme.cmText || theme.textMuted);
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
  root.style.setProperty("--lua-probe-warning", theme.warning || "#d7b24a");
  root.style.setProperty("--lua-probe-mode-selected-bg", theme.modeSelectedBg || theme.btnApplyBg);
  root.style.setProperty("--lua-probe-mode-selected-border", theme.modeSelectedBorder || theme.btnApplyBorder);
  root.style.setProperty("--lua-probe-mode-selected-color", theme.modeSelectedColor || theme.btnApplyColor);
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
  ensureInventoryThemeStyle();
  ensureInventoryInspectorEnhancer(document);
  applyInlineThemeToVisibleItemInspectors(document);
  state.lastAppliedTheme = theme.name;
  syncEditorThemeActivation();
  updateThemeDotSelection(theme.name);
  updateThemeCatalogSelection(theme.name);
  updateThemeOffButtonSelection();

  if (emitPacket) {
    sendPacket("lua_theme_changed", {
      theme: theme.name,
      label: theme.label,
      isLight: !!theme.isLight,
      accent: theme.accent,
      header: theme.header,
      caretBg: theme.caretBg,
      surfaceMain: theme.surfaceMain
    });
  }
  return true;
}
