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
  var colorDialogState = {
    prop: null,
    rgba: [1, 1, 1, 1],
    hue: 0
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toFiniteNumber(value, fallback) {
    var num = Number(value);
    return isFinite(num) ? num : fallback;
  }

  function normalizeRgba(value) {
    var rgba = Array.isArray(value) ? value.slice(0, 4) : [];
    return [
      clamp(toFiniteNumber(rgba[0], 1), 0, 1),
      clamp(toFiniteNumber(rgba[1], 1), 0, 1),
      clamp(toFiniteNumber(rgba[2], 1), 0, 1),
      clamp(toFiniteNumber(rgba[3], 1), 0, 1)
    ];
  }

  function rgbaToCss(rgba) {
    var value = normalizeRgba(rgba);
    return "rgba(" +
      Math.round(value[0] * 255) + "," +
      Math.round(value[1] * 255) + "," +
      Math.round(value[2] * 255) + "," +
      value[3] + ")";
  }

  function rgbToHsv(rgba) {
    var value = normalizeRgba(rgba);
    var r = value[0], g = value[1], b = value[2];
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;
    var h = 0;
    var s = max === 0 ? 0 : delta / max;
    var v = max;

    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = ((b - r) / delta) + 2;
      else h = ((r - g) / delta) + 4;
      h *= 60;
      if (h < 0) h += 360;
    }

    return { h: h, s: s, v: v };
  }

  function hsvToRgb(h, s, v, a) {
    var hue = ((Number(h) % 360) + 360) % 360;
    var sat = clamp(toFiniteNumber(s, 1), 0, 1);
    var val = clamp(toFiniteNumber(v, 1), 0, 1);
    var c = val * sat;
    var x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    var m = val - c;
    var r = 0, g = 0, b = 0;

    if (hue < 60) { r = c; g = x; b = 0; }
    else if (hue < 120) { r = x; g = c; b = 0; }
    else if (hue < 180) { r = 0; g = c; b = x; }
    else if (hue < 240) { r = 0; g = x; b = c; }
    else if (hue < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [
      clamp(r + m, 0, 1),
      clamp(g + m, 0, 1),
      clamp(b + m, 0, 1),
      clamp(toFiniteNumber(a, 1), 0, 1)
    ];
  }

  function formatAlpha(value) {
    var alpha = clamp(toFiniteNumber(value, 1), 0, 1);
    var text = alpha.toFixed(2);
    text = text.replace(/0+$/, "").replace(/\.$/, "");
    return text || "0";
  }

  function syncColorFields() {
    var rgba = normalizeRgba(colorDialogState.rgba);
    var rInput = qs("#color-r-input");
    var gInput = qs("#color-g-input");
    var bInput = qs("#color-b-input");
    var aInput = qs("#color-a-input");
    if (rInput) rInput.value = String(Math.round(rgba[0] * 255));
    if (gInput) gInput.value = String(Math.round(rgba[1] * 255));
    if (bInput) bInput.value = String(Math.round(rgba[2] * 255));
    if (aInput) aInput.value = formatAlpha(rgba[3]);
  }

  function updateColorDialogUi() {
    var rgba = normalizeRgba(colorDialogState.rgba);
    var preview = qs("#color-preview");
    var strip = qs("#color-strip-range");
    if (preview) preview.style.background = rgbaToCss(rgba);
    if (strip) strip.value = String(Math.round(colorDialogState.hue || 0));
    syncColorFields();
  }

  function updateColorStateFromInputs() {
    var rInput = qs("#color-r-input");
    var gInput = qs("#color-g-input");
    var bInput = qs("#color-b-input");
    var aInput = qs("#color-a-input");
    var rgba = [
      clamp(toFiniteNumber(rInput && rInput.value, 255), 0, 255) / 255,
      clamp(toFiniteNumber(gInput && gInput.value, 255), 0, 255) / 255,
      clamp(toFiniteNumber(bInput && bInput.value, 255), 0, 255) / 255,
      clamp(toFiniteNumber(aInput && aInput.value, 1), 0, 1)
    ];
    colorDialogState.rgba = rgba;
    colorDialogState.hue = rgbToHsv(rgba).h;
    updateColorDialogUi();
  }

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
          el("p", { className: "save-note", textContent: "Saves the current layout" }),
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

    var colorD = el("div", {
      id: "dialog-color",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-header" }, [
          el("h3", { textContent: "Choose Color" }),
          el("button", {
            className: "dialog-close",
            dataset: { action: "close-color" },
            textContent: "\u00D7",
          }),
        ]),
        el("div", { className: "dialog-content" }, [
          el("div", { id: "color-preview", className: "dialog-color-preview" }),
          el("label", { className: "color-strip-label", textContent: "Color Strip" }),
          el("input", {
            type: "range",
            id: "color-strip-range",
            className: "color-strip-range",
            min: "0",
            max: "360",
            step: "1",
            value: "0",
          }),
          el("div", { className: "color-field-row" }, [
            el("label", { className: "color-field", for: "color-r-input" }, [
              el("span", { className: "color-field-label", textContent: "R" }),
              el("input", { type: "text", id: "color-r-input", className: "color-number-input", inputmode: "numeric", maxlength: "4" }),
            ]),
            el("label", { className: "color-field", for: "color-g-input" }, [
              el("span", { className: "color-field-label", textContent: "G" }),
              el("input", { type: "text", id: "color-g-input", className: "color-number-input", inputmode: "numeric", maxlength: "4" }),
            ]),
            el("label", { className: "color-field", for: "color-b-input" }, [
              el("span", { className: "color-field-label", textContent: "B" }),
              el("input", { type: "text", id: "color-b-input", className: "color-number-input", inputmode: "numeric", maxlength: "4" }),
            ]),
            el("label", { className: "color-field", for: "color-a-input" }, [
              el("span", { className: "color-field-label", textContent: "A" }),
              el("input", { type: "text", id: "color-a-input", className: "color-number-input", inputmode: "decimal", maxlength: "4" }),
            ]),
          ]),
          el("p", { className: "save-note", textContent: "R, G, B use 0-255. A uses 0-1." }),
        ]),
        el("div", { className: "dialog-footer" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-color" },
            textContent: "Cancel",
          }),
          el("button", {
            className: "btn primary",
            dataset: { action: "confirm-color" },
            textContent: "Apply",
          }),
        ]),
      ]),
    ]);
    root.appendChild(colorD);

    // ── Close confirmation dialog ─────────────────────────────────
    var closeD = el("div", {
      id: "dialog-close",
      className: "dialog-overlay",
        style: { display: "none" },
      }, [
        el("div", { className: "dialog" }, [
          el("div", { className: "dialog-content centered" }, [
          el("div", { className: "confirm-icon", "aria-hidden": "true" }),
          el("h3", { textContent: "Unsaved Changes" }),
          el("p", { textContent: "You have unsaved changes. What would you like to do?" }),
        ]),
        el("div", { className: "dialog-footer centered" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-cancel" },
            textContent: "Keep Editing",
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
    } else if (action === "close-color") {
      hideDialog();
    } else if (action === "close-cancel") {
      hideDialog();
    } else if (action === "close-discard") {
      APP.state.isDirty = false;
      hideDialog();
      APP.goToStart();
    } else if (action === "close-save") {
      hideDialog();
      if (APP.state && APP.state.editorContext && APP.state.editorContext.canAccessOnStart) {
        APP.emit("save");
      } else if (APP.fileSync && typeof APP.fileSync.save === "function") {
        var id = APP.fileSync.save(APP.state.document && APP.state.document.name || "Layout");
        if (id) {
          APP.emit("toast", { type: "success", text: "Layout saved" });
          APP.goToStart();
        } else {
          APP.emit("toast", { type: "error", text: "Save failed" });
        }
      } else {
        APP.emit("save");
      }
    } else if (action === "confirm-saveas") {
      var nameInput = qs("#saveas-name");
      var name = nameInput ? nameInput.value.trim() : "";
      if (name) {
        APP.emit("saveas-confirm", name);
        hideDialog();
      }
    } else if (action === "confirm-color") {
      if (!colorDialogState.prop) return;
      updateColorStateFromInputs();
      APP.emit("color-picked", {
        prop: colorDialogState.prop,
        rgba: normalizeRgba(colorDialogState.rgba)
      });
      hideDialog();
    }
  }

  function onDialogInput(e) {
    if (!e.target) return;
    if (e.target.id === "color-strip-range") {
      colorDialogState.hue = clamp(toFiniteNumber(e.target.value, 0), 0, 360);
      colorDialogState.rgba = hsvToRgb(colorDialogState.hue, 1, 1, colorDialogState.rgba[3]);
      updateColorDialogUi();
      return;
    }
    if (
      e.target.id === "color-r-input" ||
      e.target.id === "color-g-input" ||
      e.target.id === "color-b-input" ||
      e.target.id === "color-a-input"
    ) {
      updateColorStateFromInputs();
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

  APP.on("color-dialog-open", function (payload) {
    colorDialogState.prop = payload && payload.prop ? String(payload.prop) : null;
    colorDialogState.rgba = normalizeRgba(payload && payload.rgba);
    colorDialogState.hue = rgbToHsv(colorDialogState.rgba).h;
    showDialog("color");
    updateColorDialogUi();
    var input = qs("#color-r-input");
    if (input) {
      if (typeof input.focus === "function") input.focus();
      if (typeof input.select === "function") input.select();
    }
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
      root.addEventListener("input", onDialogInput);
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
    root.addEventListener("input", onDialogInput);
    var scriptList = qs("#script-list", root);
    if (scriptList) {
      scriptList.addEventListener("click", onScriptListClick);
    }
  }

})();
