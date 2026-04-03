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

  function hasVisibleColor(rgba) {
    return Array.isArray(rgba) && (Number(rgba[3]) || 0) > 0;
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
      dataset: { elementId: element.id, elementType: element.type },
    });

    applyElementStyles(dom, element);
    return dom;
  }

  function createSvgElement(tagName) {
    return document.createElementNS("http://www.w3.org/2000/svg", tagName);
  }

  function setShadowStyle(node, blur, color) {
    if (!node || !hasVisibleColor(color) || !(blur > 0)) {
      if (node) node.style.filter = "";
      return;
    }
    node.style.filter = "drop-shadow(0 0 " + Math.max(1, blur) + "px " + rgbaToCss(color) + ")";
  }

  function createCommandLayer(command, originX, originY) {
    var layer = el("div", { className: "canvas-command" });
    layer.style.position = "absolute";
    layer.style.left = Math.round((Number(command.x) - originX) * scale) + "px";
    layer.style.top = Math.round((Number(command.y) - originY) * scale) + "px";
    layer.style.width = Math.max(1, Math.round((Number(command.w) || 0) * scale)) + "px";
    layer.style.height = Math.max(1, Math.round((Number(command.h) || 0) * scale)) + "px";
    layer.style.transformOrigin = "center center";
    layer.style.pointerEvents = "none";
    layer.style.overflow = "visible";
    if (command.o !== "text" && (Number(command.rot) || 0)) {
      layer.style.transform = "rotate(" + (Number(command.rot) || 0) + "rad)";
    }
    return layer;
  }

  function createSvgCommandNode(command, draw) {
    var width = Math.max(1, (Number(command.w) || 0) * scale);
    var height = Math.max(1, (Number(command.h) || 0) * scale);
    var svg = createSvgElement("svg");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.overflow = "visible";
    svg.style.pointerEvents = "none";
    draw(svg, width, height);
    setShadowStyle(svg, Math.max(0, (command.sh && Number(command.sh.b) || 0) * scale), command.sh && command.sh.c);
    return svg;
  }

  function appendShapeNode(layer, command) {
    var fill = hasVisibleColor(command.f) ? rgbaToCss(command.f) : "transparent";
    var stroke = hasVisibleColor(command.s) ? rgbaToCss(command.s) : "transparent";
    var strokeWidth = Math.max(0, (Number(command.sw) || 0) * scale);
    var kind = String(command.k || "box");
    var svg = createSvgCommandNode(command, function (svg, width, height) {
      var shape;
      if (kind === "circle") {
        shape = createSvgElement("circle");
        shape.setAttribute("cx", String(width * 0.5));
        shape.setAttribute("cy", String(height * 0.5));
        shape.setAttribute("r", String(Math.min(width, height) * 0.5));
      } else {
        shape = kind === "box" || kind === "boxRounded" ? createSvgElement("rect") : createSvgElement("polygon");
        if (kind === "box" || kind === "boxRounded") {
          shape.setAttribute("x", "0");
          shape.setAttribute("y", "0");
          shape.setAttribute("width", String(width));
          shape.setAttribute("height", String(height));
          if (kind === "boxRounded") {
            var radius = Math.max(0, (Number(command.r) || 0) * scale);
            shape.setAttribute("rx", String(radius));
            shape.setAttribute("ry", String(radius));
          }
        } else if (kind === "triangle") {
          shape.setAttribute("points", "0,0 " + width + ",0 0," + height);
        } else {
          var inset = Math.max(0, Math.min(0.45, Number(command.qi) || 0.125));
          shape.setAttribute("points", [
            "0,0",
            (width * (1 - inset)) + "," + (height * inset),
            width + "," + height,
            (width * inset) + "," + (height * (1 - inset))
          ].join(" "));
        }
      }
      shape.setAttribute("fill", fill);
      shape.setAttribute("stroke", stroke);
      shape.setAttribute("stroke-width", String(strokeWidth));
      shape.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(shape);
    });
    layer.appendChild(svg);
  }

  function appendBezierNode(layer, command) {
    var stroke = hasVisibleColor(command.s) ? rgbaToCss(command.s) : "transparent";
    var strokeWidth = Math.max(1, (Number(command.sw) || 2) * scale);
    var svg = createSvgCommandNode(command, function (svg, width, height) {
      var path = createSvgElement("path");
      path.setAttribute("d", "M 0 " + height + " Q " + (width * 0.5) + " 0 " + width + " " + height);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", stroke);
      path.setAttribute("stroke-width", String(strokeWidth));
      path.setAttribute("vector-effect", "non-scaling-stroke");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
    });
    layer.appendChild(svg);
  }

  function appendLineNode(layer, command) {
    var stroke = hasVisibleColor(command.s) ? rgbaToCss(command.s) : "transparent";
    var strokeWidth = Math.max(1, (Number(command.sw) || 2) * scale);
    var svg = createSvgCommandNode(command, function (svg, width, height) {
      var line = createSvgElement("line");
      line.setAttribute("x1", "0");
      line.setAttribute("y1", "0");
      line.setAttribute("x2", String(width));
      line.setAttribute("y2", String(height));
      line.setAttribute("stroke", stroke);
      line.setAttribute("stroke-width", String(strokeWidth));
      line.setAttribute("vector-effect", "non-scaling-stroke");
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);
    });
    layer.appendChild(svg);
  }

  function appendTextNode(layer, command) {
    var wrapper = el("div", { className: "canvas-text-node" });
    var lines = Array.isArray(command.l) ? command.l : [];
    var fontSize = Math.max(1, Math.floor((Number(command.ts) || 16) * scale + 0.5));
    var strokeWidth = Math.max(0, (Number(command.sw) || 0) * scale);
    wrapper.style.position = "absolute";
    wrapper.style.inset = "0";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.justifyContent = "center";
    wrapper.style.alignItems = command.ta === "center" ? "center" : (command.ta === "right" ? "flex-end" : "flex-start");
    wrapper.style.padding = "0 " + Math.round(12 * scale) + "px";
    wrapper.style.gap = Math.max(2, Math.floor(fontSize * 0.2)) + "px";
    wrapper.style.color = rgbaToCss(command.tc || [1, 1, 1, 1]);
    wrapper.style.fontSize = fontSize + "px";
    wrapper.style.fontFamily = "Play, Rajdhani, Segoe UI, sans-serif";
    wrapper.style.lineHeight = "1";
    wrapper.style.textAlign = command.ta || "left";
    wrapper.style.whiteSpace = "pre";
    wrapper.style.pointerEvents = "none";
    if (strokeWidth > 0 && hasVisibleColor(command.s)) {
      wrapper.style.webkitTextStroke = strokeWidth + "px " + rgbaToCss(command.s);
    }
    if (hasVisibleColor(command.sh && command.sh.c) && (Number(command.sh && command.sh.b) || 0) > 0) {
      wrapper.style.textShadow = "0 0 " + Math.max(1, (Number(command.sh.b) || 0) * scale) + "px " + rgbaToCss(command.sh.c);
    }
    wrapper.textContent = lines.join("\n");
    layer.appendChild(wrapper);
  }

  function appendImageNode(layer, command) {
    var image = document.createElement("img");
    image.alt = "preview-image";
    image.src = command.src || "";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = command.fit || "contain";
    image.style.display = "block";
    image.style.pointerEvents = "none";
    setShadowStyle(image, Math.max(0, (command.sh && Number(command.sh.b) || 0) * scale), command.sh && command.sh.c);
    image.addEventListener("error", function () {
      layer.style.backgroundImage = "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.85), rgba(156,156,156,0.75) 35%, rgba(64,64,64,0.95) 70%)";
      layer.style.backgroundSize = "cover";
      layer.style.backgroundRepeat = "no-repeat";
      layer.style.backgroundPosition = "center";
    }, { once: true });
    layer.appendChild(image);
  }

  function buildPreviewCommands(element) {
    if (APP.screenCommands && typeof APP.screenCommands.buildCommandsForElement === "function") {
      return APP.screenCommands.buildCommandsForElement(element);
    }
    return [];
  }

  function appendCommandNode(dom, element, command) {
    var layer = createCommandLayer(command, Number(element.x) || 0, Number(element.y) || 0);
    switch (command.o) {
      case "shape":
        appendShapeNode(layer, command);
        break;
      case "bezier":
        appendBezierNode(layer, command);
        break;
      case "line":
        appendLineNode(layer, command);
        break;
      case "text":
        appendTextNode(layer, command);
        break;
      case "image":
        appendImageNode(layer, command);
        break;
      default:
        return;
    }
    dom.appendChild(layer);
  }

  function applyElementStyles(dom, element) {
    var pos = screenToCanvas(element.x, element.y);
    var size = screenToCanvas(element.w, element.h);

    dom.innerHTML = "";
    dom.dataset.elementType = element.type;
    dom.style.left = pos.x + "px";
    dom.style.top = pos.y + "px";
    dom.style.width = size.x + "px";
    dom.style.height = size.y + "px";
    dom.style.transform = "";
    dom.style.transformOrigin = "";
    dom.style.filter = "";
    dom.style.background = "transparent";
    dom.style.backgroundColor = "transparent";
    dom.style.backgroundImage = "none";
    dom.style.backgroundSize = "";
    dom.style.backgroundRepeat = "";
    dom.style.backgroundPosition = "";
    dom.style.border = "none";
    dom.style.borderRadius = "0";
    dom.style.boxSizing = "border-box";
    dom.style.display = "block";
    dom.style.alignItems = "";
    dom.style.justifyContent = "";
    dom.style.padding = "";
    dom.style.overflow = "visible";
    dom.style.color = "";
    dom.style.fontSize = "";
    dom.style.fontFamily = "";
    dom.style.textAlign = "";
    dom.style.whiteSpace = "";
    dom.style.wordBreak = "";
    dom.style.webkitTextStroke = "";
    dom.style.textShadow = "";
    buildPreviewCommands(element).forEach(function (command) {
      appendCommandNode(dom, element, command);
    });

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

  // ─── Render selection / group overlays ──────────────────────────────

  function computeMultiSelectBounds(selIds) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < selIds.length; i++) {
      var el = findElementById(selIds[i]);
      if (!el) continue;
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.w > maxX) maxX = el.x + el.w;
      if (el.y + el.h > maxY) maxY = el.y + el.h;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function createGroupOverlay(bounds, isGroup, showHandles) {
    var overlay = el("div", {
      className: "group-overlay",
      dataset: { groupId: isGroup ? "group_sel" : "multi_sel" },
    });

    // Orange outline — non-interactive
    var outline = el("div", { className: "group-outline" });
    outline.style.position = "absolute";
    outline.style.inset = "0";
    outline.style.pointerEvents = "none";
    overlay.appendChild(outline);

    if (showHandles !== false) {
      // 8 resize handles — interactive, on top
      var handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
      handles.forEach(function (h) {
        var handle = el("div", {
          className: "group-handle",
          dataset: { h: h },
        });
        overlay.appendChild(handle);
      });
    }

    // Size/position the overlay
    var pos = screenToCanvas(bounds.x, bounds.y);
    var size = screenToCanvas(bounds.w, bounds.h);

    overlay.style.position = "absolute";
    overlay.style.left = (pos.x - 2) + "px";
    overlay.style.top = (pos.y - 2) + "px";
    overlay.style.width = (size.x + 4) + "px";
    overlay.style.height = (size.y + 4) + "px";
    overlay.style.pointerEvents = "none";

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
    qsa('.group-overlay', preview).forEach(function (node) {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  function renderSelectionOverlays() {
    var preview = getCanvasPreview();
    if (!preview) return;
    clearSelectionOverlays();

    var selIds = APP.state.selectedElementIds || [];
    var sel = APP.selection;
    var isGrouped = sel && sel.hasGroup && sel.hasGroup();
    var isGroupSelected = sel && sel.isGroupSelected && sel.isGroupSelected();
    var isMultiSelect = selIds.length >= 2;

    if (isGrouped) {
      var groupBounds = sel.getGroupBounds();
      if (groupBounds && groupBounds.w > 0 && groupBounds.h > 0) {
        preview.appendChild(createGroupOverlay(groupBounds, true, isGroupSelected));
      }
    }

    if (isMultiSelect) {
      var multiBounds = computeMultiSelectBounds(selIds);
      if (multiBounds && multiBounds.w > 0 && multiBounds.h > 0) {
        preview.appendChild(createGroupOverlay(multiBounds, false, true));
      }
      return;
    }

    if (selIds.length === 1) {
      var selEl = findElementById(selIds[0]);
      if (selEl) {
        var overlay = createSelectionOverlay(selEl, true);
        preview.appendChild(overlay);
      }
    }
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

    // Render selection / group overlays
    renderSelectionOverlays();

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

    var replacement = createElementDom(element);
    preview.replaceChild(replacement, dom);

    // Rebuild selection / group overlays
    renderSelectionOverlays();
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
