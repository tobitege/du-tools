// 080-bridge-commands.js - Command protocol to board via setInput/getOutput
(function hudEditorBridgeCommands() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Command prefix ────────────────────────────────────────────────

  var CMD_PREFIX = "he:";

  var CMD = {
    PING: "ping",
    SYNC: "sync",
    NEW: "new",
    LOAD: "load",
    SAVE: "save",
    LIST: "list",
    ADD: "add",
    UPD: "upd",
    DEL: "del",
    SEL: "sel",
    MOV: "mov",
    RES: "res",
    REND: "rend",
  };

  // ─── Bridge abstraction ────────────────────────────────────────────

  // The actual bridge to board happens via setInput on the unit.
  // In the HUD context, we don't have direct Lua access, but we can
  // use the existing MCP bridge to send commands through the board's
  // getInput() handler.

  var pendingCommands = {};
  var commandId = 0;

  function sendCommand(cmd, args) {
    var id = "he_" + (++commandId);
    var payload = CMD_PREFIX + cmd;
    if (args) {
      payload = payload + "|" + args;
    }

    // Store pending command
    pendingCommands[id] = {
      cmd: cmd,
      payload: payload,
      timestamp: Date.now(),
    };

    // Try to send via setInput if available
    // This requires the board to have setInput handler
    if (typeof unit !== "undefined" && unit && typeof unit.setInput === "function") {
      unit.setInput(payload);
    }

    return id;
  }

  // ─── Command helpers ──────────────────────────────────────────────

  function ping() {
    return sendCommand(CMD.PING);
  }

  function sync() {
    return sendCommand(CMD.SYNC);
  }

  function newDocument(screenW, screenH) {
    return sendCommand(CMD.NEW, screenW + "|" + screenH);
  }

  function loadDocument() {
    return sendCommand(CMD.LOAD);
  }

  function saveDocument() {
    return sendCommand(CMD.SAVE);
  }

  function listScripts() {
    return sendCommand(CMD.LIST);
  }

  function addElement(element) {
    var json = JSON.stringify(element);
    return sendCommand(CMD.ADD, json);
  }

  function updateElement(id, updates) {
    var json = JSON.stringify(updates);
    return sendCommand(CMD.UPD, id + "|" + json);
  }

  function deleteElement(id) {
    return sendCommand(CMD.DEL, id);
  }

  function selectElement(id) {
    return sendCommand(CMD.SEL, id || "");
  }

  function moveElement(id, x, y) {
    return sendCommand(CMD.MOV, id + "|" + x + "|" + y);
  }

  function resizeElement(id, x, y, w, h) {
    return sendCommand(CMD.RES, id + "|" + x + "|" + y + "|" + w + "|" + h);
  }

  // ─── Event handlers ────────────────────────────────────────────────

  // Handle responses from board via getOutput
  // This would be called from the Lua side when unit.getOutput() is available
  function handleResponse(response) {
    if (!response || typeof response !== "string") return;

    // Parse response
    var parts = response.split("|");
    var type = parts[0];

    if (type === "pong") {
      APP.emit("board-pong", { version: parts[1] });
    } else if (type === "sync_response") {
      APP.emit("board-sync", parseSyncResponse(parts));
    } else if (type === "new_response") {
      APP.emit("board-new", parseDocumentResponse(parts));
    } else if (type === "load_response") {
      APP.emit("board-load", parseDocumentResponse(parts));
    } else if (type === "save_response") {
      APP.emit("board-save", { ok: parts[1] === "ok" });
    } else if (type === "add_response") {
      APP.emit("element-added", parts[1] ? JSON.parse(parts[1]) : null);
    } else if (type === "update_response") {
      APP.emit("element-updated", parts[1] ? JSON.parse(parts[1]) : null);
    } else if (type === "delete_response") {
      APP.emit("element-deleted", parts[1]);
    } else if (type === "select_response") {
      APP.emit("selection-changed", parts[1]);
    } else if (type === "move_response" || type === "resize_response") {
      APP.emit("element-updated", parts[1] ? JSON.parse(parts[1]) : null);
    }
  }

  function parseSyncResponse(parts) {
    var data = {};
    for (var i = 1; i < parts.length; i++) {
      var kv = parts[i].split("=");
      if (kv.length === 2) {
        data[kv[0]] = kv[1];
      }
    }
    return data;
  }

  function parseDocumentResponse(parts) {
    // parts[1] should be JSON document
    try {
      return { document: parts[1] ? JSON.parse(parts[1]) : null };
    } catch (e) {
      return { document: null, error: e.message };
    }
  }

  // ─── Simulated local state (for offline/testing) ─────────────────

  // When the bridge isn't available, maintain a local state
  var localState = {
    document: null,
    selectedId: null,
    isDirty: false,
  };

  function applyLocalCommand(cmd, args) {
    // Apply command locally without board
    switch (cmd) {
      case CMD.NEW:
        var dims = args ? args.split("|") : ["1920", "1080"];
        localState.document = createNewDocumentLocal(parseInt(dims[0]) || 1920, parseInt(dims[1]) || 1080);
        localState.selectedId = null;
        localState.isDirty = false;
        APP.emit("document-created", localState.document);
        break;

      case CMD.ADD:
        if (localState.document) {
          var element = JSON.parse(args);
          element.id = element.id || generateIdLocal();
          localState.document.elements.push(element);
          localState.isDirty = true;
          APP.emit("element-added", element);
        }
        break;

      case CMD.UPD:
        if (localState.document) {
          var parts2 = args.split("|");
          var id = parts2[0];
          var updates = JSON.parse(parts2[1]);
          var el2 = localState.document.elements.find(function(e) { return e.id === id; });
          if (el2) {
            Object.assign(el2, updates);
            localState.isDirty = true;
            APP.emit("element-updated", id);
          }
        }
        break;

      case CMD.DEL:
        if (localState.document) {
          var idx = localState.document.elements.findIndex(function(e) { return e.id === args; });
          if (idx >= 0) {
            localState.document.elements.splice(idx, 1);
            if (localState.selectedId === args) localState.selectedId = null;
            localState.isDirty = true;
            APP.emit("element-deleted", args);
          }
        }
        break;

      case CMD.SEL:
        localState.selectedId = args || null;
        APP.emit("selection-changed", localState.selectedId);
        break;

      case CMD.MOV:
        if (localState.document) {
          var parts3 = args.split("|");
          var el3 = localState.document.elements.find(function(e) { return e.id === parts3[0]; });
          if (el3) {
            el3.x = parseInt(parts3[1]);
            el3.y = parseInt(parts3[2]);
            localState.isDirty = true;
            APP.emit("element-updated", el3.id);
          }
        }
        break;

      case CMD.RES:
        if (localState.document) {
          var parts4 = args.split("|");
          var el4 = localState.document.elements.find(function(e) { return e.id === parts4[0]; });
          if (el4) {
            el4.x = parseInt(parts4[1]);
            el4.y = parseInt(parts4[2]);
            el4.w = parseInt(parts4[3]);
            el4.h = parseInt(parts4[4]);
            localState.isDirty = true;
            APP.emit("element-updated", el4.id);
          }
        }
        break;
    }
  }

  function createNewDocumentLocal(screenW, screenH) {
    return {
      version: 1,
      revision: 0,
      screenWidth: screenW,
      screenHeight: screenH,
      elements: []
    };
  }

  function generateIdLocal() {
    return "el_" + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
  }

  // ─── Unified command interface ───────────────────────────────────

  function send(cmd, args) {
    // Try real bridge first, fall back to local
    if (typeof unit !== "undefined" && unit && typeof unit.setInput === "function") {
      return sendCommand(cmd, args);
    } else {
      applyLocalCommand(cmd, args);
      return null;
    }
  }

  // ─── Public API ─────────────────────────────────────────────────

  APP.bridge = {
    send: send,
    ping: ping,
    sync: sync,
    newDocument: newDocument,
    loadDocument: loadDocument,
    saveDocument: saveDocument,
    listScripts: listScripts,
    addElement: addElement,
    updateElement: updateElement,
    deleteElement: deleteElement,
    selectElement: selectElement,
    moveElement: moveElement,
    resizeElement: resizeElement,
    handleResponse: handleResponse,
    getLocalState: function() { return localState; },
  };

})();
