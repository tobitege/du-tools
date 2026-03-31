// 020-editor-shell.js - Editor HTML structure + navigation
(function hudEditorShell() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;
  var AUTO_OPEN_PANELS_KEY = "hud_auto_open_panels";

  function loadAutoOpenPanels() {
    try {
      return localStorage.getItem(AUTO_OPEN_PANELS_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setAutoOpenPanels(enabled) {
    APP.state.autoOpenPanels = !!enabled;
    try {
      localStorage.setItem(AUTO_OPEN_PANELS_KEY, enabled ? "1" : "");
    } catch (e) { /* ignore */ }
    APP.emit("auto-open-panels-changed", APP.state.autoOpenPanels);
  }

  // ─── Stepper builder ────────────────────────────────────────────────

  var STROKE_PRESETS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
  var RADIUS_PRESETS = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 50, 75, 100];

  function buildStepper(prop, presets) {
    var options = presets.map(function (v) {
      return el("option", { value: String(v), textContent: String(v) });
    });
    return el("div", { className: "stepper-ctrl" }, [
      el("button", { className: "stepper-dec", dataset: { stepperProp: prop }, textContent: "\u2212" }),
      el("select", { className: "stepper-select", dataset: { prop: prop } }, options),
      el("button", { className: "stepper-inc", dataset: { stepperProp: prop }, textContent: "+" }),
    ]);
  }

  // ─── Build editor shell DOM ──────────────────────────────────────────

  function buildEditorShell() {
    var container = el("div", {
      className: "hud-screen",
      dataset: { screen: "editor" },
      style: { display: "none" },
    }, [

      // ── Toolbar ──
      el("div", { id: "editor-toolbar" }, [

        // Tool buttons — SVG icon + key hint
        el("div", { className: "toolbar-group" }, [
          el("button", { className: "tool-btn active", dataset: { tool: "select" }, title: "Select (V)" }, [
            el("span", { className: "tb-icon tb-icon-select" }),
            el("span", { className: "tb-key", textContent: "V" }),
          ]),
          el("button", { className: "tool-btn", dataset: { tool: "box" }, title: "Box (B)" }, [
            el("span", { className: "tb-icon tb-icon-box" }),
            el("span", { className: "tb-key", textContent: "B" }),
          ]),
          el("button", { className: "tool-btn", dataset: { tool: "rounded" }, title: "Rounded Box (R)" }, [
            el("span", { className: "tb-icon tb-icon-rounded" }),
            el("span", { className: "tb-key", textContent: "R" }),
          ]),
          el("button", { className: "tool-btn", dataset: { tool: "circle" }, title: "Circle (C)" }, [
            el("span", { className: "tb-icon tb-icon-circle" }),
            el("span", { className: "tb-key", textContent: "C" }),
          ]),
          el("button", { className: "tool-btn", dataset: { tool: "line" }, title: "Line (L)" }, [
            el("span", { className: "tb-icon tb-icon-line" }),
            el("span", { className: "tb-key", textContent: "L" }),
          ]),
          el("button", { className: "tool-btn", dataset: { tool: "text" }, title: "Text (T)" }, [
            el("span", { className: "tb-icon tb-icon-text" }),
            el("span", { className: "tb-key", textContent: "T" }),
          ]),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Color swatches
        el("div", { className: "toolbar-group colors" }, [
          el("div", { className: "swatch-pair" }, [
            el("input", {
              type: "color",
              className: "color-swatch",
              value: "#3366FF",
              title: "Fill color",
              dataset: { prop: "fill" },
            }),
            el("span", { className: "swatch-label", textContent: "Fill" }),
          ]),
          el("div", { className: "swatch-pair" }, [
            el("input", {
              type: "color",
              className: "color-swatch",
              value: "#FFFFFF",
              title: "Stroke color",
              dataset: { prop: "stroke" },
            }),
            el("span", { className: "swatch-label", textContent: "Stroke" }),
          ]),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Grouping
        el("div", { className: "toolbar-group actions" }, [
          el("button", { className: "action-btn", dataset: { action: "group" }, title: "Group (Ctrl+G)" }, [
            el("span", { className: "tb-icon tb-icon-group" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "ungroup" }, title: "Ungroup (Ctrl+Shift+G)" }, [
            el("span", { className: "tb-icon tb-icon-ungroup" }),
          ]),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Clone
        el("div", { className: "toolbar-group actions" }, [
          el("button", { className: "action-btn", dataset: { action: "clone" }, title: "Clone (Ctrl+D)" }, [
            el("span", { className: "tb-icon tb-icon-clone" }),
          ]),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Alignment
        el("div", { className: "toolbar-group align-group" }, [
          el("button", { className: "action-btn", dataset: { action: "align-left" }, title: "Align left" }, [
            el("span", { className: "tb-icon tb-icon-align-left" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-center-h" }, title: "Align center horizontal" }, [
            el("span", { className: "tb-icon tb-icon-align-center-h" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-right" }, title: "Align right" }, [
            el("span", { className: "tb-icon tb-icon-align-right" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-top" }, title: "Align top" }, [
            el("span", { className: "tb-icon tb-icon-align-top" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-center-v" }, title: "Align center vertical" }, [
            el("span", { className: "tb-icon tb-icon-align-center-v" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-bottom" }, title: "Align bottom" }, [
            el("span", { className: "tb-icon tb-icon-align-bottom" }),
          ]),
        ]),

        el("div", { className: "toolbar-divider" }),

        el("label", { className: "toolbar-check", title: "Auto-open collapsed panels on hover" }, [
          el("input", {
            type: "checkbox",
            className: "toolbar-check-input",
            id: "auto-open-panels-toggle",
          }),
          el("span", { className: "toolbar-check-box" }),
          el("span", { className: "toolbar-check-label", textContent: "Auto Panels" }),
        ]),

        el("div", { className: "toolbar-spacer" }),

        // Undo/Redo
        el("div", { className: "toolbar-group actions" }, [
          el("button", { className: "action-btn", dataset: { action: "undo" }, title: "Undo (Ctrl+Z)" }, [
            el("span", { className: "tb-icon", textContent: "\u21A9" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "redo" }, title: "Redo (Ctrl+Y)" }, [
            el("span", { className: "tb-icon", textContent: "\u21AA" }),
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
          el("button", { className: "panel-toggle", dataset: { action: "toggle-collapse" }, textContent: "\u25BE" }),
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
            buildStepper("strokeWidth", STROKE_PRESETS),
          ]),
          el("div", { className: "prop-row", dataset: { propRow: "radius" } }, [
            el("label", { textContent: "Radius" }),
            buildStepper("radius", RADIUS_PRESETS),
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
    else if (action.indexOf("align-") === 0) {
      APP.emit("align", action.replace("align-", ""));
    }
    else if (action === "group") {
      APP.emit("group-selection");
    }
    else if (action === "ungroup") {
      APP.emit("ungroup-selection");
    }
    else if (action === "clone") {
      APP.emit("clone-selection");
    }
    else if (action === "toggle-collapse") {
      APP.emit("toggle-props-collapse");
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

  function syncToolbarSettings() {
    var root = APP.getRoot();
    var input = qs("#auto-open-panels-toggle", root);
    if (input) input.checked = !!APP.state.autoOpenPanels;
  }

  function attachToolbarSettingListeners() {
    var root = APP.getRoot();
    var toolbar = qs("#editor-toolbar", root);
    if (!toolbar || toolbar.__hudSettingsBound) return;
    toolbar.__hudSettingsBound = true;

    toolbar.addEventListener("change", function (e) {
      var input = e.target;
      if (!input || input.id !== "auto-open-panels-toggle") return;
      setAutoOpenPanels(!!input.checked);
    });
  }

  // ─── Register with core ──────────────────────────────────────────────

  APP.on("document-created", function () {
    goToEditor();
  });

  APP.on("tool-changed", function (tool) {
    updateToolButtons(tool || APP.state.currentTool);
  });

  APP.on("auto-open-panels-changed", function () {
    syncToolbarSettings();
  });

  function mountEditorShell() {
    var root = APP.getRoot();
    if (qs('[data-screen="editor"]', root)) return;
    var editorShell = buildEditorShell();
    root.appendChild(editorShell);

    var toolbar = qs("#editor-toolbar", root);
    if (toolbar) toolbar.addEventListener("click", onToolbarClick);
    attachToolbarSettingListeners();
    APP.state.autoOpenPanels = loadAutoOpenPanels();
    syncToolbarSettings();

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
