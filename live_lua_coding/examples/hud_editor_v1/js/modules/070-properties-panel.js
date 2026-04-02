// 070-properties-panel.js - Properties editing UI + binding
(function hudEditorPropertiesPanel() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var qs = APP.qs;
  var qsa = APP.qsa;

  function isAutoOpenEnabled() {
    return !!APP.state.autoOpenPanels;
  }

  function setColorButtonValue(button, hex) {
    if (!button) return;
    var color = String(hex || "#ffffff");
    button.dataset.colorHex = color;
    button.style.setProperty("--swatch-color", color);
    button.style.backgroundColor = color;
    button.style.backgroundImage = "none";
    var chip = qs(".color-swatch-chip, .prop-color-chip", button);
    if (chip) chip.style.background = color;
  }

  function getSelectedElement() {
    return APP.state.selectedElementId ? APP.canvas.getElementById(APP.state.selectedElementId) : null;
  }

  function getColorValueForProp(prop) {
    var element = getSelectedElement();
    if (!element) return [1, 1, 1, 1];
    if (prop === "fill") return Array.isArray(element.fill) ? element.fill.slice() : [1, 1, 1, 1];
    if (prop === "stroke") return Array.isArray(element.stroke) ? element.stroke.slice() : [1, 1, 1, 1];
    return [1, 1, 1, 1];
  }

  function openColorDialog(prop, rgba) {
    if (!prop) return;
    var value = Array.isArray(rgba) ? rgba.slice(0, 4) : getColorValueForProp(prop);
    APP.emit("color-dialog-open", {
      prop: prop,
      rgba: value
    });
  }

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
    // Radius only applies to box / boxRounded
    var radiusRow = qs('[data-prop-row="radius"]', panel);
    var showRadius = (element.type === "box" || element.type === "boxRounded");
    if (radiusRow) radiusRow.style.display = showRadius ? "" : "none";

    if (radiusInput && showRadius) setStepperValue(radiusInput, element.radius || 0);
    if (strokeWidthInput) setStepperValue(strokeWidthInput, element.strokeWidth || 0);

    // Colors — update both panel and toolbar pickers
    var fillHex   = rgbaToHex(element.fill);
    var strokeHex = rgbaToHex(element.stroke);
    var fillInput = qs('[data-color-prop="fill"]', panel);
    var strokeInput = qs('[data-color-prop="stroke"]', panel);
    setColorButtonValue(fillInput, fillHex);
    setColorButtonValue(strokeInput, strokeHex);

    // Sync toolbar color pickers too
    var root = APP.getRoot ? APP.getRoot() : document;
    var toolbarFill   = qs('#editor-toolbar [data-color-prop="fill"]', root);
    var toolbarStroke = qs('#editor-toolbar [data-color-prop="stroke"]', root);
    setColorButtonValue(toolbarFill, fillHex);
    setColorButtonValue(toolbarStroke, strokeHex);

    // Text
    if (textArea) {
      var lines = element.textLines || [];
      textArea.value = Array.isArray(lines) ? lines.join("\n") : (lines || "");
    }
  }

  // ─── Property sync: panel → document ──────────────────────────────

  // Properties that should apply to all selected elements
  var MULTI_PROPS = { fill: 1, stroke: 1, strokeWidth: 1 };

  function applyPanelChange(prop, value) {
    var elementId = APP.state.selectedElementId;
    if (!elementId) return;

    APP.emit("before-element-change");

    // Determine which elements to update
    var targetIds;
    if (MULTI_PROPS[prop]) {
      targetIds = (APP.state.selectedElementIds || []).slice();
      if (targetIds.length === 0) targetIds = [elementId];
    } else {
      targetIds = [elementId];
    }

    var changed = false;

    for (var t = 0; t < targetIds.length; t++) {
      var element = APP.canvas.getElementById(targetIds[t]);
      if (!element) continue;

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
          element.fill = Array.isArray(value) ? value.slice(0, 4) : hexToRgba(value);
          changed = true;
          break;
        case "stroke":
          element.stroke = Array.isArray(value) ? value.slice(0, 4) : hexToRgba(value);
          changed = true;
          break;
        case "textLines":
          element.textLines = value.split("\n");
          changed = true;
          break;
      }

      if (changed) {
        APP.canvas.updateElement(targetIds[t]);
      }
    }

    if (changed) {
      APP.state.isDirty = true;
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

  // ─── Collapse / expand ─────────────────────────────────────────────

  var COLLAPSE_KEY = "hud_props_panel_collapsed";

  function toggleCollapse() {
    var panel = qs("#properties-panel");
    if (!panel) return;
    var collapsed = !panel.classList.contains("collapsed");
    panel.classList.toggle("collapsed", collapsed);
    if (!collapsed) panel.classList.remove("hover-open");
    var btn = qs(".panel-toggle", panel);
    if (btn) btn.textContent = collapsed ? "\u25B8" : "\u25BE";
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : ""); } catch (e) { /* ignore */ }
  }

  function restoreCollapse() {
    var panel = qs("#properties-panel");
    if (!panel) return;
    var collapsed = false;
    try { collapsed = localStorage.getItem(COLLAPSE_KEY) === "1"; } catch (e) { /* ignore */ }
    panel.classList.toggle("collapsed", collapsed);
    if (!collapsed) panel.classList.remove("hover-open");
    var btn = qs(".panel-toggle", panel);
    if (btn) btn.textContent = collapsed ? "\u25B8" : "\u25BE";
  }

  // ─── Panel visibility ─────────────────────────────────────────────

  function showPanel() {
    var panel = qs("#properties-panel");
    if (!panel) return;
    panel.classList.add("visible");
    restorePanelPos(panel);
    restoreCollapse();
  }

  function hidePanel() {
    var panel = qs("#properties-panel");
    if (panel) panel.classList.remove("visible");
  }

  // ─── Stepper value helper ─────────────────────────────────────────

  function setStepperValue(select, value) {
    // Try exact match first
    for (var i = 0; i < select.options.length; i++) {
      if (Number(select.options[i].value) === value) {
        select.selectedIndex = i;
        return;
      }
    }
    // Closest option
    var best = 0;
    var bestDiff = Infinity;
    for (var j = 0; j < select.options.length; j++) {
      var diff = Math.abs(Number(select.options[j].value) - value);
      if (diff < bestDiff) { bestDiff = diff; best = j; }
    }
    select.selectedIndex = best;
  }

  // ─── Input event handlers ─────────────────────────────────────────

  function onInputChange(e) {
    var input = e.target;
    var prop = input.dataset.prop;
    if (!prop) return;
    applyPanelChange(prop, input.value);
  }

  function onColorPicked(payload) {
    if (!payload || !payload.prop) return;
    var value = Array.isArray(payload.rgba) ? payload.rgba : payload.value;
    if (!value) return;
    applyPanelChange(payload.prop, value);
    if (APP.state.selectedElementId) {
      populatePanel(APP.state.selectedElementId);
    }
  }

  function onStepperClick(e) {
    var btn = e.target.closest(".stepper-dec, .stepper-inc");
    if (!btn) return;
    var prop = btn.dataset.stepperProp;
    if (!prop) return;
    var panel = qs("#properties-panel");
    var select = panel && qs('.stepper-select[data-prop="' + prop + '"]', panel);
    if (!select) return;
    var dir = btn.classList.contains("stepper-inc") ? 1 : -1;
    var newIdx = select.selectedIndex + dir;
    newIdx = Math.max(0, Math.min(newIdx, select.options.length - 1));
    select.selectedIndex = newIdx;
    applyPanelChange(prop, select.value);
  }

  function onStepperChange(e) {
    var select = e.target;
    if (!select.classList.contains("stepper-select")) return;
    var prop = select.dataset.prop;
    if (!prop) return;
    applyPanelChange(prop, select.value);
  }

  // ─── Panel position persistence ───────────────────────────────────────

  var POS_KEY = "hud_props_panel_pos";

  function savePanelPos(panel) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ left: panel.style.left, top: panel.style.top }));
    } catch (e) {}
  }

  function restorePanelPos(panel) {
    var left = 12, top = 72;
    try {
      var saved = localStorage.getItem(POS_KEY);
      if (saved) {
        var pos = JSON.parse(saved);
        if (pos.left) left = parseFloat(pos.left) || 12;
        if (pos.top)  top  = parseFloat(pos.top)  || 72;
        // Clamp to editor bounds so a stale position can't hide the panel
        var editorScreen = panel.closest('[data-screen="editor"]');
        if (editorScreen) {
          left = Math.max(0, Math.min(left, editorScreen.clientWidth  - (panel.offsetWidth  || 340)));
          top  = Math.max(0, Math.min(top,  editorScreen.clientHeight - (panel.offsetHeight || 80)));
        }
      }
    } catch (e) {}
    // Always set position — defaults (12, 72) when no stored data
    panel.style.left  = left + "px";
    panel.style.top   = top  + "px";
    panel.style.right = "auto";
  }

  // ─── Panel drag ──────────────────────────────────────────────────────

  var drag = { active: false, offX: 0, offY: 0, editorRect: null };

  function attachDragListener() {
    var panel = qs("#properties-panel");
    var header = panel && qs(".panel-header", panel);
    if (!header || header.__hudPanelDragBound) return;
    header.__hudPanelDragBound = true;

    header.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      if (e.target.closest(".panel-toggle")) return;
      var editorScreen = panel.closest('[data-screen="editor"]');
      if (!editorScreen) return;
      var editorRect = editorScreen.getBoundingClientRect();
      var panelRect  = panel.getBoundingClientRect();

      drag.active = true;
      drag.offX = e.clientX - panelRect.left;
      drag.offY = e.clientY - panelRect.top;
      drag.editorRect = editorRect;

      // Panel is left-anchored by default; normalise on drag start
      panel.style.right = "auto";
      panel.style.left  = (panelRect.left - editorRect.left) + "px";
      panel.style.top   = (panelRect.top  - editorRect.top)  + "px";

      e.preventDefault();
    });

    document.addEventListener("mousemove", function (e) {
      if (!drag.active) return;
      var er = drag.editorRect;
      var x = e.clientX - drag.offX - er.left;
      var y = e.clientY - drag.offY - er.top;
      x = Math.max(0, Math.min(x, er.width  - panel.offsetWidth));
      y = Math.max(0, Math.min(y, er.height - panel.offsetHeight));
      panel.style.left = x + "px";
      panel.style.top  = y + "px";
    });

    document.addEventListener("mouseup", function () {
      if (drag.active) savePanelPos(panel);
      drag.active = false;
    });
  }

  function attachHoverOpenListener() {
    var panel = qs("#properties-panel");
    if (!panel || panel.__hudPropsHoverBound) return;
    panel.__hudPropsHoverBound = true;

    panel.addEventListener("mouseenter", function () {
      if (!isAutoOpenEnabled()) return;
      if (!panel.classList.contains("collapsed")) return;
      panel.classList.add("hover-open");
    });

    panel.addEventListener("mouseleave", function () {
      if (!panel.classList.contains("collapsed")) return;
      panel.classList.remove("hover-open");
    });
  }

  // ─── Toolbar color picker sync ─────────────────────────────────────

  function attachToolbarColorListeners() {
    var root = APP.getRoot ? APP.getRoot() : document;
    var toolbar = qs("#editor-toolbar", root);
    if (!toolbar || toolbar.__hudToolbarColorBound) return;
    toolbar.__hudToolbarColorBound = true;

    toolbar.addEventListener("click", function (e) {
      var button = e.target.closest("[data-color-prop]");
      if (!button) return;
      var prop = button.dataset.colorProp;
      if (prop !== "fill" && prop !== "stroke") return;
      openColorDialog(prop);
    });
  }

  function onPanelColorClick(e) {
    var button = e.target.closest("#properties-panel [data-color-prop]");
    if (!button) return;
    var prop = button.dataset.colorProp;
    if (prop !== "fill" && prop !== "stroke") return;
    openColorDialog(prop);
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

    // Stepper clicks (+/−) and select changes — use delegation on panel
    panel.removeEventListener("click", onPanelColorClick);
    panel.removeEventListener("click",  onStepperClick);
    panel.removeEventListener("change", onStepperChange);
    panel.addEventListener("click", onPanelColorClick);
    panel.addEventListener("click",  onStepperClick);
    panel.addEventListener("change", onStepperChange);
  }

  // ─── Event listeners ──────────────────────────────────────────────

  APP.on("selection-changed", function (elementId) {
    if (elementId) {
      populatePanel(elementId);
      showPanel();
      attachPanelListeners();
      attachDragListener();
    } else {
      hidePanel();
    }
  });

  APP.on("enter-edit", function () {
    setTimeout(function () {
      attachPanelListeners();
      attachDragListener();
      attachHoverOpenListener();
      attachToolbarColorListeners();
    }, 200);
  });

  APP.on("element-updated", function (elementId) {
    if (elementId === APP.state.selectedElementId) {
      populatePanel(elementId);
    }
  });

  APP.on("color-picked", onColorPicked);

  APP.on("toggle-props-collapse", function () {
    toggleCollapse();
  });

  APP.on("auto-open-panels-changed", function (enabled) {
    var panel = qs("#properties-panel");
    if (!enabled && panel) panel.classList.remove("hover-open");
  });

})();
