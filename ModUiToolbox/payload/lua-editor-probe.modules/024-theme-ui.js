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

function updateThemeOffButtonSelection() {
  var buttons = document.querySelectorAll(".lua-theme-off-button");
  if (!buttons || !buttons.length) {
    return;
  }
  var isOff = !state.themeEnabled;
  for (var i = 0; i < buttons.length; i += 1) {
    var button = buttons[i];
    button.setAttribute("data-active", isOff ? "1" : "0");
    button.setAttribute("aria-pressed", isOff ? "true" : "false");
    button.setAttribute("title", isOff ? "Theme is off" : "Turn theme off");
  }
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
  setThemeEnabled(true, persist !== false);
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
  var offButtonId = baseId + "-off";
  var trigger = document.getElementById(triggerId);
  var offButton = document.getElementById(offButtonId);
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

  if (!offButton) {
    offButton = document.createElement("button");
    offButton.type = "button";
    offButton.id = offButtonId;
    offButton.className = "lua-theme-off-button";
    offButton.textContent = "Off";
    offButton.setAttribute("aria-label", "Theme off");
    offButton.addEventListener("click", function (event) {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      if (event && typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      hideThemeCatalogPanels();
      setThemeEnabled(false, true);
    }, true);
  }

  if (offButton.parentNode !== switcher) {
    switcher.appendChild(offButton);
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

function getThemeDotShortcuts() {
  return [
    { name: "daisy-black", label: "Black", dot: "#a6e22e" },
    { name: "daisy-emerald", label: "Emerald", dot: "#6ee7b7" },
    { name: "daisy-smooth", label: "Smooth", dot: "#ff9f43" }
  ];
}

function createThemeDotSwitcher(switcherId) {
  var switcher = document.createElement("div");
  switcher.id = switcherId;
  switcher.className = "modui-theme-switcher";

  var shortcuts = getThemeDotShortcuts();
  for (var i = 0; i < shortcuts.length; i += 1) {
    (function (shortcut) {
      var theme = getThemeByName(shortcut.name) || shortcut;
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "lua-theme-dot";
      dot.style.background = shortcut.dot || theme.dot;
      dot.setAttribute("data-theme", shortcut.name);
      dot.setAttribute("data-active", "0");
      dot.setAttribute("title", "Theme: " + (theme.label || shortcut.label || shortcut.name));
      dot.setAttribute("aria-label", "Theme: " + (theme.label || shortcut.label || shortcut.name));
      dot.addEventListener("click", function () {
        setThemeEnabled(true, true);
        applyTheme(shortcut.name, true);
      }, true);
      switcher.appendChild(dot);
    })(shortcuts[i]);
  }

  return switcher;
}

function ensureSharedThemeSwitcher(hostNode, switcherId, applyActiveTheme) {
  var resolvedHost = hostNode || null;
  var resolvedId = String(switcherId || "").trim();
  var switcher;
  if (!resolvedHost || typeof resolvedHost.appendChild !== "function" || !resolvedId) {
    return null;
  }

  switcher = document.getElementById(resolvedId);
  if (!switcher) {
    switcher = createThemeDotSwitcher(resolvedId);
  }

  if (switcher.parentNode !== resolvedHost) {
    resolvedHost.appendChild(switcher);
  }

  ensureThemeCatalogTrigger(switcher, resolvedId);
  updateThemeDotSelection(state.activeTheme || getDefaultThemeName());
  updateThemeCatalogSelection(state.activeTheme || getDefaultThemeName());
  updateThemeOffButtonSelection();
  if (applyActiveTheme !== false) {
    applyTheme(state.activeTheme || getDefaultThemeName(), false);
  }
  return switcher;
}

