// 000-core.js - HUD Editor runtime, root state, DOM utilities
(function hudEditorCore() {
  "use strict";

  var WIN = window;
  var DOC = document;
  var NS = "HudEditor";

  if (WIN[NS] && typeof WIN[NS].destroy === "function") {
    try {
      WIN[NS].destroy("reinstall");
    } catch (_ignoreDestroy) {}
  }
  if (WIN[NS]) {
    return;
  }

  var listeners = {};
  var cleanupFns = [];

  var state = {
    initialized: false,
    editModeActive: false,
    currentScreen: "start",
    currentTool: "select",
    selectedElementId: null,
    isDirty: false,
    document: null,
    connectedScreen: false
  };

  function addCleanup(fn) {
    if (typeof fn === "function") {
      cleanupFns.push(fn);
    }
    return fn;
  }

  function runCleanup() {
    for (var i = cleanupFns.length - 1; i >= 0; i -= 1) {
      try {
        cleanupFns[i]();
      } catch (_ignoreCleanup) {}
    }
    cleanupFns = [];
  }

  function el(tag, attrs, children) {
    var node = DOC.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "className") {
          node.className = attrs[key];
        } else if (key === "dataset") {
          Object.keys(attrs[key]).forEach(function (dk) {
            node.dataset[dk] = attrs[key][dk];
          });
        } else if (key === "style" && typeof attrs[key] === "object") {
          Object.keys(attrs[key]).forEach(function (sk) {
            node.style[sk] = attrs[key][sk];
          });
        } else if (key === "textContent") {
          node.textContent = attrs[key];
        } else {
          node.setAttribute(key, attrs[key]);
        }
      });
    }
    if (children) {
      children.forEach(function (child) {
        if (typeof child === "string") {
          node.appendChild(DOC.createTextNode(child));
        } else if (child) {
          node.appendChild(child);
        }
      });
    }
    return node;
  }

  function qs(selector, root) {
    return (root || DOC).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || DOC).querySelectorAll(selector));
  }

  function getRoot() {
    var root = DOC.getElementById("hud-editor-root");
    if (!root) {
      root = el("div", { id: "hud-editor-root" });
      root.style.display = "none";
      (DOC.body || DOC.documentElement).appendChild(root);
    }
    return root;
  }

  function showScreen(name) {
    state.currentScreen = name;
    var root = getRoot();
    qsa(".hud-screen", root).forEach(function (screen) {
      screen.classList.remove("active");
      screen.style.display = "none";
    });
    var target = qs('[data-screen="' + name + '"]', root);
    if (target) {
      target.classList.add("active");
      target.style.display = "";
    }
  }

  function enterEditMode() {
    if (state.editModeActive) {
      showScreen(state.currentScreen);
      return;
    }
    state.editModeActive = true;
    var root = getRoot();
    root.style.display = "block";
    root.style.pointerEvents = "auto";
    showScreen(state.currentScreen);
    emit("enter-edit");
  }

  function exitEditMode() {
    if (!state.editModeActive) {
      return;
    }
    state.editModeActive = false;
    var root = getRoot();
    root.style.display = "none";
    root.style.pointerEvents = "none";
    emit("exit-edit");
  }

  function on(event, fn) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!listeners[event]) {
      return;
    }
    listeners[event] = listeners[event].filter(function (entry) {
      return entry !== fn;
    });
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(function (fn) {
      try {
        fn(data);
      } catch (_ignoreListener) {}
    });
  }

  function isEscapeEvent(e) {
    if (!e) {
      return false;
    }
    return e.code === "Escape" || e.key === "Escape" || e.key === "Esc" || e.keyCode === 27 || e.which === 27;
  }

  function onKeyDown(e) {
    if (!state.editModeActive) {
      return;
    }

    if (isEscapeEvent(e)) {
      if (state.currentScreen === "start") {
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        exitEditMode();
        updateToggleButton();
        e.preventDefault();
        return;
      }
      state.selectedElementId = null;
      emit("deselect-all");
      return;
    }

    if (e.code === "Delete" && state.selectedElementId) {
      emit("delete-element", state.selectedElementId);
      return;
    }

    var toolMap = {
      KeyV: "select",
      KeyB: "box",
      KeyR: "rounded",
      KeyC: "circle",
      KeyL: "line",
      KeyT: "text"
    };
    if (toolMap[e.code] && !e.ctrlKey && !e.metaKey) {
      state.currentTool = toolMap[e.code];
      emit("tool-changed", state.currentTool);
      return;
    }

    if (e.ctrlKey && e.code === "KeyZ") {
      emit("undo");
      e.preventDefault();
      return;
    }
    if (e.ctrlKey && e.code === "KeyY") {
      emit("redo");
      e.preventDefault();
      return;
    }
    if (e.ctrlKey && e.code === "KeyS") {
      emit("save");
      e.preventDefault();
    }
  }

  function onMouseCapture(e) {
    if (!state.editModeActive) {
      return;
    }
  }

  function updateToggleButton() {
    var button = DOC.getElementById("hud-editor-toggle");
    if (!button) {
      return;
    }
    if (state.editModeActive) {
      button.textContent = "HUD Editor: ON";
      button.style.background = "#0ee9e7";
      button.style.color = "#000";
    } else {
      button.textContent = "HUD Editor: OFF";
      button.style.background = "#333";
      button.style.color = "#fff";
    }
  }

  function getToastContainer() {
    var container = DOC.getElementById("hud-editor-toast-container");
    if (!container) {
      container = DOC.createElement("div");
      container.id = "hud-editor-toast-container";
      container.className = "toast-container";
      (DOC.body || DOC.documentElement).appendChild(container);
    }
    return container;
  }

  function showToast(payload) {
    var data = payload && typeof payload === "object" ? payload : { text: String(payload || "") };
    var text = String(data.text || "").trim();
    if (!text) {
      return;
    }
    var container = getToastContainer();
    var toast = DOC.createElement("div");
    toast.className = "toast " + (data.type || "info");
    toast.textContent = text;
    container.appendChild(toast);

    WIN.setTimeout(function () {
      try {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-6px)";
      } catch (_ignoreToastFade) {}
    }, 1800);

    WIN.setTimeout(function () {
      try {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      } catch (_ignoreToastRemove) {}
    }, 2200);
  }

  function createToggleButton() {
    var existing = DOC.getElementById("hud-editor-toggle");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    var button = DOC.createElement("button");
    button.id = "hud-editor-toggle";
    button.type = "button";
    button.textContent = "HUD Editor: OFF";
    button.style.cssText = "position:fixed;top:10px;right:16px;display:inline-flex;align-items:center;justify-content:center;min-width:164px;height:40px;background:#333;color:#fff;z-index:2147482400;font:700 14px/1.2 'Segoe UI',Tahoma,sans-serif;padding:8px 16px;border:2px solid #0ee9e7;border-radius:10px;cursor:pointer;white-space:nowrap;box-sizing:border-box;box-shadow:0 8px 24px rgba(0,0,0,0.28);";
    button.addEventListener("click", function () {
      if (state.editModeActive) {
        exitEditMode();
      } else {
        enterEditMode();
      }
      updateToggleButton();
    });
    updateToggleButton();
    (DOC.body || DOC.documentElement).appendChild(button);

    addCleanup(function () {
      try {
        if (button.parentNode) {
          button.parentNode.removeChild(button);
        }
      } catch (_ignoreButtonCleanup) {}
    });
  }

  function init() {
    if (state.initialized) {
      return;
    }
    state.initialized = true;

    DOC.addEventListener("keydown", onKeyDown, true);
    WIN.addEventListener("keydown", onKeyDown, true);
    DOC.addEventListener("mousedown", onMouseCapture, true);
    DOC.addEventListener("mousemove", onMouseCapture, true);
    DOC.addEventListener("mouseup", onMouseCapture, true);
    DOC.addEventListener("click", onMouseCapture, true);

    addCleanup(function () {
      DOC.removeEventListener("keydown", onKeyDown, true);
      WIN.removeEventListener("keydown", onKeyDown, true);
      DOC.removeEventListener("mousedown", onMouseCapture, true);
      DOC.removeEventListener("mousemove", onMouseCapture, true);
      DOC.removeEventListener("mouseup", onMouseCapture, true);
      DOC.removeEventListener("click", onMouseCapture, true);
    });

    if (DOC.body) {
      createToggleButton();
    } else {
      var onReady = function () {
        DOC.removeEventListener("DOMContentLoaded", onReady);
        createToggleButton();
      };
      DOC.addEventListener("DOMContentLoaded", onReady);
      addCleanup(function () {
        DOC.removeEventListener("DOMContentLoaded", onReady);
      });
    }

    on("toast", showToast);

    addCleanup(function () {
      var container = DOC.getElementById("hud-editor-toast-container");
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
  }

  function destroy(reason) {
    try {
      emit("destroy", reason || "destroy");
    } catch (_ignoreDestroyEmit) {}

    exitEditMode();
    runCleanup();

    var root = DOC.getElementById("hud-editor-root");
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }

    var style = DOC.getElementById("hud-editor-styles");
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }

    listeners = {};
    delete WIN[NS];
  }

  WIN[NS] = {
    state: state,
    getRoot: getRoot,
    el: el,
    qs: qs,
    qsa: qsa,
    showScreen: showScreen,
    enterEditMode: enterEditMode,
    exitEditMode: exitEditMode,
    updateToggleButton: updateToggleButton,
    on: on,
    off: off,
    emit: emit,
    cleanup: addCleanup,
    init: init,
    destroy: destroy
  };

  init();
})();
