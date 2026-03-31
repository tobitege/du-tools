// HUD Editor Probe - Lua Painter
// Project: D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1
// Built: 2026-03-31T02:27:55Z

// Inlined CSS
(function injectCSS() {
  var existing = document.getElementById('hud-editor-styles');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  var style = document.createElement('style');
  style.id = 'hud-editor-styles';
  style.textContent = "/* hud-editor.css - All HUD Editor styles\n   Project: D:\\\\github\\\\du-tobi\\\\live_lua_coding\\\\examples\\\\hud_editor_v1\n   Self-contained - does NOT use ModUiExtractor core styles\n*/\n\n/* ─── Root container ────────────────────────────────────────────────── */\n\n#hud-editor-root {\n  position: fixed;\n  top: 0;\n  left: 0;\n  width: 100vw;\n  height: 100vh;\n  z-index: 99999;\n  pointer-events: none;\n  font-family: 'Rajdhani', 'Segoe UI', Tahoma, sans-serif;\n  font-size: 14px;\n  color: #ccc;\n  background: rgba(0, 0, 0, 0.70);\n  display: none;\n  overflow: hidden;\n}\n\n#hud-editor-root[style*=\"block\"] {\n  pointer-events: auto;\n}\n\n/* ─── Screens ────────────────────────────────────────────────────────── */\n\n.hud-screen {\n  display: none;\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100vw;\n  height: 100vh;\n}\n\n.hud-screen.active {\n  display: flex;\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           START SCREEN                                */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n[data-screen=\"start\"] {\n  width: 80vw;\n  height: 80vh;\n  top: 10vh;\n  left: 10vw;\n  align-items: center;\n  justify-content: center;\n  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 18px;\n  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);\n  overflow: auto;\n}\n\n.start-container {\n  text-align: center;\n  max-width: 520px;\n  padding: 48px;\n}\n\n.start-header h1 {\n  font-size: 52px;\n  font-weight: 700;\n  color: #fff;\n  margin: 0 0 8px 0;\n  text-shadow: 0 0 30px rgba(14, 233, 231, 0.4);\n  letter-spacing: 1px;\n}\n\n.start-header .subtitle {\n  color: #777;\n  font-size: 18px;\n  margin: 0 0 48px 0;\n}\n\n.start-menu {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n}\n\n.menu-btn {\n  display: flex;\n  align-items: center;\n  width: 100%;\n  padding: 18px 24px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 12px;\n  cursor: pointer;\n  transition: all 0.2s ease;\n  text-align: left;\n  color: inherit;\n  font-family: inherit;\n  font-size: 16px;\n}\n\n.menu-btn:hover {\n  background: rgba(14, 233, 231, 0.08);\n  border-color: rgba(14, 233, 231, 0.3);\n  transform: translateX(6px);\n}\n\n.menu-btn.primary {\n  background: rgba(14, 233, 231, 0.10);\n  border-color: rgba(14, 233, 231, 0.3);\n}\n\n.menu-btn.primary:hover {\n  background: rgba(14, 233, 231, 0.18);\n  border-color: rgba(14, 233, 231, 0.5);\n}\n\n.menu-btn .icon {\n  font-size: 26px;\n  margin-right: 18px;\n  width: 32px;\n  text-align: center;\n  flex-shrink: 0;\n}\n\n.menu-btn .label-group {\n  display: flex;\n  flex-direction: column;\n}\n\n.menu-btn .label {\n  color: #fff;\n  font-size: 20px;\n  font-weight: 600;\n}\n\n.menu-btn .desc {\n  color: #666;\n  font-size: 13px;\n  margin-top: 3px;\n}\n\n.start-footer {\n  margin-top: 40px;\n}\n\n.hint {\n  color: #444;\n  font-size: 13px;\n  font-style: italic;\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           EDITOR SCREEN                               */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n[data-screen=\"editor\"] {\n  top: 8vh;\n  left: 6vw;\n  width: 88vw;\n  height: 84vh;\n  flex-direction: column;\n  background: #12121a;\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 18px;\n  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);\n  overflow: hidden;\n}\n\n/* ─── Toolbar ────────────────────────────────────────────────────────── */\n\n#editor-toolbar {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 8px 12px;\n  background: #1a1a24;\n  border-bottom: 1px solid #2a2a3a;\n  flex-shrink: 0;\n  min-height: 56px;\n}\n\n.toolbar-section {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n\n.toolbar-section label {\n  font-size: 13px;\n  color: #888;\n  margin-left: 8px;\n  margin-right: 4px;\n  white-space: nowrap;\n}\n\n.toolbar-divider {\n  width: 1px;\n  height: 28px;\n  background: #2a2a3a;\n  margin: 0 6px;\n}\n\n.toolbar-spacer {\n  flex: 1;\n}\n\n.tool-btn,\n.action-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-width: 60px;\n  height: 40px;\n  padding: 0 10px;\n  border: 1px solid transparent;\n  border-radius: 6px;\n  background: transparent;\n  color: #aaa;\n  cursor: pointer;\n  font-size: 13px;\n  font-weight: 600;\n  transition: all 0.15s ease;\n  font-family: inherit;\n  white-space: nowrap;\n}\n\n.tool-btn:hover,\n.action-btn:hover {\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n}\n\n.tool-btn.active {\n  background: rgba(14, 233, 231, 0.15);\n  border-color: rgba(14, 233, 231, 0.4);\n  color: #0ee9e7;\n}\n\n.color-picker {\n  width: 30px;\n  height: 30px;\n  border: 1px solid #444;\n  border-radius: 6px;\n  cursor: pointer;\n  background: none;\n  padding: 2px;\n}\n\n.color-picker::-webkit-color-swatch-wrapper {\n  padding: 0;\n}\n\n.color-picker::-webkit-color-swatch {\n  border: none;\n  border-radius: 4px;\n}\n\n.size-input {\n  width: 56px;\n  height: 36px;\n  background: #1a1a24;\n  border: 1px solid #3a3a4a;\n  border-radius: 6px;\n  color: #ccc;\n  font-size: 14px;\n  padding: 0 6px;\n  text-align: center;\n  font-family: inherit;\n}\n\n.size-input:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n  outline: none;\n}\n\n/* ─── Canvas area ────────────────────────────────────────────────────── */\n\n#canvas-container {\n  flex: 1;\n  overflow: hidden;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 20px;\n  background: #0a0a10;\n  position: relative;\n}\n\n#canvas-preview {\n  position: relative;\n  background: #1a1a24;\n  border: 1px solid #3a3a4a;\n  border-radius: 8px;\n  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);\n  overflow: hidden;\n}\n\n/* Canvas elements (rendered from document.elements) */\n.canvas-element {\n  position: absolute;\n  box-sizing: border-box;\n  cursor: pointer;\n  transition: opacity 0.1s ease;\n}\n\n.canvas-element:hover {\n  opacity: 0.85;\n}\n\n.canvas-element.selected {\n  outline: 2px solid rgba(14, 233, 231, 0.9);\n  outline-offset: 2px;\n}\n\n/* Selection handles */\n.resize-handle {\n  position: absolute;\n  width: 10px;\n  height: 10px;\n  background: #0ee9e7;\n  border: 1px solid #fff;\n  border-radius: 2px;\n  z-index: 100;\n  pointer-events: auto;\n}\n\n.resize-handle[data-h=\"nw\"] { cursor: nw-resize; top: -5px; left: -5px; }\n.resize-handle[data-h=\"n\"]  { cursor: n-resize;  top: -5px; left: calc(50% - 5px); }\n.resize-handle[data-h=\"ne\"] { cursor: ne-resize; top: -5px; right: -5px; }\n.resize-handle[data-h=\"e\"]  { cursor: e-resize;  top: calc(50% - 5px); right: -5px; }\n.resize-handle[data-h=\"se\"] { cursor: se-resize; bottom: -5px; right: -5px; }\n.resize-handle[data-h=\"s\"]  { cursor: s-resize;  bottom: -5px; left: calc(50% - 5px); }\n.resize-handle[data-h=\"sw\"] { cursor: sw-resize; bottom: -5px; left: -5px; }\n.resize-handle[data-h=\"w\"]  { cursor: w-resize;  top: calc(50% - 5px); left: -5px; }\n\n/* ─── Properties panel ──────────────────────────────────────────────── */\n\n#properties-panel {\n  position: absolute;\n  right: 12px;\n  top: 72px;\n  width: 260px;\n  background: #1a1a24;\n  border: 1px solid #2a2a3a;\n  border-radius: 8px;\n  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);\n  z-index: 50;\n  overflow: hidden;\n  display: none;\n}\n\n#properties-panel.visible {\n  display: block;\n}\n\n.panel-header {\n  padding: 10px 14px;\n  background: #1e1e2a;\n  border-bottom: 1px solid #2a2a3a;\n  font-weight: 600;\n  font-size: 13px;\n  color: #aaa;\n}\n\n.panel-content {\n  padding: 12px;\n}\n\n.prop-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 10px;\n}\n\n.prop-row.vertical {\n  flex-direction: column;\n  align-items: flex-start;\n}\n\n.prop-row label {\n  font-size: 12px;\n  color: #777;\n  min-width: 28px;\n}\n\n.prop-input {\n  flex: 1;\n  height: 28px;\n  background: #12121a;\n  border: 1px solid #3a3a4a;\n  border-radius: 4px;\n  color: #ccc;\n  font-size: 12px;\n  padding: 0 6px;\n  font-family: inherit;\n}\n\n.prop-input:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n  outline: none;\n}\n\n.prop-color {\n  width: 32px;\n  height: 28px;\n  border: 1px solid #3a3a4a;\n  border-radius: 4px;\n  cursor: pointer;\n  background: none;\n  padding: 1px;\n}\n\n.prop-textarea {\n  width: 100%;\n  background: #12121a;\n  border: 1px solid #3a3a4a;\n  border-radius: 4px;\n  color: #ccc;\n  font-size: 12px;\n  padding: 6px;\n  font-family: inherit;\n  resize: vertical;\n}\n\n.prop-textarea:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n  outline: none;\n}\n\n.prop-delete {\n  width: 100%;\n  padding: 8px;\n  background: rgba(255, 70, 70, 0.12);\n  border: 1px solid rgba(255, 70, 70, 0.3);\n  border-radius: 6px;\n  color: #ff6666;\n  cursor: pointer;\n  font-size: 13px;\n  font-family: inherit;\n  transition: all 0.15s ease;\n}\n\n.prop-delete:hover {\n  background: rgba(255, 70, 70, 0.22);\n  border-color: rgba(255, 70, 70, 0.5);\n}\n\n/* ─── Status bar ────────────────────────────────────────────────────── */\n\n#editor-statusbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 8px 12px;\n  background: #1a1a24;\n  border-top: 1px solid #2a2a3a;\n  flex-shrink: 0;\n  min-height: 60px;\n}\n\n.statusbar-left,\n.statusbar-right {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.statusbar-center {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}\n\n.status-btn {\n  min-width: 140px;\n  height: 40px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  padding: 0 18px;\n  border: 1px solid #3a3a4a;\n  border-radius: 6px;\n  background: rgba(255, 255, 255, 0.04);\n  color: #aaa;\n  cursor: pointer;\n  font-size: 15px;\n  font-weight: 600;\n  font-family: inherit;\n  transition: all 0.15s ease;\n  white-space: nowrap;\n}\n\n.status-btn:hover {\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n}\n\n.status-btn.primary {\n  background: rgba(14, 233, 231, 0.12);\n  border-color: rgba(14, 233, 231, 0.3);\n  color: #0ee9e7;\n}\n\n.status-btn.primary:hover {\n  background: rgba(14, 233, 231, 0.22);\n}\n\n.status-btn.danger {\n  background: rgba(255, 70, 70, 0.08);\n  border-color: rgba(255, 70, 70, 0.3);\n  color: #ff6666;\n}\n\n.status-btn.danger:hover {\n  background: rgba(255, 70, 70, 0.18);\n}\n\n.status-mode {\n  font-size: 15px;\n  color: #0ee9e7;\n  font-weight: 600;\n}\n\n.status-hint {\n  font-size: 13px;\n  color: #555;\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           DIALOGS                                     */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n.dialog-overlay {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  background: rgba(0, 0, 0, 0.7);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  z-index: 100000;\n}\n\n.dialog {\n  background: #1e1e2a;\n  border: 1px solid #3a3a4a;\n  border-radius: 12px;\n  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);\n  width: 420px;\n  max-width: 90vw;\n  max-height: 80vh;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n}\n\n.dialog-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 16px 20px;\n  border-bottom: 1px solid #2a2a3a;\n}\n\n.dialog-header h3 {\n  margin: 0;\n  font-size: 18px;\n  color: #fff;\n  font-weight: 600;\n}\n\n.dialog-close {\n  width: 28px;\n  height: 28px;\n  border: none;\n  background: none;\n  color: #777;\n  font-size: 20px;\n  cursor: pointer;\n  border-radius: 4px;\n}\n\n.dialog-close:hover {\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n}\n\n.dialog-content {\n  padding: 20px;\n  overflow-y: auto;\n}\n\n.dialog-footer {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 10px;\n  padding: 14px 20px;\n  border-top: 1px solid #2a2a3a;\n}\n\n.dialog-footer.centered {\n  justify-content: center;\n}\n\n/* Script list in load dialog */\n.script-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  max-height: 300px;\n  overflow-y: auto;\n}\n\n.script-item {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 10px 14px;\n  background: rgba(255, 255, 255, 0.03);\n  border: 1px solid #2a2a3a;\n  border-radius: 8px;\n  cursor: pointer;\n  transition: all 0.15s ease;\n}\n\n.script-item:hover {\n  background: rgba(14, 233, 231, 0.06);\n  border-color: rgba(14, 233, 231, 0.2);\n}\n\n.script-item .script-name {\n  font-size: 14px;\n  color: #ddd;\n}\n\n.script-item .script-meta {\n  font-size: 11px;\n  color: #666;\n}\n\n/* Save As dialog input */\n.saveas-input {\n  width: 100%;\n  height: 36px;\n  background: #12121a;\n  border: 1px solid #3a3a4a;\n  border-radius: 6px;\n  color: #ccc;\n  font-size: 14px;\n  padding: 0 12px;\n  font-family: inherit;\n  margin-top: 8px;\n}\n\n.saveas-input:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n  outline: none;\n}\n\n.save-note {\n  font-size: 12px;\n  color: #666;\n  margin-top: 8px;\n}\n\n/* Confirm dialog icon */\n.confirm-icon {\n  font-size: 36px;\n  text-align: center;\n  margin-bottom: 8px;\n}\n\n/* ─── Dialog buttons ─────────────────────────────────────────────────── */\n\n.btn {\n  padding: 8px 20px;\n  border: 1px solid #3a3a4a;\n  border-radius: 6px;\n  background: rgba(255, 255, 255, 0.04);\n  color: #aaa;\n  cursor: pointer;\n  font-size: 14px;\n  font-family: inherit;\n  transition: all 0.15s ease;\n}\n\n.btn:hover {\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n}\n\n.btn.primary {\n  background: rgba(14, 233, 231, 0.12);\n  border-color: rgba(14, 233, 231, 0.3);\n  color: #0ee9e7;\n}\n\n.btn.primary:hover {\n  background: rgba(14, 233, 231, 0.22);\n}\n\n.btn.danger {\n  background: rgba(255, 70, 70, 0.10);\n  border-color: rgba(255, 70, 70, 0.3);\n  color: #ff6666;\n}\n\n.btn.danger:hover {\n  background: rgba(255, 70, 70, 0.20);\n}\n\n.btn.secondary {\n  background: rgba(255, 255, 255, 0.04);\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           EMPTY STATE                                 */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n.empty-state {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  color: #444;\n  font-size: 16px;\n  gap: 12px;\n}\n\n.empty-state .icon {\n  font-size: 48px;\n  opacity: 0.3;\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           TOAST NOTIFICATIONS                         */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n.toast-container {\n  position: fixed;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n  z-index: 200000;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  align-items: center;\n  pointer-events: none;\n}\n\n.toast {\n  padding: 10px 20px;\n  background: #2a2a3a;\n  border: 1px solid #3a3a4a;\n  border-radius: 8px;\n  color: #ccc;\n  font-size: 13px;\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);\n  animation: toast-in 0.3s ease;\n  transition: opacity 0.25s ease, transform 0.25s ease;\n  pointer-events: auto;\n}\n\n.toast.success {\n  border-color: rgba(50, 200, 100, 0.4);\n  background: rgba(50, 200, 100, 0.1);\n  color: #6fd898;\n}\n\n.toast.error {\n  border-color: rgba(255, 70, 70, 0.4);\n  background: rgba(255, 70, 70, 0.1);\n  color: #ff8888;\n}\n\n.toast.info {\n  border-color: rgba(14, 233, 231, 0.3);\n  background: rgba(14, 233, 231, 0.08);\n  color: #0ee9e7;\n}\n\n@keyframes toast-in {\n  from { opacity: 0; transform: translateY(10px); }\n  to { opacity: 1; transform: translateY(0); }\n}\n";
  document.head.appendChild(style);
})();
// --- 000-core.js ---
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

// --- 010-start-screen.js ---
// 010-start-screen.js - Start screen UI + logic
(function hudEditorStartScreen() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;

  // ─── Build start screen DOM ──────────────────────────────────────────

  function buildStartScreen() {
    var container = el("div", {
      className: "hud-screen",
      dataset: { screen: "start" },
      style: { display: "none" },
    }, [
      el("div", { className: "start-container" }, [
        el("div", { className: "start-header" }, [
          el("h1", { textContent: "Lua Painter" }),
          el("p", { className: "subtitle", textContent: "HUD Layout Editor" }),
        ]),
        el("div", { className: "start-menu" }, [
          el("button", {
            className: "menu-btn primary",
            dataset: { action: "new" },
          }, [
            el("span", { className: "icon", textContent: "\u270F" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "New Script" }),
              el("span", { className: "desc", textContent: "Start a fresh layout" }),
            ]),
          ]),
          el("button", {
            className: "menu-btn",
            dataset: { action: "load" },
          }, [
            el("span", { className: "icon", textContent: "\u27A4" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "Load" }),
              el("span", { className: "desc", textContent: "Open existing layout from databank" }),
            ]),
          ]),
          el("button", {
            className: "menu-btn",
            dataset: { action: "saveas" },
          }, [
            el("span", { className: "icon", textContent: "\u2714" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "Save As" }),
              el("span", { className: "desc", textContent: "Save current layout as new script" }),
            ]),
          ]),
        ]),
      ]),
    ]);
    return container;
  }

  // ─── Action handlers ─────────────────────────────────────────────────

  function onNewScript() {
    var sw = 1920;
    var sh = 1080;
    APP.state.document = {
      version: 1,
      revision: 0,
      screenWidth: sw,
      screenHeight: sh,
      elements: [
        {
          id: "main_panel",
          type: "boxRounded",
          x: Math.round(sw * 0.05),
          y: Math.round(sh * 0.05),
          w: Math.round(sw * 0.9),
          h: Math.round(sh * 0.9),
          radius: 20,
          fill: [0.10, 0.11, 0.12, 0.98],
          stroke: [0.70, 0.72, 0.76, 1.00],
          strokeWidth: 3,
          textLines: ["New Layout"],
          textColor: [0.86, 0.88, 0.92, 1.0],
          textSize: 24,
          textAlign: "center",
        },
      ],
    };
    APP.state.isDirty = false;
    APP.showScreen("editor");
    APP.emit("document-created", APP.state.document);
  }

  function onLoad() {
    APP.emit("load-dialog-open");
  }

  function onSaveAs() {
    APP.emit("saveas-dialog-open");
  }

  // ─── Click delegation ────────────────────────────────────────────────

  function onMenuClick(e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;
    if (action === "new") onNewScript();
    else if (action === "load") onLoad();
    else if (action === "saveas") onSaveAs();
  }

  // ─── Register with core ──────────────────────────────────────────────

  APP.on("enter-edit", function () {
    if (APP.state.currentScreen === "start") {
      APP.showScreen("start");
    }
  });

  function mountStartScreen() {
    var root = APP.getRoot();
    if (qs('[data-screen="start"]', root)) return;
    var startScreen = buildStartScreen();
    root.appendChild(startScreen);
    startScreen.addEventListener("click", onMenuClick);
  }

  APP.init = (function (origInit) {
    return function () {
      origInit();
      mountStartScreen();
    };
  })(APP.init);

  mountStartScreen();
})();

// --- 020-editor-shell.js ---
// 020-editor-shell.js - Editor HTML structure + navigation
(function hudEditorShell() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;

  // ─── Build editor shell DOM ──────────────────────────────────────────

  function buildEditorShell() {
    var container = el("div", {
      className: "hud-screen",
      dataset: { screen: "editor" },
      style: { display: "none" },
    }, [

      // ── Toolbar ──
      el("div", { id: "editor-toolbar" }, [

        // Tool buttons
        el("div", { className: "toolbar-section tools" }, [
          el("button", { className: "tool-btn active", dataset: { tool: "select" }, title: "Select (V)", textContent: "Select" }),
          el("button", { className: "tool-btn", dataset: { tool: "box" }, title: "Box (B)", textContent: "Box" }),
          el("button", { className: "tool-btn", dataset: { tool: "rounded" }, title: "Rounded Box (R)", textContent: "Round" }),
          el("button", { className: "tool-btn", dataset: { tool: "circle" }, title: "Circle (C)", textContent: "Circle" }),
          el("button", { className: "tool-btn", dataset: { tool: "line" }, title: "Line (L)", textContent: "Line" }),
          el("button", { className: "tool-btn", dataset: { tool: "text" }, title: "Text (T)", textContent: "Text" }),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Color pickers
        el("div", { className: "toolbar-section colors" }, [
          el("label", { textContent: "Fill" }),
          el("input", {
            type: "color",
            className: "color-picker",
            value: "#3366FF",
            dataset: { prop: "fill" },
          }),
          el("label", { textContent: "Stroke" }),
          el("input", {
            type: "color",
            className: "color-picker",
            value: "#FFFFFF",
            dataset: { prop: "stroke" },
          }),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Size inputs
        el("div", { className: "toolbar-section size" }, [
          el("label", { textContent: "Stroke W" }),
          el("input", {
            type: "number",
            className: "size-input",
            value: "2",
            min: "0",
            max: "20",
            dataset: { prop: "strokeWidth" },
          }),
          el("label", { textContent: "Radius" }),
          el("input", {
            type: "number",
            className: "size-input",
            value: "12",
            min: "0",
            max: "200",
            dataset: { prop: "radius" },
          }),
        ]),

        el("div", { className: "toolbar-spacer" }),

        // Undo/Redo
        el("div", { className: "toolbar-section actions" }, [
          el("button", { className: "action-btn", dataset: { action: "undo" }, title: "Undo (Ctrl+Z)" }, [
            el("span", { textContent: "\u21A9" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "redo" }, title: "Redo (Ctrl+Y)" }, [
            el("span", { textContent: "\u21AA" }),
          ]),
        ]),
      ]),

      // ── Canvas area ──
      el("div", { id: "canvas-container" }, [
        el("div", { id: "canvas-preview" }),
      ]),

      // ── Properties panel ──
      el("div", { id: "properties-panel", className: "docked-panel" }, [
        el("div", { className: "panel-header" }, [
          el("span", { textContent: "Properties" }),
        ]),
        el("div", { className: "panel-content" }, [
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "X" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "x" } }),
            el("label", { textContent: "Y" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "y" } }),
          ]),
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "W" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "w" } }),
            el("label", { textContent: "H" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "h" } }),
          ]),
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "Fill" }),
            el("input", { type: "color", className: "prop-color", dataset: { prop: "fill" } }),
          ]),
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "Stroke" }),
            el("input", { type: "color", className: "prop-color", dataset: { prop: "stroke" } }),
          ]),
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "Stroke W" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "strokeWidth" } }),
          ]),
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "Radius" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "radius" } }),
          ]),
          el("div", { className: "prop-row vertical" }, [
            el("label", { textContent: "Text" }),
            el("textarea", { className: "prop-textarea", rows: "3", dataset: { prop: "textLines" } }),
          ]),
          el("div", { className: "prop-row" }, [
            el("button", {
              className: "prop-delete",
              dataset: { action: "delete-element" },
              textContent: "Delete Element",
            }),
          ]),
        ]),
      ]),

      // ── Status bar ──
      el("div", { id: "editor-statusbar" }, [
        el("div", { className: "statusbar-left" }, [
          el("button", {
            className: "status-btn primary",
            dataset: { action: "save" },
            textContent: "Save",
          }),
          el("button", {
            className: "status-btn",
            dataset: { action: "save-exit" },
            textContent: "Save + Exit",
          }),
        ]),
        el("div", { className: "statusbar-center" }, [
          el("span", { className: "status-mode", textContent: "Editing" }),
          el("span", { className: "status-hint", textContent: "Use the HUD Editor button to close" }),
        ]),
        el("div", { className: "statusbar-right" }, [
          el("button", {
            className: "status-btn",
            dataset: { action: "export-board" },
            textContent: "Export Board",
          }),
          el("button", {
            className: "status-btn",
            dataset: { action: "export-screen" },
            textContent: "Export Screen",
          }),
          el("button", {
            className: "status-btn danger",
            dataset: { action: "close" },
            textContent: "Close",
          }),
        ]),
      ]),
    ]);

    return container;
  }

  // ─── Toolbar click delegation ────────────────────────────────────────

  function onToolbarClick(e) {
    var btn = e.target.closest("[data-tool]");
    if (btn) {
      APP.state.currentTool = btn.dataset.tool;
      updateToolButtons(APP.state.currentTool);
      APP.emit("tool-changed", APP.state.currentTool);
      return;
    }

    var actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;

    var action = actionBtn.dataset.action;
    if (action === "undo") APP.emit("undo");
    else if (action === "redo") APP.emit("redo");
    else if (action === "save") APP.emit("save");
    else if (action === "save-exit") APP.emit("save-exit");
    else if (action === "export-board") APP.emit("export-board");
    else if (action === "export-screen") APP.emit("export-screen");
    else if (action === "close") APP.emit("close-editor");
    else if (action === "delete-element" && APP.state.selectedElementId) {
      APP.emit("delete-element", APP.state.selectedElementId);
    }
  }

  // ─── Navigation ──────────────────────────────────────────────────────

  function goToStart() {
    APP.showScreen("start");
  }

  function goToEditor() {
    APP.showScreen("editor");
    setTimeout(function () {
      APP.emit("resize");
    }, 0);
    requestAnimationFrame(function () {
      APP.emit("resize");
    });
  }

  function updateToolButtons(activeTool) {
    var root = APP.getRoot();
    qsa("#editor-toolbar .tool-btn", root).forEach(function (button) {
      if (button.dataset.tool === activeTool) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
  }

  // ─── Register with core ──────────────────────────────────────────────

  APP.on("document-created", function () {
    goToEditor();
  });

  APP.on("tool-changed", function (tool) {
    updateToolButtons(tool || APP.state.currentTool);
  });

  function mountEditorShell() {
    var root = APP.getRoot();
    if (qs('[data-screen="editor"]', root)) return;
    var editorShell = buildEditorShell();
    root.appendChild(editorShell);

    var toolbar = qs("#editor-toolbar", root);
    if (toolbar) toolbar.addEventListener("click", onToolbarClick);

    var statusbar = qs("#editor-statusbar", root);
    if (statusbar) statusbar.addEventListener("click", onToolbarClick);

    var propsPanel = qs("#properties-panel", root);
    if (propsPanel) propsPanel.addEventListener("click", onToolbarClick);
  }

  APP.init = (function (origInit) {
    return function () {
      origInit();
      mountEditorShell();
    };
  })(APP.init);

  mountEditorShell();

  // Expose
  APP.goToStart = goToStart;
  APP.goToEditor = goToEditor;
  APP.updateToolButtons = updateToolButtons;
})();

// --- 030-canvas-renderer.js ---
// 030-canvas-renderer.js - DOM-based element rendering for WYSIWYG preview
(function hudEditorCanvasRenderer() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;

  // ─── Config ──────────────────────────────────────────────────────────

  var CANVAS_PADDING = 32;  // px padding around preview
  var DEFAULT_SCREEN_W = 1920;
  var DEFAULT_SCREEN_H = 1080;

  // ─── State ──────────────────────────────────────────────────────────

  var scale = 1;
  var canvasW = DEFAULT_SCREEN_W;
  var canvasH = DEFAULT_SCREEN_H;
  var renderPending = false;

  // ─── Coordinate conversion ──────────────────────────────────────────

  function screenToCanvas(sx, sy) {
    return {
      x: Math.round(sx * scale),
      y: Math.round(sy * scale),
    };
  }

  function canvasToScreen(cx, cy) {
    return {
      x: Math.round(cx / scale),
      y: Math.round(cy / scale),
    };
  }

  // ─── Color helpers ─────────────────────────────────────────────────

  function rgbaToCss(rgba) {
    if (!rgba || rgba.length < 4) return "transparent";
    var r = Math.round((rgba[0] || 0) * 255);
    var g = Math.round((rgba[1] || 0) * 255);
    var b = Math.round((rgba[2] || 0) * 255);
    var a = rgba[3] !== undefined ? rgba[3] : 1;
    if (a >= 1) {
      return "rgb(" + r + "," + g + "," + b + ")";
    }
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function cssToRgba(css) {
    // Parse #RRGGBB or #RGB
    var hex = css.replace("#", "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return [0, 0, 0, 1];
    var r = parseInt(hex.substr(0, 2), 16) / 255;
    var g = parseInt(hex.substr(2, 2), 16) / 255;
    var b = parseInt(hex.substr(4, 2), 16) / 255;
    return [r, g, b, 1];
  }

  // ─── Element DOM creation ───────────────────────────────────────────

  function createElementDom(element) {
    var dom = el("div", {
      className: "canvas-element",
      dataset: { elementId: element.id },
    });

    applyElementStyles(dom, element);
    return dom;
  }

  function applyElementStyles(dom, element) {
    var pos = screenToCanvas(element.x, element.y);
    var size = screenToCanvas(element.w, element.h);

    dom.style.left = pos.x + "px";
    dom.style.top = pos.y + "px";
    dom.style.width = size.x + "px";
    dom.style.height = size.y + "px";

    var fill = rgbaToCss(element.fill);
    var stroke = rgbaToCss(element.stroke);
    var strokeWidth = element.strokeWidth || 0;

    switch (element.type) {
      case "boxRounded":
        dom.style.background = fill;
        dom.style.border = strokeWidth + "px solid " + stroke;
        dom.style.borderRadius = (element.radius || 0) * scale + "px";
        dom.style.boxSizing = "border-box";
        break;

      case "box":
        dom.style.background = fill;
        dom.style.border = strokeWidth + "px solid " + stroke;
        dom.style.boxSizing = "border-box";
        break;

      case "circle":
        dom.style.background = fill;
        dom.style.border = strokeWidth + "px solid " + stroke;
        dom.style.borderRadius = "50%";
        dom.style.boxSizing = "border-box";
        break;

      case "line":
        dom.style.background = "transparent";
        dom.style.border = "none";
        dom.style.boxSizing = "border-box";
        // Lines use a pseudo-element or background for the line itself
        // For simplicity, draw as a rotated thin div
        var len = Math.sqrt(size.x * size.x + size.y * size.y);
        dom.style.width = len + "px";
        dom.style.height = Math.max(1, strokeWidth) + "px";
        dom.style.background = stroke;
        dom.style.borderRadius = "0";
        // Position at center
        dom.style.left = (pos.x + size.x / 2 - len / 2) + "px";
        dom.style.top = (pos.y + size.y / 2 - strokeWidth / 2) + "px";
        // Approximate angle (assumes line from top-left to bottom-right)
        var angle = Math.atan2(size.y, size.x) * 180 / Math.PI;
        dom.style.transform = "rotate(" + angle + "deg)";
        dom.style.transformOrigin = "center center";
        break;

      case "text":
        dom.style.background = fill;
        dom.style.border = strokeWidth + "px solid " + stroke;
        dom.style.borderRadius = (element.radius || 0) * scale + "px";
        dom.style.boxSizing = "border-box";
        dom.style.display = "flex";
        dom.style.alignItems = "center";
        dom.style.justifyContent = element.textAlign === "center" ? "center" :
                                   element.textAlign === "right" ? "flex-end" : "flex-start";
        dom.style.padding = "4px 8px";
        dom.style.overflow = "hidden";
        dom.style.color = rgbaToCss(element.textColor || [1, 1, 1, 1]);
        dom.style.fontSize = ((element.textSize || 16) * scale) + "px";
        dom.style.fontFamily = "Rajdhani, Segoe UI, sans-serif";
        dom.style.textAlign = element.textAlign || "left";
        dom.style.whiteSpace = "pre-wrap";
        dom.style.wordBreak = "break-word";
        // Text content
        var lines = element.textLines || [];
        dom.textContent = Array.isArray(lines) ? lines.join("\n") : lines;
        break;

      default:
        dom.style.background = fill;
        dom.style.border = strokeWidth + "px solid " + stroke;
        dom.style.boxSizing = "border-box";
    }
  }

  // ─── Selection overlay ─────────────────────────────────────────────

  function createSelectionOverlay(element) {
    var overlay = el("div", {
      className: "selection-overlay",
      dataset: { elementId: element.id + "_sel" },
    });

    // Outline
    var outline = el("div", { className: "selection-outline" });
    overlay.appendChild(outline);

    // 8 resize handles
    var handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    handles.forEach(function (h) {
      var handle = el("div", {
        className: "resize-handle",
        dataset: { h: h, elementId: element.id },
      });
      overlay.appendChild(handle);
    });

    // Size/position the overlay
    var pos = screenToCanvas(element.x, element.y);
    var size = screenToCanvas(element.w, element.h);

    overlay.style.position = "absolute";
    overlay.style.left = (pos.x - 2) + "px";
    overlay.style.top = (pos.y - 2) + "px";
    overlay.style.width = (size.x + 4) + "px";
    overlay.style.height = (size.y + 4) + "px";
    overlay.style.pointerEvents = "none";
    outline.style.position = "absolute";
    outline.style.inset = "0";
    outline.style.border = "2px solid rgba(14, 233, 231, 0.9)";

    return overlay;
  }

  function clearSelectionOverlays() {
    var preview = getCanvasPreview();
    if (!preview) return;
    qsa('.selection-overlay', preview).forEach(function (node) {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  // ─── Render all elements ────────────────────────────────────────────

  function getCanvasPreview() {
    return qs("#canvas-preview");
  }

  function clearCanvas() {
    var preview = getCanvasPreview();
    if (!preview) return;
    // Remove all child elements but keep structure
    while (preview.firstChild) {
      preview.removeChild(preview.firstChild);
    }
  }

  function renderDocument() {
    var doc = APP.state.document;
    if (!doc) return;

    var preview = getCanvasPreview();
    if (!preview) return;

    clearCanvas();

    // Update canvas size from document
    canvasW = doc.screenWidth || DEFAULT_SCREEN_W;
    canvasH = doc.screenHeight || DEFAULT_SCREEN_H;

    // Size the preview container
    sizeCanvasPreview();

    // Render each element
    var elements = doc.elements || [];
    elements.forEach(function (element) {
      var dom = createElementDom(element);
      preview.appendChild(dom);
    });

    // Render selection if something is selected
    clearSelectionOverlays();
    if (APP.state.selectedElementId) {
      var selectedEl = findElementById(APP.state.selectedElementId);
      if (selectedEl) {
        var overlay = createSelectionOverlay(selectedEl);
        preview.appendChild(overlay);
      }
    }

    renderPending = false;
  }

  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(function () {
      renderDocument();
    });
  }

  function findElementById(id) {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return null;
    return doc.elements.find(function (el) {
      return el.id === id;
    }) || null;
  }

  // ─── Size canvas preview to fit container ──────────────────────────

  function sizeCanvasPreview() {
    var container = qs("#canvas-container");
    var preview = getCanvasPreview();
    if (!container || !preview) return;

    var availW = container.clientWidth - CANVAS_PADDING * 2;
    var availH = container.clientHeight - CANVAS_PADDING * 2;

    // Fit canvas within available space, maintaining aspect ratio
    var aspectScreen = canvasW / canvasH;
    var aspectAvail = availW / availH;

    var fitW, fitH;
    if (aspectAvail > aspectScreen) {
      // Available is wider than screen - fit to height
      fitH = availH;
      fitW = fitH * aspectScreen;
    } else {
      // Available is taller than screen - fit to width
      fitW = availW;
      fitH = fitW / aspectScreen;
    }

    fitW = Math.max(64, Math.min(fitW, availW));
    fitH = Math.max(36, Math.min(fitH, availH));

    preview.style.width = fitW + "px";
    preview.style.height = fitH + "px";

    scale = fitW / canvasW;
  }

  // ─── Update single element in DOM ─────────────────────────────────

  function updateElementDom(elementId) {
    var preview = getCanvasPreview();
    if (!preview) return;

    var dom = qs('[data-element-id="' + elementId + '"]', preview);
    if (!dom) return;

    var element = findElementById(elementId);
    if (!element) {
      preview.removeChild(dom);
      return;
    }

    applyElementStyles(dom, element);

    // Update selection overlay if selected
    clearSelectionOverlays();
    if (APP.state.selectedElementId === elementId) {
      var overlay = createSelectionOverlay(element);
      preview.appendChild(overlay);
    }
  }

  // ─── Remove element from DOM ──────────────────────────────────────

  function removeElementDom(elementId) {
    var preview = getCanvasPreview();
    if (!preview) return;

    var dom = qs('[data-element-id="' + elementId + '"]', preview);
    if (dom) preview.removeChild(dom);

    var selOverlay = qs('[data-element-id="' + elementId + '_sel"]', preview);
    if (selOverlay) preview.removeChild(selOverlay);
  }

  // ─── Add element to DOM ───────────────────────────────────────────

  function addElementDom(element) {
    var preview = getCanvasPreview();
    if (!preview) return;

    var dom = createElementDom(element);
    preview.appendChild(dom);
  }

  // ─── Event listeners ────────────────────────────────────────────────

  APP.on("document-created", function () {
    scheduleRender();
  });

  APP.on("document-loaded", function () {
    scheduleRender();
  });

  APP.on("element-added", function (element) {
    addElementDom(element);
    if (APP.state.selectedElementId === element.id) {
      var preview = getCanvasPreview();
      if (preview) {
        var selOverlay = qs('[data-element-id="' + element.id + '_sel"]', preview);
        if (selOverlay) preview.removeChild(selOverlay);
        var overlay = createSelectionOverlay(element);
        preview.appendChild(overlay);
      }
    }
  });

  APP.on("element-updated", function (elementId) {
    updateElementDom(elementId);
  });

  APP.on("element-deleted", function (elementId) {
    removeElementDom(elementId);
  });

  APP.on("selection-changed", function () {
    // Re-render to show/hide selection overlay
    scheduleRender();
  });

  APP.on("deselect-all", function () {
    scheduleRender();
  });

  APP.on("tool-changed", function () {
    // Could change cursor style based on tool
  });

  APP.on("resize", function () {
    sizeCanvasPreview();
    scheduleRender();
  });

  // ─── Public API ────────────────────────────────────────────────────

  APP.canvas = {
    render: renderDocument,
    scheduleRender: scheduleRender,
    updateElement: updateElementDom,
    removeElement: removeElementDom,
    addElement: addElementDom,
    screenToCanvas: screenToCanvas,
    canvasToScreen: canvasToScreen,
    getScale: function () { return scale; },
    getElementById: findElementById,
    sizePreview: sizeCanvasPreview,
    applyElementStyles: applyElementStyles,
    clearSelectionOverlays: clearSelectionOverlays,
    _getPreview: getCanvasPreview,
  };

  // ─── Init: size canvas on window resize ───────────────────────────

  function onWindowResize() {
    if (APP.state.editModeActive) {
      APP.emit("resize");
    }
  }

  window.addEventListener("resize", onWindowResize);
  if (typeof APP.cleanup === "function") {
    APP.cleanup(function () {
      window.removeEventListener("resize", onWindowResize);
    });
  }

  // Initial size when entering edit mode
  APP.on("enter-edit", function () {
    sizeCanvasPreview();
    scheduleRender();
  });

})();

// --- 040-tool-handlers.js ---
// 040-tool-handlers.js - Tool selection and element creation
(function hudEditorToolHandlers() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Tool state ────────────────────────────────────────────────────

  var isCreating = false;
  var createStartX = 0;
  var createStartY = 0;
  var createCurrentX = 0;
  var createCurrentY = 0;
  var tempElement = null;
  var tempDom = null;

  function ensureCanvasCreateListeners() {
    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;
    if (preview.__hudEditorCreateBound) return;
    preview.__hudEditorCreateBound = true;
    preview.addEventListener("mousedown", onCanvasMouseDown);
    preview.addEventListener("mousemove", onCanvasMouseMove);
    preview.addEventListener("mouseup", onCanvasMouseUp);
  }

  // ─── Tool to element type mapping ─────────────────────────────────

  var toolToType = {
    select: null,
    box: "box",
    rounded: "boxRounded",
    circle: "circle",
    line: "line",
    text: "text",
  };

  // ─── Generate unique element ID ────────────────────────────────────

  function generateId() {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return "el_" + Date.now();
    var base = "el";
    var counter = doc.elements.length + 1;
    var id = base + "_" + counter;
    // Ensure uniqueness
    while (doc.elements.find(function (e) { return e.id === id; })) {
      counter++;
      id = base + "_" + counter;
    }
    return id;
  }

  // ─── Create element from current tool ─────────────────────────────

  function createNewElement(screenX, screenY) {
    var tool = APP.state.currentTool;
    var type = toolToType[tool];
    if (!type) return null;

    var sw = APP.state.document ? APP.state.document.screenWidth : 1920;
    var sh = APP.state.document ? APP.state.document.screenHeight : 1080;

    var defaultSize = 100;
    if (tool === "line") {
      defaultSize = 150;
    } else if (tool === "text") {
      defaultSize = 200;
    }

    var element = {
      id: generateId(),
      type: type,
      x: Math.max(0, Math.min(screenX - defaultSize / 2, sw - defaultSize)),
      y: Math.max(0, Math.min(screenY - defaultSize / 2, sh - defaultSize)),
      w: defaultSize,
      h: defaultSize,
      radius: 12,
      fill: [0.15, 0.15, 0.18, 0.95],
      stroke: [0.70, 0.72, 0.76, 1.0],
      strokeWidth: 2,
      textLines: tool === "text" ? ["Text"] : null,
      textColor: [0.86, 0.88, 0.92, 1.0],
      textSize: 16,
      textAlign: "center",
    };

    return element;
  }

  // ─── Update temp element during drag ───────────────────────────────

  function updateTempElement(screenX, screenY) {
    if (!tempElement) return;

    var tool = APP.state.currentTool;
    var sx = Math.min(createStartX, screenX);
    var sy = Math.min(createStartY, screenY);
    var ex = Math.max(createStartX, screenX);
    var ey = Math.max(createStartY, screenY);

    tempElement.x = sx;
    tempElement.y = sy;
    tempElement.w = Math.max(10, ex - sx);
    tempElement.h = Math.max(10, ey - sy);

    // Update the temp DOM
    if (tempDom && APP.canvas && typeof APP.canvas.applyElementStyles === "function") {
      APP.canvas.applyElementStyles(tempDom, tempElement);
    }
  }

  // ─── Finalize element creation ─────────────────────────────────────

  function finalizeCreation() {
    if (!tempElement) return null;

    // Only create if element has meaningful size
    if (tempElement.w < 10 || tempElement.h < 10) {
      // Remove temp DOM
      if (tempDom) {
        var preview = APP.canvas && APP.canvas.getElementById ? null : null;
        // Temp DOM will be cleaned up by scheduleRender on cancel
      }
      cancelCreation();
      return null;
    }

    // Add to document once
    if (APP.state.document && APP.state.document.elements) {
      APP.state.document.elements.push(tempElement);
      APP.state.isDirty = true;

      // Select the new element
      APP.state.selectedElementId = tempElement.id;

      // Emit events
      APP.emit("element-added", tempElement);
      APP.emit("selection-changed", tempElement.id);
    }

    var created = tempElement;
    tempElement = null;
    tempDom = null;
    isCreating = false;

    return created;
  }

  // ─── Cancel creation ───────────────────────────────────────────────

  function cancelCreation() {
    if (tempElement) {
      // Remove temp DOM if exists
      if (tempDom) {
        var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
        if (preview && preview.querySelector) {
          var dom = preview.querySelector('[data-element-id="' + tempElement.id + '"]');
          if (dom) preview.removeChild(dom);
        }
        tempDom = null;
      }
      tempElement = null;
    }
    isCreating = false;
    APP.emit("creating-cancelled");
  }

  // ─── Canvas mouse handlers ─────────────────────────────────────────

  function onCanvasMouseDown(e) {
    if (!APP.state.editModeActive) return;
    if (APP.state.currentScreen !== "editor") return;

    var tool = APP.state.currentTool;

    // If in select mode, let selection-manager handle it
    if (tool === "select") return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    createStartX = screen.x;
    createStartY = screen.y;
    createCurrentX = screen.x;
    createCurrentY = screen.y;

    tempElement = createNewElement(screen.x, screen.y);
    if (!tempElement) return;

    isCreating = true;

    // Create temp DOM
    tempDom = document.createElement("div");
    tempDom.className = "canvas-element creating";
    tempDom.dataset.elementId = tempElement.id;
    tempDom.style.opacity = "0.6";
    preview.appendChild(tempDom);

    if (APP.canvas && typeof APP.canvas.applyElementStyles === "function") {
      APP.canvas.applyElementStyles(tempDom, tempElement);
    }
    APP.emit("creation-started", tempElement);
  }

  function onCanvasMouseMove(e) {
    if (!isCreating || !tempElement) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    createCurrentX = screen.x;
    createCurrentY = screen.y;

    updateTempElement(screen.x, screen.y);
  }

  function onCanvasMouseUp(e) {
    if (!isCreating) return;
    finalizeCreation();
  }

  // ─── Attach canvas events ──────────────────────────────────────────

  APP.on("enter-edit", function () {
    if (APP.state.currentScreen !== "editor") return;
    setTimeout(ensureCanvasCreateListeners, 0);
  });

  APP.on("document-created", function () {
    setTimeout(ensureCanvasCreateListeners, 0);
  });

  APP.on("document-loaded", function () {
    setTimeout(ensureCanvasCreateListeners, 0);
  });

  // Expose for selection manager
  APP.tools = {
    isCreating: function () { return isCreating; },
    cancelCreation: cancelCreation,
    finalizeCreation: finalizeCreation,
  };

})();

// --- 050-selection-manager.js ---
// 050-selection-manager.js - Element selection and hit testing
(function hudEditorSelectionManager() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Hit testing ───────────────────────────────────────────────────

  function pointInElement(x, y, element) {
    if (!element) return false;
    return x >= element.x &&
           x <= element.x + element.w &&
           y >= element.y &&
           y <= element.y + element.h;
  }

  function hitTest(screenX, screenY) {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return null;

    // Test in reverse order (top-most first)
    var elements = doc.elements;
    for (var i = elements.length - 1; i >= 0; i--) {
      var el = elements[i];
      if (pointInElement(screenX, screenY, el)) {
        return el;
      }
    }
    return null;
  }

  // ─── Selection ─────────────────────────────────────────────────────

  function selectElement(elementId) {
    if (APP.state.selectedElementId === elementId) {
      APP.emit("selection-changed", elementId);
      return;
    }

    APP.state.selectedElementId = elementId;
    APP.emit("selection-changed", elementId);
  }

  function deselectAll() {
    if (!APP.state.selectedElementId) return;
    APP.state.selectedElementId = null;
    APP.emit("selection-changed", null);
    APP.emit("deselect-all");
  }

  function deleteSelected() {
    var id = APP.state.selectedElementId;
    if (!id) return;

    var doc = APP.state.document;
    if (!doc || !doc.elements) return;

    var idx = -1;
    for (var i = 0; i < doc.elements.length; i++) {
      if (doc.elements[i].id === id) {
        idx = i;
        break;
      }
    }

    if (idx >= 0) {
      doc.elements.splice(idx, 1);
      APP.state.isDirty = true;
      APP.emit("element-deleted", id);
    }

    deselectAll();
  }

  // ─── Canvas click handler ──────────────────────────────────────────

  function onCanvasClick(e) {
    if (!APP.state.editModeActive) return;
    if (APP.state.currentScreen !== "editor") return;
    if (APP.state.currentTool !== "select") return;

    // Ignore clicks on resize handles
    if (e.target.classList && e.target.classList.contains("resize-handle")) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    // Don't process if clicking on UI panels
    if (e.target.closest("#properties-panel")) return;
    if (e.target.closest("#editor-toolbar")) return;
    if (e.target.closest("#editor-statusbar")) return;

    var clickedElement = e.target.closest(".canvas-element");
    if (clickedElement && clickedElement.dataset && clickedElement.dataset.elementId) {
      selectElement(clickedElement.dataset.elementId);
      return;
    }

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    var hit = hitTest(screen.x, screen.y);

    if (hit) {
      selectElement(hit.id);
    } else {
      deselectAll();
    }
  }

  // ─── Resize handle drag state ─────────────────────────────────────

  var resizeState = {
    active: false,
    elementId: null,
    handle: null,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    origW: 0,
    origH: 0,
  };

  function ensureCanvasSelectionListeners() {
    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;
    if (!preview.__hudEditorSelectBound) {
      preview.__hudEditorSelectBound = true;
      preview.addEventListener("click", onCanvasClick);
      preview.addEventListener("mousedown", onResizeHandleMouseDown, true);
    }
  }

  function onResizeHandleMouseDown(e) {
    e.stopPropagation();
    e.preventDefault();

    if (!APP.state.editModeActive) return;

    var handle = e.target;
    var elementId = handle.dataset.elementId;
    var handleType = handle.dataset.h;

    var element = APP.canvas.getElementById(elementId);
    if (!element) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    resizeState.active = true;
    resizeState.elementId = elementId;
    resizeState.handle = handleType;
    resizeState.startX = screen.x;
    resizeState.startY = screen.y;
    resizeState.origX = element.x;
    resizeState.origY = element.y;
    resizeState.origW = element.w;
    resizeState.origH = element.h;

    document.addEventListener("mousemove", onResizeMouseMove);
    document.addEventListener("mouseup", onResizeMouseUp);
  }

  function onResizeMouseMove(e) {
    if (!resizeState.active) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    var dx = screen.x - resizeState.startX;
    var dy = screen.y - resizeState.startY;

    var elem = APP.canvas.getElementById(resizeState.elementId);
    if (!elem) return;

    var h = resizeState.handle;

    // Calculate new bounds based on handle
    var newX = resizeState.origX;
    var newY = resizeState.origY;
    var newW = resizeState.origW;
    var newH = resizeState.origH;

    if (h.includes("e")) {
      newW = Math.max(10, resizeState.origW + dx);
    }
    if (h.includes("s")) {
      newH = Math.max(10, resizeState.origH + dy);
    }
    if (h.includes("w")) {
      var nw = Math.max(10, resizeState.origW - dx);
      newX = resizeState.origX + resizeState.origW - nw;
      newW = nw;
    }
    if (h.includes("n")) {
      var nh = Math.max(10, resizeState.origH - dy);
      newY = resizeState.origY + resizeState.origH - nh;
      newH = nh;
    }

    elem.x = newX;
    elem.y = newY;
    elem.w = newW;
    elem.h = newH;

    APP.state.isDirty = true;
    APP.canvas.updateElement(resizeState.elementId);
  }

  function onResizeMouseUp(e) {
    if (!resizeState.active) return;

    resizeState.active = false;
    document.removeEventListener("mousemove", onResizeMouseMove);
    document.removeEventListener("mouseup", onResizeMouseUp);

    APP.emit("element-updated", resizeState.elementId);
  }

  // ─── Attach events ─────────────────────────────────────────────────

  APP.on("enter-edit", function () {
    if (APP.state.currentScreen !== "editor") return;
    setTimeout(ensureCanvasSelectionListeners, 0);
  });

  APP.on("document-created", function () {
    setTimeout(ensureCanvasSelectionListeners, 0);
  });

  APP.on("document-loaded", function () {
    setTimeout(ensureCanvasSelectionListeners, 0);
  });

  // Handle resize handles added later via mutation or render
  APP.on("selection-changed", function () {
    // Attach resize handle listeners when selection changes
    setTimeout(function () {
      var handles = document.querySelectorAll(".resize-handle");
      handles.forEach(function (h) {
        h.removeEventListener("mousedown", onResizeHandleMouseDown);
        h.addEventListener("mousedown", onResizeHandleMouseDown);
      });
    }, 10);
  });

  APP.on("tool-changed", function (tool) {
    if (tool !== "select") {
      deselectAll();
    }
  });

  // ─── Public API ────────────────────────────────────────────────────

  APP.selection = {
    select: selectElement,
    deselect: deselectAll,
    deleteSelected: deleteSelected,
    hitTest: hitTest,
  };

  if (typeof APP.cleanup === "function") {
    APP.cleanup(function () {
      resizeState.active = false;
      document.removeEventListener("mousemove", onResizeMouseMove);
      document.removeEventListener("mouseup", onResizeMouseUp);
    });
  }

})();

// --- 070-properties-panel.js ---
// 070-properties-panel.js - Properties editing UI + binding
(function hudEditorPropertiesPanel() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var qs = APP.qs;
  var qsa = APP.qsa;

  // ─── Property sync: document → panel ───────────────────────────────

  function populatePanel(elementId) {
    var element = APP.canvas.getElementById(elementId);
    if (!element) {
      hidePanel();
      return;
    }

    var panel = qs("#properties-panel");
    if (!panel) return;

    panel.classList.add("visible");

    // Position X/Y
    var xInput = qs('[data-prop="x"]', panel);
    var yInput = qs('[data-prop="y"]', panel);
    var wInput = qs('[data-prop="w"]', panel);
    var hInput = qs('[data-prop="h"]', panel);
    var radiusInput = qs('[data-prop="radius"]', panel);
    var strokeWidthInput = qs('[data-prop="strokeWidth"]', panel);
    var textArea = qs('[data-prop="textLines"]', panel);

    if (xInput) xInput.value = Math.round(element.x);
    if (yInput) yInput.value = Math.round(element.y);
    if (wInput) wInput.value = Math.round(element.w);
    if (hInput) hInput.value = Math.round(element.h);
    if (radiusInput) radiusInput.value = element.radius || 0;
    if (strokeWidthInput) strokeWidthInput.value = element.strokeWidth || 0;

    // Colors
    var fillInput = qs('[data-prop="fill"]', panel);
    var strokeInput = qs('[data-prop="stroke"]', panel);
    if (fillInput) fillInput.value = rgbaToHex(element.fill);
    if (strokeInput) strokeInput.value = rgbaToHex(element.stroke);

    // Text
    if (textArea) {
      var lines = element.textLines || [];
      textArea.value = Array.isArray(lines) ? lines.join("\n") : (lines || "");
    }
  }

  // ─── Property sync: panel → document ──────────────────────────────

  function applyPanelChange(prop, value) {
    var elementId = APP.state.selectedElementId;
    if (!elementId) return;

    var element = APP.canvas.getElementById(elementId);
    if (!element) return;

    var changed = false;

    switch (prop) {
      case "x":
        element.x = parseFloat(value) || 0;
        changed = true;
        break;
      case "y":
        element.y = parseFloat(value) || 0;
        changed = true;
        break;
      case "w":
        element.w = Math.max(1, parseFloat(value) || 1);
        changed = true;
        break;
      case "h":
        element.h = Math.max(1, parseFloat(value) || 1);
        changed = true;
        break;
      case "radius":
        element.radius = Math.max(0, parseFloat(value) || 0);
        changed = true;
        break;
      case "strokeWidth":
        element.strokeWidth = Math.max(0, parseFloat(value) || 0);
        changed = true;
        break;
      case "fill":
        element.fill = hexToRgba(value);
        changed = true;
        break;
      case "stroke":
        element.stroke = hexToRgba(value);
        changed = true;
        break;
      case "textLines":
        element.textLines = value.split("\n");
        changed = true;
        break;
    }

    if (changed) {
      APP.state.isDirty = true;
      APP.canvas.updateElement(elementId);
      APP.emit("element-updated", elementId);
    }
  }

  // ─── Color conversion ─────────────────────────────────────────────

  function rgbaToHex(rgba) {
    if (!rgba || rgba.length < 4) return "#ffffff";
    var r = Math.round(rgba[0] * 255);
    var g = Math.round(rgba[1] * 255);
    var b = Math.round(rgba[2] * 255);
    return "#" +
      (r < 16 ? "0" : "") + r.toString(16) +
      (g < 16 ? "0" : "") + g.toString(16) +
      (b < 16 ? "0" : "") + b.toString(16);
  }

  function hexToRgba(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return [1, 1, 1, 1];
    var r = parseInt(hex.substr(0, 2), 16) / 255;
    var g = parseInt(hex.substr(2, 2), 16) / 255;
    var b = parseInt(hex.substr(4, 2), 16) / 255;
    return [r, g, b, 1];
  }

  // ─── Panel visibility ─────────────────────────────────────────────

  function showPanel() {
    var panel = qs("#properties-panel");
    if (panel) panel.classList.add("visible");
  }

  function hidePanel() {
    var panel = qs("#properties-panel");
    if (panel) panel.classList.remove("visible");
  }

  // ─── Input event handlers ─────────────────────────────────────────

  function onInputChange(e) {
    var input = e.target;
    var prop = input.dataset.prop;
    if (!prop) return;

    var value = input.type === "number" ? input.value : input.value;
    applyPanelChange(prop, value);
  }

  function onColorChange(e) {
    var input = e.target;
    var prop = input.dataset.prop;
    if (!prop) return;
    applyPanelChange(prop, input.value);
  }

  // ─── Attach panel events ───────────────────────────────────────────

  function attachPanelListeners() {
    var panel = qs("#properties-panel");
    if (!panel) return;

    // Number/text inputs
    var inputs = qsa("input[data-prop]", panel);
    inputs.forEach(function (input) {
      input.removeEventListener("input", onInputChange);
      input.addEventListener("input", onInputChange);
    });

    // Textarea
    var textareas = qsa("textarea[data-prop]", panel);
    textareas.forEach(function (ta) {
      ta.removeEventListener("input", onInputChange);
      ta.addEventListener("input", onInputChange);
    });

    // Color inputs
    var colors = qsa("input[type='color'][data-prop]", panel);
    colors.forEach(function (c) {
      c.removeEventListener("input", onColorChange);
      c.addEventListener("input", onColorChange);
    });
  }

  // ─── Event listeners ──────────────────────────────────────────────

  APP.on("selection-changed", function (elementId) {
    if (elementId) {
      populatePanel(elementId);
      showPanel();
      attachPanelListeners();
    } else {
      hidePanel();
    }
  });

  APP.on("enter-edit", function () {
    // Re-attach listeners when entering edit mode
    setTimeout(attachPanelListeners, 200);
  });

  APP.on("element-updated", function (elementId) {
    if (elementId === APP.state.selectedElementId) {
      populatePanel(elementId);
    }
  });

})();

// --- 080-bridge-commands.js ---
// 080-bridge-commands.js - Command protocol to board via setInput/getOutput
(function hudEditorBridgeCommands() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Command prefix ────────────────────────────────────────────────

  var CMD_PREFIX = "he:";

  var CMD = {
    PING: "ping",
    SYNC: "sync",
    NEW: "new",
    LOAD: "load",
    SAVE: "save",
    LIST: "list",
    ADD: "add",
    UPD: "upd",
    DEL: "del",
    SEL: "sel",
    MOV: "mov",
    RES: "res",
    REND: "rend",
  };

  // ─── Bridge abstraction ────────────────────────────────────────────

  // The actual bridge to board happens via setInput on the unit.
  // In the HUD context, we don't have direct Lua access, but we can
  // use the existing MCP bridge to send commands through the board's
  // getInput() handler.

  var pendingCommands = {};
  var commandId = 0;

  function sendCommand(cmd, args) {
    var id = "he_" + (++commandId);
    var payload = CMD_PREFIX + cmd;
    if (args) {
      payload = payload + "|" + args;
    }

    // Store pending command
    pendingCommands[id] = {
      cmd: cmd,
      payload: payload,
      timestamp: Date.now(),
    };

    // Try to send via setInput if available
    // This requires the board to have setInput handler
    if (typeof unit !== "undefined" && unit && typeof unit.setInput === "function") {
      unit.setInput(payload);
    }

    return id;
  }

  // ─── Command helpers ──────────────────────────────────────────────

  function ping() {
    return sendCommand(CMD.PING);
  }

  function sync() {
    return sendCommand(CMD.SYNC);
  }

  function newDocument(screenW, screenH) {
    return sendCommand(CMD.NEW, screenW + "|" + screenH);
  }

  function loadDocument() {
    return sendCommand(CMD.LOAD);
  }

  function saveDocument() {
    return sendCommand(CMD.SAVE);
  }

  function listScripts() {
    return sendCommand(CMD.LIST);
  }

  function addElement(element) {
    var json = JSON.stringify(element);
    return sendCommand(CMD.ADD, json);
  }

  function updateElement(id, updates) {
    var json = JSON.stringify(updates);
    return sendCommand(CMD.UPD, id + "|" + json);
  }

  function deleteElement(id) {
    return sendCommand(CMD.DEL, id);
  }

  function selectElement(id) {
    return sendCommand(CMD.SEL, id || "");
  }

  function moveElement(id, x, y) {
    return sendCommand(CMD.MOV, id + "|" + x + "|" + y);
  }

  function resizeElement(id, x, y, w, h) {
    return sendCommand(CMD.RES, id + "|" + x + "|" + y + "|" + w + "|" + h);
  }

  // ─── Event handlers ────────────────────────────────────────────────

  // Handle responses from board via getOutput
  // This would be called from the Lua side when unit.getOutput() is available
  function handleResponse(response) {
    if (!response || typeof response !== "string") return;

    // Parse response
    var parts = response.split("|");
    var type = parts[0];

    if (type === "pong") {
      APP.emit("board-pong", { version: parts[1] });
    } else if (type === "sync_response") {
      APP.emit("board-sync", parseSyncResponse(parts));
    } else if (type === "new_response") {
      APP.emit("board-new", parseDocumentResponse(parts));
    } else if (type === "load_response") {
      APP.emit("board-load", parseDocumentResponse(parts));
    } else if (type === "save_response") {
      APP.emit("board-save", { ok: parts[1] === "ok" });
    } else if (type === "add_response") {
      APP.emit("element-added", parts[1] ? JSON.parse(parts[1]) : null);
    } else if (type === "update_response") {
      APP.emit("element-updated", parts[1] ? JSON.parse(parts[1]) : null);
    } else if (type === "delete_response") {
      APP.emit("element-deleted", parts[1]);
    } else if (type === "select_response") {
      APP.emit("selection-changed", parts[1]);
    } else if (type === "move_response" || type === "resize_response") {
      APP.emit("element-updated", parts[1] ? JSON.parse(parts[1]) : null);
    }
  }

  function parseSyncResponse(parts) {
    var data = {};
    for (var i = 1; i < parts.length; i++) {
      var kv = parts[i].split("=");
      if (kv.length === 2) {
        data[kv[0]] = kv[1];
      }
    }
    return data;
  }

  function parseDocumentResponse(parts) {
    // parts[1] should be JSON document
    try {
      return { document: parts[1] ? JSON.parse(parts[1]) : null };
    } catch (e) {
      return { document: null, error: e.message };
    }
  }

  // ─── Simulated local state (for offline/testing) ─────────────────

  // When the bridge isn't available, maintain a local state
  var localState = {
    document: null,
    selectedId: null,
    isDirty: false,
  };

  function applyLocalCommand(cmd, args) {
    // Apply command locally without board
    switch (cmd) {
      case CMD.NEW:
        var dims = args ? args.split("|") : ["1920", "1080"];
        localState.document = createNewDocumentLocal(parseInt(dims[0]) || 1920, parseInt(dims[1]) || 1080);
        localState.selectedId = null;
        localState.isDirty = false;
        APP.emit("document-created", localState.document);
        break;

      case CMD.ADD:
        if (localState.document) {
          var element = JSON.parse(args);
          element.id = element.id || generateIdLocal();
          localState.document.elements.push(element);
          localState.isDirty = true;
          APP.emit("element-added", element);
        }
        break;

      case CMD.UPD:
        if (localState.document) {
          var parts2 = args.split("|");
          var id = parts2[0];
          var updates = JSON.parse(parts2[1]);
          var el2 = localState.document.elements.find(function(e) { return e.id === id; });
          if (el2) {
            Object.assign(el2, updates);
            localState.isDirty = true;
            APP.emit("element-updated", id);
          }
        }
        break;

      case CMD.DEL:
        if (localState.document) {
          var idx = localState.document.elements.findIndex(function(e) { return e.id === args; });
          if (idx >= 0) {
            localState.document.elements.splice(idx, 1);
            if (localState.selectedId === args) localState.selectedId = null;
            localState.isDirty = true;
            APP.emit("element-deleted", args);
          }
        }
        break;

      case CMD.SEL:
        localState.selectedId = args || null;
        APP.emit("selection-changed", localState.selectedId);
        break;

      case CMD.MOV:
        if (localState.document) {
          var parts3 = args.split("|");
          var el3 = localState.document.elements.find(function(e) { return e.id === parts3[0]; });
          if (el3) {
            el3.x = parseInt(parts3[1]);
            el3.y = parseInt(parts3[2]);
            localState.isDirty = true;
            APP.emit("element-updated", el3.id);
          }
        }
        break;

      case CMD.RES:
        if (localState.document) {
          var parts4 = args.split("|");
          var el4 = localState.document.elements.find(function(e) { return e.id === parts4[0]; });
          if (el4) {
            el4.x = parseInt(parts4[1]);
            el4.y = parseInt(parts4[2]);
            el4.w = parseInt(parts4[3]);
            el4.h = parseInt(parts4[4]);
            localState.isDirty = true;
            APP.emit("element-updated", el4.id);
          }
        }
        break;
    }
  }

  function createNewDocumentLocal(screenW, screenH) {
    return {
      version: 1,
      revision: 0,
      screenWidth: screenW,
      screenHeight: screenH,
      elements: []
    };
  }

  function generateIdLocal() {
    return "el_" + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
  }

  // ─── Unified command interface ───────────────────────────────────

  function send(cmd, args) {
    // Try real bridge first, fall back to local
    if (typeof unit !== "undefined" && unit && typeof unit.setInput === "function") {
      return sendCommand(cmd, args);
    } else {
      applyLocalCommand(cmd, args);
      return null;
    }
  }

  // ─── Public API ─────────────────────────────────────────────────

  APP.bridge = {
    send: send,
    ping: ping,
    sync: sync,
    newDocument: newDocument,
    loadDocument: loadDocument,
    saveDocument: saveDocument,
    listScripts: listScripts,
    addElement: addElement,
    updateElement: updateElement,
    deleteElement: deleteElement,
    selectElement: selectElement,
    moveElement: moveElement,
    resizeElement: resizeElement,
    handleResponse: handleResponse,
    getLocalState: function() { return localState; },
  };

})();

// --- 085-ide-export.js ---
// 085-ide-export.js - Export generated board/screen code via mod IDE-import path
(function hudEditorIdeExport() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  function getRuntimeCtx() {
    return window.__HUD_EDITOR_RUNTIME_CTX__ || null;
  }

  function getDocument() {
    return APP.state && APP.state.document ? APP.state.document : null;
  }

  function luaEscapeString(value) {
    return JSON.stringify(String(value == null ? "" : value))
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  function toLua(value, indent) {
    indent = indent || "";
    var nextIndent = indent + "  ";
    if (value === null || typeof value === "undefined") return "nil";
    if (typeof value === "number") return isFinite(value) ? String(value) : "0";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return luaEscapeString(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return "{}";
      return "{\n" + value.map(function (item) {
        return nextIndent + toLua(item, nextIndent);
      }).join(",\n") + "\n" + indent + "}";
    }
    if (typeof value === "object") {
      var keys = Object.keys(value);
      if (keys.length === 0) return "{}";
      return "{\n" + keys.map(function (key) {
        var safeKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
          ? key
          : "[" + luaEscapeString(key) + "]";
        return nextIndent + safeKey + " = " + toLua(value[key], nextIndent);
      }).join(",\n") + "\n" + indent + "}";
    }
    return "nil";
  }

  function cloneDocument(doc) {
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  }

  function buildBoardOnStartCode(doc) {
    var embedded = toLua(cloneDocument(doc), "");
    return [
      "-- Generated by HUD Editor",
      "-- Paste into the programming board onStart filter",
      "",
      "local HUD_EDITOR_BOOT_DOCUMENT = " + embedded,
      "",
      "local HudEditorBoard = require(\"board/HudEditorBoard\")",
      "if not HudEditorBoard then",
      "    system.print(\"ERROR: Failed to load HudEditorBoard module\")",
      "    return",
      "end",
      "",
      "HudEditorBoard.init(HUD_EDITOR_BOOT_DOCUMENT)",
      "",
      "function onInputReceived(input)",
      "    return HudEditorBoard.onInputReceived(input)",
      "end",
      "",
      "function onTimer(timerName)",
      "    HudEditorBoard.onTimer(timerName)",
      "end",
      "",
      "unit.hideWidget()",
      "system.print(\"HudEditorBoard initialized\")",
      ""
    ].join("\n");
  }

  function buildScreenCode(doc) {
    var embedded = toLua(cloneDocument(doc), "");
    return [
      "-- Generated by HUD Editor",
      "-- Paste into the linked screen editor",
      "",
      "local DOCUMENT = " + embedded,
      "",
      "local function rgbaToArgb(rgba)",
      "    if not rgba or #rgba < 4 then return 0xFFFFFFFF end",
      "    local a = math.floor((rgba[4] or 1) * 255)",
      "    local r = math.floor((rgba[1] or 0) * 255)",
      "    local g = math.floor((rgba[2] or 0) * 255)",
      "    local b = math.floor((rgba[3] or 0) * 255)",
      "    return (a << 24) | (r << 16) | (g << 8) | b",
      "end",
      "",
      "local function renderElement(layer, element)",
      "    if not element then return end",
      "    local x = element.x or 0",
      "    local y = element.y or 0",
      "    local w = element.w or 100",
      "    local h = element.h or 100",
      "    local fill = element.fill or {0.5, 0.5, 0.5, 1}",
      "    local stroke = element.stroke or {1, 1, 1, 1}",
      "    local strokeWidth = element.strokeWidth or 0",
      "    local fillArgb = rgbaToArgb(fill)",
      "    local strokeArgb = rgbaToArgb(stroke)",
      "    local etype = element.type or \"box\"",
      "    if etype == \"boxRounded\" or etype == \"box\" then",
      "        addBoxRounded(layer, x, y, w, h, element.radius or 0, fillArgb, strokeArgb, strokeWidth)",
      "    elseif etype == \"circle\" then",
      "        addCircle(layer, x + w/2, y + h/2, math.min(w, h)/2, fillArgb, strokeArgb, strokeWidth)",
      "    elseif etype == \"line\" then",
      "        addLine(layer, x, y, x + w, y + h, strokeArgb, strokeWidth)",
      "    elseif etype == \"text\" then",
      "        local text = table.concat(element.textLines or {}, \"\\n\")",
      "        if text == \"\" then return end",
      "        local tx = x",
      "        if element.textAlign == \"center\" then",
      "            tx = x + w / 2",
      "        elseif element.textAlign == \"right\" then",
      "            tx = x + w",
      "        end",
      "        addText(layer, \"Play\", text, tx, y + h/2, element.textSize or 16, rgbaToArgb(element.textColor or {1,1,1,1}))",
      "    end",
      "end",
      "",
      "function onDraw(layer)",
      "    local sw = DOCUMENT.screenWidth or 1920",
      "    local sh = DOCUMENT.screenHeight or 1080",
      "    addBox(layer, 0, 0, sw, sh, 0x00000000, 0x00000000, 0)",
      "    for _, element in ipairs(DOCUMENT.elements or {}) do",
      "        renderElement(layer, element)",
      "    end",
      "end",
      ""
    ].join("\n");
  }

  function queueIdeImport(targetKind, code) {
    var ctx = getRuntimeCtx();
    if (!ctx || typeof ctx.sendPacket !== "function") {
      return { ok: false, error: "runtime_ctx_unavailable" };
    }
    var requestId = "hud-editor-" + targetKind + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
    ctx.sendPacket("hud_editor_ide_export", {
      requestId: requestId,
      targetKind: targetKind,
      code: String(code || "")
    });
    return { ok: true, requestId: requestId };
  }

  function exportBoard() {
    var doc = getDocument();
    if (!doc) return { ok: false, error: "no_document" };
    return queueIdeImport("lua_editor", buildBoardOnStartCode(doc));
  }

  function exportScreen() {
    var doc = getDocument();
    if (!doc) return { ok: false, error: "no_document" };
    return queueIdeImport("screen_editor", buildScreenCode(doc));
  }

  APP.ideExport = {
    toLua: toLua,
    buildBoardOnStartCode: buildBoardOnStartCode,
    buildScreenCode: buildScreenCode,
    exportBoard: exportBoard,
    exportScreen: exportScreen
  };

  APP.on("export-board", function () {
    var result = exportBoard();
    if (result && result.ok) {
      APP.emit("toast", { type: "success", text: "Board export queued" });
    } else {
      APP.emit("toast", { type: "error", text: "Board export failed" });
    }
  });

  APP.on("export-screen", function () {
    var result = exportScreen();
    if (result && result.ok) {
      APP.emit("toast", { type: "success", text: "Screen export queued" });
    } else {
      APP.emit("toast", { type: "error", text: "Screen export failed" });
    }
  });
})();

// --- 090-databank-sync.js ---
// 090-databank-sync.js - Databank persistence integration
// Note: Actual databank I/O is done by the board Lua.
// This module coordinates save/load between JS and board via bridge commands.
(function hudEditorDatabankSync() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Request save to databank via board ───────────────────────

  function saveToDatabank() {
    if (APP.bridge && APP.bridge.saveDocument) {
      APP.bridge.saveDocument();
      return true;
    }
    // Fallback to localStorage
    if (APP.fileSync) {
      var id = APP.fileSync.save(APP.state.document && APP.state.document.name || "Layout");
      return !!id;
    }
    return false;
  }

  // ─── Request load from databank via board ────────────────────

  function loadFromDatabank() {
    if (APP.bridge && APP.bridge.loadDocument) {
      APP.bridge.loadDocument();
      return true;
    }
    return false;
  }

  // ─── Request list from databank ─────────────────────────────

  function listFromDatabank() {
    if (APP.bridge && APP.bridge.listScripts) {
      APP.bridge.listScripts();
      return true;
    }
    return false;
  }

  // ─── Bridge event handlers ───────────────────────────────────

  // When board confirms save
  APP.on("board-save", function (result) {
    if (result && result.ok) {
      APP.state.isDirty = false;
      APP.emit("toast", { type: "success", text: "Saved to databank" });
    } else {
      APP.emit("toast", { type: "error", text: "Databank save failed" });
    }
  });

  // When board confirms load
  APP.on("board-load", function (result) {
    if (result && result.document) {
      APP.state.document = result.document;
      APP.state.isDirty = false;
      APP.emit("document-loaded", result.document);
      APP.emit("toast", { type: "success", text: "Loaded from databank" });
    } else {
      APP.emit("toast", { type: "error", text: "Databank load failed" });
    }
  });

  // When board sends list
  APP.on("board-list", function (result) {
    if (result && result.scripts) {
      APP.emit("script-list-response", result.scripts);
    }
  });

  // When board reports error
  APP.on("board-error", function (err) {
    APP.emit("toast", { type: "error", text: "Board error: " + (err.message || err) });
  });

  // ─── Event forwarding from board ─────────────────────────────

  // The board sends responses via setOutput which the JS reads.
  // Since we're in the HUD context, we poll for board responses.
  // For now, use the bridge's local state as the primary source of truth.

  // ─── Public API ───────────────────────────────────────────────

  APP.databank = {
    save: saveToDatabank,
    load: loadFromDatabank,
    list: listFromDatabank,
  };

})();

// --- 100-file-sync.js ---
// 100-file-sync.js - Filesystem operations via localStorage or MCP bridge
(function hudEditorFileSync() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Storage keys ───────────────────────────────────────────────

  var STORAGE_KEY = "hud_editor_layouts";
  var CURRENT_KEY = "hud_editor_current";

  // ─── Layout storage ────────────────────────────────────────────

  function getStoredLayouts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  function saveLayouts(layouts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ─── Save layout to browser storage ───────────────────────────

  function saveLayoutLocally(id, name, document) {
    var layouts = getStoredLayouts();
    layouts[id] = {
      id: id,
      name: name,
      saved: Date.now(),
      document: document,
    };
    saveLayouts(layouts);
    return true;
  }

  // ─── Load layout from browser storage ─────────────────────────

  function loadLayoutLocally(id) {
    var layouts = getStoredLayouts();
    return layouts[id] || null;
  }

  // ─── List all saved layouts ───────────────────────────────────

  function listLayoutsLocally() {
    var layouts = getStoredLayouts();
    var list = [];
    for (var id in layouts) {
      if (layouts.hasOwnProperty(id)) {
        list.push({
          id: layouts[id].id,
          name: layouts[id].name,
          saved: layouts[id].saved,
        });
      }
    }
    // Sort by saved time, newest first
    list.sort(function(a, b) { return (b.saved || 0) - (a.saved || 0); });
    return list;
  }

  // ─── Delete layout from browser storage ───────────────────────

  function deleteLayoutLocally(id) {
    var layouts = getStoredLayouts();
    if (layouts[id]) {
      delete layouts[id];
      saveLayouts(layouts);
      return true;
    }
    return false;
  }

  // ─── Save current layout ─────────────────────────────────────

  function saveCurrentLayout(name) {
    var doc = APP.state.document;
    if (!doc) return null;

    var id = doc.id || generateLayoutId();
    var finalName = (name || doc.name || "Layout").trim();
    doc.id = id;
    doc.name = finalName;
    var success = saveLayoutLocally(id, finalName, deepCopyDoc(doc));

    if (success) {
      APP.state.isDirty = false;
      return id;
    }
    return null;
  }

  function deepCopyDoc(doc) {
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  }

  // ─── Load layout by ID ───────────────────────────────────────

  function loadLayout(id) {
    var stored = loadLayoutLocally(id);
    if (!stored) return null;

    APP.state.document = deepCopyDoc(stored.document);
    APP.state.selectedElementId = null;
    APP.state.isDirty = false;
    APP.emit("document-loaded", APP.state.document);
    return stored;
  }

  // ─── Export layout as JSON string ────────────────────────────

  function exportLayoutAsJson(doc) {
    doc = doc || APP.state.document;
    if (!doc) return null;
    return JSON.stringify(doc, null, 2);
  }

  // ─── Import layout from JSON string ──────────────────────────

  function importLayoutFromJson(json) {
    try {
      var doc = JSON.parse(json);
      if (!doc || !doc.elements) {
        return { error: "Invalid layout format" };
      }
      APP.state.document = doc;
      APP.state.selectedElementId = null;
      APP.state.isDirty = true;
      APP.emit("document-loaded", doc);
      return { success: true, document: doc };
    } catch (e) {
      return { error: e.message };
    }
  }

  // ─── Generate unique ID ───────────────────────────────────────

  function generateLayoutId() {
    return "layout_" + Math.floor(Date.now() / 1000).toString(36) +
           "_" + Math.random().toString(36).substr(2, 5);
  }

  // ─── Bridge integration (for external file operations) ─────────

  // When MCP bridge is available, expose layout data for external tools
  function getLayoutForBridge() {
    var doc = APP.state.document;
    if (!doc) return null;
    return {
      json: exportLayoutAsJson(doc),
      size: exportLayoutAsJson(doc).length,
    };
  }

  // ─── Event handlers ───────────────────────────────────────────

  APP.on("save", function () {
    var id = saveCurrentLayout(APP.state.document && APP.state.document.name || "Layout");
    if (id) {
      APP.emit("toast", { type: "success", text: "Layout saved" });
    } else {
      APP.emit("toast", { type: "error", text: "Save failed" });
    }
  });

  APP.on("save-exit", function () {
    var id = saveCurrentLayout(APP.state.document && APP.state.document.name || "Layout");
    if (id) {
      APP.emit("toast", { type: "success", text: "Layout saved" });
      APP.goToStart();
    } else {
      APP.emit("toast", { type: "error", text: "Save failed" });
    }
  });

  APP.on("saveas-confirm", function (name) {
    var id = saveCurrentLayout(name);
    if (id) {
      APP.emit("toast", { type: "success", text: "Layout saved as: " + name });
    } else {
      APP.emit("toast", { type: "error", text: "Save failed" });
    }
  });

  APP.on("load-confirm", function (id) {
    var loaded = loadLayout(id);
    if (loaded) {
      APP.emit("toast", { type: "success", text: "Layout loaded" });
      if (typeof APP.goToEditor === "function") {
        APP.goToEditor();
      }
      setTimeout(function () {
        if (APP.canvas && typeof APP.canvas.render === "function") {
          APP.canvas.render();
        }
      }, 0);
    } else {
      APP.emit("toast", { type: "error", text: "Load failed" });
    }
  });

  APP.on("request-script-list", function () {
    var list = listLayoutsLocally();
    APP.emit("script-list-response", list);
  });

  // ─── Public API ───────────────────────────────────────────────

  APP.fileSync = {
    save: saveCurrentLayout,
    load: loadLayout,
    list: listLayoutsLocally,
    delete: deleteLayoutLocally,
    exportJson: exportLayoutAsJson,
    importJson: importLayoutFromJson,
    getForBridge: getLayoutForBridge,
    generateId: generateLayoutId,
  };

})();

// --- 110-undo-redo.js ---
// 110-undo-redo.js - Undo/redo stack
(function hudEditorUndoRedo() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Undo/Redo state ─────────────────────────────────────────────

  var undoStack = [];
  var redoStack = [];
  var maxStackSize = 50;
  var isUndoRedoAction = false;

  // ─── Push state to undo stack ───────────────────────────────────

  function pushUndo() {
    if (isUndoRedoAction) return;
    if (!APP.state.document) return;

    var snapshot = deepCopyDocument(APP.state.document);
    undoStack.push(snapshot);

    // Limit stack size
    if (undoStack.length > maxStackSize) {
      undoStack.shift();
    }

    // Clear redo on new action
    redoStack = [];
  }

  function deepCopyDocument(doc) {
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  }

  // ─── Perform undo ────────────────────────────────────────────────

  function undo() {
    if (undoStack.length === 0) {
      APP.emit("toast", { type: "info", text: "Nothing to undo" });
      return false;
    }

    isUndoRedoAction = true;

    // Save current state to redo
    if (APP.state.document) {
      redoStack.push(deepCopyDocument(APP.state.document));
    }

    // Restore previous state
    var snapshot = undoStack.pop();
    APP.state.document = snapshot;
    APP.state.isDirty = true;
    APP.emit("document-loaded", snapshot);
    APP.emit("toast", { type: "info", text: "Undone" });

    isUndoRedoAction = false;
    return true;
  }

  // ─── Perform redo ───────────────────────────────────────────────

  function redo() {
    if (redoStack.length === 0) {
      APP.emit("toast", { type: "info", text: "Nothing to redo" });
      return false;
    }

    isUndoRedoAction = true;

    // Save current state to undo
    if (APP.state.document) {
      undoStack.push(deepCopyDocument(APP.state.document));
    }

    // Restore next redo state
    var snapshot = redoStack.pop();
    APP.state.document = snapshot;
    APP.state.isDirty = true;
    APP.emit("document-loaded", snapshot);
    APP.emit("toast", { type: "info", text: "Redone" });

    isUndoRedoAction = false;
    return true;
  }

  // ─── Clear stacks ───────────────────────────────────────────────

  function clear() {
    undoStack = [];
    redoStack = [];
  }

  // ─── Event listeners ────────────────────────────────────────────

  // Push undo before element changes
  APP.on("before-element-change", function() {
    pushUndo();
  });

  // Keyboard shortcuts
  APP.on("undo", function() {
    undo();
  });

  APP.on("redo", function() {
    redo();
  });

  // Clear on new document
  APP.on("document-created", function() {
    clear();
  });

  APP.on("document-loaded", function() {
    clear();
  });

  // ─── Public API ─────────────────────────────────────────────────

  APP.undoRedo = {
    undo: undo,
    redo: redo,
    push: pushUndo,
    clear: clear,
    canUndo: function() { return undoStack.length > 0; },
    canRedo: function() { return redoStack.length > 0; },
  };

})();

// --- 120-dialogs.js ---
// 120-dialogs.js - Dialog components (load, saveas, close confirm)
(function hudEditorDialogs() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;

  // ─── Dialog registry ───────────────────────────────────────────────

  var activeDialog = null;

  function showDialog(name) {
    if (activeDialog) hideDialog();
    var dlg = qs("#dialog-" + name);
    if (!dlg) return;
    dlg.style.display = "flex";
    activeDialog = dlg;
  }

  function hideDialog() {
    if (!activeDialog) return;
    activeDialog.style.display = "none";
    activeDialog = null;
  }

  // ─── Build all dialogs ────────────────────────────────────────────

  function buildDialogs() {
    var root = APP.getRoot();

    // ── Load dialog ──────────────────────────────────────────────
    var loadD = el("div", {
      id: "dialog-load",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-header" }, [
          el("h3", { textContent: "Load Script" }),
          el("button", {
            className: "dialog-close",
            dataset: { action: "close-load" },
            textContent: "\u00D7",
          }),
        ]),
        el("div", { className: "dialog-content" }, [
          el("div", { id: "script-list", className: "script-list" }),
        ]),
        el("div", { className: "dialog-footer" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-load" },
            textContent: "Cancel",
          }),
        ]),
      ]),
    ]);
    root.appendChild(loadD);

    // ── Save As dialog ────────────────────────────────────────────
    var saveasD = el("div", {
      id: "dialog-saveas",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-header" }, [
          el("h3", { textContent: "Save As" }),
          el("button", {
            className: "dialog-close",
            dataset: { action: "close-saveas" },
            textContent: "\u00D7",
          }),
        ]),
        el("div", { className: "dialog-content" }, [
          el("label", { textContent: "Script Name" }),
          el("input", {
            type: "text",
            id: "saveas-name",
            className: "saveas-input",
            placeholder: "my-layout",
          }),
          el("p", { className: "save-note", textContent: "Saves to linked databank" }),
        ]),
        el("div", { className: "dialog-footer" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-saveas" },
            textContent: "Cancel",
          }),
          el("button", {
            className: "btn primary",
            dataset: { action: "confirm-saveas" },
            textContent: "Save",
          }),
        ]),
      ]),
    ]);
    root.appendChild(saveasD);

    // ── Close confirmation dialog ─────────────────────────────────
    var closeD = el("div", {
      id: "dialog-close",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-content centered" }, [
          el("div", { className: "confirm-icon", textContent: "\u26A0" }),
          el("h3", { textContent: "Unsaved Changes" }),
          el("p", { textContent: "You have unsaved changes. What would you like to do?" }),
        ]),
        el("div", { className: "dialog-footer centered" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-cancel" },
            textContent: "Cancel",
          }),
          el("button", {
            className: "btn danger",
            dataset: { action: "close-discard" },
            textContent: "Discard",
          }),
          el("button", {
            className: "btn primary",
            dataset: { action: "close-save" },
            textContent: "Save & Close",
          }),
        ]),
      ]),
    ]);
    root.appendChild(closeD);
  }

  // ─── Load dialog content ───────────────────────────────────────────

  function populateScriptList(scripts) {
    var list = qs("#script-list");
    if (!list) return;

    // Clear existing
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (!scripts || scripts.length === 0) {
      var empty = el("div", {
        className: "empty-state",
        style: { padding: "20px", textAlign: "center", color: "#666" },
      }, [
        el("p", { textContent: "No saved scripts found." }),
      ]);
      list.appendChild(empty);
      return;
    }

    scripts.forEach(function (script) {
      var item = el("div", {
        className: "script-item",
        dataset: { scriptId: script.id },
      }, [
        el("div", { className: "script-name", textContent: script.name || script.id }),
        el("div", { className: "script-meta", textContent: formatDate(script.modified) }),
      ]);
      list.appendChild(item);
    });
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";
    var d = new Date(timestamp * 1000);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  }

  // ─── Click delegation ───────────────────────────────────────────────

  function onDialogClick(e) {
    var action = e.target.dataset.action;
    if (!action) return;

    if (action === "close-load") {
      hideDialog();
    } else if (action === "close-saveas") {
      hideDialog();
    } else if (action === "close-cancel") {
      hideDialog();
    } else if (action === "close-discard") {
      APP.state.isDirty = false;
      hideDialog();
      APP.goToStart();
    } else if (action === "close-save") {
      // Trigger save then close
      APP.emit("save");
      hideDialog();
      APP.goToStart();
    } else if (action === "confirm-saveas") {
      var nameInput = qs("#saveas-name");
      var name = nameInput ? nameInput.value.trim() : "";
      if (name) {
        APP.emit("saveas-confirm", name);
        hideDialog();
      }
    }
  }

  // ─── Script item click ─────────────────────────────────────────────

  function onScriptListClick(e) {
    var item = e.target.closest(".script-item");
    if (!item) return;
    var scriptId = item.dataset.scriptId;
    if (scriptId) {
      APP.emit("load-confirm", scriptId);
      hideDialog();
    }
  }

  // ─── Event listeners ───────────────────────────────────────────────

  APP.on("load-dialog-open", function () {
    showDialog("load");
    // Emit event to request script list (board/databank will respond)
    APP.emit("request-script-list");
  });

  APP.on("saveas-dialog-open", function () {
    showDialog("saveas");
    var input = qs("#saveas-name");
    if (input) input.value = "";
  });

  APP.on("close-editor", function () {
    if (APP.state.isDirty) {
      showDialog("close");
    } else {
      APP.goToStart();
    }
  });

  // Receive script list from board/databank
  APP.on("script-list-response", function (scripts) {
    populateScriptList(scripts);
  });

  APP.on("close-dialog", function () {
    hideDialog();
  });

  // ─── Bootstrap ─────────────────────────────────────────────────────

  APP.init = (function (origInit) {
    return function () {
      origInit();
      buildDialogs();

      // Attach click delegation to dialogs
      var root = APP.getRoot();
      root.addEventListener("click", onDialogClick);
      var scriptList = qs("#script-list", root);
      if (scriptList) {
        scriptList.addEventListener("click", onScriptListClick);
      }
    };
  })(APP.init);

  // If already initialized, build now
  if (APP.getRoot().childElementCount > 0) {
    buildDialogs();
    var root = APP.getRoot();
    root.addEventListener("click", onDialogClick);
    var scriptList = qs("#script-list", root);
    if (scriptList) {
      scriptList.addEventListener("click", onScriptListClick);
    }
  }

})();

