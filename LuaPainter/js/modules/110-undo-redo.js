// 110-undo-redo.js - Undo/redo stack
(function hudEditorUndoRedo() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Undo/Redo state ─────────────────────────────────────────────

  var undoStack = [];
  var redoStack = [];
  var maxStackSize = 50;
  var isUndoRedoAction = false;

  // ─── Push state to undo stack ───────────────────────────────────

  function pushUndo() {
    if (isUndoRedoAction) return;
    if (!APP.state.document) return;

    var snapshot = deepCopyDocument(APP.state.document);
    undoStack.push(snapshot);

    // Limit stack size
    if (undoStack.length > maxStackSize) {
      undoStack.shift();
    }

    // Clear redo on new action
    redoStack = [];
  }

  function deepCopyDocument(doc) {
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  }

  // ─── Perform undo ────────────────────────────────────────────────

  function undo() {
    if (undoStack.length === 0) {
      APP.emit("toast", { type: "info", text: "Nothing to undo" });
      return false;
    }

    isUndoRedoAction = true;

    // Save current state to redo
    if (APP.state.document) {
      redoStack.push(deepCopyDocument(APP.state.document));
    }

    // Restore previous state
    var snapshot = undoStack.pop();
    APP.state.document = snapshot;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    if (typeof APP.refreshDirtyState === "function") {
      APP.refreshDirtyState(snapshot);
    } else {
      APP.state.isDirty = true;
    }
    APP.emit("selection-changed", null);
    APP.emit("document-loaded", snapshot);
    APP.emit("toast", { type: "info", text: "Undone" });

    isUndoRedoAction = false;
    return true;
  }

  // ─── Perform redo ───────────────────────────────────────────────

  function redo() {
    if (redoStack.length === 0) {
      APP.emit("toast", { type: "info", text: "Nothing to redo" });
      return false;
    }

    isUndoRedoAction = true;

    // Save current state to undo
    if (APP.state.document) {
      undoStack.push(deepCopyDocument(APP.state.document));
    }

    // Restore next redo state
    var snapshot = redoStack.pop();
    APP.state.document = snapshot;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    if (typeof APP.refreshDirtyState === "function") {
      APP.refreshDirtyState(snapshot);
    } else {
      APP.state.isDirty = true;
    }
    APP.emit("selection-changed", null);
    APP.emit("document-loaded", snapshot);
    APP.emit("toast", { type: "info", text: "Redone" });

    isUndoRedoAction = false;
    return true;
  }

  // ─── Clear stacks ───────────────────────────────────────────────

  function clear() {
    undoStack = [];
    redoStack = [];
  }

  // ─── Event listeners ────────────────────────────────────────────

  // Push undo before element changes
  APP.on("before-element-change", function() {
    pushUndo();
  });

  // Keyboard shortcuts
  APP.on("undo", function() {
    undo();
  });

  APP.on("redo", function() {
    redo();
  });

  // Clear on new document (but not during undo/redo which also emits document-loaded)
  APP.on("document-created", function() {
    if (!isUndoRedoAction) clear();
  });

  APP.on("document-loaded", function() {
    if (!isUndoRedoAction) clear();
  });

  // ─── Public API ─────────────────────────────────────────────────

  APP.undoRedo = {
    undo: undo,
    redo: redo,
    push: pushUndo,
    clear: clear,
    canUndo: function() { return undoStack.length > 0; },
    canRedo: function() { return redoStack.length > 0; },
  };

})();
