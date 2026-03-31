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

    // Hide element when visibility is off; restore when toggled back
    if (element.visible === false) {
      dom.style.display = "none";
    } else if (dom.style.display === "none") {
      dom.style.display = "";
    }
  }

  // ─── Selection overlay ─────────────────────────────────────────────

  function createSelectionOverlay(element, showHandles) {
    var overlay = el("div", {
      className: "selection-overlay",
      dataset: { elementId: element.id + "_sel" },
    });

    // Outline
    var outline = el("div", { className: "selection-outline" });
    overlay.appendChild(outline);

    // 8 resize handles — only for focus element
    if (showHandles !== false) {
      var handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
      handles.forEach(function (h) {
        var handle = el("div", {
          className: "resize-handle",
          dataset: { h: h, elementId: element.id },
        });
        overlay.appendChild(handle);
      });
    }

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

    // Render selection overlays for all selected elements
    clearSelectionOverlays();
    var selIds = APP.state.selectedElementIds || [];
    var focusId = APP.state.selectedElementId;
    for (var si = 0; si < selIds.length; si++) {
      var selEl = findElementById(selIds[si]);
      if (selEl) {
        var isFocus = selIds[si] === focusId;
        var overlay = createSelectionOverlay(selEl, isFocus);
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

    // Rebuild all selection overlays
    clearSelectionOverlays();
    var selIds = APP.state.selectedElementIds || [];
    var focusId = APP.state.selectedElementId;
    for (var si = 0; si < selIds.length; si++) {
      var selEl = findElementById(selIds[si]);
      if (selEl) {
        var ov = createSelectionOverlay(selEl, selIds[si] === focusId);
        preview.appendChild(ov);
      }
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
