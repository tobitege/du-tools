// 050-selection-manager.js - Element selection, hit testing, drag, resize
(function hudEditorSelectionManager() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Helpers ──────────────────────────────────────────────────────

  function ids() { return APP.state.selectedElementIds; }

  function isSelected(id) {
    var arr = ids();
    for (var i = 0; i < arr.length; i++) { if (arr[i] === id) return true; }
    return false;
  }

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
    var elements = doc.elements;
    for (var i = elements.length - 1; i >= 0; i--) {
      var el = elements[i];
      if (el.visible === false) continue;
      if (pointInElement(screenX, screenY, el)) return el;
    }
    return null;
  }

  // ─── Selection ─────────────────────────────────────────────────────

  function selectElement(elementId) {
    APP.state.selectedElementId = elementId;
    APP.state.selectedElementIds = elementId ? [elementId] : [];
    APP.emit("selection-changed", elementId);
  }

  function toggleInSelection(elementId) {
    var arr = ids();
    if (isSelected(elementId)) {
      // Remove from selection
      var next = [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] !== elementId) next.push(arr[i]);
      }
      APP.state.selectedElementIds = next;
      APP.state.selectedElementId = next.length > 0 ? next[next.length - 1] : null;
    } else {
      // Add to selection
      arr.push(elementId);
      APP.state.selectedElementId = elementId;
    }
    APP.emit("selection-changed", APP.state.selectedElementId);
  }

  function deselectAll() {
    if (ids().length === 0 && !APP.state.selectedElementId) return;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.emit("selection-changed", null);
    APP.emit("deselect-all");
  }

  function deleteSelected() {
    var arr = ids().slice();
    if (arr.length === 0) return;

    var doc = APP.state.document;
    if (!doc || !doc.elements) return;

    if (APP.undoRedo) APP.undoRedo.push();

    for (var s = 0; s < arr.length; s++) {
      var id = arr[s];
      for (var i = doc.elements.length - 1; i >= 0; i--) {
        if (doc.elements[i].id === id) {
          doc.elements.splice(i, 1);
          APP.state.isDirty = true;
          APP.emit("element-deleted", id);
          break;
        }
      }
    }

    deselectAll();
  }

  // ─── Canvas click handler ──────────────────────────────────────────

  function onCanvasClick(e) {
    if (dragState.suppressClick) {
      dragState.suppressClick = false;
      return;
    }

    if (!APP.state.editModeActive) return;
    if (APP.state.currentScreen !== "editor") return;
    if (APP.state.currentTool !== "select") return;

    if (e.target.classList && e.target.classList.contains("resize-handle")) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    if (e.target.closest("#properties-panel")) return;
    if (e.target.closest("#shapes-panel")) return;
    if (e.target.closest("#editor-toolbar")) return;
    if (e.target.closest("#editor-statusbar")) return;

    var hitId = null;
    var clickedElement = e.target.closest(".canvas-element");
    if (clickedElement && clickedElement.dataset && clickedElement.dataset.elementId) {
      hitId = clickedElement.dataset.elementId;
    } else {
      var rect = preview.getBoundingClientRect();
      var canvasX = e.clientX - rect.left;
      var canvasY = e.clientY - rect.top;
      var screen = APP.canvas.canvasToScreen(canvasX, canvasY);
      var hit = hitTest(screen.x, screen.y);
      if (hit) hitId = hit.id;
    }

    if (hitId) {
      if (e.shiftKey || e.ctrlKey) {
        toggleInSelection(hitId);
      } else {
        selectElement(hitId);
      }
    } else {
      deselectAll();
    }
  }

  // ─── Drag/move state (multi-element) ───────────────────────────────

  var dragState = {
    active: false,
    startX: 0,
    startY: 0,
    origins: null,   // [{id, origX, origY}, ...]
    moved: false,
    suppressClick: false,
  };

  function onElementMouseDown(e) {
    if (!APP.state.editModeActive) return;
    if (APP.state.currentScreen !== "editor") return;
    if (APP.state.currentTool !== "select") return;

    if (e.target.classList && e.target.classList.contains("resize-handle")) return;

    if (e.target.closest("#properties-panel")) return;
    if (e.target.closest("#shapes-panel")) return;
    if (e.target.closest("#editor-toolbar")) return;
    if (e.target.closest("#editor-statusbar")) return;

    var clickedElement = e.target.closest(".canvas-element");
    if (!clickedElement || !clickedElement.dataset || !clickedElement.dataset.elementId) return;

    var elementId = clickedElement.dataset.elementId;
    var element = APP.canvas.getElementById(elementId);
    if (!element) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    // If clicking an already-selected element in a multi-select, drag all.
    // If clicking unselected without shift, replace selection then drag.
    // If shift-clicking, the click handler handles toggle; don't initiate drag.
    if (e.shiftKey || e.ctrlKey) return;

    if (!isSelected(elementId)) {
      selectElement(elementId);
    }

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    // Capture origins for all selected elements
    var origins = [];
    var arr = ids();
    for (var i = 0; i < arr.length; i++) {
      var el = APP.canvas.getElementById(arr[i]);
      if (el) origins.push({ id: arr[i], origX: el.x, origY: el.y });
    }

    dragState.active = true;
    dragState.startX = screen.x;
    dragState.startY = screen.y;
    dragState.origins = origins;
    dragState.moved = false;
    dragState.suppressClick = false;

    e.preventDefault();

    document.addEventListener("mousemove", onDragMouseMove);
    document.addEventListener("mouseup", onDragMouseUp);
  }

  function onDragMouseMove(e) {
    if (!dragState.active) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    var dx = screen.x - dragState.startX;
    var dy = screen.y - dragState.startY;

    if (!dragState.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    if (!dragState.moved && APP.undoRedo) APP.undoRedo.push();
    dragState.moved = true;

    var origins = dragState.origins;
    for (var i = 0; i < origins.length; i++) {
      var o = origins[i];
      var elem = APP.canvas.getElementById(o.id);
      if (!elem) continue;
      elem.x = o.origX + dx;
      elem.y = o.origY + dy;
      APP.canvas.updateElement(o.id);
    }
    APP.state.isDirty = true;
  }

  function onDragMouseUp() {
    if (!dragState.active) return;

    var wasMoved = dragState.moved;
    dragState.active = false;
    dragState.moved = false;

    document.removeEventListener("mousemove", onDragMouseMove);
    document.removeEventListener("mouseup", onDragMouseUp);

    if (wasMoved) {
      dragState.suppressClick = true;
      var origins = dragState.origins;
      for (var i = 0; i < origins.length; i++) {
        APP.emit("element-updated", origins[i].id);
      }
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
      preview.addEventListener("mousedown", onElementMouseDown);
      preview.addEventListener("mousedown", onResizeHandleMouseDown, true);
    }
  }

  function onResizeHandleMouseDown(e) {
    var handle = e.target;
    if (!handle.classList || !handle.classList.contains("resize-handle")) return;

    e.stopPropagation();
    e.preventDefault();

    if (!APP.state.editModeActive) return;

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

    if (APP.undoRedo) APP.undoRedo.push();

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

    var newX = resizeState.origX;
    var newY = resizeState.origY;
    var newW = resizeState.origW;
    var newH = resizeState.origH;

    if (h.includes("e")) { newW = Math.max(10, resizeState.origW + dx); }
    if (h.includes("s")) { newH = Math.max(10, resizeState.origH + dy); }
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

  function onResizeMouseUp() {
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

  APP.on("selection-changed", function () {
    setTimeout(function () {
      var handles = document.querySelectorAll(".resize-handle");
      handles.forEach(function (h) {
        h.removeEventListener("mousedown", onResizeHandleMouseDown);
        h.addEventListener("mousedown", onResizeHandleMouseDown);
      });
    }, 10);
  });

  APP.on("tool-changed", function (tool) {
    if (tool !== "select") { deselectAll(); }
  });

  APP.on("delete-element", function () {
    deleteSelected();
  });

  // ─── Alignment ─────────────────────────────────────────────────────

  function alignSelected(mode) {
    var arr = ids();
    if (arr.length < 2) {
      // Single element: align to canvas
      if (arr.length === 1) alignToCanvas(mode);
      return;
    }

    var elems = [];
    for (var i = 0; i < arr.length; i++) {
      var e = APP.canvas.getElementById(arr[i]);
      if (e) elems.push(e);
    }
    if (elems.length < 2) return;

    if (APP.undoRedo) APP.undoRedo.push();

    // Compute bounding box of all selected
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var j = 0; j < elems.length; j++) {
      var el = elems[j];
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.w > maxX) maxX = el.x + el.w;
      if (el.y + el.h > maxY) maxY = el.y + el.h;
    }

    for (var k = 0; k < elems.length; k++) {
      var elem = elems[k];
      switch (mode) {
        case "left":      elem.x = minX; break;
        case "right":     elem.x = maxX - elem.w; break;
        case "center-h":  elem.x = minX + (maxX - minX) / 2 - elem.w / 2; break;
        case "top":       elem.y = minY; break;
        case "bottom":    elem.y = maxY - elem.h; break;
        case "center-v":  elem.y = minY + (maxY - minY) / 2 - elem.h / 2; break;
      }
      APP.canvas.updateElement(elem.id);
    }

    APP.state.isDirty = true;
    APP.canvas.scheduleRender();
    APP.emit("element-updated", arr[0]);
  }

  function alignToCanvas(mode) {
    var arr = ids();
    if (arr.length !== 1) return;
    var elem = APP.canvas.getElementById(arr[0]);
    if (!elem) return;

    var doc = APP.state.document;
    var sw = (doc && doc.screenWidth) || 1920;
    var sh = (doc && doc.screenHeight) || 1080;

    if (APP.undoRedo) APP.undoRedo.push();

    switch (mode) {
      case "left":      elem.x = 0; break;
      case "right":     elem.x = sw - elem.w; break;
      case "center-h":  elem.x = (sw - elem.w) / 2; break;
      case "top":       elem.y = 0; break;
      case "bottom":    elem.y = sh - elem.h; break;
      case "center-v":  elem.y = (sh - elem.h) / 2; break;
    }

    APP.state.isDirty = true;
    APP.canvas.updateElement(elem.id);
    APP.emit("element-updated", elem.id);
  }

  APP.on("align", function (mode) {
    alignSelected(mode);
  });

  // ─── Public API ────────────────────────────────────────────────────

  APP.selection = {
    select: selectElement,
    toggleIn: toggleInSelection,
    deselect: deselectAll,
    deleteSelected: deleteSelected,
    hitTest: hitTest,
    isSelected: isSelected,
    getIds: function () { return ids().slice(); },
  };

  if (typeof APP.cleanup === "function") {
    APP.cleanup(function () {
      dragState.active = false;
      document.removeEventListener("mousemove", onDragMouseMove);
      document.removeEventListener("mouseup", onDragMouseUp);
      resizeState.active = false;
      document.removeEventListener("mousemove", onResizeMouseMove);
      document.removeEventListener("mouseup", onResizeMouseUp);
    });
  }

})();
