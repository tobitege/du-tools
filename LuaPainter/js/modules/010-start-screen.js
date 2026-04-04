// 010-start-screen.js - Start screen UI + logic
(function hudEditorStartScreen() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;
  var selectedStartScriptId = "";
  var selectedStartScriptName = "";
  var currentStartScripts = [];

  function getSavedLayoutAccess(status) {
    var canUseBoard = !!(status && status.canAccessOnStart);
    var canUseLocal = !!(APP.fileSync && typeof APP.fileSync.list === "function");
    return canUseBoard || canUseLocal;
  }

  function findStartScript(scriptId) {
    var targetId = String(scriptId || "");
    var i;
    for (i = 0; i < currentStartScripts.length; i += 1) {
      if (String(currentStartScripts[i] && currentStartScripts[i].id || "") === targetId) {
        return currentStartScripts[i];
      }
    }
    return null;
  }

  function setSelectedStartScript(scriptId) {
    var script = findStartScript(scriptId);
    selectedStartScriptId = script ? String(script.id || "") : "";
    selectedStartScriptName = script && script.name ? String(script.name) : "";
    var root = APP.getRoot();
    qsa("#start-script-list .script-item", root).forEach(function (item) {
      item.classList.toggle("selected", item.dataset.scriptId === selectedStartScriptId);
    });
  }

  function formatScriptDate(timestamp) {
    if (!timestamp) return "";
    var d = new Date(timestamp * 1000);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  }

  function clearStartScriptSelection() {
    selectedStartScriptId = "";
    selectedStartScriptName = "";
    var root = APP.getRoot();
    qsa("#start-script-list .script-item", root).forEach(function (item) {
      item.classList.remove("selected");
    });
    updateLoadButtonState(APP.state && APP.state.editorContext);
  }

  function updateLoadButtonState(status) {
    var root = APP.getRoot();
    var loadBtn = qs("#start-load-btn", root);
    var renameBtn = qs("#start-rename-btn", root);
    var canUseSavedLayouts = getSavedLayoutAccess(status);
    if (loadBtn) {
      loadBtn.disabled = !canUseSavedLayouts || !selectedStartScriptId;
    }
    if (renameBtn) {
      renameBtn.disabled = !canUseSavedLayouts || !selectedStartScriptId;
    }
  }

  function populateStartScriptList(scripts) {
    var root = APP.getRoot();
    var list = qs("#start-script-list", root);
    if (!list) return;
    currentStartScripts = Array.isArray(scripts) ? scripts.slice() : [];

    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (!scripts || scripts.length === 0) {
      selectedStartScriptId = "";
      list.appendChild(el("div", {
        className: "start-script-list-empty",
        textContent: "No saved layouts found."
      }));
      updateLoadButtonState(APP.state && APP.state.editorContext);
      return;
    }

    var hasSelected = false;
    scripts.forEach(function (script) {
      var scriptId = String(script && script.id || "");
      if (!scriptId) return;
      var isSelected = scriptId === selectedStartScriptId;
      if (isSelected) hasSelected = true;
      list.appendChild(el("button", {
        type: "button",
        className: "script-item" + (isSelected ? " selected" : ""),
        dataset: { action: "select-start-script", scriptId: scriptId }
      }, [
        el("div", { className: "script-name", textContent: script.name || scriptId }),
        el("div", { className: "script-meta", textContent: formatScriptDate(script.modified || script.saved) })
      ]));
    });

    if (!hasSelected) {
      setSelectedStartScript(scripts[0] && scripts[0].id ? String(scripts[0].id) : "");
    } else {
      setSelectedStartScript(selectedStartScriptId);
    }
    updateLoadButtonState(APP.state && APP.state.editorContext);
  }

  function requestStartScriptList() {
    APP.emit("request-script-list");
  }

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
        ]),
        el("div", { id: "start-editor-context", className: "start-context-card" }, [
          el("div", { className: "start-context-title", textContent: "Lua Editor Connection" }),
          el("div", { className: "start-context-pill is-offline", textContent: "Preview Only" }),
          el("p", {
            className: "start-context-copy",
            textContent: "Open the programming board Lua editor to load from or save to unit.onStart."
          }),
        ]),
        el("div", { className: "start-main" }, [
          el("div", { className: "start-column start-column-actions" }, [
            el("div", { className: "start-menu" }, [
              el("button", {
                className: "menu-btn primary",
                dataset: { action: "new" },
              }, [
                el("span", { className: "icon", textContent: "\u270F" }),
                el("div", { className: "label-group" }, [
                  el("span", { className: "label", textContent: "New Layout" }),
                  el("span", { className: "desc", textContent: "Start a fresh layout" }),
                ]),
              ]),
              el("button", {
                className: "menu-btn",
                id: "start-saveas-btn",
                dataset: { action: "saveas" },
              }, [
                el("span", { className: "icon", textContent: "\u2714" }),
                el("div", { className: "label-group" }, [
                  el("span", { className: "label", textContent: "Save" }),
                  el("span", { className: "desc", textContent: "Save current layout" }),
                ]),
              ]),
            ]),
          ]),
          el("div", { className: "start-column start-column-library" }, [
            el("button", {
              className: "menu-btn",
              id: "start-load-btn",
              dataset: { action: "load" },
            }, [
              el("span", { className: "icon", textContent: "\u27A4" }),
              el("div", { className: "label-group" }, [
                el("span", { className: "label", textContent: "Load" }),
                el("span", { className: "desc", textContent: "Open selected layout" }),
              ]),
            ]),
            el("div", { className: "start-script-card" }, [
              el("div", { className: "start-script-card-header" }, [
                el("div", { className: "start-script-title", textContent: "Saved Layouts" }),
                el("button", {
                  type: "button",
                  className: "btn secondary start-script-action-btn",
                  id: "start-rename-btn",
                  dataset: { action: "rename" },
                  textContent: "Rename"
                }),
              ]),
              el("div", { id: "start-script-list", className: "script-list start-script-list" }),
            ]),
          ]),
        ]),
        el("div", { className: "start-footer" }, [
          el("button", {
            className: "menu-btn exit-btn",
            dataset: { action: "exit" },
            title: "Close Lua Painter"
          }, [
            el("span", { className: "icon", textContent: "\u2716" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "Exit" }),
              el("span", { className: "desc", textContent: "Close Lua Painter" }),
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
    if (!selectedStartScriptId) return;
    APP.emit("load-confirm", selectedStartScriptId);
  }

  function onSaveAs() {
    APP.emit("saveas-dialog-open");
  }

  function onRenameLayout() {
    if (!selectedStartScriptId) return;
    APP.emit("rename-dialog-open", {
      id: selectedStartScriptId,
      name: selectedStartScriptName || "Layout"
    });
  }

  // ─── Click delegation ────────────────────────────────────────────────

  function onMenuClick(e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.disabled) return;
    var action = btn.dataset.action;
    if (action === "select-start-script") {
      setSelectedStartScript(btn.dataset.scriptId || "");
      updateLoadButtonState(APP.state && APP.state.editorContext);
      return;
    }
    if (action === "new") onNewScript();
    else if (action === "load") onLoad();
    else if (action === "saveas") onSaveAs();
    else if (action === "rename") onRenameLayout();
    else if (action === "exit") {
      if (typeof APP.closeUi === "function") APP.closeUi("start-exit");
      else {
        APP.exitEditMode();
        if (typeof APP.updateToggleButton === "function") APP.updateToggleButton();
      }
    }
  }

  function updateEditorContext(status) {
    var root = APP.getRoot();
    var saveAsBtn = qs("#start-saveas-btn", root);
    var card = qs("#start-editor-context", root);
    var pill = qs(".start-context-pill", card);
    var copy = qs(".start-context-copy", card);
    var canUseBoard = !!(status && status.canAccessOnStart);
    var canUseSavedLayouts = getSavedLayoutAccess(status);

    if (saveAsBtn) saveAsBtn.disabled = !canUseSavedLayouts;
    updateLoadButtonState(status);

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
    requestStartScriptList();
  });

  APP.on("editor-context", updateEditorContext);
  APP.on("script-list-response", populateStartScriptList);
  APP.on("saveas-confirm", function () {
    setTimeout(requestStartScriptList, 50);
  });
  APP.on("rename-layout-success", function () {
    setTimeout(requestStartScriptList, 50);
  });

  function mountStartScreen() {
    var root = APP.getRoot();
    var oldStart = qs('[data-screen="start"]', root);
    if (oldStart && oldStart.parentNode) {
      oldStart.parentNode.removeChild(oldStart);
    }
    var startScreen = buildStartScreen();
    root.appendChild(startScreen);
    startScreen.addEventListener("click", onMenuClick);
    clearStartScriptSelection();
    requestStartScriptList();
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
