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
