// 040-tool-handlers.js - Tool selection and element creation
(function hudEditorToolHandlers() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Tool state ────────────────────────────────────────────────────

  var isCreating = false;
  var createStartX = 0;
  var createStartY = 0;
  var createCurrentX = 0;
  var createCurrentY = 0;
  var tempElement = null;
  var tempDom = null;
  var MIN_CREATE_SIZE = 10;
  var DEFAULT_IMAGE_PATH = "resources_generated/env/voxel/ore/aluminium-ore/icons/env_aluminium-ore_icon.png";

  function ensureCanvasCreateListeners() {
    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;
    if (preview.__hudEditorCreateBound) return;
    preview.__hudEditorCreateBound = true;
    preview.addEventListener("mousedown", onCanvasMouseDown);
    preview.addEventListener("mousemove", onCanvasMouseMove);
    preview.addEventListener("mouseup", onCanvasMouseUp);
  }

  // ─── Tool to element type mapping ─────────────────────────────────

  var toolToType = {
    select: null,
    box: "box",
    rounded: "boxRounded",
    circle: "circle",
    bezierArc: "bezierArc",
    triangle: "triangle",
    quad: "quad",
    image: "image",
    line: "line",
    text: "text",
  };

  // ─── Generate unique element ID ────────────────────────────────────

  function generateId() {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return "el_" + Date.now();
    var base = "el";
    var counter = doc.elements.length + 1;
    var id = base + "_" + counter;
    // Ensure uniqueness
    while (doc.elements.find(function (e) { return e.id === id; })) {
      counter++;
      id = base + "_" + counter;
    }
    return id;
  }

  // ─── Create element from current tool ─────────────────────────────

  function createNewElement(screenX, screenY) {
    var tool = APP.state.currentTool;
    var type = toolToType[tool];
    if (!type) return null;

    var element = {
      id: generateId(),
      type: type,
      visible: true,
      x: screenX,
      y: screenY,
      w: 0,
      h: 0,
      radius: 12,
      fill: [0.15, 0.15, 0.18, 0.95],
      stroke: [0.70, 0.72, 0.76, 1.0],
      strokeWidth: 2,
      textLines: tool === "text" ? ["Text"] : null,
      textColor: [0.86, 0.88, 0.92, 1.0],
      textSize: 16,
      textAlign: "center",
      textVAlign: "center",
      rotation: 0,
      shadowBlur: 0,
      shadowColor: [0, 0, 0, 0],
      imageSrc: "",
      imageFit: "contain",
      quadInset: 0.125
    };

    if (type === "line" || type === "bezierArc") {
      element.fill = [0, 0, 0, 0];
    }
    if (type === "text") {
      element.fill = [0, 0, 0, 0];
      element.strokeWidth = 0;
    }
    if (type === "image") {
      element.fill = [0, 0, 0, 0];
      element.stroke = [0, 0, 0, 0];
      element.strokeWidth = 0;
      element.imageSrc = DEFAULT_IMAGE_PATH;
    }

    return element;
  }

  // ─── Update temp element during drag ───────────────────────────────

  function updateTempElement(screenX, screenY) {
    if (!tempElement) return;

    var tool = APP.state.currentTool;
    if (tool === "line") {
      tempElement.x = createStartX;
      tempElement.y = createStartY;
      tempElement.w = screenX - createStartX;
      tempElement.h = screenY - createStartY;
    } else {
      var sx = Math.min(createStartX, screenX);
      var sy = Math.min(createStartY, screenY);
      var ex = Math.max(createStartX, screenX);
      var ey = Math.max(createStartY, screenY);

      tempElement.x = sx;
      tempElement.y = sy;
      tempElement.w = ex - sx;
      tempElement.h = ey - sy;
    }

    // Update the temp DOM
    if (tempDom && APP.canvas && typeof APP.canvas.applyElementStyles === "function") {
      APP.canvas.applyElementStyles(tempDom, tempElement);
    }
  }

  function hasMeaningfulSize(element) {
    if (!element) return false;
    if (element.type === "line") {
      return Math.sqrt(element.w * element.w + element.h * element.h) >= MIN_CREATE_SIZE;
    }
    return element.w >= MIN_CREATE_SIZE && element.h >= MIN_CREATE_SIZE;
  }

  // ─── Finalize element creation ─────────────────────────────────────

  function finalizeCreation() {
    if (!tempElement) return null;

    // Only create if element has meaningful size
    if (!hasMeaningfulSize(tempElement)) {
      // Remove temp DOM
      if (tempDom) {
        var preview = APP.canvas && APP.canvas.getElementById ? null : null;
        // Temp DOM will be cleaned up by scheduleRender on cancel
      }
      cancelCreation();
      return null;
    }

    // Add to document once
    if (APP.state.document && APP.state.document.elements) {
      if (APP.undoRedo && typeof APP.undoRedo.push === "function") {
        APP.undoRedo.push();
      }
      APP.state.document.elements.push(tempElement);
      APP.state.isDirty = true;

      // Select the new element
      APP.state.selectedElementId = tempElement.id;

      // Emit events
      APP.emit("element-added", tempElement);
      APP.emit("selection-changed", tempElement.id);
    }

    var created = tempElement;
    tempElement = null;
    tempDom = null;
    isCreating = false;

    return created;
  }

  // ─── Cancel creation ───────────────────────────────────────────────

  function cancelCreation() {
    if (tempElement) {
      // Remove temp DOM if exists
      if (tempDom) {
        var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
        if (preview && preview.querySelector) {
          var dom = preview.querySelector('[data-element-id="' + tempElement.id + '"]');
          if (dom) preview.removeChild(dom);
        }
        tempDom = null;
      }
      tempElement = null;
    }
    isCreating = false;
    APP.emit("creating-cancelled");
  }

  // ─── Canvas mouse handlers ─────────────────────────────────────────

  function onCanvasMouseDown(e) {
    if (!APP.state.editModeActive) return;
    if (APP.state.currentScreen !== "editor") return;

    var tool = APP.state.currentTool;

    // If in select mode, let selection-manager handle it
    if (tool === "select") return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    createStartX = screen.x;
    createStartY = screen.y;
    createCurrentX = screen.x;
    createCurrentY = screen.y;

    tempElement = createNewElement(screen.x, screen.y);
    if (!tempElement) return;

    isCreating = true;

    // Create temp DOM
    tempDom = document.createElement("div");
    tempDom.className = "canvas-element creating";
    tempDom.dataset.elementId = tempElement.id;
    tempDom.style.opacity = "0.6";
    preview.appendChild(tempDom);

    if (APP.canvas && typeof APP.canvas.applyElementStyles === "function") {
      APP.canvas.applyElementStyles(tempDom, tempElement);
    }
    APP.emit("creation-started", tempElement);
  }

  function onCanvasMouseMove(e) {
    if (!isCreating || !tempElement) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    createCurrentX = screen.x;
    createCurrentY = screen.y;

    updateTempElement(screen.x, screen.y);
  }

  function onCanvasMouseUp(e) {
    if (!isCreating) return;
    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (preview) {
      var rect = preview.getBoundingClientRect();
      var canvasX = e.clientX - rect.left;
      var canvasY = e.clientY - rect.top;
      var screen = APP.canvas.canvasToScreen(canvasX, canvasY);
      updateTempElement(screen.x, screen.y);
    }
    finalizeCreation();
  }

  // ─── Attach canvas events ──────────────────────────────────────────

  APP.on("enter-edit", function () {
    if (APP.state.currentScreen !== "editor") return;
    setTimeout(ensureCanvasCreateListeners, 0);
  });

  APP.on("document-created", function () {
    setTimeout(ensureCanvasCreateListeners, 0);
  });

  APP.on("document-loaded", function () {
    setTimeout(ensureCanvasCreateListeners, 0);
  });

  // Expose for selection manager
  APP.tools = {
    isCreating: function () { return isCreating; },
    cancelCreation: cancelCreation,
    finalizeCreation: finalizeCreation,
  };

})();
