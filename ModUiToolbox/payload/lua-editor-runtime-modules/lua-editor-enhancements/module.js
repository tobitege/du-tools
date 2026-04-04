function (ctx) {
  "use strict";

  function getEnhancementApi() {
    var state = window.__UI_TOOLBOX_LUA_PROBE_STATE__;
    return state && state.luaEditorEnhancements ? state.luaEditorEnhancements : null;
  }

  var activated = false;
  var retryHandle = 0;

  function stopRetry() {
    if (!retryHandle) {
      return;
    }
    try {
      window.clearInterval(retryHandle);
    } catch (_ignoreRetryClear) {}
    retryHandle = 0;
  }

  function activateOnce() {
    if (activated) {
      return true;
    }
    var api = getEnhancementApi();
    if (!api || typeof api.install !== "function") {
      return false;
    }
    api.install();
    activated = true;
    stopRetry();
    return true;
  }

  function deactivate() {
    stopRetry();
    if (!activated) {
      return;
    }
    var api = getEnhancementApi();
    if (api && typeof api.uninstall === "function") {
      api.uninstall();
    }
    activated = false;
  }

  return {
    install: function () {
      if (activateOnce()) {
        return;
      }
      retryHandle = window.setInterval(function () {
        activateOnce();
      }, 100);
      if (ctx && typeof ctx.cleanup === "function") {
        ctx.cleanup(stopRetry);
      }
    },
    uninstall: function () {
      deactivate();
    }
  };
}
