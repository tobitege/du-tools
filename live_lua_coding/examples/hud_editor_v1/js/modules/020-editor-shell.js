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
  var GLOW_PRESETS = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 50, 64, 80, 100];
  var TEXT_SIZE_PRESETS = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 44, 48, 56, 64, 80, 96, 128, 160, 200];
  var SHAPE_TOOL_OPTIONS = [
    { tool: "box", title: "Box", shortcut: "B", glyph: "\u25A1", iconClass: "tb-icon-box tb-icon-glyph tb-icon-glyph-box" },
    { tool: "rounded", title: "Rounded Box", shortcut: "R", glyph: "\u25A2", iconClass: "tb-icon-rounded tb-icon-glyph tb-icon-glyph-rounded" },
    { tool: "circle", title: "Circle", shortcut: "C", glyph: "\u25CB", iconClass: "tb-icon-circle tb-icon-glyph tb-icon-glyph-circle" },
    { tool: "bezierArc", title: "Bezier Arc", shortcut: "A", glyph: "\u2302", iconClass: "tb-icon-line tb-icon-glyph tb-icon-glyph-line" },
    { tool: "triangle", title: "Triangle", shortcut: "Y", glyph: "\u25B3", iconClass: "tb-icon-box tb-icon-glyph tb-icon-glyph-box" },
    { tool: "quad", title: "Quad", shortcut: "Q", glyph: "\u25F0", iconClass: "tb-icon-rounded tb-icon-glyph tb-icon-glyph-rounded" },
    { tool: "image", title: "Image", shortcut: "I", glyph: "\u25C9", iconClass: "tb-icon-circle tb-icon-glyph tb-icon-glyph-circle" },
    { tool: "line", title: "Line", shortcut: "L", glyph: "/", iconClass: "tb-icon-line tb-icon-glyph tb-icon-glyph-line" },
    { tool: "text", title: "Text", shortcut: "T", glyph: "T", iconClass: "tb-icon-text tb-icon-glyph tb-icon-glyph-text" },
  ];
  var SHAPE_TOOL_MAP = {};
  var lastShapeTool = SHAPE_TOOL_OPTIONS[0].tool;

  SHAPE_TOOL_OPTIONS.forEach(function (option) {
    SHAPE_TOOL_MAP[option.tool] = option;
  });

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

  function buildPropDropdown(prop, options) {
    return el("div", { className: "prop-dropdown", dataset: { propDropdown: prop } }, [
      el("button", {
        type: "button",
        className: "prop-dropdown-trigger prop-input prop-input-wide",
        dataset: { propDropdownTrigger: prop }
      }, [
        el("span", {
          className: "prop-dropdown-label",
          dataset: { propDropdownLabel: prop },
          textContent: options[0] ? options[0].label : ""
        }),
        el("span", { className: "prop-dropdown-caret", textContent: "\u25BE" }),
      ]),
      el("div", { className: "prop-dropdown-menu" }, options.map(function (option) {
        return el("button", {
          type: "button",
          className: "prop-dropdown-option",
          dataset: { propDropdownValue: prop, value: option.value },
          textContent: option.label
        });
      })),
    ]);
  }

  function buildShapeToolButton(option) {
    return el("button", {
      type: "button",
      className: "tool-btn dropdown-tool-btn",
      dataset: { tool: option.tool },
      title: option.title + " (" + option.shortcut + ")"
    }, [
      el("span", { className: "tb-icon " + option.iconClass, textContent: option.glyph }),
      el("span", { className: "dropdown-tool-copy" }, [
        el("span", { className: "dropdown-tool-title", textContent: option.title }),
        el("span", { className: "dropdown-tool-key", textContent: option.shortcut }),
      ]),
    ]);
  }

  function buildShapeDropdown() {
    var defaultShape = SHAPE_TOOL_OPTIONS[0];
    return el("div", { className: "toolbar-dropdown", id: "shape-tool-dropdown" }, [
      el("button", {
        type: "button",
        className: "action-btn toolbar-dropdown-trigger",
        dataset: { action: "toggle-shape-menu" },
        title: "Shape tools"
      }, [
        el("span", {
          id: "shape-tool-trigger-icon",
          className: "tb-icon " + defaultShape.iconClass,
          textContent: defaultShape.glyph
        }),
        el("span", { className: "toolbar-dropdown-caret", textContent: "\u25BE" }),
      ]),
      el("div", { className: "toolbar-dropdown-menu", id: "shape-tool-menu" },
        SHAPE_TOOL_OPTIONS.map(buildShapeToolButton)
      ),
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

        // Tool buttons — selection stays visible, shapes live in a compact menu
        el("div", { className: "toolbar-group" }, [
          el("button", { className: "tool-btn active", dataset: { tool: "select" }, title: "Select (V)" }, [
            el("span", { className: "tb-icon tb-icon-select tb-icon-glyph tb-icon-glyph-select", textContent: "\u2196" }),
            el("span", { className: "tb-key", textContent: "V" }),
          ]),
          buildShapeDropdown(),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Color swatches
        el("div", { className: "toolbar-group colors" }, [
          el("div", { className: "swatch-pair" }, [
            el("span", { className: "swatch-label", textContent: "Fill" }),
            el("button", {
              type: "button",
              className: "color-swatch-btn",
              title: "Fill color",
              dataset: { colorProp: "fill", colorHex: "#3366FF" },
            }, [
              el("span", { className: "color-swatch-chip" }),
            ]),
          ]),
          el("div", { className: "swatch-pair" }, [
            el("span", { className: "swatch-label", textContent: "Stroke" }),
            el("button", {
              type: "button",
              className: "color-swatch-btn",
              title: "Stroke color",
              dataset: { colorProp: "stroke", colorHex: "#FFFFFF" },
            }, [
              el("span", { className: "color-swatch-chip" }),
            ]),
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

        // Size match
        el("div", { className: "toolbar-group size-match-group" }, [
          el("button", { className: "action-btn", dataset: { action: "size-match-smallest-w" }, title: "Match smallest width" }, [
            el("span", { className: "tb-icon tb-icon-size-smallest-w" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "size-match-biggest-w" }, title: "Match biggest width" }, [
            el("span", { className: "tb-icon tb-icon-size-biggest-w" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "size-match-smallest-h" }, title: "Match smallest height" }, [
            el("span", { className: "tb-icon tb-icon-size-smallest-h" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "size-match-biggest-h" }, title: "Match biggest height" }, [
            el("span", { className: "tb-icon tb-icon-size-biggest-h" }),
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
          el("div", { className: "panel-tabs", dataset: { tabs: "properties" } }, [
            el("button", {
              type: "button",
              className: "panel-tab active",
              dataset: { panelTabBtn: "shape" },
              textContent: "Shape"
            }),
            el("button", {
              type: "button",
              className: "panel-tab",
              dataset: { panelTabBtn: "text" },
              textContent: "Text"
            }),
          ]),
          el("div", {
            className: "panel-empty-state",
            textContent: "Select an element to edit its properties."
          }),
          el("div", { className: "panel-tab-page active", dataset: { panelTabPage: "shape" } }, [
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
              el("button", {
                type: "button",
                className: "prop-color-btn",
                title: "Fill color",
                dataset: { colorProp: "fill", colorHex: "#3366FF" }
              }, [
                el("span", { className: "prop-color-chip" }),
              ]),
            ]),
            el("div", { className: "prop-row" }, [
              el("label", { textContent: "Stroke" }),
              el("button", {
                type: "button",
                className: "prop-color-btn",
                title: "Stroke color",
                dataset: { colorProp: "stroke", colorHex: "#FFFFFF" }
              }, [
                el("span", { className: "prop-color-chip" }),
              ]),
            ]),
            el("div", { className: "prop-row" }, [
              el("label", { textContent: "Stroke W" }),
              buildStepper("strokeWidth", STROKE_PRESETS),
            ]),
            el("div", { className: "prop-row", dataset: { propRow: "radius" } }, [
              el("label", { textContent: "Radius" }),
              buildStepper("radius", RADIUS_PRESETS),
            ]),
            el("div", { className: "prop-row", dataset: { propRow: "rotation" } }, [
              el("label", { textContent: "Rot (rad)" }),
              el("input", { type: "number", step: "0.01", className: "prop-input", dataset: { prop: "rotation" } }),
            ]),
            el("div", { className: "prop-row", dataset: { propRow: "shadowBlur" } }, [
              el("label", { textContent: "Glow" }),
              buildStepper("shadowBlur", GLOW_PRESETS),
            ]),
            el("div", { className: "prop-row", dataset: { propRow: "shadowColor" } }, [
              el("label", { textContent: "Glow Color" }),
              el("button", {
                type: "button",
                className: "prop-color-btn",
                title: "Glow color",
                dataset: { colorProp: "shadowColor", colorHex: "#000000" }
              }, [
                el("span", { className: "prop-color-chip" }),
              ]),
            ]),
            el("div", { className: "prop-row vertical", dataset: { propRow: "imageSrc" } }, [
              el("label", { textContent: "Image" }),
              el("input", { type: "text", className: "prop-input prop-input-wide", dataset: { prop: "imageSrc" } }),
            ]),
          ]),
          el("div", { className: "panel-tab-page", dataset: { panelTabPage: "text" } }, [
            el("div", { className: "prop-row", dataset: { propRow: "textColor" } }, [
              el("label", { textContent: "Text Col" }),
              el("button", {
                type: "button",
                className: "prop-color-btn",
                title: "Text color",
                dataset: { colorProp: "textColor", colorHex: "#FFFFFF" }
              }, [
                el("span", { className: "prop-color-chip" }),
              ]),
            ]),
            el("div", { className: "prop-row", dataset: { propRow: "textSize" } }, [
              el("label", { textContent: "Size" }),
              buildStepper("textSize", TEXT_SIZE_PRESETS),
            ]),
            el("div", { className: "prop-row prop-row-dual" }, [
              el("div", { className: "prop-inline-field", dataset: { propRow: "textAlign" } }, [
                el("label", { textContent: "H Align" }),
                buildPropDropdown("textAlign", [
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" },
                ]),
              ]),
              el("div", { className: "prop-inline-field", dataset: { propRow: "textVAlign" } }, [
                el("label", { textContent: "V Align" }),
                buildPropDropdown("textVAlign", [
                  { value: "top", label: "Top" },
                  { value: "center", label: "Center" },
                  { value: "bottom", label: "Bottom" },
                ]),
              ]),
            ]),
            el("div", { className: "prop-row vertical", dataset: { propRow: "textLines" } }, [
              el("label", { textContent: "Text" }),
              el("textarea", {
                className: "prop-textarea",
                rows: "4",
                placeholder: "Line 1\nLine 2",
                dataset: { prop: "textLines" }
              }),
            ]),
          ]),
          el("div", { className: "prop-row", dataset: { propRow: "delete" } }, [
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
            textContent: "Apply + Close HUD",
          }),
        ]),
        el("div", { className: "statusbar-center" }, [
          el("span", { id: "editor-context-pill", className: "editor-context-pill is-offline", textContent: "Preview Only" }),
          el("span", {
            id: "editor-status-hint",
            className: "status-hint",
            textContent: "Open the programming board Lua editor to load or save"
          }),
        ]),
        el("div", { className: "statusbar-right" }, [
          el("button", {
            className: "status-btn icon-only status-btn-help",
            dataset: { action: "status-help" },
            textContent: "?",
            title: "Bottom bar help",
            "aria-label": "Bottom bar help",
          }),
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
    var dropdownBtn = e.target.closest('[data-action="toggle-shape-menu"]');
    if (dropdownBtn) {
      toggleShapeMenu();
      return;
    }

    var btn = e.target.closest("[data-tool]");
    if (btn) {
      APP.state.currentTool = btn.dataset.tool;
      updateToolButtons(APP.state.currentTool);
      closeShapeMenu();
      APP.emit("tool-changed", APP.state.currentTool);
      return;
    }

    var actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;

    var action = actionBtn.dataset.action;
    closeShapeMenu();
    if (action === "undo") APP.emit("undo");
    else if (action === "redo") APP.emit("redo");
    else if (action === "save") APP.emit("save");
    else if (action === "status-help") APP.emit("status-help-open");
    else if (action === "export-board") APP.emit("export-board");
    else if (action === "export-screen") APP.emit("export-screen");
    else if (action === "close") APP.emit("close-editor");
    else if (action === "delete-element" && APP.state.selectedElementId) {
      APP.emit("delete-element", APP.state.selectedElementId);
    }
    else if (action.indexOf("align-") === 0) {
      APP.emit("align", action.replace("align-", ""));
    }
    else if (action.indexOf("size-match-") === 0) {
      APP.emit("size-match", action.replace("size-match-", ""));
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

  function isShapeTool(tool) {
    return !!SHAPE_TOOL_MAP[tool];
  }

  function getShapeDropdown(root) {
    return qs("#shape-tool-dropdown", root || APP.getRoot());
  }

  function openShapeMenu() {
    var dropdown = getShapeDropdown();
    var trigger;
    if (!dropdown) return;
    trigger = qs(".toolbar-dropdown-trigger", dropdown);
    dropdown.classList.add("open");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
  }

  function closeShapeMenu() {
    var dropdown = getShapeDropdown();
    var trigger;
    if (!dropdown) return;
    trigger = qs(".toolbar-dropdown-trigger", dropdown);
    dropdown.classList.remove("open");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function toggleShapeMenu() {
    var dropdown = getShapeDropdown();
    if (!dropdown) return;
    if (dropdown.classList.contains("open")) {
      closeShapeMenu();
    } else {
      openShapeMenu();
    }
  }

  function updateShapeDropdown(activeTool) {
    var dropdown = getShapeDropdown();
    var trigger;
    var icon;
    var option;
    if (!dropdown) return;

    if (isShapeTool(activeTool)) lastShapeTool = activeTool;
    option = SHAPE_TOOL_MAP[lastShapeTool] || SHAPE_TOOL_OPTIONS[0];
    trigger = qs(".toolbar-dropdown-trigger", dropdown);
    icon = qs("#shape-tool-trigger-icon", dropdown);

    if (icon) {
      icon.className = "tb-icon " + option.iconClass;
      icon.textContent = option.glyph;
    }
    if (trigger) {
      trigger.title = "Shape tools (" + option.title + " ready, " + option.shortcut + ")";
      trigger.classList.toggle("active", isShapeTool(activeTool));
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
    updateShapeDropdown(activeTool);
  }

  function syncToolbarSettings() {
    var root = APP.getRoot();
    var input = qs("#auto-open-panels-toggle", root);
    if (input) input.checked = !!APP.state.autoOpenPanels;
  }

  function updateEditorContext(status) {
    var root = APP.getRoot();
    var saveBtn = qs('[data-action="save"]', root);
    var pill = qs("#editor-context-pill", root);
    var hint = qs("#editor-status-hint", root);
    var canUseBoard = !!(status && status.canAccessOnStart);

    if (saveBtn) {
      saveBtn.textContent = canUseBoard ? "Apply + Close HUD" : "Save";
      saveBtn.title = canUseBoard
        ? "Write to unit.onStart and close Lua Painter after apply"
        : "Save current layout";
    }

    if (saveBtn) saveBtn.disabled = !canUseBoard;

    if (pill) {
      pill.className = "editor-context-pill " + (canUseBoard ? "is-online" : "is-offline");
      pill.textContent = canUseBoard ? "Board Connected" : "Preview Only";
    }
    if (hint) {
      hint.textContent = canUseBoard
        ? "Save writes directly to the current programming board unit.onStart"
        : "Open the programming board Lua editor to load or save";
    }
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

  function attachShapeDropdownListeners() {
    if (document.__hudShapeDropdownBound) return;
    document.__hudShapeDropdownBound = true;

    document.addEventListener("mousedown", function (e) {
      var dropdown = getShapeDropdown();
      if (!dropdown || !dropdown.classList.contains("open")) return;
      if (dropdown.contains(e.target)) return;
      closeShapeMenu();
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.code === "Escape") {
        closeShapeMenu();
      }
    }, true);
  }

  // ─── Register with core ──────────────────────────────────────────────

  APP.on("document-created", function () {
    goToEditor();
  });

  APP.on("tool-changed", function (tool) {
    closeShapeMenu();
    updateToolButtons(tool || APP.state.currentTool);
  });

  APP.on("auto-open-panels-changed", function () {
    syncToolbarSettings();
  });

  APP.on("editor-context", updateEditorContext);

  function mountEditorShell() {
    var root = APP.getRoot();
    if (qs('[data-screen="editor"]', root)) return;
    var editorShell = buildEditorShell();
    root.appendChild(editorShell);

    var toolbar = qs("#editor-toolbar", root);
    if (toolbar) toolbar.addEventListener("click", onToolbarClick);
    attachToolbarSettingListeners();
    attachShapeDropdownListeners();
    APP.state.autoOpenPanels = loadAutoOpenPanels();
    syncToolbarSettings();
    updateEditorContext(APP.state.editorContext || null);

    var statusbar = qs("#editor-statusbar", root);
    if (statusbar) statusbar.addEventListener("click", onToolbarClick);

    var propsPanel = qs("#properties-panel", root);
    if (propsPanel) propsPanel.addEventListener("click", onToolbarClick);
  }

  APP.init = (function (origInit) {
    return function () {
      origInit();
      mountEditorShell();
      updateEditorContext(APP.state.editorContext || null);
    };
  })(APP.init);

  mountEditorShell();

  // Expose
  APP.goToStart = goToStart;
  APP.goToEditor = goToEditor;
  APP.updateToolButtons = updateToolButtons;
  APP.closeShapeMenu = closeShapeMenu;
})();
