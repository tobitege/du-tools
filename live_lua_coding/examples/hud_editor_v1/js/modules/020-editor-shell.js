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
