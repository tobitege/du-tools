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
