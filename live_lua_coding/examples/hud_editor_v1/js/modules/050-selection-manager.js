// 050-selection-manager.js - Element selection, hit testing, drag, resize, grouping, cloning
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

  // ─── Group state ──────────────────────────────────────────────────

  var groupState = {
    active: false,        // true when a group selection is active
    selected: false,      // true when the persistent group is the active UI target
    memberIds: [],        // element IDs that are members of the group
  };

  function hasGroup() { return groupState.active && groupState.memberIds.length >= 2; }
  function isGroupSelected() { return hasGroup() && groupState.selected; }

  // Aggregate selection: selected group members or selected loose elements.
  function activeIds() {
    if (isGroupSelected()) return groupState.memberIds.slice();
    return ids().slice();
  }

  function isAggregateSelection() {
    return activeIds().length >= 2;
  }

  function getBoundsForIds(targetIds) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < targetIds.length; i++) {
      var el = APP.canvas.getElementById(targetIds[i]);
      if (!el) continue;
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.w > maxX) maxX = el.x + el.w;
      if (el.y + el.h > maxY) maxY = el.y + el.h;
    }
    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
      return null;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function getGroupBounds() {
    var members = groupState.memberIds.slice();
    if (members.length === 0) return null;
    return getBoundsForIds(members);
  }

  function getAggregateBounds() {
    var selectedIds = activeIds();
    if (selectedIds.length === 0) return null;
    return getBoundsForIds(selectedIds);
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

  function selectGroup() {
    if (!hasGroup()) return;
    groupState.selected = true;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.emit("selection-changed", null);
  }

  function selectElement(elementId) {
    groupState.selected = false;
    APP.state.selectedElementId = elementId;
    APP.state.selectedElementIds = elementId ? [elementId] : [];
    APP.emit("selection-changed", elementId);
  }

  function toggleInSelection(elementId) {
    groupState.selected = false;
    var arr = ids();
    if (isSelected(elementId)) {
      var next = [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] !== elementId) next.push(arr[i]);
      }
      APP.state.selectedElementIds = next;
      APP.state.selectedElementId = next.length > 0 ? next[next.length - 1] : null;
    } else {
      arr.push(elementId);
      APP.state.selectedElementId = elementId;
    }
    APP.emit("selection-changed", APP.state.selectedElementId);
  }

  function deselectAll() {
    if (ids().length === 0 && !APP.state.selectedElementId && !groupState.active) return;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    groupState.selected = false;
    APP.emit("selection-changed", null);
    APP.emit("deselect-all");
  }

  function deleteSelected() {
    var arr = activeIds();
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

    if (hasGroup()) {
      groupState.memberIds = groupState.memberIds.filter(function (groupId) {
        return !!APP.canvas.getElementById(groupId);
      });
      if (groupState.memberIds.length < 2) {
        groupState.active = false;
        groupState.selected = false;
        groupState.memberIds = [];
      }
    }
    deselectAll();
  }

  // ─── Grouping ──────────────────────────────────────────────────────

  function groupSelection() {
    var arr = ids();
    if (arr.length < 2) return;

    if (APP.undoRedo) APP.undoRedo.push();

    groupState.active = true;
    groupState.selected = true;
    groupState.memberIds = arr.slice();
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.emit("group-activated");
    APP.emit("selection-changed", null);
    APP.canvas.scheduleRender();
  }

  function ungroupSelection() {
    if (!hasGroup()) return;

    if (APP.undoRedo) APP.undoRedo.push();

    var members = groupState.memberIds.slice();
    groupState.active = false;
    groupState.selected = false;
    groupState.memberIds = [];
    APP.state.selectedElementIds = members;
    APP.state.selectedElementId = members.length > 0 ? members[members.length - 1] : null;
    APP.emit("group-deactivated");
    APP.emit("selection-changed", APP.state.selectedElementId);
    APP.canvas.scheduleRender();
  }

  // ─── Cloning ───────────────────────────────────────────────────────

  var CLONE_OFFSET_X = 24;
  var CLONE_OFFSET_Y = 24;

  function cloneSelection() {
    var sourceIds;
    if (isGroupSelected()) {
      sourceIds = groupState.memberIds.slice();
    } else {
      sourceIds = ids().slice();
    }
    if (sourceIds.length === 0) return;

    var doc = APP.state.document;
    if (!doc || !doc.elements) return;

    if (APP.undoRedo) APP.undoRedo.push();

    var newIds = [];
    for (var i = 0; i < sourceIds.length; i++) {
      var src = APP.canvas.getElementById(sourceIds[i]);
      if (!src) continue;
      var clone = JSON.parse(JSON.stringify(src));
      clone.id = generateId();
      clone.x += CLONE_OFFSET_X;
      clone.y += CLONE_OFFSET_Y;
      doc.elements.push(clone);
      newIds.push(clone.id);
      APP.emit("element-added", clone);
    }

    if (newIds.length === 0) return;

    APP.state.isDirty = true;
    groupState.selected = false;

    if (newIds.length === 1) {
      selectElement(newIds[0]);
    } else {
      APP.state.selectedElementIds = newIds;
      APP.state.selectedElementId = newIds[newIds.length - 1];
      APP.emit("selection-changed", APP.state.selectedElementId);
    }

    APP.canvas.scheduleRender();
    APP.emit("toast", { type: "success", text: newIds.length > 1 ? "Cloned selection" : "Cloned element" });
  }

  function generateId() {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return "el_" + Date.now();
    var base = "el";
    var counter = doc.elements.length + 1;
    var id = base + "_" + counter;
    while (doc.elements.find(function (e) { return e.id === id; })) {
      counter++;
      id = base + "_" + counter;
    }
    return id;
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
    if (e.target.classList && e.target.classList.contains("group-handle")) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    if (e.target.closest("#properties-panel")) return;
    if (e.target.closest("#shapes-panel")) return;
    if (e.target.closest("#editor-toolbar")) return;
    if (e.target.closest("#editor-statusbar")) return;

    var hitId = null;
    var screen = null;
    var clickedElement = e.target.closest(".canvas-element");
    if (clickedElement && clickedElement.dataset && clickedElement.dataset.elementId) {
      hitId = clickedElement.dataset.elementId;
    } else {
      var rect = preview.getBoundingClientRect();
      var canvasX = e.clientX - rect.left;
      var canvasY = e.clientY - rect.top;
      screen = APP.canvas.canvasToScreen(canvasX, canvasY);
      var hit = hitTest(screen.x, screen.y);
      if (hit) hitId = hit.id;
    }

    if (hasGroup()) {
      if (hitId && groupState.memberIds.indexOf(hitId) !== -1) {
        selectGroup();
        return;
      }

      var bounds = getGroupBounds();
      if (!hitId && pointInElement(screen.x, screen.y, bounds)) {
        selectGroup();
        return;
      }
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

  // ─── Drag/move state (multi-element + group) ───────────────────────

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
    if (e.target.classList && e.target.classList.contains("group-handle")) return;

    if (e.target.closest("#properties-panel")) return;
    if (e.target.closest("#shapes-panel")) return;
    if (e.target.closest("#editor-toolbar")) return;
    if (e.target.closest("#editor-statusbar")) return;

    var clickedElement = e.target.closest(".canvas-element");
    if (!clickedElement || !clickedElement.dataset || !clickedElement.dataset.elementId) {
      if (!hasGroup()) return;

      var previewRect = preview.getBoundingClientRect();
      var previewCanvasX = e.clientX - previewRect.left;
      var previewCanvasY = e.clientY - previewRect.top;
      var previewScreen = APP.canvas.canvasToScreen(previewCanvasX, previewCanvasY);
      var groupBounds = getGroupBounds();
      var groupHit = hitTest(previewScreen.x, previewScreen.y);
      if (groupHit || !pointInElement(previewScreen.x, previewScreen.y, groupBounds)) return;

      selectGroup();
      startAggregateDrag(previewScreen.x, previewScreen.y, groupState.memberIds.slice());
      e.preventDefault();
      return;
    }

    var elementId = clickedElement.dataset.elementId;
    var element = APP.canvas.getElementById(elementId);
    if (!element) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    if (e.shiftKey || e.ctrlKey) return;

    // Clicking a grouped member targets the persistent group.
    if (hasGroup() && groupState.memberIds.indexOf(elementId) !== -1) {
      var groupRect = preview.getBoundingClientRect();
      var groupCanvasX = e.clientX - groupRect.left;
      var groupCanvasY = e.clientY - groupRect.top;
      var groupScreen = APP.canvas.canvasToScreen(groupCanvasX, groupCanvasY);
      selectGroup();
      startAggregateDrag(groupScreen.x, groupScreen.y, groupState.memberIds.slice());
      e.preventDefault();
      return;
    }

    if (!isSelected(elementId)) {
      selectElement(elementId);
    }

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    startAggregateDrag(screen.x, screen.y, ids().slice());
    e.preventDefault();
  }

  function startAggregateDrag(screenX, screenY, targetIds) {
    var origins = [];
    for (var i = 0; i < targetIds.length; i++) {
      var el = APP.canvas.getElementById(targetIds[i]);
      if (el) origins.push({ id: targetIds[i], origX: el.x, origY: el.y });
    }

    dragState.active = true;
    dragState.startX = screenX;
    dragState.startY = screenY;
    dragState.origins = origins;
    dragState.moved = false;
    dragState.suppressClick = false;

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

  // ─── Group resize state ───────────────────────────────────────────

  var groupResizeState = {
    active: false,
    handle: null,
    startX: 0,
    startY: 0,
    bounds: null,  // {x, y, w, h}
    memberOrigins: null, // [{id, origX, origY, origW, origH}, ...]
  };

  function ensureCanvasSelectionListeners() {
    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;
    if (!preview.__hudEditorSelectBound) {
      preview.__hudEditorSelectBound = true;
      preview.addEventListener("click", onCanvasClick);
      preview.addEventListener("mousedown", onElementMouseDown);
      preview.addEventListener("mousedown", onResizeHandleMouseDown, true);
      preview.addEventListener("mousedown", onGroupHandleMouseDown, true);
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

  // ─── Group handle mouse handlers ──────────────────────────────────

  function onGroupHandleMouseDown(e) {
    var handle = e.target;
    if (!handle.classList || !handle.classList.contains("group-handle")) return;

    e.stopPropagation();
    e.preventDefault();

    if (!APP.state.editModeActive) return;
    if (!isAggregateSelection()) return;

    var handleType = handle.dataset.h;
    var bounds = getAggregateBounds();
    if (!bounds || bounds.w <= 0 || bounds.h <= 0) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    if (APP.undoRedo) APP.undoRedo.push();

    // Capture member origins
    var aIds = activeIds();
    var memberOrigins = [];
    for (var i = 0; i < aIds.length; i++) {
      var el = APP.canvas.getElementById(aIds[i]);
      if (el) {
        memberOrigins.push({ id: el.id, origX: el.x, origY: el.y, origW: el.w, origH: el.h });
      }
    }

    groupResizeState.active = true;
    groupResizeState.handle = handleType;
    groupResizeState.startX = screen.x;
    groupResizeState.startY = screen.y;
    groupResizeState.bounds = bounds;
    groupResizeState.memberOrigins = memberOrigins;

    document.addEventListener("mousemove", onGroupResizeMouseMove);
    document.addEventListener("mouseup", onGroupResizeMouseUp);
  }

  function onGroupResizeMouseMove(e) {
    if (!groupResizeState.active) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    var dx = screen.x - groupResizeState.startX;
    var dy = screen.y - groupResizeState.startY;

    var oldBounds = groupResizeState.bounds;
    var h = groupResizeState.handle;

    var newX = oldBounds.x;
    var newY = oldBounds.y;
    var newW = oldBounds.w;
    var newH = oldBounds.h;

    if (h.includes("e")) { newW = Math.max(20, oldBounds.w + dx); }
    if (h.includes("s")) { newH = Math.max(20, oldBounds.h + dy); }
    if (h.includes("w")) {
      var nw = Math.max(20, oldBounds.w - dx);
      newX = oldBounds.x + oldBounds.w - nw;
      newW = nw;
    }
    if (h.includes("n")) {
      var nh = Math.max(20, oldBounds.h - dy);
      newY = oldBounds.y + oldBounds.h - nh;
      newH = nh;
    }

    // Compute scale factors
    var scaleX = newW / oldBounds.w;
    var scaleY = newH / oldBounds.h;

    // Compute translation of the group's top-left
    var transX = newX - oldBounds.x;
    var transY = newY - oldBounds.y;

    var origins = groupResizeState.memberOrigins;
    for (var i = 0; i < origins.length; i++) {
      var o = origins[i];
      var elem = APP.canvas.getElementById(o.id);
      if (!elem) continue;

      if (elem.type === "circle") {
        // Circle: move center point, keep radius (scale doesn't apply to radius visually here)
        var oldCx = o.origX + o.origW / 2;
        var oldCy = o.origY + o.origH / 2;
        var newCx = (oldCx - oldBounds.x) * scaleX + oldBounds.x + transX;
        var newCy = (oldCy - oldBounds.y) * scaleY + oldBounds.y + transY;
        elem.x = newCx - o.origW / 2;
        elem.y = newCy - o.origH / 2;
      } else if (elem.type === "line") {
        // Line: scale both position and dimensions
        elem.x = (o.origX - oldBounds.x) * scaleX + oldBounds.x + transX;
        elem.y = (o.origY - oldBounds.y) * scaleY + oldBounds.y + transY;
        elem.w = o.origW * scaleX;
        elem.h = o.origH * scaleY;
      } else {
        // Box, boxRounded, text: scale position and dimensions
        elem.x = (o.origX - oldBounds.x) * scaleX + oldBounds.x + transX;
        elem.y = (o.origY - oldBounds.y) * scaleY + oldBounds.y + transY;
        elem.w = Math.max(10, o.origW * scaleX);
        elem.h = Math.max(10, o.origH * scaleY);
      }

      APP.canvas.updateElement(elem.id);
    }

    APP.state.isDirty = true;
  }

  function onGroupResizeMouseUp() {
    if (!groupResizeState.active) return;

    groupResizeState.active = false;
    document.removeEventListener("mousemove", onGroupResizeMouseMove);
    document.removeEventListener("mouseup", onGroupResizeMouseUp);

    var aIds = activeIds();
    for (var i = 0; i < aIds.length; i++) {
      APP.emit("element-updated", aIds[i]);
    }
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
      var gHandles = document.querySelectorAll(".group-handle");
      gHandles.forEach(function (h) {
        h.removeEventListener("mousedown", onGroupHandleMouseDown);
        h.addEventListener("mousedown", onGroupHandleMouseDown);
      });
    }, 10);
  });

  APP.on("tool-changed", function (tool) {
    if (tool !== "select") { deselectAll(); }
  });

  APP.on("delete-element", function () {
    deleteSelected();
  });

  APP.on("group-selection", function () {
    groupSelection();
  });

  APP.on("ungroup-selection", function () {
    ungroupSelection();
  });

  APP.on("clone-selection", function () {
    cloneSelection();
  });

  // ─── Alignment ─────────────────────────────────────────────────────

  function alignSelected(mode) {
    var arr = activeIds();
    if (arr.length < 2) {
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

    var anchorId = APP.state.selectedElementId;
    if (!anchorId || arr.indexOf(anchorId) === -1) {
      anchorId = arr[arr.length - 1];
    }
    var anchor = APP.canvas.getElementById(anchorId);
    if (!anchor) {
      anchor = elems[elems.length - 1];
    }
    if (!anchor) return;

    var anchorLeft = Number(anchor.x) || 0;
    var anchorTop = Number(anchor.y) || 0;
    var anchorWidth = Math.max(0, Number(anchor.w) || 0);
    var anchorHeight = Math.max(0, Number(anchor.h) || 0);
    var anchorRight = anchorLeft + anchorWidth;
    var anchorBottom = anchorTop + anchorHeight;
    var anchorCenterX = anchorLeft + anchorWidth / 2;
    var anchorCenterY = anchorTop + anchorHeight / 2;

    for (var k = 0; k < elems.length; k++) {
      var elem = elems[k];
      switch (mode) {
        case "left":      elem.x = anchorLeft; break;
        case "right":     elem.x = anchorRight - elem.w; break;
        case "center-h":  elem.x = anchorCenterX - elem.w / 2; break;
        case "top":       elem.y = anchorTop; break;
        case "bottom":    elem.y = anchorBottom - elem.h; break;
        case "center-v":  elem.y = anchorCenterY - elem.h / 2; break;
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
    selectGroup: selectGroup,
    toggleIn: toggleInSelection,
    deselect: deselectAll,
    deleteSelected: deleteSelected,
    hitTest: hitTest,
    isSelected: isSelected,
    getIds: function () { return ids().slice(); },
    groupSelection: groupSelection,
    ungroupSelection: ungroupSelection,
    cloneSelection: cloneSelection,
    hasGroup: hasGroup,
    isGroupSelected: isGroupSelected,
    getGroupBounds: getGroupBounds,
    getGroupMemberIds: function () { return groupState.memberIds.slice(); },
  };

  if (typeof APP.cleanup === "function") {
    APP.cleanup(function () {
      dragState.active = false;
      document.removeEventListener("mousemove", onDragMouseMove);
      document.removeEventListener("mouseup", onDragMouseUp);
      resizeState.active = false;
      document.removeEventListener("mousemove", onResizeMouseMove);
      document.removeEventListener("mouseup", onResizeMouseUp);
      groupResizeState.active = false;
      document.removeEventListener("mousemove", onGroupResizeMouseMove);
      document.removeEventListener("mouseup", onGroupResizeMouseUp);
    });
  }

})();
