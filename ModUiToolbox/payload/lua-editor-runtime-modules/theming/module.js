function (ctx) {
  "use strict";

  var HOST_ID = "ModUiToolbox-global-theme-host";
  var SWITCHER_ID = "ModUiToolbox-global-theme-dots";
  var RUNTIME_BUTTON_ID = "ModUiToolbox-runtime-module-button";

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

  function syncThemeUi() {
    var api = getThemeApi();
    var host = ensureHost();
    var button = document.getElementById(RUNTIME_BUTTON_ID);
    var rect;
    var activeThemeName;

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
      if (rect && host.style) {
        host.style.left = Math.max(0, Math.round(rect.right + 8)) + "px";
        host.style.top = Math.max(0, Math.round(rect.top + 3)) + "px";
      } else if (host.style) {
        host.style.left = "52px";
        host.style.top = "13px";
      }
    } catch (_ignoreThemeHostPosition) {}

    api.ensureThemeSwitcherHost(host, SWITCHER_ID, false);
    activeThemeName = typeof api.getActiveThemeName === "function" ? api.getActiveThemeName() : null;
    if (typeof api.applyTheme === "function") {
      api.applyTheme(activeThemeName || "daisy-black", false);
    }
    return true;
  }

  return {
    install: function () {
      syncThemeUi();
      ctx.setInterval(syncThemeUi, 500);
    },
    uninstall: function () {
      var api = getThemeApi();
      if (api && typeof api.setThemeEnabled === "function") {
        api.setThemeEnabled(false, true);
      }
      removeHost();
    }
  };
}
