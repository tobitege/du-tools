// 090-databank-sync.js - Ingame-only persistence via the live Lua editor
(function hudEditorDatabankSync() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var pendingLoadToEditor = false;

  function hasBridge() {
    return !!(APP.bridge && typeof APP.bridge.isAvailable === "function" && APP.bridge.isAvailable());
  }

  function readEditorContext() {
    var fallback = {
      available: hasBridge(),
      visible: false,
      selectedSlot: null,
      selectedFilter: null,
      canAccessOnStart: false
    };
    var status = APP.bridge && typeof APP.bridge.getEditorStatus === "function"
      ? (APP.bridge.getEditorStatus() || fallback)
      : fallback;
    APP.state.editorContext = status;
    APP.emit("editor-context", status);
    return status;
  }

  function ensureVisibleEditorForBoardAction() {
    var status = readEditorContext();
    if (status && status.canAccessOnStart) {
      return true;
    }
    APP.emit("toast", {
      type: "error",
      text: "Open the programming board Lua editor and keep it visible for load/save"
    });
    return false;
  }

  function handlePostSaveEditorClose(message) {
    if (APP.state && APP.state.editModeActive && typeof APP.exitEditMode === "function") {
      APP.exitEditMode();
      if (typeof APP.updateToggleButton === "function") {
        APP.updateToggleButton();
      }
      APP.emit("toast", {
        type: "info",
        text: message || "Lua editor applied and closed; HUD editor closed too"
      });
      return;
    }
    if (typeof APP.goToStart === "function") {
      APP.goToStart();
    }
  }

  function applyLoadedDocument(doc, options) {
    if (!doc) return false;
    APP.state.document = doc;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.state.isDirty = false;
    APP.emit("document-loaded", doc);

    if (options && options.enterEditor && typeof APP.goToEditor === "function") {
      APP.goToEditor();
    }

    setTimeout(function () {
      if (APP.canvas && typeof APP.canvas.render === "function") {
        APP.canvas.render();
      }
    }, 0);
    return true;
  }

  function requestSync() {
    if (hasBridge() && APP.bridge.sync) {
      APP.bridge.sync();
      return true;
    }
    return false;
  }

  function requestLoad(scriptId) {
    if (hasBridge() && APP.bridge.loadDocument) {
      APP.bridge.loadDocument(scriptId || "_current");
      return true;
    }
    return false;
  }

  function requestList() {
    if (hasBridge() && APP.bridge.listScripts) {
      APP.bridge.listScripts();
      return true;
    }
    return false;
  }

  function requestSave() {
    if (hasBridge() && APP.bridge.saveDocument) {
      APP.bridge.saveDocument();
      return true;
    }
    return false;
  }

  APP.on("save", function () {
    if (!ensureVisibleEditorForBoardAction()) {
      return;
    }
    if (!requestSave()) {
      APP.emit("toast", { type: "error", text: "Lua editor bridge unavailable" });
    }
  });

  APP.on("saveas-confirm", function (name) {
    if (APP.state.document) {
      APP.state.document.name = String(name || "").trim() || "Layout";
    }
    if (!ensureVisibleEditorForBoardAction()) {
      return;
    }
    if (!requestSave()) {
      APP.emit("toast", { type: "error", text: "Lua editor bridge unavailable" });
    }
  });

  APP.on("load-confirm", function (id) {
    pendingLoadToEditor = true;
    if (!ensureVisibleEditorForBoardAction()) {
      pendingLoadToEditor = false;
      return;
    }
    if (!requestLoad(id)) {
      pendingLoadToEditor = false;
      APP.emit("toast", { type: "error", text: "Lua editor bridge unavailable" });
    }
  });

  APP.on("request-script-list", function () {
    if (!ensureVisibleEditorForBoardAction()) {
      APP.emit("script-list-response", []);
      return;
    }
    if (!requestList()) {
      APP.emit("script-list-response", []);
    }
  });

  APP.on("enter-edit", function () {
    readEditorContext();
    if (!APP.state.document) {
      requestSync();
    }
  });

  APP.on("board-sync", function (result) {
    readEditorContext();
    if (result && result.document && !APP.state.document) {
      applyLoadedDocument(result.document, { enterEditor: false });
    }
  });

  APP.on("board-load", function (result) {
    readEditorContext();
    var loaded = !!(result && result.document && applyLoadedDocument(result.document, {
      enterEditor: pendingLoadToEditor
    }));
    pendingLoadToEditor = false;

    if (loaded) {
      var count = Array.isArray(result.document.elements) ? result.document.elements.length : 0;
      APP.emit("toast", {
        type: "success",
        text: "Loaded " + count + " element" + (count === 1 ? "" : "s") + " from unit.onStart"
      });
    } else {
      APP.emit("toast", { type: "error", text: "Load from unit.onStart failed" });
    }
  });

  APP.on("board-save", function (result) {
    readEditorContext();
    if (result && result.ok) {
      APP.state.isDirty = false;
      APP.emit("toast", { type: "success", text: "Saved to unit.onStart" });
      handlePostSaveEditorClose();
    } else {
      APP.emit("toast", { type: "error", text: "Save to unit.onStart failed" });
    }
  });

  APP.on("board-list", function (result) {
    APP.emit("script-list-response", result && result.scripts ? result.scripts : []);
  });

  APP.on("board-error", function (err) {
    readEditorContext();
    var message = String((err && err.message) || err || "unknown");
    if (message === "lua editor not visible") {
      APP.emit("toast", {
        type: "error",
        text: "Open the programming board Lua editor and keep it visible for load/save"
      });
      return;
    }
    APP.emit("toast", { type: "error", text: "Lua editor error: " + message });
  });

  APP.databank = {
    save: requestSave,
    load: requestLoad,
    list: requestList,
    sync: requestSync
  };

  readEditorContext();
})();
