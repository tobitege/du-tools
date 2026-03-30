// 090-databank-sync.js - Databank persistence integration
// Note: Actual databank I/O is done by the board Lua.
// This module coordinates save/load between JS and board via bridge commands.
(function hudEditorDatabankSync() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Request save to databank via board ───────────────────────

  function saveToDatabank() {
    if (APP.bridge && APP.bridge.saveDocument) {
      APP.bridge.saveDocument();
      return true;
    }
    // Fallback to localStorage
    if (APP.fileSync) {
      var id = APP.fileSync.save(APP.state.document && APP.state.document.name || "Layout");
      return !!id;
    }
    return false;
  }

  // ─── Request load from databank via board ────────────────────

  function loadFromDatabank() {
    if (APP.bridge && APP.bridge.loadDocument) {
      APP.bridge.loadDocument();
      return true;
    }
    return false;
  }

  // ─── Request list from databank ─────────────────────────────

  function listFromDatabank() {
    if (APP.bridge && APP.bridge.listScripts) {
      APP.bridge.listScripts();
      return true;
    }
    return false;
  }

  // ─── Bridge event handlers ───────────────────────────────────

  // When board confirms save
  APP.on("board-save", function (result) {
    if (result && result.ok) {
      APP.state.isDirty = false;
      APP.emit("toast", { type: "success", text: "Saved to databank" });
    } else {
      APP.emit("toast", { type: "error", text: "Databank save failed" });
    }
  });

  // When board confirms load
  APP.on("board-load", function (result) {
    if (result && result.document) {
      APP.state.document = result.document;
      APP.state.isDirty = false;
      APP.emit("document-loaded", result.document);
      APP.emit("toast", { type: "success", text: "Loaded from databank" });
    } else {
      APP.emit("toast", { type: "error", text: "Databank load failed" });
    }
  });

  // When board sends list
  APP.on("board-list", function (result) {
    if (result && result.scripts) {
      APP.emit("script-list-response", result.scripts);
    }
  });

  // When board reports error
  APP.on("board-error", function (err) {
    APP.emit("toast", { type: "error", text: "Board error: " + (err.message || err) });
  });

  // ─── Event forwarding from board ─────────────────────────────

  // The board sends responses via setOutput which the JS reads.
  // Since we're in the HUD context, we poll for board responses.
  // For now, use the bridge's local state as the primary source of truth.

  // ─── Public API ───────────────────────────────────────────────

  APP.databank = {
    save: saveToDatabank,
    load: loadFromDatabank,
    list: listFromDatabank,
  };

})();
