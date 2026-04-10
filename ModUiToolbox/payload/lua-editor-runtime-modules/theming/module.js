function (ctx) {
  "use strict";

  var HOST_ID = "ModUiToolbox-global-theme-host";
  var SWITCHER_ID = "ModUiToolbox-global-theme-dots";
  var RUNTIME_BUTTON_ID = "ModUiToolbox-runtime-module-button";
  var lastThemeName = "";
  var lastThemeEnabled = null;
  var lastLeft = "";
  var lastTop = "";

  function getThemeApi() {
    var state = window.__UI_TOOLBOX_LUA_PROBE_STATE__;
    return state && state.theming ? state.theming : null;
  }

  function removeHost() {
    var host = document.getElementById(HOST_ID);
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }

  function ensureHost() {
    var host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      (document.body || document.documentElement).appendChild(host);
    }
    return host;
  }

  function setHostPosition(host, left, top) {
    if (!host || !host.style) {
      return;
    }
    if (left !== lastLeft) {
      host.style.left = left;
      lastLeft = left;
    }
    if (top !== lastTop) {
      host.style.top = top;
      lastTop = top;
    }
  }

  function syncThemeUi() {
    var api = getThemeApi();
    var host = ensureHost();
    var button = document.getElementById(RUNTIME_BUTTON_ID);
    var rect;
    var activeThemeName;
    var themeEnabled;
    var switcherMissing;

    if (!api || !host) {
      return false;
    }

    if (host.style) {
      host.style.position = "fixed";
      host.style.display = "flex";
      host.style.pointerEvents = "auto";
      host.style.zIndex = "2147482601";
    }

    try {
      rect = button && typeof button.getBoundingClientRect === "function"
        ? button.getBoundingClientRect()
        : null;
      if (rect) {
        setHostPosition(
          host,
          Math.max(0, Math.round(rect.right + 8)) + "px",
          Math.max(0, Math.round(rect.top + 3)) + "px"
        );
      } else {
        setHostPosition(host, "52px", "13px");
      }
    } catch (_ignoreThemeHostPosition) {}

    activeThemeName = typeof api.getActiveThemeName === "function" ? api.getActiveThemeName() : null;
    themeEnabled = typeof api.isThemeEnabled === "function" ? !!api.isThemeEnabled() : true;
    switcherMissing = !document.getElementById(SWITCHER_ID);

    if (switcherMissing || themeEnabled !== lastThemeEnabled || activeThemeName !== lastThemeName) {
      api.ensureThemeSwitcherHost(host, SWITCHER_ID, false);
    }

    if (themeEnabled && typeof api.applyTheme === "function" &&
        (themeEnabled !== lastThemeEnabled || activeThemeName !== lastThemeName)) {
      api.applyTheme(activeThemeName || "daisy-black", false);
    }

    if (typeof api.syncPopupInspectorUi === "function") {
      api.syncPopupInspectorUi();
    }

    lastThemeEnabled = themeEnabled;
    lastThemeName = activeThemeName || "daisy-black";
    return true;
  }

  return {
    install: function () {
      syncThemeUi();
      ctx.setInterval(syncThemeUi, 500);
    },
    uninstall: function (reason) {
      var api = getThemeApi();
      var why = String(reason || "disable");
      var shouldPersistDisabled = why === "disable" || why === "toggle" || why === "menu";
      if (api && typeof api.setThemeEnabled === "function" && shouldPersistDisabled) {
        api.setThemeEnabled(false, true);
      }
      removeHost();
    }
  };
}
