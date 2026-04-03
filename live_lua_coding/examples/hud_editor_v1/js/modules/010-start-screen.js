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
      el("div", { className: "start-glow-shapes start-glow-left" }, [
        el("div", { className: "glow-shape glow-shape-circle glow-shape-cyan" }),
        el("div", { className: "glow-shape glow-shape-box glow-shape-purple" }),
        el("div", { className: "glow-shape glow-shape-triangle glow-shape-amber" }),
      ]),
      el("div", { className: "start-container" }, [
        el("div", { className: "start-header" }, [
          el("h1", { textContent: "Lua Painter" }),
          el("p", { className: "subtitle", textContent: "HUD Layout Editor" }),
        ]),
        el("div", { id: "start-editor-context", className: "start-context-card" }, [
          el("div", { className: "start-context-title", textContent: "Lua Editor Connection" }),
          el("div", { className: "start-context-pill is-offline", textContent: "Preview Only" }),
          el("p", {
            className: "start-context-copy",
            textContent: "Open the programming board Lua editor to load from or save to unit.onStart."
          }),
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
            id: "start-load-btn",
            dataset: { action: "load" },
          }, [
            el("span", { className: "icon", textContent: "\u27A4" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "Load" }),
              el("span", { className: "desc", textContent: "Open layout from unit.onStart" }),
            ]),
          ]),
          el("button", {
            className: "menu-btn",
            id: "start-saveas-btn",
            dataset: { action: "saveas" },
          }, [
            el("span", { className: "icon", textContent: "\u2714" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "Save As" }),
              el("span", { className: "desc", textContent: "Save current layout into unit.onStart" }),
            ]),
          ]),
        ]),
        el("div", { className: "start-footer" }, [
          el("button", {
            className: "menu-btn exit-btn",
            dataset: { action: "exit" },
            title: "Close the HUD Editor"
          }, [
            el("span", { className: "icon", textContent: "\u2716" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "Exit" }),
              el("span", { className: "desc", textContent: "Close the HUD Editor" }),
            ]),
          ]),
        ]),
      ]),
      el("div", { className: "start-glow-shapes start-glow-right" }, [
        el("div", { className: "glow-shape glow-shape-box glow-shape-green" }),
        el("div", { className: "glow-shape glow-shape-circle glow-shape-cyan" }),
        el("div", { className: "glow-shape glow-shape-box glow-shape-purple" }),
      ]),
    ]);
    return container;
  }

  // ─── Action handlers ─────────────────────────────────────────────────

  function onNewScript() {
    var sw = 1920;
    var sh = 1080;
    APP.state.document = APP.normalizeDocumentMeta({
      version: 1,
      revision: 1,
      id: APP.createLayoutId(),
      name: "Layout",
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
    });
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
    if (btn.disabled) return;
    var action = btn.dataset.action;
    if (action === "new") onNewScript();
    else if (action === "load") onLoad();
    else if (action === "saveas") onSaveAs();
    else if (action === "exit") APP.exitEditMode();
  }

  function updateEditorContext(status) {
    var root = APP.getRoot();
    var loadBtn = qs("#start-load-btn", root);
    var saveAsBtn = qs("#start-saveas-btn", root);
    var card = qs("#start-editor-context", root);
    var pill = qs(".start-context-pill", card);
    var copy = qs(".start-context-copy", card);
    var canUseBoard = !!(status && status.canAccessOnStart);

    if (loadBtn) loadBtn.disabled = !canUseBoard;
    if (saveAsBtn) saveAsBtn.disabled = !canUseBoard;

    if (!pill || !copy) return;
    pill.className = "start-context-pill " + (canUseBoard ? "is-online" : "is-offline");
    pill.textContent = canUseBoard ? "Board Connected" : "Preview Only";
    copy.textContent = canUseBoard
      ? "Load reads the current programming board unit.onStart filter, and save writes back there."
      : "Open the programming board Lua editor to load from or save to unit.onStart.";
  }

  // ─── Register with core ──────────────────────────────────────────────

  APP.on("enter-edit", function () {
    if (APP.state.currentScreen === "start") {
      APP.showScreen("start");
    }
  });

  APP.on("editor-context", updateEditorContext);

  function mountStartScreen() {
    var root = APP.getRoot();
    var oldStart = qs('[data-screen="start"]', root);
    if (oldStart && oldStart.parentNode) {
      oldStart.parentNode.removeChild(oldStart);
    }
    var startScreen = buildStartScreen();
    root.appendChild(startScreen);
    startScreen.addEventListener("click", onMenuClick);
  }

  APP.init = (function (origInit) {
    return function () {
      origInit();
      mountStartScreen();
      updateEditorContext(APP.state.editorContext || null);
    };
  })(APP.init);

  mountStartScreen();
  updateEditorContext(APP.state.editorContext || null);
})();
