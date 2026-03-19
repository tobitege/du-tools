  function normalizeProbeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getLuaEditorRoot() {
    return document.getElementById("dpu_editor");
  }

  function isElementVisible(element) {
    if (!element) {
      return false;
    }
    if (element.style && element.style.display === "none") {
      return false;
    }
    return element.offsetParent !== null || element === document.activeElement;
  }

  function getLuaEditorCodeMirror() {
    try {
      if (window.LUAEditorManager && typeof window.LUAEditorManager.getLuaEditor === "function") {
        return window.LUAEditorManager.getLuaEditor();
      }
    } catch (_ignore) {}
    return null;
  }

  function getSlotNodes() {
    var root = getLuaEditorRoot();
    if (!root || !root.querySelectorAll) {
      return [];
    }

    var nodes = root.querySelectorAll("#slots_container .slot");
    var result = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || (node.classList && node.classList.contains("slotTemplate"))) {
        continue;
      }
      result.push(node);
    }
    return result;
  }

  function getFilterNodes(visibleOnly) {
    var root = getLuaEditorRoot();
    if (!root || !root.querySelectorAll) {
      return [];
    }

    var nodes = root.querySelectorAll("#filters_container .filter");
    var result = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || (node.classList && node.classList.contains("filterTemplate"))) {
        continue;
      }
      if (visibleOnly && node.classList && !node.classList.contains("view")) {
        continue;
      }
      result.push(node);
    }
    return result;
  }

  function getSlotName(node) {
    if (!node || !node.querySelector) {
      return "";
    }
    var input = node.querySelector("input");
    if (!input) {
      return normalizeProbeText(node.textContent || "");
    }
    return String(input.value || input.placeholder || input.textContent || "").trim();
  }

  function getFilterEventName(node) {
    if (!node || !node.querySelector) {
      return "";
    }
    var label = node.querySelector(".actionName");
    return String(label ? (label.textContent || "") : "").trim();
  }

  function isSelectedNode(node) {
    if (!node || !node.classList) {
      return false;
    }
    return node.classList.contains("selected") ||
      node.classList.contains("active") ||
      node.classList.contains("current");
  }

  function clickNode(node) {
    if (!node) {
      return false;
    }
    try {
      if (typeof node.click === "function") {
        node.click();
        return true;
      }
      if (typeof MouseEvent === "function" && typeof node.dispatchEvent === "function") {
        node.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        }));
        return true;
      }
    } catch (_ignore) {}
    return false;
  }

  function findSlotNodeByName(slotName) {
    var expected = normalizeProbeText(slotName);
    var slots = getSlotNodes();
    var fallback = null;

    for (var i = 0; i < slots.length; i += 1) {
      var slotNode = slots[i];
      var currentName = normalizeProbeText(getSlotName(slotNode));
      if (!currentName) {
        continue;
      }
      if (currentName === expected) {
        return slotNode;
      }
      if (fallback === null && currentName.indexOf(expected) >= 0) {
        fallback = slotNode;
      }
    }

    return fallback;
  }

  function findFilterNodeByEvent(filterEvent) {
    var expected = normalizeProbeText(filterEvent);
    var filters = getFilterNodes(true);
    var fallback = null;

    for (var i = 0; i < filters.length; i += 1) {
      var filterNode = filters[i];
      var currentName = normalizeProbeText(getFilterEventName(filterNode));
      if (!currentName) {
        continue;
      }
      if (currentName === expected) {
        return filterNode;
      }
      if (fallback === null && (currentName.indexOf(expected) >= 0 || expected.indexOf(currentName) >= 0)) {
        fallback = filterNode;
      }
    }

    return fallback;
  }

  function describeLuaEditor() {
    var root = getLuaEditorRoot();
    var titleNode = document.getElementById("lua_editor_title");
    var wrapNode = document.getElementById("lua_wrap_lines");
    var applyNode = document.getElementById("applyBtn");
    var codeMirror = getLuaEditorCodeMirror();
    var code = "";

    try {
      if (codeMirror && typeof codeMirror.getValue === "function") {
        code = codeMirror.getValue();
      }
    } catch (_ignore) {}

    var slots = [];
    var slotNodes = getSlotNodes();
    for (var i = 0; i < slotNodes.length; i += 1) {
      var slotNode = slotNodes[i];
      slots.push({
        name: getSlotName(slotNode),
        selected: isSelectedNode(slotNode),
        disabled: !!(slotNode.classList && slotNode.classList.contains("disabled"))
      });
    }

    var filters = [];
    var filterNodes = getFilterNodes(true);
    for (var j = 0; j < filterNodes.length; j += 1) {
      var filterNode = filterNodes[j];
      filters.push({
        event: getFilterEventName(filterNode),
        selected: isSelectedNode(filterNode)
      });
    }

    var selectedSlot = null;
    var selectedFilter = null;
    for (var s = 0; s < slots.length; s += 1) {
      if (slots[s].selected) {
        selectedSlot = slots[s].name;
        break;
      }
    }
    for (var f = 0; f < filters.length; f += 1) {
      if (filters[f].selected) {
        selectedFilter = filters[f].event;
        break;
      }
    }

    return {
      visible: isElementVisible(root),
      title: titleNode ? String(titleNode.textContent || "").trim() : "",
      wrapLines: !!(wrapNode && wrapNode.checked),
      canApply: isElementVisible(applyNode),
      codeLength: code.length,
      selectedSlot: selectedSlot,
      selectedFilter: selectedFilter,
      slots: slots,
      filters: filters
    };
  }

  function selectSlotByName(slotName) {
    var slotNode = findSlotNodeByName(slotName);
    if (!slotNode) {
      throw new Error("slot_not_found:" + slotName);
    }
    if (!clickNode(slotNode)) {
      throw new Error("slot_click_failed:" + slotName);
    }
    return describeLuaEditor();
  }

  function selectFilterByEvent(filterEvent) {
    var filterNode = findFilterNodeByEvent(filterEvent);
    if (!filterNode) {
      throw new Error("filter_not_found:" + filterEvent);
    }
    if (!clickNode(filterNode)) {
      throw new Error("filter_click_failed:" + filterEvent);
    }
    return describeLuaEditor();
  }

  function setLuaEditorCode(code) {
    var text = String(code || "");
    try {
      if (window.LUAEditorManager && typeof window.LUAEditorManager.setCodeLuaEditor === "function") {
        window.LUAEditorManager.setCodeLuaEditor(text);
        return describeLuaEditor();
      }
    } catch (_ignoreSetCode) {}

    applyIdeCode(text);
    return describeLuaEditor();
  }

  function applyLuaEditorChanges() {
    if (!window.LUAEditorManager || typeof window.LUAEditorManager.apply !== "function") {
      throw new Error("apply_unavailable");
    }
    window.LUAEditorManager.apply();
    return {
      applied: true
    };
  }

  function serializeProbeValue(value, depth) {
    var maxDepth = typeof depth === "number" ? depth : 0;
    if (value === null || typeof value === "undefined") {
      return value;
    }
    if (maxDepth > 4) {
      return "[max-depth]";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      var out = [];
      for (var i = 0; i < value.length && i < 64; i += 1) {
        out.push(serializeProbeValue(value[i], maxDepth + 1));
      }
      return out;
    }
    if (typeof value === "object") {
      var obj = {};
      var keys = [];
      try {
        keys = Object.keys(value);
      } catch (_ignoreKeys) {
        return "[unserializable-object]";
      }
      for (var j = 0; j < keys.length && j < 64; j += 1) {
        var key = keys[j];
        obj[key] = serializeProbeValue(value[key], maxDepth + 1);
      }
      return obj;
    }
    return String(value);
  }

  function emitMcpResult(commandId, method, success, result, errorMessage) {
    sendPacket("lua_mcp_result", {
      commandId: String(commandId || ""),
      method: String(method || ""),
      success: !!success,
      result: success ? serializeProbeValue(result, 0) : null,
      error: success ? null : String(errorMessage || "unknown_error")
    });
  }

  function invokeMcpCommand(commandId, method, args) {
    var normalizedMethod = String(method || "").trim().toLowerCase();
    var listArgs = Array.isArray(args) ? args : [];

    try {
      var result = null;
      if (normalizedMethod === "describe") {
        result = describeLuaEditor();
      } else if (normalizedMethod === "select_slot") {
        result = selectSlotByName(listArgs[0]);
      } else if (normalizedMethod === "select_filter") {
        result = selectFilterByEvent(listArgs[0]);
      } else if (normalizedMethod === "set_code") {
        result = setLuaEditorCode(listArgs[0]);
      } else if (normalizedMethod === "apply") {
        result = applyLuaEditorChanges();
      } else {
        throw new Error("unsupported_method:" + normalizedMethod);
      }

      emitMcpResult(commandId, normalizedMethod, true, result, null);
      return result;
    } catch (err) {
      var message = String(err && err.message ? err.message : err);
      emitMcpResult(commandId, normalizedMethod, false, null, message);
      throw err;
    }
  }

  state.describeLuaEditor = describeLuaEditor;
  state.selectSlotByName = selectSlotByName;
  state.selectFilterByEvent = selectFilterByEvent;
  state.setLuaEditorCode = setLuaEditorCode;
  state.applyLuaEditorChanges = applyLuaEditorChanges;
  state.invokeMcpCommand = invokeMcpCommand;
  state.mcp = {
    invoke: invokeMcpCommand,
    describeLuaEditor: describeLuaEditor,
    selectSlotByName: selectSlotByName,
    selectFilterByEvent: selectFilterByEvent,
    setCode: setLuaEditorCode,
    apply: applyLuaEditorChanges
  };
