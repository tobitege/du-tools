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

  function normalizeEventKey(name) {
    var s = String(name || "").trim().toLowerCase();
    s = s.replace(/\s+/g, "");
    s = s.replace(/\([^)]*\)/g, "");
    return s;
  }

  function filterRowHasChosenEvent(filterNode) {
    var raw = String(getFilterEventName(filterNode) || "").trim();
    if (!raw) {
      return false;
    }
    var t = normalizeProbeText(raw);
    if (!t || t.indexOf("select event") >= 0) {
      return false;
    }
    return true;
  }

  function isPromiseLike(value) {
    return !!value && (typeof value === "object" || typeof value === "function") && typeof value.then === "function";
  }

  function pollUntilAsync(stepFn, maxRounds, delayMs, timeoutErrorFactory) {
    var rounds = typeof maxRounds === "number" && maxRounds > 0 ? maxRounds : 60;
    var waitMs = typeof delayMs === "number" && delayMs >= 0 ? delayMs : 25;
    return new Promise(function(resolve, reject) {
      var round = 0;

      function tick() {
        var outcome = null;
        try {
          outcome = stepFn(round);
        } catch (err) {
          reject(err);
          return;
        }

        if (outcome) {
          resolve(outcome);
          return;
        }

        round += 1;
        if (round >= rounds) {
          if (typeof timeoutErrorFactory === "function") {
            try {
              reject(timeoutErrorFactory());
            } catch (timeoutErr) {
              reject(timeoutErr);
            }
          } else {
            reject(new Error("poll_timeout"));
          }
          return;
        }

        window.setTimeout(tick, waitMs);
      }

      tick();
    });
  }

  function dispatchMouse(kind, el) {
    if (!el || typeof el.dispatchEvent !== "function") {
      return;
    }
    try {
      if (typeof MouseEvent === "function") {
        el.dispatchEvent(new MouseEvent(kind, { bubbles: true, cancelable: true, view: window }));
      }
    } catch (_ignoreMouse) {}
  }

  function openFilterAddMenu(anchorFilter) {
    var wrap = anchorFilter.querySelector(".action_list_button_wrapper");
    var dd = anchorFilter.querySelector(".ddContainer");
    var kebab = anchorFilter.querySelector(".icon_kebab_menu");
    var hoverTarget = wrap || dd || kebab;
    if (!hoverTarget) {
      return false;
    }
    dispatchMouse("mouseenter", hoverTarget);
    dispatchMouse("mouseover", hoverTarget);
    dispatchMouse("mousemove", hoverTarget);
    if (kebab) {
      dispatchMouse("mouseenter", kebab);
      dispatchMouse("mouseover", kebab);
    }
    return true;
  }

  function nudgeFilterMenuOpen(anchorFilter) {
    var wrap = anchorFilter.querySelector(".action_list_button_wrapper");
    var target = wrap || anchorFilter.querySelector(".ddContainer");
    if (!target) {
      return;
    }
    dispatchMouse("mousedown", target);
    dispatchMouse("mouseup", target);
    openFilterAddMenu(anchorFilter);
  }

  function queryActionMenuItems(anchorFilter) {
    var ul = anchorFilter.querySelector("ul.actionsList");
    if (!ul || !ul.querySelectorAll) {
      return [];
    }
    return ul.querySelectorAll("li");
  }

  function findActionMenuItemForEvent(anchorFilter, wantKey) {
    var lis = queryActionMenuItems(anchorFilter);
    var j;
    for (j = 0; j < lis.length; j += 1) {
      var li = lis[j];
      var label = normalizeEventKey(li.textContent || "");
      if (!label) {
        continue;
      }
      if (label === wantKey || label.indexOf(wantKey) === 0 || wantKey.indexOf(label) === 0) {
        return li;
      }
    }
    return null;
  }

  function findLuaAddFilterButton() {
    var root = getLuaEditorRoot();
    var btn = null;
    if (root && root.querySelector) {
      btn = root.querySelector(".lua_add_filter_button");
    }
    if (!btn) {
      btn = document.querySelector("#dpu_editor .lua_add_filter_button");
    }
    return btn;
  }

  function clickLuaAddFilterButton() {
    var btn = findLuaAddFilterButton();
    if (!btn) {
      return false;
    }
    return clickNode(btn);
  }

  function pickUnsettledFilterRow() {
    var filters = getFilterNodes(true);
    var i;
    for (i = filters.length - 1; i >= 0; i -= 1) {
      if (!filterRowHasChosenEvent(filters[i])) {
        return filters[i];
      }
    }
    return null;
  }

  function waitForUnsettledFilterRowAsync(maxRounds, delayMs) {
    return pollUntilAsync(
      function() {
        return pickUnsettledFilterRow();
      },
      maxRounds,
      delayMs,
      function() {
        return new Error("add_filter_no_placeholder_row");
      }
    );
  }

  function addFilterByEventName(rawEventName) {
    var wantKey = normalizeEventKey(rawEventName);
    if (!wantKey) {
      throw new Error("add_filter_empty_name");
    }

    var filters = getFilterNodes(true);
    var idx;
    for (idx = 0; idx < filters.length; idx += 1) {
      var fNode = filters[idx];
      if (!filterRowHasChosenEvent(fNode)) {
        continue;
      }
      if (normalizeEventKey(getFilterEventName(fNode)) === wantKey) {
        var presentSnap = describeLuaEditor();
        presentSnap.alreadyPresent = true;
        return presentSnap;
      }
    }

    return Promise.resolve()
      .then(function() {
        var anchor = pickUnsettledFilterRow();
        if (anchor) {
          return anchor;
        }

        var countBefore = getFilterNodes(true).length;
        var clickedAdd = clickLuaAddFilterButton();
        if (!clickedAdd) {
          if (!window.LUAEditorManager || typeof window.LUAEditorManager.addNewFilter !== "function") {
            throw new Error("add_filter_no_add_button");
          }
          window.LUAEditorManager.addNewFilter(true);
        }

        return waitForUnsettledFilterRowAsync(120, 25).catch(function(initialErr) {
          var filtersAfter = getFilterNodes(true).length;
          if (filtersAfter <= countBefore) {
            throw new Error("add_filter_no_new_row");
          }
          return waitForUnsettledFilterRowAsync(60, 25).catch(function() {
            throw initialErr;
          });
        });
      })
      .then(function(anchor) {
        if (!openFilterAddMenu(anchor)) {
          throw new Error("add_filter_no_menu_anchor");
        }

        return pollUntilAsync(
          function(round) {
            var choice = findActionMenuItemForEvent(anchor, wantKey);
            if (choice) {
              return {
                anchor: anchor,
                choice: choice
              };
            }
            if (round === 6 || round === 14 || round === 28) {
              nudgeFilterMenuOpen(anchor);
            }
            return null;
          },
          90,
          25,
          function() {
            return new Error("add_filter_option_not_found:" + rawEventName);
          }
        );
      })
      .then(function(step) {
        try {
          if (!clickNode(step.choice)) {
            throw new Error("add_filter_click_failed:" + rawEventName);
          }
        } catch (clickErr) {
          throw new Error("add_filter_click_failed:" + rawEventName + ":" + String(clickErr && clickErr.message ? clickErr.message : clickErr));
        }

        return pollUntilAsync(
          function() {
            if (normalizeEventKey(getFilterEventName(step.anchor)) !== wantKey) {
              return null;
            }
            var out = describeLuaEditor();
            out.added = String(rawEventName || "").trim();
            return out;
          },
          80,
          25,
          function() {
            return new Error("add_filter_selection_not_observed:" + rawEventName);
          }
        );
      });
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

  var MAX_OUTER_HTML_CHARS = 350000;

  function outerHtmlForSelector(rawSelector) {
    var sel = String(rawSelector || "").trim();
    if (!sel) {
      sel = "#filters";
    }
    var root = getLuaEditorRoot();
    var el = null;
    try {
      if (root && root.querySelector) {
        el = root.querySelector(sel);
      }
    } catch (_badSel) {}
    if (!el) {
      try {
        el = document.querySelector(sel);
      } catch (_badSel2) {}
    }
    if (!el) {
      throw new Error("outer_html_not_found:" + sel);
    }
    var html = "";
    try {
      html = typeof el.outerHTML === "string" ? el.outerHTML : "";
    } catch (_ignoreOh) {}
    var originalLength = html.length;
    var truncated = false;
    if (html.length > MAX_OUTER_HTML_CHARS) {
      html = html.slice(0, MAX_OUTER_HTML_CHARS);
      truncated = true;
    }
    return {
      selector: sel,
      outerHTML: html,
      originalLength: originalLength,
      truncated: truncated
    };
  }

  function runRawProbeEval(source) {
    var src = String(source || "").trim();
    if (!src) {
      throw new Error("raw_eval_empty");
    }
    var st = window.__UI_EXTRACTOR_LUA_PROBE_STATE__;
    if (!st) {
      throw new Error("raw_eval_no_state");
    }
    var factory = new Function("state", '"use strict"; ' + src);
    return factory(st);
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
    var payload = {
      commandId: String(commandId || ""),
      method: String(method || ""),
      success: !!success,
      result: success ? serializeProbeValue(result, 0) : null,
      error: success ? null : String(errorMessage || "unknown_error")
    };
    var payloadJson = "";
    try {
      payloadJson = JSON.stringify(payload);
    } catch (_ignoreSerialize) {}

    if (payloadJson && payloadJson.length > mcpResultChunkSize) {
      sendJsonPacketChunked("lua_mcp_result", payload, mcpResultChunkSize);
      return;
    }

    sendPacket("lua_mcp_result", payload);
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
      } else if (normalizedMethod === "add_filter") {
        result = addFilterByEventName(listArgs[0]);
      } else if (normalizedMethod === "outer_html") {
        result = outerHtmlForSelector(listArgs[0]);
      } else if (normalizedMethod === "raw_eval") {
        result = runRawProbeEval(listArgs[0]);
      } else {
        throw new Error("unsupported_method:" + normalizedMethod);
      }

      if (isPromiseLike(result)) {
        result.then(function(asyncResult) {
          emitMcpResult(commandId, normalizedMethod, true, asyncResult, null);
        }).catch(function(asyncErr) {
          var asyncMessage = String(asyncErr && asyncErr.message ? asyncErr.message : asyncErr);
          emitMcpResult(commandId, normalizedMethod, false, null, asyncMessage);
        });
        return null;
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
  state.addFilterByEventName = addFilterByEventName;
  state.outerHtmlForSelector = outerHtmlForSelector;
  state.runRawProbeEval = runRawProbeEval;
  state.invokeMcpCommand = invokeMcpCommand;
  state.mcp = {
    invoke: invokeMcpCommand,
    describeLuaEditor: describeLuaEditor,
    selectSlotByName: selectSlotByName,
    selectFilterByEvent: selectFilterByEvent,
    setCode: setLuaEditorCode,
    apply: applyLuaEditorChanges,
    addFilter: addFilterByEventName,
    outerHtml: outerHtmlForSelector,
    rawEval: runRawProbeEval
  };
