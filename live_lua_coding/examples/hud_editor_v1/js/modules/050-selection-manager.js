// 050-selection-manager.js - Element selection and hit testing
(function hudEditorSelectionManager() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Hit testing ───────────────────────────────────────────────────

  function pointInElement(x, y, element) {
    if (!element) return false;
    return x >= element.x &&
           x <= element.x + element.w &&
           y >= element.y &&
           y <= element.y + element.h;
  }

  function hitTest(screenX, screenY) {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return null;

    // Test in reverse order (top-most first)
    var elements = doc.elements;
    for (var i = elements.length - 1; i >= 0; i--) {
      var el = elements[i];
      if (pointInElement(screenX, screenY, el)) {
        return el;
      }
    }
    return null;
  }

  // ─── Selection ─────────────────────────────────────────────────────

  function selectElement(elementId) {
    if (APP.state.selectedElementId === elementId) {
      APP.emit("selection-changed", elementId);
      return;
    }

    APP.state.selectedElementId = elementId;
    APP.emit("selection-changed", elementId);
  }

  function deselectAll() {
    if (!APP.state.selectedElementId) return;
    APP.state.selectedElementId = null;
    APP.emit("selection-changed", null);
    APP.emit("deselect-all");
  }

  function deleteSelected() {
    var id = APP.state.selectedElementId;
    if (!id) return;

    var doc = APP.state.document;
    if (!doc || !doc.elements) return;

    var idx = -1;
    for (var i = 0; i < doc.elements.length; i++) {
      if (doc.elements[i].id === id) {
        idx = i;
        break;
      }
    }

    if (idx >= 0) {
      doc.elements.splice(idx, 1);
      APP.state.isDirty = true;
      APP.emit("element-deleted", id);
    }

    deselectAll();
  }

  // ─── Canvas click handler ──────────────────────────────────────────

  function onCanvasClick(e) {
    if (!APP.state.editModeActive) return;
    if (APP.state.currentScreen !== "editor") return;
    if (APP.state.currentTool !== "select") return;

    // Ignore clicks on resize handles
    if (e.target.classList && e.target.classList.contains("resize-handle")) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    // Don't process if clicking on UI panels
    if (e.target.closest("#properties-panel")) return;
    if (e.target.closest("#editor-toolbar")) return;
    if (e.target.closest("#editor-statusbar")) return;

    var clickedElement = e.target.closest(".canvas-element");
    if (clickedElement && clickedElement.dataset && clickedElement.dataset.elementId) {
      selectElement(clickedElement.dataset.elementId);
      return;
    }

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    var hit = hitTest(screen.x, screen.y);

    if (hit) {
      selectElement(hit.id);
    } else {
      deselectAll();
    }
  }

  // ─── Resize handle drag state ─────────────────────────────────────

  var resizeState = {
    active: false,
    elementId: null,
    handle: null,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    origW: 0,
    origH: 0,
  };

  function ensureCanvasSelectionListeners() {
    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;
    if (!preview.__hudEditorSelectBound) {
      preview.__hudEditorSelectBound = true;
      preview.addEventListener("click", onCanvasClick);
      preview.addEventListener("mousedown", onResizeHandleMouseDown, true);
    }
  }

  function onResizeHandleMouseDown(e) {
    e.stopPropagation();
    e.preventDefault();

    if (!APP.state.editModeActive) return;

    var handle = e.target;
    var elementId = handle.dataset.elementId;
    var handleType = handle.dataset.h;

    var element = APP.canvas.getElementById(elementId);
    if (!element) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    resizeState.active = true;
    resizeState.elementId = elementId;
    resizeState.handle = handleType;
    resizeState.startX = screen.x;
    resizeState.startY = screen.y;
    resizeState.origX = element.x;
    resizeState.origY = element.y;
    resizeState.origW = element.w;
    resizeState.origH = element.h;

    document.addEventListener("mousemove", onResizeMouseMove);
    document.addEventListener("mouseup", onResizeMouseUp);
  }

  function onResizeMouseMove(e) {
    if (!resizeState.active) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    var dx = screen.x - resizeState.startX;
    var dy = screen.y - resizeState.startY;

    var elem = APP.canvas.getElementById(resizeState.elementId);
    if (!elem) return;

    var h = resizeState.handle;

    // Calculate new bounds based on handle
    var newX = resizeState.origX;
    var newY = resizeState.origY;
    var newW = resizeState.origW;
    var newH = resizeState.origH;

    if (h.includes("e")) {
      newW = Math.max(10, resizeState.origW + dx);
    }
    if (h.includes("s")) {
      newH = Math.max(10, resizeState.origH + dy);
    }
    if (h.includes("w")) {
      var nw = Math.max(10, resizeState.origW - dx);
      newX = resizeState.origX + resizeState.origW - nw;
      newW = nw;
    }
    if (h.includes("n")) {
      var nh = Math.max(10, resizeState.origH - dy);
      newY = resizeState.origY + resizeState.origH - nh;
      newH = nh;
    }

    elem.x = newX;
    elem.y = newY;
    elem.w = newW;
    elem.h = newH;

    APP.state.isDirty = true;
    APP.canvas.updateElement(resizeState.elementId);
  }

  function onResizeMouseUp(e) {
    if (!resizeState.active) return;

    resizeState.active = false;
    document.removeEventListener("mousemove", onResizeMouseMove);
    document.removeEventListener("mouseup", onResizeMouseUp);

    APP.emit("element-updated", resizeState.elementId);
  }

  // ─── Attach events ─────────────────────────────────────────────────

  APP.on("enter-edit", function () {
    if (APP.state.currentScreen !== "editor") return;
    setTimeout(ensureCanvasSelectionListeners, 0);
  });

  APP.on("document-created", function () {
    setTimeout(ensureCanvasSelectionListeners, 0);
  });

  APP.on("document-loaded", function () {
    setTimeout(ensureCanvasSelectionListeners, 0);
  });

  // Handle resize handles added later via mutation or render
  APP.on("selection-changed", function () {
    // Attach resize handle listeners when selection changes
    setTimeout(function () {
      var handles = document.querySelectorAll(".resize-handle");
      handles.forEach(function (h) {
        h.removeEventListener("mousedown", onResizeHandleMouseDown);
        h.addEventListener("mousedown", onResizeHandleMouseDown);
      });
    }, 10);
  });

  APP.on("tool-changed", function (tool) {
    if (tool !== "select") {
      deselectAll();
    }
  });

  // ─── Public API ────────────────────────────────────────────────────

  APP.selection = {
    select: selectElement,
    deselect: deselectAll,
    deleteSelected: deleteSelected,
    hitTest: hitTest,
  };

  if (typeof APP.cleanup === "function") {
    APP.cleanup(function () {
      resizeState.active = false;
      document.removeEventListener("mousemove", onResizeMouseMove);
      document.removeEventListener("mouseup", onResizeMouseUp);
    });
  }

})();
