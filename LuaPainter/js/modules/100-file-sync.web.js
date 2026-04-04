// 100-file-sync.web.js - Browser-only localStorage persistence for the web harness
(function hudEditorFileSync() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Storage keys ───────────────────────────────────────────────

  var STORAGE_KEY = "hud_editor_layouts";
  var CURRENT_KEY = "hud_editor_current";

  // ─── Layout storage ────────────────────────────────────────────

  function getStoredLayouts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  function saveLayouts(layouts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ─── Save layout to browser storage ───────────────────────────

  function saveLayoutLocally(id, name, document) {
    var layouts = getStoredLayouts();
    layouts[id] = {
      id: id,
      name: name,
      saved: Date.now(),
      document: document,
    };
    saveLayouts(layouts);
    return true;
  }

  // ─── Load layout from browser storage ─────────────────────────

  function loadLayoutLocally(id) {
    var layouts = getStoredLayouts();
    return layouts[id] || null;
  }

  // ─── List all saved layouts ───────────────────────────────────

  function listLayoutsLocally() {
    var layouts = getStoredLayouts();
    var list = [];
    for (var id in layouts) {
      if (layouts.hasOwnProperty(id)) {
        if (!layouts[id] || !layouts[id].id || !layouts[id].document || !layouts[id].document.id) {
          continue;
        }
        list.push({
          id: layouts[id].id,
          name: layouts[id].name,
          saved: layouts[id].saved,
        });
      }
    }
    // Sort by saved time, newest first
    list.sort(function(a, b) { return (b.saved || 0) - (a.saved || 0); });
    return list;
  }

  // ─── Delete layout from browser storage ───────────────────────

  function deleteLayoutLocally(id) {
    var layouts = getStoredLayouts();
    if (layouts[id]) {
      delete layouts[id];
      saveLayouts(layouts);
      return true;
    }
    return false;
  }

  function renameLayoutLocally(id, name) {
    var layouts = getStoredLayouts();
    var entry = layouts[id];
    var finalName = String(name || "").trim();
    if (!entry || !finalName) {
      return false;
    }
    entry.name = finalName;
    entry.saved = Date.now();
    if (entry.document && typeof entry.document === "object") {
      entry.document.name = finalName;
    }
    layouts[id] = entry;
    if (!saveLayouts(layouts)) {
      return false;
    }
    if (APP.state && APP.state.document && String(APP.state.document.id || "") === String(id)) {
      APP.state.document.name = finalName;
      if (typeof APP.setSavedDocumentBaseline === "function") {
        APP.setSavedDocumentBaseline(APP.state.document);
      }
      APP.emit("document-loaded", APP.state.document);
    }
    return true;
  }

  // ─── Save current layout ─────────────────────────────────────

  function saveCurrentLayout(name) {
    var doc = APP.state.document;
    if (!doc) return null;

    var finalName = (name || doc.name || "Layout").trim();
    doc.name = finalName;
    if (!APP.normalizeDocumentMeta || !APP.normalizeDocumentMeta(doc)) {
      return null;
    }
    var success = saveLayoutLocally(doc.id, doc.name, deepCopyDoc(doc));

    if (success) {
      if (typeof APP.setSavedDocumentBaseline === "function") {
        APP.setSavedDocumentBaseline(doc);
      } else {
        APP.state.isDirty = false;
      }
      return doc.id;
    }
    return null;
  }

  function deepCopyDoc(doc) {
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  }

  // ─── Load layout by ID ───────────────────────────────────────

  function loadLayout(id) {
    var stored = loadLayoutLocally(id);
    if (!stored) return null;

    var doc = deepCopyDoc(stored.document);
    if (!APP.normalizeDocumentMeta || !APP.normalizeDocumentMeta(doc)) {
      return null;
    }
    APP.state.document = doc;
    APP.state.selectedElementId = null;
    if (typeof APP.setSavedDocumentBaseline === "function") {
      APP.setSavedDocumentBaseline(APP.state.document);
    } else {
      APP.state.isDirty = false;
    }
    APP.emit("document-loaded", APP.state.document);
    return stored;
  }

  // ─── Export layout as JSON string ────────────────────────────

  function exportLayoutAsJson(doc) {
    doc = doc || APP.state.document;
    if (!doc) return null;
    return JSON.stringify(doc, null, 2);
  }

  // ─── Import layout from JSON string ──────────────────────────

  function importLayoutFromJson(json) {
    try {
      var doc = JSON.parse(json);
      if (!doc || !doc.elements) {
        return { error: "Invalid layout format" };
      }
      if (!APP.normalizeDocumentMeta || !APP.normalizeDocumentMeta(doc)) {
        return { error: "Layout id missing" };
      }
      APP.state.document = doc;
      APP.state.selectedElementId = null;
      APP.state.isDirty = true;
      APP.emit("document-loaded", doc);
      setTimeout(function () {
        if (APP.canvas && typeof APP.canvas.render === "function") {
          APP.canvas.render();
        }
      }, 0);
      return { success: true, document: doc };
    } catch (e) {
      return { error: e.message };
    }
  }

  // ─── Generate unique ID ───────────────────────────────────────

  function generateLayoutId() {
    return APP.createLayoutId();
  }

  // ─── Bridge integration (for external file operations) ─────────

  // When MCP bridge is available, expose layout data for external tools
  function getLayoutForBridge() {
    var doc = APP.state.document;
    if (!doc) return null;
    return {
      json: exportLayoutAsJson(doc),
      size: exportLayoutAsJson(doc).length,
    };
  }

  // ─── Event handlers ───────────────────────────────────────────

  APP.on("save", function () {
    var id = saveCurrentLayout(APP.state.document && APP.state.document.name || "Layout");
    if (id) {
      APP.emit("toast", { type: "success", text: "Layout saved" });
    } else {
      APP.emit("toast", { type: "error", text: "Save failed" });
    }
  });

  APP.on("saveas-confirm", function (name) {
    var id = saveCurrentLayout(name);
    if (id) {
      APP.emit("toast", { type: "success", text: "Layout saved as: " + name });
    } else {
      APP.emit("toast", { type: "error", text: "Save failed" });
    }
  });

  APP.on("load-confirm", function (id) {
    var loaded = loadLayout(id);
    if (loaded) {
      APP.emit("toast", { type: "success", text: "Layout loaded" });
      if (typeof APP.goToEditor === "function") {
        APP.goToEditor();
      }
      setTimeout(function () {
        if (APP.canvas && typeof APP.canvas.render === "function") {
          APP.canvas.render();
        }
      }, 0);
    } else {
      APP.emit("toast", { type: "error", text: "Load failed" });
    }
  });

  APP.on("request-script-list", function () {
    var list = listLayoutsLocally();
    APP.emit("script-list-response", list);
  });

  APP.on("rename-layout-confirm", function (payload) {
    var id = payload && payload.id ? String(payload.id) : "";
    var name = payload && payload.name ? String(payload.name).trim() : "";
    if (!id || !name) {
      APP.emit("toast", { type: "error", text: "Rename failed" });
      return;
    }
    if (renameLayoutLocally(id, name)) {
      APP.emit("toast", { type: "success", text: "Renamed layout to: " + name });
      APP.emit("script-list-response", listLayoutsLocally());
      APP.emit("rename-layout-success", { id: id, name: name });
    } else {
      APP.emit("toast", { type: "error", text: "Rename failed" });
    }
  });

  // ─── Public API ───────────────────────────────────────────────

  APP.fileSync = {
    save: saveCurrentLayout,
    load: loadLayout,
    list: listLayoutsLocally,
    delete: deleteLayoutLocally,
    rename: renameLayoutLocally,
    exportJson: exportLayoutAsJson,
    importJson: importLayoutFromJson,
    getForBridge: getLayoutForBridge,
    generateId: generateLayoutId,
  };

})();
