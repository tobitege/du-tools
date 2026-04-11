  function normalizeProbeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getLuaEditorRoot() {
    return document.getElementById("dpu_editor");
  }

  function ensureLuaEditorVisible() {
    var root = getLuaEditorRoot();
    if (!isElementVisible(root)) {
      throw new Error("lua_editor_not_visible");
    }
    return root;
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

  function activateSelectionNode(node) {
    if (!node) {
      return false;
    }
    if (typeof dispatchMouseSequence === "function") {
      try {
        if (dispatchMouseSequence(node)) {
          return true;
        }
      } catch (_ignoreDispatchSequence) {}
    }
    return clickNode(node);
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

  function normalizeEventKey(name) {
    var s = String(name || "").trim().toLowerCase();
    s = s.replace(/\s+/g, "");
    s = s.replace(/\([^)]*\)/g, "");
    return s;
  }

  function getFilterArgumentValues(filterNode) {
    var args = [];
    if (!filterNode || !filterNode.querySelectorAll) {
      return args;
    }

    try {
      var inputs = filterNode.querySelectorAll(".actionInputs input");
      for (var i = 0; i < inputs.length; i += 1) {
        var input = inputs[i];
        if (!input) {
          continue;
        }
        var rawValue = "";
        if (typeof input.value !== "undefined") {
          rawValue = input.value;
        } else if (typeof input.getAttribute === "function") {
          rawValue = input.getAttribute("value") || "";
        }
        var normalized = normalizeProbeText(rawValue);
        if (normalized) {
          args.push(normalized);
        }
      }
    } catch (_ignoreFilterArgs) {}

    return args;
  }

  function buildFilterDisplaySignature(eventName, args) {
    var safeEventName = String(eventName || "").trim();
    var safeArgs = args || [];
    var parts = [];
    for (var i = 0; i < safeArgs.length; i += 1) {
      parts.push(String(safeArgs[i] || "").trim());
    }
    return safeEventName + "(" + parts.join(", ") + ")";
  }

  function parseFilterDescriptor(filterEvent) {
    var raw = String(filterEvent || "").trim();
    var eventName = raw;
    var args = [];
    var hasArgs = false;
    var match = raw.match(/^([^()]+)\((.*)\)$/);
    if (match) {
      hasArgs = true;
      eventName = String(match[1] || "").trim();
      var rawArgs = String(match[2] || "").trim();
      if (rawArgs) {
        var parts = rawArgs.split(",");
        for (var i = 0; i < parts.length; i += 1) {
          var normalized = normalizeProbeText(parts[i]);
          if (normalized) {
            args.push(normalized);
          }
        }
      }
    }

    var eventKey = normalizeEventKey(eventName);
    return {
      raw: raw,
      eventName: eventName,
      eventKey: eventKey,
      args: args,
      hasArgs: hasArgs,
      signatureKey: eventKey + "|" + args.join("|")
    };
  }

  function getFilterInfo(filterNode, index) {
    var eventName = String(getFilterEventName(filterNode) || "").trim();
    var args = getFilterArgumentValues(filterNode);
    var eventKey = normalizeEventKey(eventName);
    return {
      node: filterNode,
      index: index,
      eventName: eventName,
      eventKey: eventKey,
      args: args,
      signatureKey: eventKey + "|" + args.join("|"),
      displaySignature: buildFilterDisplaySignature(eventName, args),
      visible: isElementVisible(filterNode),
      selected: isSelectedNode(filterNode),
      className: filterNode && filterNode.className ? String(filterNode.className) : ""
    };
  }

  function getAllFilterInfos() {
    var filterNodes = getFilterNodes(false);
    var infos = [];
    for (var i = 0; i < filterNodes.length; i += 1) {
      infos.push(getFilterInfo(filterNodes[i], i));
    }
    return infos;
  }

  function findFilterMatches(filterEvent) {
    var expected = parseFilterDescriptor(filterEvent);
    var allInfos = getAllFilterInfos();
    var infos = [];
    for (var i = 0; i < allInfos.length; i += 1) {
      if (allInfos[i].visible) {
        infos.push(allInfos[i]);
      }
    }
    if (infos.length <= 0) {
      infos = allInfos;
    }
    var matches = [];

    for (var i = 0; i < infos.length; i += 1) {
      var info = infos[i];
      if (!info.eventKey || info.eventKey !== expected.eventKey) {
        continue;
      }
      if (expected.hasArgs && info.signatureKey !== expected.signatureKey) {
        continue;
      }
      matches.push(info);
    }

    return {
      expected: expected,
      matches: matches
    };
  }

  function getSelectedVisibleFilterInfo() {
    var infos = getAllFilterInfos();
    for (var i = 0; i < infos.length; i += 1) {
      if (infos[i].visible && infos[i].selected) {
        return infos[i];
      }
    }
    return null;
  }

  function waitMsAsync(waitMs) {
    return new Promise(function(resolve) {
      window.setTimeout(resolve, Math.max(0, waitMs));
    });
  }

  function waitForSlotSelectionAsync(rawSlotName) {
    var expectedSlot = normalizeProbeText(rawSlotName);
    return pollUntilAsync(
      function() {
        var snapshot = describeLuaEditor();
        if (normalizeProbeText(snapshot.selectedSlot) !== expectedSlot) {
          return null;
        }
        if (!snapshot.filters || snapshot.filters.length <= 0) {
          return snapshot;
        }
        if (snapshot.selectedFilter) {
          return snapshot;
        }
        return null;
      },
      200,
      25,
      function() {
        return new Error("slot_select_not_observed:" + rawSlotName);
      }
    );
  }

  function selectLuaEditorContext(slotName, filterEvent, minPauseMs) {
    ensureLuaEditorVisible();
    var rawSlotName = String(slotName || "").trim();
    var rawFilterEvent = String(filterEvent || "").trim();
    if (!rawSlotName) {
      throw new Error("slot_name_required");
    }
    if (!rawFilterEvent) {
      throw new Error("filter_name_required");
    }

    var expectedSlot = normalizeProbeText(rawSlotName);
    var requiredPauseMs = Math.max(1000, parseInt(String(minPauseMs || ""), 10) || 1000);
    var expectedFilter = parseFilterDescriptor(rawFilterEvent);

    return pollUntilAsync(
      function() {
        var snapshot = describeLuaEditor();
        if (normalizeProbeText(snapshot.selectedSlot) === expectedSlot) {
          return snapshot;
        }
        var slotNode = findSlotNodeByName(rawSlotName);
        if (!slotNode) {
          throw new Error("slot_not_found:" + rawSlotName);
        }
        if (!activateSelectionNode(slotNode)) {
          throw new Error("slot_click_failed:" + rawSlotName);
        }
        return null;
      },
      200,
      25,
      function() {
        return new Error("slot_select_not_observed:" + rawSlotName);
      }
    ).then(function() {
      return waitForSlotSelectionAsync(rawSlotName);
    }).then(function() {
      return waitMsAsync(requiredPauseMs);
    }).then(function() {
      return pollUntilAsync(
        function() {
          var resolved = findFilterMatches(rawFilterEvent);
          if (resolved.matches.length > 1) {
            throw new Error("filter_ambiguous:" + rawFilterEvent + ":" + resolved.matches.length);
          }
          if (resolved.matches.length <= 0) {
            return null;
          }
          return resolved.matches[0];
        },
        240,
        25,
        function() {
          return new Error("filter_not_found:" + rawFilterEvent);
        }
      );
    }).then(function(filterInfo) {
      var selectedInfo = getSelectedVisibleFilterInfo();
      if (selectedInfo && selectedInfo.signatureKey === filterInfo.signatureKey) {
        return describeLuaEditor();
      }
      if (!activateSelectionNode(filterInfo.node)) {
        throw new Error("filter_click_failed:" + rawFilterEvent);
      }
      return pollUntilAsync(
        function() {
          var currentSelected = getSelectedVisibleFilterInfo();
          if (currentSelected && currentSelected.signatureKey === expectedFilter.signatureKey) {
            return describeLuaEditor();
          }
          return null;
        },
        200,
        25,
        function() {
          return new Error("filter_select_not_observed:" + rawFilterEvent);
        }
      );
    });
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
    ensureLuaEditorVisible();
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
    if (!isElementVisible(root)) {
      return {
        visible: false,
        title: "",
        wrapLines: false,
        canApply: false,
        codeLength: 0,
        selectedSlot: null,
        selectedFilter: null,
        contextKey: "",
        reference: null,
        slots: [],
        filters: []
      };
    }
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

    try {
      var manager = window.LUAEditorManager || null;
      var currentData = manager && manager.currentData ? manager.currentData : null;
      var currentSlot = currentData && currentData.currentSlot ? currentData.currentSlot : null;
      var currentFilter = currentData && currentData.currentFilter ? currentData.currentFilter : null;
      if (currentSlot && typeof currentSlot.name !== "undefined" && currentSlot.name !== null) {
        selectedSlot = String(currentSlot.name);
      }
      if (currentFilter) {
        if (typeof currentFilter.signature !== "undefined" && currentFilter.signature !== null && String(currentFilter.signature)) {
          selectedFilter = String(currentFilter.signature);
        } else if (typeof currentFilter.name !== "undefined" && currentFilter.name !== null && String(currentFilter.name)) {
          selectedFilter = String(currentFilter.name);
        }
      }
    } catch (_ignoreManagerSelection) {}

    try {
      if (typeof getResolvedActiveFilterDisplaySignature === "function") {
        var resolvedSelectedFilter = String(getResolvedActiveFilterDisplaySignature() || "").replace(/\s+/g, " ").trim();
        if (resolvedSelectedFilter) {
          selectedFilter = resolvedSelectedFilter;
        }
      }
    } catch (_ignoreResolvedSelectedFilter) {}

    var ideSyncContextKey = "";
    var ideSyncReference = null;
    try {
      if (typeof getIdeSyncSnapshot === "function") {
        var ideSyncSnapshot = getIdeSyncSnapshot("lua_editor");
        if (ideSyncSnapshot && typeof ideSyncSnapshot === "object") {
          ideSyncContextKey = typeof ideSyncSnapshot.contextKey === "string" ? ideSyncSnapshot.contextKey : "";
          if (ideSyncSnapshot.reference && typeof ideSyncSnapshot.reference === "object") {
            ideSyncReference = cloneIdeSyncObject(ideSyncSnapshot.reference);
          }
        }
      }
    } catch (_ignoreIdeSyncSnapshot) {}

    return {
      visible: true,
      title: titleNode ? String(titleNode.textContent || "").trim() : "",
      wrapLines: !!(wrapNode && wrapNode.checked),
      canApply: typeof isLuaApplyButtonInteractive === "function"
        ? isLuaApplyButtonInteractive(applyNode)
        : isElementVisible(applyNode),
      codeLength: code.length,
      selectedSlot: selectedSlot,
      selectedFilter: selectedFilter,
      contextKey: ideSyncContextKey,
      reference: ideSyncReference,
      slots: slots,
      filters: filters
    };
  }

  function listLuaEditorFilters() {
    ensureLuaEditorVisible();
    var snapshot = describeLuaEditor();
    var infos = getAllFilterInfos();
    var details = [];
    for (var i = 0; i < infos.length; i += 1) {
      var info = infos[i];
      details.push({
        index: info.index,
        event: info.eventName,
        args: info.args,
        signature: info.displaySignature,
        selected: info.selected,
        visible: info.visible,
        className: info.className
      });
    }
    snapshot.filterDetails = details;
    return snapshot;
  }

  function selectSlotByName(slotName) {
    ensureLuaEditorVisible();
    var slotNode = findSlotNodeByName(slotName);
    if (!slotNode) {
      throw new Error("slot_not_found:" + slotName);
    }
    if (!activateSelectionNode(slotNode)) {
      throw new Error("slot_click_failed:" + slotName);
    }
    return waitForSlotSelectionAsync(slotName);
  }

  function selectFilterByEvent(filterEvent) {
    ensureLuaEditorVisible();
    var resolved = findFilterMatches(filterEvent);
    if (resolved.matches.length <= 0) {
      throw new Error("filter_not_found:" + filterEvent);
    }
    if (resolved.matches.length > 1) {
      throw new Error("filter_ambiguous:" + filterEvent + ":" + resolved.matches.length);
    }
    var filterInfo = resolved.matches[0];
    if (!activateSelectionNode(filterInfo.node)) {
      throw new Error("filter_click_failed:" + filterEvent);
    }
    return describeLuaEditor();
  }

  function selectFilterByIndex(filterIndex) {
    ensureLuaEditorVisible();
    var wantedIndex = parseInt(String(filterIndex || ""), 10);
    if (!isFinite(wantedIndex)) {
      throw new Error("filter_index_invalid:" + filterIndex);
    }
    var infos = getAllFilterInfos();
    var filterInfo = null;
    for (var i = 0; i < infos.length; i += 1) {
      if (infos[i].index === wantedIndex) {
        filterInfo = infos[i];
        break;
      }
    }
    if (!filterInfo) {
      throw new Error("filter_index_not_found:" + wantedIndex);
    }
    if (!activateSelectionNode(filterInfo.node)) {
      throw new Error("filter_index_click_failed:" + wantedIndex);
    }
    return describeLuaEditor();
  }

  function setLuaEditorCode(code) {
    ensureLuaEditorVisible();
    var text = String(code || "");
    try {
      if (window.LUAEditorManager && typeof window.LUAEditorManager.setCodeLuaEditor === "function") {
        window.LUAEditorManager.setCodeLuaEditor(text);
        normalizeLuaEditorTrailingNewline(getLuaCodeMirror());
        return describeLuaEditor();
      }
    } catch (_ignoreSetCode) {}

    applyIdeCode(text);
    return describeLuaEditor();
  }

  function applyLuaEditorChanges() {
    ensureLuaEditorVisible();
    var root = getLuaEditorRoot();
    if (!isElementVisible(root)) {
      throw new Error("lua_editor_not_visible");
    }

    var applyNode = null;
    if (typeof getLuaApplyButtonNode === "function") {
      try {
        applyNode = getLuaApplyButtonNode();
      } catch (_ignoreApplyButtonLookup) {}
    }
    if (!applyNode && root && root.querySelector) {
      try {
        applyNode = root.querySelector(".btn_bar .lua_editor_apply_button");
      } catch (_ignoreApplyButtonQuery) {}
    }

    var canUseApplyButton = !!(applyNode && isElementVisible(applyNode));
    if (canUseApplyButton && typeof isLuaApplyButtonInteractive === "function") {
      canUseApplyButton = isLuaApplyButtonInteractive(applyNode);
    }
    if (canUseApplyButton && dispatchMouseSequence(applyNode)) {
      return waitForLuaEditorClosedAsync(root, {
        applied: true,
        path: "button"
      }, "lua_editor_apply_failed");
    }

    if (window.LUAEditorManager && typeof window.LUAEditorManager.apply === "function") {
      window.LUAEditorManager.apply();
      return waitForLuaEditorClosedAsync(root, {
        applied: true,
        path: "manager"
      }, "lua_editor_apply_failed");
    }

    throw new Error("apply_unavailable");
  }

  function getScreenEditorPanel() {
    try {
      if (window.screenContentEditorPanel) {
        return window.screenContentEditorPanel;
      }
    } catch (_ignoreScreenPanel) {}
    return null;
  }

  function getScreenEditorRoot() {
    var panel = getScreenEditorPanel();
    try {
      if (panel && panel.HTMLNodes) {
        if (panel.HTMLNodes.main) {
          return panel.HTMLNodes.main;
        }
        if (panel.HTMLNodes.root) {
          return panel.HTMLNodes.root;
        }
        if (panel.HTMLNodes.panel) {
          return panel.HTMLNodes.panel;
        }
      }
    } catch (_ignoreScreenHtmlNodes) {}
    try {
      return document.querySelector(".screen_content_editor_panel");
    } catch (_ignoreScreenRootQuery) {}
    return null;
  }

  function getScreenEditorCodeNode(panel, root) {
    if (panel && panel.textEditor) {
      return panel.textEditor;
    }
    if (root && root.querySelector) {
      try {
        return root.querySelector("textarea");
      } catch (_ignoreScreenTextarea) {}
    }
    return null;
  }

  function getScreenEditorCodeMirror(root) {
    if (!root || !root.querySelector) {
      return null;
    }
    try {
      var cmNode = root.querySelector(".CodeMirror");
      if (cmNode && cmNode.CodeMirror) {
        return cmNode.CodeMirror;
      }
    } catch (_ignoreScreenCodeMirror) {}
    return null;
  }

  function getScreenEditorTitle(root) {
    if (!root || !root.querySelector) {
      return "";
    }
    try {
      var titleNode = root.querySelector(".header_block .panel_title");
      return titleNode ? String(titleNode.textContent || "").replace(/\s+/g, " ").trim() : "";
    } catch (_ignoreScreenTitleText) {}
    return "";
  }

  function getScreenEditorSubTitle(root) {
    if (!root || !root.querySelector) {
      return "";
    }
    try {
      var subTitleNode = root.querySelector(".content .top_line .sub_title_wrapper .sub_title");
      return subTitleNode ? String(subTitleNode.textContent || "").replace(/\s+/g, " ").trim() : "";
    } catch (_ignoreScreenSubTitleText) {}
    return "";
  }

  function getScreenEditorMode(panel, root) {
    var modeInputNode = null;
    try {
      if (root && root.querySelector) {
        modeInputNode = root.querySelector(".mode_switch_wrapper .checkbox_switch input");
      }
    } catch (_ignoreScreenModeInputLookup) {}

    if (!modeInputNode) {
      try {
        if (panel && panel.HTMLNodes && panel.HTMLNodes.isHTMLModeCheckbox) {
          modeInputNode = panel.HTMLNodes.isHTMLModeCheckbox;
        }
      } catch (_ignoreScreenModeInputFallback) {}
    }

    try {
      if (panel && typeof panel.isInHTMLMode === "boolean") {
        return panel.isInHTMLMode ? "html" : "lua";
      }
      if (modeInputNode && typeof modeInputNode.checked === "boolean") {
        return modeInputNode.checked ? "html" : "lua";
      }
    } catch (_ignoreScreenModeValue) {}

    return "lua";
  }

  function getScreenEditorContextSnapshot(root, panel) {
    var resolvedRoot = root || getScreenEditorRoot();
    var resolvedPanel = panel || getScreenEditorPanel();
    var title = getScreenEditorTitle(resolvedRoot);
    var subTitle = getScreenEditorSubTitle(resolvedRoot);
    var mode = getScreenEditorMode(resolvedPanel, resolvedRoot);
    return {
      title: title,
      subTitle: subTitle,
      mode: mode,
      contextKey: "screen:" + normalizeIdeSyncValue(title) + "::" + normalizeIdeSyncValue(subTitle) + "::" + normalizeIdeSyncValue(mode)
    };
  }

  function getScreenEditorCursorFromTextarea(codeNode) {
    if (!codeNode || typeof codeNode.value !== "string") {
      return {
        line: 0,
        ch: 0
      };
    }

    var text = String(codeNode.value || "");
    var selectionStart = typeof codeNode.selectionStart === "number" ? codeNode.selectionStart : 0;
    if (selectionStart < 0) {
      selectionStart = 0;
    }
    if (selectionStart > text.length) {
      selectionStart = text.length;
    }

    var beforeCursor = text.slice(0, selectionStart);
    var parts = beforeCursor.split(/\r\n?|\n/);
    var line = parts.length > 0 ? parts.length - 1 : 0;
    var ch = parts.length > 0 ? parts[parts.length - 1].length : 0;
    return {
      line: line,
      ch: ch
    };
  }

  function getTextareaOffsetForLineAndCh(text, line, ch) {
    var normalized = String(text || "").replace(/\r\n?/g, "\n");
    var wantedLine = typeof line === "number" && line >= 0 ? line : 0;
    var wantedCh = typeof ch === "number" && ch >= 0 ? ch : 0;
    var currentLine = 0;
    var idx = 0;
    while (currentLine < wantedLine && idx < normalized.length) {
      var nextNewline = normalized.indexOf("\n", idx);
      if (nextNewline < 0) {
        idx = normalized.length;
        break;
      }
      idx = nextNewline + 1;
      currentLine += 1;
    }

    var lineEnd = normalized.indexOf("\n", idx);
    if (lineEnd < 0) {
      lineEnd = normalized.length;
    }
    var maxCh = lineEnd - idx;
    return idx + Math.min(wantedCh, maxCh < 0 ? 0 : maxCh);
  }

  function hasRememberedScreenViewportForKey(key) {
    if (!key) {
      return false;
    }
    var remembered = state.screenScrollTopByContext[key];
    if (typeof remembered === "number") {
      return remembered >= 0;
    }
    return !!(remembered && typeof remembered === "object" && typeof remembered.topLine === "number" && remembered.topLine >= 0);
  }

  function rememberScreenEditorViewportForKey(keyHint) {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    if (!isElementVisible(root)) {
      return false;
    }

    var codeMirror = getScreenEditorCodeMirror(root);
    var codeNode = getScreenEditorCodeNode(panel, root);
    if (!codeMirror && !codeNode) {
      return false;
    }

    var context = getScreenEditorContextSnapshot(root, panel);
    var key = keyHint || context.contextKey || state.lastScreenContextKey || "screen:default";
    state.lastScreenContextKey = key;

    try {
      var topLine = 0;
      var cursorLine = 0;
      var cursorCh = 0;
      var scrollTopPx = 0;
      var hadFocus = false;

      if (codeMirror) {
        try {
          if (typeof codeMirror.getScrollInfo === "function") {
            var scrollInfo = codeMirror.getScrollInfo();
            scrollTopPx = scrollInfo && typeof scrollInfo.top === "number" ? scrollInfo.top : 0;
          }
        } catch (_ignoreScreenScrollInfo) {}

        try {
          if (typeof codeMirror.lineAtHeight === "function") {
            topLine = codeMirror.lineAtHeight(scrollTopPx, "local");
          }
        } catch (_ignoreScreenTopLine) {}

        try {
          if (typeof codeMirror.getCursor === "function") {
            var cursor = codeMirror.getCursor();
            if (cursor && typeof cursor.line === "number") {
              cursorLine = cursor.line;
            }
            if (cursor && typeof cursor.ch === "number") {
              cursorCh = cursor.ch;
            }
          }
        } catch (_ignoreScreenCursor) {}

        try {
          if (typeof codeMirror.hasFocus === "function") {
            hadFocus = codeMirror.hasFocus();
          }
        } catch (_ignoreScreenFocus) {}
      } else if (codeNode) {
        var textCursor = getScreenEditorCursorFromTextarea(codeNode);
        topLine = textCursor.line;
        cursorLine = textCursor.line;
        cursorCh = textCursor.ch;
        scrollTopPx = typeof codeNode.scrollTop === "number" ? codeNode.scrollTop : 0;
        hadFocus = document.activeElement === codeNode;
      }

      if (typeof topLine !== "number" || topLine < 0) {
        topLine = cursorLine >= 0 ? cursorLine : 0;
      }
      if (cursorLine < 0) {
        cursorLine = topLine;
      }
      if (cursorCh < 0) {
        cursorCh = 0;
      }

      state.screenScrollTopByContext[key] = {
        topLine: topLine,
        cursorLine: cursorLine,
        cursorCh: cursorCh,
        scrollTopPx: scrollTopPx,
        hadFocus: hadFocus
      };
      return true;
    } catch (_ignoreRememberScreenViewport) {}

    return false;
  }

  function restoreScreenEditorViewportForKey(keyHint) {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    if (!isElementVisible(root)) {
      return false;
    }

    var codeMirror = getScreenEditorCodeMirror(root);
    var codeNode = getScreenEditorCodeNode(panel, root);
    if (!codeMirror && !codeNode) {
      return false;
    }

    var context = getScreenEditorContextSnapshot(root, panel);
    var key = keyHint || context.contextKey || state.lastScreenContextKey;
    if (!key) {
      return false;
    }
    state.lastScreenContextKey = key;

    var remembered = state.screenScrollTopByContext[key];
    var rememberedTopLine = -1;
    var rememberedCursorLine = -1;
    var rememberedCursorCh = 0;
    var rememberedScrollTopPx = 0;
    var shouldFocus = false;

    if (typeof remembered === "number") {
      rememberedTopLine = remembered;
      rememberedCursorLine = remembered;
    } else if (remembered && typeof remembered === "object") {
      if (typeof remembered.topLine === "number") {
        rememberedTopLine = remembered.topLine;
      }
      if (typeof remembered.cursorLine === "number") {
        rememberedCursorLine = remembered.cursorLine;
      }
      if (typeof remembered.cursorCh === "number") {
        rememberedCursorCh = remembered.cursorCh;
      }
      if (typeof remembered.scrollTopPx === "number") {
        rememberedScrollTopPx = remembered.scrollTopPx;
      }
      shouldFocus = !!remembered.hadFocus;
    }

    if (typeof rememberedTopLine !== "number" || rememberedTopLine < 0) {
      return false;
    }

    try {
      var applyRestore = function() {
        if (codeMirror) {
          var lineCount = typeof codeMirror.lineCount === "function" ? codeMirror.lineCount() : 0;
          if (lineCount > 0) {
            if (rememberedTopLine >= lineCount) {
              rememberedTopLine = lineCount - 1;
            }
            if (rememberedCursorLine < 0 || rememberedCursorLine >= lineCount) {
              rememberedCursorLine = rememberedTopLine;
            }
          }

          if (rememberedCursorLine < 0) {
            rememberedCursorLine = rememberedTopLine;
          }
          if (rememberedCursorCh < 0) {
            rememberedCursorCh = 0;
          }

          if (typeof codeMirror.heightAtLine === "function" && typeof codeMirror.scrollTo === "function") {
            var topPx = codeMirror.heightAtLine(rememberedTopLine, "local");
            codeMirror.scrollTo(null, topPx > 0 ? topPx - 5 : 0);
          } else if (typeof codeMirror.scrollTo === "function") {
            codeMirror.scrollTo(null, rememberedScrollTopPx > 0 ? rememberedScrollTopPx : 0);
          }

          if (typeof codeMirror.setCursor === "function") {
            codeMirror.setCursor({ line: rememberedCursorLine, ch: rememberedCursorCh });
          }
          if (shouldFocus && typeof codeMirror.focus === "function") {
            codeMirror.focus();
          }
          return;
        }

        if (codeNode && typeof codeNode.value === "string") {
          var offset = getTextareaOffsetForLineAndCh(codeNode.value, rememberedCursorLine, rememberedCursorCh);
          try {
            codeNode.selectionStart = offset;
            codeNode.selectionEnd = offset;
          } catch (_ignoreScreenTextareaSelection) {}
          if (typeof codeNode.scrollTop === "number") {
            codeNode.scrollTop = rememberedScrollTopPx > 0 ? rememberedScrollTopPx : 0;
          }
          if (shouldFocus && typeof codeNode.focus === "function") {
            codeNode.focus();
          }
        }
      };

      applyRestore();
      window.setTimeout(applyRestore, 40);
      return true;
    } catch (_ignoreRestoreScreenViewport) {}

    return false;
  }

  function detachScreenViewportBindings(codeMirror) {
    if (!codeMirror) {
      return;
    }

    var handlers = codeMirror.__luaProbeScreenViewportHandlers;
    if (handlers && typeof codeMirror.off === "function") {
      try {
        if (typeof handlers.cursorActivity === "function") {
          codeMirror.off("cursorActivity", handlers.cursorActivity);
        }
      } catch (_ignoreScreenOffCursor) {}
      try {
        if (typeof handlers.scroll === "function") {
          codeMirror.off("scroll", handlers.scroll);
        }
      } catch (_ignoreScreenOffScroll) {}
      try {
        if (typeof handlers.changes === "function") {
          codeMirror.off("changes", handlers.changes);
        }
      } catch (_ignoreScreenOffChanges) {}
    }

    codeMirror.__luaProbeScreenViewportHandlers = null;
    codeMirror.__luaProbeScreenViewportBindingsBound = false;
    codeMirror.__luaProbeScreenViewportOwner = "";
  }

  function rememberActiveScreenViewportIfReady() {
    var context = getScreenEditorContextSnapshot();
    var key = context.contextKey || state.lastScreenContextKey;
    if (!key) {
      return;
    }
    state.lastScreenContextKey = key;
    if (state.screenLastRestoredContextKey !== key && hasRememberedScreenViewportForKey(key)) {
      return;
    }
    rememberScreenEditorViewportForKey(key);
  }

  function ensureScreenViewportBindings() {
    var root = getScreenEditorRoot();
    var codeMirror = getScreenEditorCodeMirror(root);
    if (!codeMirror || typeof codeMirror.on !== "function") {
      if (state.screenViewportBindingsCodeMirror) {
        detachScreenViewportBindings(state.screenViewportBindingsCodeMirror);
        state.screenViewportBindingsCodeMirror = null;
      }
      return;
    }

    if (state.screenViewportBindingsCodeMirror && state.screenViewportBindingsCodeMirror !== codeMirror) {
      detachScreenViewportBindings(state.screenViewportBindingsCodeMirror);
      state.screenViewportBindingsCodeMirror = null;
    }

    var owner = String(codeMirror.__luaProbeScreenViewportOwner || "");
    if ((owner && owner !== dumpId) || (!owner && codeMirror.__luaProbeScreenViewportBindingsBound)) {
      detachScreenViewportBindings(codeMirror);
    }

    if (String(codeMirror.__luaProbeScreenViewportOwner || "") === dumpId && codeMirror.__luaProbeScreenViewportHandlers) {
      state.screenViewportBindingsCodeMirror = codeMirror;
      return;
    }

    var handlers = {};
    handlers.cursorActivity = function () {
      rememberActiveScreenViewportIfReady();
    };
    handlers.scroll = function () {
      rememberActiveScreenViewportIfReady();
    };
    handlers.changes = function () {
      window.setTimeout(function () {
        rememberActiveScreenViewportIfReady();
      }, 0);
    };

    codeMirror.on("cursorActivity", handlers.cursorActivity);
    codeMirror.on("scroll", handlers.scroll);
    codeMirror.on("changes", handlers.changes);

    codeMirror.__luaProbeScreenViewportHandlers = handlers;
    codeMirror.__luaProbeScreenViewportBindingsBound = true;
    codeMirror.__luaProbeScreenViewportOwner = dumpId;
    state.screenViewportBindingsCodeMirror = codeMirror;
  }

  function parseIntegerOrNull(value) {
    var parsed = parseInt(String(value || "").replace(/[^\d-]/g, ""), 10);
    return isNaN(parsed) ? null : parsed;
  }

  function describeScreenEditor() {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    var codeMirror = getScreenEditorCodeMirror(root);
    var isVisible = isElementVisible(root);
    var wrapNode = null;
    var saveNode = null;
    var cancelNode = null;
    var errorCountNode = null;
    var enableLogsNode = null;
    var modeSwitchNode = null;
    var modeInputNode = null;
    var codeNode = getScreenEditorCodeNode(panel, root);
    var code = "";
    var context = getScreenEditorContextSnapshot(root, panel);
    var viewport = null;

    if (!isVisible) {
      return {
        surface: "screen_editor",
        visible: false,
        title: "",
        subTitle: "",
        contextKey: "",
        wrapLines: false,
        canApply: false,
        canCancel: false,
        codeLength: 0,
        isHtmlMode: false,
        mode: "",
        htmlModeAvailable: false,
        enableOutputInLuaChannel: false,
        errorCount: null,
        viewport: null
      };
    }

    if (root && root.querySelector) {
      try {
        wrapNode = root.querySelector(".wrap_line_wrapper .checkbox");
      } catch (_ignoreScreenWrap) {}
      try {
        saveNode = root.querySelector(".footer_line .right_block .save_button");
      } catch (_ignoreScreenSave) {}
      try {
        cancelNode = root.querySelector(".footer_line .right_block .cancel_button");
      } catch (_ignoreScreenCancel) {}
      try {
        errorCountNode = root.querySelector(".editor_error_ctn_value");
      } catch (_ignoreScreenErrorCount) {}
      try {
        enableLogsNode = root.querySelector(".enable_logs_wrapper .checkbox");
      } catch (_ignoreScreenEnableLogs) {}
      try {
        modeSwitchNode = root.querySelector(".mode_switch_wrapper .checkbox_switch");
      } catch (_ignoreScreenModeSwitch) {}
      try {
        modeInputNode = root.querySelector(".mode_switch_wrapper .checkbox_switch input");
      } catch (_ignoreScreenModeInput) {}
    }

    if (!modeInputNode) {
      try {
        if (panel && panel.HTMLNodes && panel.HTMLNodes.isHTMLModeCheckbox) {
          modeInputNode = panel.HTMLNodes.isHTMLModeCheckbox;
        }
      } catch (_ignoreScreenModeCheckbox) {}
    }

    try {
      if (codeMirror && typeof codeMirror.getValue === "function") {
        code = codeMirror.getValue();
      } else if (codeNode && typeof codeNode.value === "string") {
        code = codeNode.value;
      }
    } catch (_ignoreScreenCode) {}

    var isHtmlMode = context.mode === "html";

    var htmlModeAvailable = !!modeInputNode;
    try {
      if (modeSwitchNode && modeSwitchNode.classList && modeSwitchNode.classList.contains("disabled")) {
        htmlModeAvailable = false;
      }
    } catch (_ignoreScreenModeAvailable) {}

    var canApply = !!(saveNode && isElementVisible(saveNode));
    try {
      if (saveNode && saveNode.classList && saveNode.classList.contains("disabled")) {
        canApply = false;
      }
    } catch (_ignoreScreenSaveDisabled) {}
    if (!canApply) {
      canApply = !!(panel && codeNode && window.CPPScreenContentEditor && typeof window.CPPScreenContentEditor.save === "function");
    }

    try {
      if (codeMirror) {
        var scrollInfo = typeof codeMirror.getScrollInfo === "function" ? codeMirror.getScrollInfo() : null;
        var cursor = typeof codeMirror.getCursor === "function" ? codeMirror.getCursor() : null;
        viewport = {
          scrollTopPx: scrollInfo && typeof scrollInfo.top === "number" ? scrollInfo.top : 0,
          topLine: scrollInfo && typeof scrollInfo.top === "number" && typeof codeMirror.lineAtHeight === "function"
            ? codeMirror.lineAtHeight(scrollInfo.top, "local")
            : null,
          cursorLine: cursor && typeof cursor.line === "number" ? cursor.line : null,
          cursorCh: cursor && typeof cursor.ch === "number" ? cursor.ch : null
        };
      } else if (codeNode) {
        var textCursor = getScreenEditorCursorFromTextarea(codeNode);
        viewport = {
          scrollTopPx: typeof codeNode.scrollTop === "number" ? codeNode.scrollTop : 0,
          topLine: textCursor.line,
          cursorLine: textCursor.line,
          cursorCh: textCursor.ch
        };
      }
    } catch (_ignoreScreenViewport) {}

    return {
      surface: "screen_editor",
      visible: true,
      title: context.title,
      subTitle: context.subTitle,
      contextKey: context.contextKey,
      wrapLines: !!(wrapNode && wrapNode.checked),
      canApply: canApply,
      canCancel: !!(cancelNode && isElementVisible(cancelNode)),
      codeLength: code.length,
      isHtmlMode: !!isHtmlMode,
      mode: context.mode,
      htmlModeAvailable: !!htmlModeAvailable,
      enableOutputInLuaChannel: !!(enableLogsNode && enableLogsNode.checked),
      errorCount: parseIntegerOrNull(errorCountNode ? errorCountNode.textContent : ""),
      viewport: viewport
    };
  }

  function setScreenEditorCode(code) {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    var codeMirror = getScreenEditorCodeMirror(root);
    var codeNode = getScreenEditorCodeNode(panel, root);
    var hiddenTextarea = null;
    var text = String(code || "");
    if (root && root.querySelector) {
      try {
        hiddenTextarea = root.querySelector(".textarea_editor");
      } catch (_ignoreScreenHiddenTextarea) {}
    }
    if (!isElementVisible(root)) {
      throw new Error("screen_editor_not_visible");
    }
    if (!codeMirror && !codeNode && !hiddenTextarea) {
      throw new Error("screen_editor_unavailable");
    }
    try {
      if (codeMirror && typeof codeMirror.setValue === "function") {
        codeMirror.setValue(text);
      }
    } catch (_ignoreScreenCodeMirrorSet) {}
    try {
      if (codeNode && typeof codeNode.value === "string") {
        codeNode.value = text;
      }
    } catch (_ignoreScreenCodeNodeSet) {}
    try {
      if (hiddenTextarea && typeof hiddenTextarea.value === "string") {
        hiddenTextarea.value = text;
      }
    } catch (_ignoreScreenHiddenTextareaSet) {}
    try {
      if (panel && typeof panel._onCodeChange === "function") {
        panel._onCodeChange();
      }
    } catch (_ignoreScreenCodeChange) {}
    return describeScreenEditor();
  }

  function applyScreenEditorChanges() {
    var panel = getScreenEditorPanel();
    var root = getScreenEditorRoot();
    var saveNode = null;
    var codeNode = getScreenEditorCodeNode(panel, root);
    if (!isElementVisible(root)) {
      throw new Error("screen_editor_not_visible");
    }
    if (root && root.querySelector) {
      try {
        saveNode = root.querySelector(".footer_line .right_block .save_button");
      } catch (_ignoreScreenSaveButton) {}
    }
    if (saveNode && clickNode(saveNode)) {
      return {
        applied: true,
        usedDomButton: true
      };
    }
    if (!panel || !codeNode || !window.CPPScreenContentEditor || typeof window.CPPScreenContentEditor.save !== "function") {
      throw new Error("apply_unavailable");
    }
    window.CPPScreenContentEditor.save(codeNode.value, !!panel.isInHTMLMode);
    return {
      applied: true,
      usedDomButton: false
    };
  }

  function cancelScreenEditorChanges() {
    var root = getScreenEditorRoot();
    var panel = getScreenEditorPanel();
    var cancelNode = null;
    var closeNode = null;
    function waitForScreenEditorClosedAsync(resultValue) {
      return pollUntilAsync(
        function() {
          var currentRoot = getScreenEditorRoot();
          if (!isElementVisible(currentRoot || root)) {
            return resultValue;
          }
          return null;
        },
        40,
        25,
        function() {
          return new Error("screen_editor_cancel_failed");
        }
      );
    }

    if (!isElementVisible(root)) {
      throw new Error("screen_editor_not_visible");
    }

    if (root && root.querySelector) {
      try {
        cancelNode = root.querySelector(".footer_line .right_block .cancel_button");
      } catch (_ignoreScreenCancelButton) {}
      try {
        closeNode = root.querySelector(".header_block .close_button");
      } catch (_ignoreScreenCloseButton) {}
    }

    if (cancelNode && dispatchMouseSequence(cancelNode)) {
      return waitForScreenEditorClosedAsync({
        cancelled: true,
        usedDomButton: true,
        usedCloseButton: false
      });
    }

    if (closeNode && dispatchMouseSequence(closeNode)) {
      return waitForScreenEditorClosedAsync({
        cancelled: true,
        usedDomButton: false,
        usedCloseButton: true
      });
    }

    try {
      if (panel && typeof panel.close === "function") {
        panel.close();
        return waitForScreenEditorClosedAsync({
          cancelled: true,
          usedDomButton: false,
          usedCloseButton: false,
          usedPanelClose: true
        });
      }
    } catch (_ignoreScreenPanelClose) {}

    throw new Error("screen_editor_cancel_failed");
  }

  function normalizeProbeTargetKind(targetKind) {
    var normalized = String(targetKind || "").trim().toLowerCase();
    if (normalized === "screen_editor") {
      return "screen_editor";
    }
    if (normalized === "hud_chat") {
      return "hud_chat";
    }
    return "lua_editor";
  }

  function describeProbeTarget(targetKind) {
    if (normalizeProbeTargetKind(targetKind) === "screen_editor") {
      return describeScreenEditor();
    }
    var luaSnapshot = describeLuaEditor();
    luaSnapshot.surface = "lua_editor";
    return luaSnapshot;
  }

  function setCodeForProbeTarget(targetKind, code) {
    if (normalizeProbeTargetKind(targetKind) === "screen_editor") {
      return setScreenEditorCode(code);
    }
    return setLuaEditorCode(code);
  }

  function applyChangesForProbeTarget(targetKind) {
    if (normalizeProbeTargetKind(targetKind) === "screen_editor") {
      return applyScreenEditorChanges();
    }
    return applyLuaEditorChanges();
  }

  function cancelChangesForProbeTarget(targetKind) {
    var normalized = normalizeProbeTargetKind(targetKind);
    if (normalized === "screen_editor") {
      return cancelScreenEditorChanges();
    }
    if (normalized === "lua_editor") {
      return cancelLuaEditorChanges();
    }
    throw new Error("unsupported_method_for_target:" + normalized + ":cancel");
  }

  function waitForLuaEditorClosedAsync(root, resultValue, errorCode) {
    return pollUntilAsync(
      function() {
        var currentRoot = getLuaEditorRoot();
        if (!isElementVisible(currentRoot || root)) {
          var out = {};
          var key = null;
          if (resultValue && typeof resultValue === "object") {
            for (key in resultValue) {
              if (Object.prototype.hasOwnProperty.call(resultValue, key)) {
                out[key] = resultValue[key];
              }
            }
          }
          out.editorClosed = true;
          return out;
        }
        return null;
      },
      40,
      25,
      function() {
        return new Error(errorCode || "lua_editor_close_failed");
      }
    );
  }

  function cancelLuaEditorChanges() {
    var root = getLuaEditorRoot();
    if (!isElementVisible(root)) {
      throw new Error("lua_editor_not_visible");
    }
    var cancelNode = null;
    if (root && root.querySelector) {
      try {
        cancelNode = root.querySelector(".btn_bar .lua_editor_cancel_button");
      } catch (_ignore) {}
    }
    if (cancelNode && typeof cancelNode.click === "function") {
      cancelNode.click();
      return waitForLuaEditorClosedAsync(root, {
        cancelled: true
      }, "lua_editor_cancel_failed");
    }
    throw new Error("lua_editor_cancel_button_not_found");
  }

  var MAX_OUTER_HTML_CHARS = 3000000;

  function outerHtmlForTargetSelector(targetKind, rawSelector) {
    var normalizedTarget = normalizeProbeTargetKind(targetKind);
    var sel = String(rawSelector || "").trim();
    if (!sel) {
      sel = normalizedTarget === "screen_editor" ? ".screen_content_editor_panel" : "#filters";
    }
    var root = normalizedTarget === "screen_editor" ? getScreenEditorRoot() : getLuaEditorRoot();
    var el = null;
    try {
      if (root && typeof root.matches === "function" && root.matches(sel)) {
        el = root;
      }
    } catch (_ignoreRootMatch) {}
    try {
      if (!el && root && root.querySelector) {
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
    html = html.replace(/<svg[\s\S]*?<\/svg>/gi, "");
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

  function outerHtmlForSelector(rawSelector) {
    return outerHtmlForTargetSelector("lua_editor", rawSelector);
  }

  function trimChatText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function serializeChatClassList(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    var out = [];
    for (var i = 0; i < value.length && i < 8; i += 1) {
      var text = trimChatText(value[i]);
      if (!text) {
        continue;
      }
      out.push(text);
    }
    return out;
  }

  function readDomChatMessages(limit) {
    return readDomChatMessagesForChannel(limit, null);
  }

  function getChatRoot() {
    return document.querySelector(".main_chat");
  }

  function getChatView() {
    try {
      if (window.chatViewManager) {
        return window.chatViewManager.currentChatView || null;
      }
    } catch (_ignoreChatView) {}
    return null;
  }

  function getSelectedChatChannelData() {
    var currentView = getChatView();
    try {
      if (currentView && currentView._currentSelectedChannelView) {
        return currentView._currentSelectedChannelView.channelData || null;
      }
    } catch (_ignoreSelectedChatChannel) {}
    return null;
  }

  function getSelectedDomChatInfo() {
    var root = getChatRoot();
    var currentView = getChatView();
    var info = {
      channelId: null,
      channelName: null
    };
    var tabNode = null;

    try {
      if (currentView && currentView._currentSelectedChannelView && currentView._currentSelectedChannelView.HTMLNodes) {
        tabNode = currentView._currentSelectedChannelView.HTMLNodes.channelInput || null;
      }
    } catch (_ignoreCurrentTab) {}

    if (!tabNode && root && root.querySelector) {
      tabNode = root.querySelector(".channel_box .channel_btn.active_tab");
    }

    if (tabNode && typeof tabNode.getAttribute === "function") {
      var attrChannelId = trimChatText(tabNode.getAttribute("channel-id") || "");
      if (attrChannelId) {
        info.channelId = attrChannelId;
      }
      var labelNode = tabNode.querySelector ? tabNode.querySelector(".channel_label") : null;
      var tabChannelName = trimChatText(labelNode ? (labelNode.textContent || "") : "");
      if (tabChannelName) {
        info.channelName = tabChannelName;
      }
    }

    if (!info.channelName) {
      try {
        if (currentView && currentView.HTMLNodes && currentView.HTMLNodes.currentChannelLabel) {
          info.channelName = trimChatText(currentView.HTMLNodes.currentChannelLabel.textContent || "") || null;
        }
      } catch (_ignoreCurrentLabel) {}
    }

    if (!info.channelName && root && root.querySelector) {
      var currentChannelLabel = root.querySelector(".current_channel_label");
      info.channelName = trimChatText(currentChannelLabel ? (currentChannelLabel.textContent || "") : "") || null;
    }

    return info;
  }

  function buildChatChannelInfo(channelData, fallbackInfo) {
    var baseInfo = fallbackInfo || {};
    var channelId = null;
    var channelName = null;
    if (channelData && channelData.channelId != null) {
      channelId = trimChatText(String(channelData.channelId));
    }
    if (channelData && channelData.channelName != null) {
      channelName = trimChatText(String(channelData.channelName));
    }
    if (!channelId && baseInfo.channelId != null) {
      channelId = trimChatText(String(baseInfo.channelId));
    }
    if (!channelName && baseInfo.channelName != null) {
      channelName = trimChatText(String(baseInfo.channelName));
    }
    return {
      channelId: channelId || null,
      channelName: channelName || null
    };
  }

  function resolveActiveChatChannel() {
    var selectedChannel = getSelectedChatChannelData();
    var domInfo = getSelectedDomChatInfo();
    var info = buildChatChannelInfo(selectedChannel, domInfo);
    if (selectedChannel) {
      return {
        channel: selectedChannel,
        info: info
      };
    }
    if (info.channelId) {
      var channelFromManager = getChatChannelDataById(info.channelId);
      return {
        channel: channelFromManager,
        info: buildChatChannelInfo(channelFromManager, info)
      };
    }
    return {
      channel: null,
      info: info
    };
  }

  function serializeChatMessage(message, channelInfo) {
    if (!message) {
      return null;
    }

    var info = channelInfo || {};
    var dateValue = null;
    if (typeof message.date === "number" && isFinite(message.date)) {
      dateValue = message.date;
    } else if (typeof message.date === "string" && trimChatText(message.date)) {
      dateValue = trimChatText(message.date);
    }

    return {
      channelId: typeof info.channelId === "string" && info.channelId ? info.channelId : null,
      channelName: typeof info.channelName === "string" && info.channelName ? info.channelName : null,
      fromId: typeof message.fromId === "number" && isFinite(message.fromId) ? message.fromId : null,
      fromName: trimChatText(message.fromName || "") || null,
      text: trimChatText(message.sendText || ""),
      fromMe: !!message.fromMe,
      isAdmin: !!message.isAdmin,
      isCommunityHelper: !!message.isCommunityHelper,
      isNotification: !(typeof message.fromId === "number" && message.fromId > 0),
      date: dateValue,
      className: serializeChatClassList(message.className)
    };
  }

  function readDomChatMessagesForChannel(limit, channelInfo) {
    var size = typeof limit === "number" && limit > 0 ? limit : 20;
    var nodes = document.querySelectorAll(".main_chat .chat_wrapper .message_queue li");
    var start = nodes.length > size ? nodes.length - size : 0;
    var messages = [];
    var info = channelInfo || {};
    var i;
    for (i = start; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || !node.querySelector) {
        continue;
      }
      var nameNode = node.querySelector(".name");
      var messageNode = node.querySelector(".message");
      var text = trimChatText(messageNode ? (messageNode.textContent || "") : node.textContent || "");
      if (!text) {
        continue;
      }
      messages.push({
        channelId: typeof info.channelId === "string" && info.channelId ? info.channelId : null,
        channelName: typeof info.channelName === "string" && info.channelName ? info.channelName : null,
        fromId: null,
        fromName: trimChatText(nameNode ? (nameNode.textContent || "") : "") || null,
        text: text,
        fromMe: !!(nameNode && nameNode.classList && nameNode.classList.contains("user_link")),
        isAdmin: !!(messageNode && messageNode.classList && messageNode.classList.contains("admin")),
        isCommunityHelper: !!(messageNode && messageNode.classList && messageNode.classList.contains("community_helper")),
        isNotification: !(nameNode && trimChatText(nameNode.textContent || "")),
        date: null,
        className: []
      });
    }
    return messages;
  }

  function captureChatSnapshot() {
    var root = getChatRoot();
    var wrapper = root && root.querySelector ? root.querySelector(".chat_wrapper") : null;
    var selectedChannel = null;
    var currentView = getChatView();
    var domInfo = getSelectedDomChatInfo();
    var channelInfo = null;
    var messages = [];
    var source = "dom";
    var limit = 20;
    selectedChannel = getSelectedChatChannelData();
    channelInfo = buildChatChannelInfo(selectedChannel, domInfo);

    if (selectedChannel && Array.isArray(selectedChannel.messageList)) {
      source = "chat_manager";
      var start = selectedChannel.messageList.length > limit ? selectedChannel.messageList.length - limit : 0;
      var i;
      for (i = start; i < selectedChannel.messageList.length; i += 1) {
        var serialized = serializeChatMessage(selectedChannel.messageList[i], channelInfo);
        if (!serialized || !serialized.text) {
          continue;
        }
        messages.push(serialized);
      }
    } else {
      messages = readDomChatMessagesForChannel(limit, channelInfo);
    }

    return {
      visible: isElementVisible(wrapper || root),
      open: !!(currentView && currentView.showState),
      source: source,
      selectedChannelId: channelInfo.channelId,
      selectedChannelName: channelInfo.channelName,
      messageCount: messages.length,
      messages: messages
    };
  }

  function emitChatSnapshot(commandId, snapshot) {
    sendPacket("chat_snapshot", {
      commandId: String(commandId || ""),
      snapshot: snapshot || {}
    });
  }

  function emitChatSendResult(commandId, success, result, errorMessage) {
    sendPacket("chat_send_result", {
      commandId: String(commandId || ""),
      success: !!success,
      result: success ? serializeProbeValue(result, 0) : null,
      error: success ? null : String(errorMessage || "unknown_error")
    });
  }

  function emitChatChannelResult(commandId, success, result, errorMessage) {
    sendPacket("chat_channel_result", {
      commandId: String(commandId || ""),
      success: !!success,
      result: success ? serializeProbeValue(result, 0) : null,
      error: success ? null : String(errorMessage || "unknown_error")
    });
  }

  function getChatManagerSafe() {
    try {
      if (typeof chatManager !== "undefined" && chatManager) {
        return chatManager;
      }
    } catch (_ignoreChatManagerGlobal) {}
    try {
      return window.chatManager || null;
    } catch (_ignoreChatManager) {}
    return null;
  }

  function getChatChannelDataById(channelId) {
    var normalizedId = trimChatText(channelId || "");
    if (!normalizedId) {
      return null;
    }
    var manager = getChatManagerSafe();
    if (!manager || typeof manager.getChannelData !== "function") {
      return null;
    }
    try {
      return manager.getChannelData(normalizedId) || null;
    } catch (_ignoreGetChannel) {}
    return null;
  }

  function getChatMessageInputNode() {
    var root = getChatRoot();
    if (root && root.querySelector) {
      var input = root.querySelector(".input_message");
      if (input) {
        return input;
      }
    }
    return document.querySelector(".main_chat .input_message");
  }

  function getChatSendButtonNode() {
    var root = getChatRoot();
    if (root && root.querySelector) {
      var button = root.querySelector(".buttons_chat_send_message");
      if (button) {
        return button;
      }
    }
    return document.querySelector(".main_chat .buttons_chat_send_message");
  }

  function setTextInputValue(node, value) {
    if (!node) {
      return false;
    }
    try {
      var proto = Object.getPrototypeOf(node);
      var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
      if (descriptor && typeof descriptor.set === "function") {
        descriptor.set.call(node, String(value == null ? "" : value));
      } else {
        node.value = String(value == null ? "" : value);
      }
      return true;
    } catch (_ignoreSetValue) {}
    try {
      node.value = String(value == null ? "" : value);
      return true;
    } catch (_ignoreDirectValue) {}
    return false;
  }

  function dispatchBasicDomEvent(node, type) {
    if (!node) {
      return false;
    }
    try {
      var eventObject = document.createEvent("Event");
      eventObject.initEvent(String(type || ""), true, true);
      return !!node.dispatchEvent(eventObject);
    } catch (_ignoreBasicEvent) {}
    return false;
  }

  function clickDomNodeCompat(node) {
    if (!node) {
      return false;
    }
    if (clickNode(node)) {
      return true;
    }
    try {
      var mouseEvent = document.createEvent("MouseEvents");
      mouseEvent.initMouseEvent("click", true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
      return !!node.dispatchEvent(mouseEvent);
    } catch (_ignoreMouseEvent) {}
    return false;
  }

  function dispatchMouseSequence(node) {
    if (!node) {
      return false;
    }
    dispatchMouse("mouseenter", node);
    dispatchMouse("mouseover", node);
    dispatchMouse("mousemove", node);
    dispatchMouse("mousedown", node);
    dispatchMouse("mouseup", node);
    return clickDomNodeCompat(node);
  }

  function pushUniqueNode(nodes, node) {
    if (!node) {
      return;
    }
    if (nodes.indexOf(node) >= 0) {
      return;
    }
    nodes.push(node);
  }

  function getChatTabActivationTargets(tab) {
    var nodes = [];
    if (!tab) {
      return nodes;
    }
    pushUniqueNode(nodes, tab);
    if (tab.querySelector) {
      pushUniqueNode(nodes, tab.querySelector(".channel_label"));
      pushUniqueNode(nodes, tab.querySelector(".channel_name"));
      pushUniqueNode(nodes, tab.querySelector(".channel_input"));
      pushUniqueNode(nodes, tab.querySelector("input"));
      pushUniqueNode(nodes, tab.querySelector("span"));
      pushUniqueNode(nodes, tab.querySelector("svg"));
      pushUniqueNode(nodes, tab.querySelector("use"));
    }
    if (tab.children && tab.children.length) {
      for (var i = 0; i < tab.children.length; i += 1) {
        pushUniqueNode(nodes, tab.children[i]);
      }
    }
    return nodes;
  }

  function activateDomChatTab(tab) {
    var targets = getChatTabActivationTargets(tab);
    var activated = false;
    for (var i = 0; i < targets.length; i += 1) {
      activated = dispatchMouseSequence(targets[i]) || activated;
    }
    return activated;
  }

  function waitForChatChannelAvailableAsync(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    return pollUntilAsync(
      function() {
        return getChatChannelDataById(targetChannelId) || findDomChatTabByChannelId(targetChannelId);
      },
      200,
      25,
      function() {
        return new Error("chat_channel_available_timeout:" + targetChannelId);
      }
    );
  }

  function parseJoinChannelCommand(rawMessage) {
    var message = String(rawMessage == null ? "" : rawMessage);
    var match = /^\s*\/join\s+([A-Za-z0-9+_-]{3,10})\s*$/i.exec(message);
    if (!match) {
      return null;
    }
    var channelName = validateCustomChannelName(match[1]);
    return {
      channelName: channelName,
      expectedChannelId: buildCustomChannelId(channelName)
    };
  }

  function submitChatMessageThroughUiAsync(message) {
    var input = getChatMessageInputNode();
    var sendButton = getChatSendButtonNode();
    if (!input || !sendButton || !isElementVisible(input) || !isElementVisible(sendButton)) {
      return Promise.resolve(false);
    }

    try {
      input.focus();
    } catch (_ignoreChatInputFocus) {}

    if (!setTextInputValue(input, message)) {
      return Promise.resolve(false);
    }

    dispatchBasicDomEvent(input, "input");
    dispatchBasicDomEvent(input, "change");

    if (!clickDomNodeCompat(sendButton)) {
      return Promise.resolve(false);
    }

    return new Promise(function(resolve) {
      var attempts = 0;
      var maxAttempts = 40;
      function checkCleared() {
        if (trimChatText(input.value || "") === "") {
          resolve(true);
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          resolve(false);
          return;
        }
        window.setTimeout(checkCleared, 25);
      }
      checkCleared();
    });
  }

  function buildCustomChannelId(channelName) {
    return "room_" + String(channelName || "").toLowerCase();
  }

  function validateCustomChannelName(rawName) {
    var name = trimChatText(rawName || "");
    if (!/^[A-Za-z0-9+_-]{3,10}$/.test(name)) {
      throw new Error("chat_channel_invalid_name");
    }
    return name;
  }

  function findDomChatTabByChannelId(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    if (!targetChannelId) {
      return null;
    }
    var tabs = document.querySelectorAll(".main_chat .channel_box .channel_btn");
    var i;
    for (i = 0; i < tabs.length; i += 1) {
      var tab = tabs[i];
      if (!tab || typeof tab.getAttribute !== "function") {
        continue;
      }
      if (trimChatText(tab.getAttribute("channel-id") || "") === targetChannelId) {
        return tab;
      }
    }
    return null;
  }

  function waitForSelectedChatChannelAsync(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    return pollUntilAsync(
      function() {
        var selected = getSelectedChatChannelData();
        if (selected && String(selected.channelId || "") === targetChannelId) {
          return selected;
        }
        var domInfo = getSelectedDomChatInfo();
        if (domInfo.channelId === targetChannelId) {
          return getChatChannelDataById(targetChannelId) || {
            channelId: targetChannelId,
            channelName: domInfo.channelName
          };
        }
        return null;
      },
      160,
      25,
      function() {
        return new Error("chat_select_timeout:" + targetChannelId);
      }
    );
  }

  function selectChatChannelById(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    if (!targetChannelId) {
      throw new Error("chat_select_missing_channel");
    }
    var active = resolveActiveChatChannel();
    if (active.info.channelId === targetChannelId) {
      return Promise.resolve(active.channel || {
        channelId: active.info.channelId,
        channelName: active.info.channelName
      });
    }
    var currentView = getChatView();
    var canUseCurrentView = !!(currentView && typeof currentView.selectChannel === "function");
    var domTab = findDomChatTabByChannelId(targetChannelId);
    if (!canUseCurrentView && !domTab) {
      throw new Error("chat_select_unavailable");
    }
    function triggerCurrentViewSelect() {
      if (!canUseCurrentView) {
        return false;
      }
      try {
        currentView.selectChannel(targetChannelId);
        return true;
      } catch (_ignoreSelectChannel) {}
      return false;
    }
    function triggerDomSelect(tab) {
      if (!tab) {
        return false;
      }
      return activateDomChatTab(tab);
    }

    var triggered = false;
    if (domTab) {
      triggered = triggerDomSelect(domTab);
    }
    if (!triggered && canUseCurrentView) {
      triggered = triggerCurrentViewSelect();
    }
    if (!triggered) {
      throw new Error("chat_select_click_failed:" + targetChannelId);
    }

    return waitForSelectedChatChannelAsync(targetChannelId)
      .catch(function(_firstError) {
        var refreshedTab = findDomChatTabByChannelId(targetChannelId) || domTab;
        if (refreshedTab && triggerDomSelect(refreshedTab)) {
          return waitForSelectedChatChannelAsync(targetChannelId);
        }
        throw _firstError;
      })
      .catch(function(_secondError) {
        if (!canUseCurrentView) {
          throw _secondError;
        }
        triggerCurrentViewSelect();
        return waitForSelectedChatChannelAsync(targetChannelId);
      });
  }

  function ensureChatChannelSelected(channelId) {
    var targetChannelId = trimChatText(channelId || "");
    if (!targetChannelId) {
      throw new Error("chat_send_missing_channel");
    }
    var active = resolveActiveChatChannel();
    if (active.info.channelId === targetChannelId) {
      return Promise.resolve(active.channel || {
        channelId: active.info.channelId,
        channelName: active.info.channelName
      });
    }
    var channel = getChatChannelDataById(targetChannelId);
    if (!channel) {
      throw new Error("chat_channel_not_found:" + targetChannelId);
    }
    return selectChatChannelById(targetChannelId);
  }

  function selectExistingChatChannel(rawChannelId) {
    var targetChannelId = trimChatText(rawChannelId || "");
    if (!targetChannelId) {
      throw new Error("chat_select_missing_channel");
    }
    return ensureChatChannelSelected(targetChannelId).then(function(selectedChannel) {
      var info = buildChatChannelInfo(selectedChannel, {
        channelId: targetChannelId,
        channelName: null
      });
      return {
        requestedChannelName: info.channelName,
        expectedChannelId: targetChannelId,
        existed: true,
        selected: true,
        channelId: info.channelId,
        channelName: info.channelName
      };
    });
  }

  function sendChatMessage(rawMessage, rawChannelId) {
    var message = String(rawMessage == null ? "" : rawMessage);
    if (!trimChatText(message)) {
      throw new Error("chat_send_empty_message");
    }

    var targetChannelId = trimChatText(rawChannelId || "");
    return Promise.resolve()
      .then(function() {
        if (targetChannelId) {
          return ensureChatChannelSelected(targetChannelId);
        }
        var active = resolveActiveChatChannel();
        if (!active.info.channelId) {
          throw new Error("chat_send_no_selected_channel");
        }
        return active.channel || {
          channelId: active.info.channelId,
          channelName: active.info.channelName
        };
      })
      .then(function(selectedChannel) {
        var resolvedChannelId = trimChatText(selectedChannel && selectedChannel.channelId != null ? String(selectedChannel.channelId) : targetChannelId);
        if (!resolvedChannelId) {
          throw new Error("chat_send_no_selected_channel");
        }
        var info = buildChatChannelInfo(selectedChannel, {
          channelId: resolvedChannelId,
          channelName: null
        });
        var joinCommand = parseJoinChannelCommand(message);
        return submitChatMessageThroughUiAsync(message).then(function(sentViaUi) {
          if (!sentViaUi) {
            var manager = getChatManagerSafe();
            if (!manager || typeof manager.sendMessageToCPP !== "function") {
              throw new Error("chat_send_unavailable");
            }
            manager.sendMessageToCPP(resolvedChannelId, message);
          }
          var result = {
            sent: true,
            channelId: info.channelId,
            channelName: info.channelName,
            message: message,
            usedExplicitChannel: !!targetChannelId
          };
          if (!joinCommand) {
            return result;
          }
          return waitForChatChannelAvailableAsync(joinCommand.expectedChannelId)
            .then(function() {
              return selectChatChannelById(joinCommand.expectedChannelId);
            })
            .then(function(joinedChannel) {
              var joinedInfo = buildChatChannelInfo(joinedChannel, {
                channelId: joinCommand.expectedChannelId,
                channelName: joinCommand.channelName
              });
              result.channelId = joinedInfo.channelId;
              result.channelName = joinedInfo.channelName;
              return result;
            });
        });
      });
  }

  function createOrJoinChatChannel(rawChannelName) {
    var manager = getChatManagerSafe();
    if (!manager || typeof manager.getChannelData !== "function") {
      throw new Error("chat_channel_manager_unavailable");
    }
    var channelName = validateCustomChannelName(rawChannelName);
    var expectedChannelId = buildCustomChannelId(channelName);
    var existingChannel = getChatChannelDataById(expectedChannelId);
    if (existingChannel) {
      return selectChatChannelById(expectedChannelId).then(function(selectedChannel) {
        var info = buildChatChannelInfo(selectedChannel || existingChannel, {
          channelId: expectedChannelId,
          channelName: channelName
        });
        return {
          requestedChannelName: channelName,
          expectedChannelId: expectedChannelId,
          existed: true,
          selected: true,
          channelId: info.channelId,
          channelName: info.channelName
        };
      });
    }

    var active = resolveActiveChatChannel();
    if (!active.info.channelId) {
      throw new Error("chat_channel_no_selected_channel");
    }

    return sendChatMessage("/join " + channelName, String(active.info.channelId))
      .then(function() {
        return pollUntilAsync(
          function() {
            return getChatChannelDataById(expectedChannelId);
          },
          120,
          50,
          function() {
            return new Error("chat_channel_join_timeout:" + expectedChannelId);
          }
        );
      })
      .then(function() {
        return selectChatChannelById(expectedChannelId);
      })
      .then(function(selectedChannel) {
        var info = buildChatChannelInfo(selectedChannel, {
          channelId: expectedChannelId,
          channelName: channelName
        });
        return {
          requestedChannelName: channelName,
          expectedChannelId: expectedChannelId,
          existed: false,
          selected: true,
          channelId: info.channelId,
          channelName: info.channelName
        };
      });
  }

  function runRawProbeEval(source) {
    var src = String(source || "").trim();
    if (!src) {
      throw new Error("raw_eval_empty");
    }
    var st = window.__UI_TOOLBOX_LUA_PROBE_STATE__;
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

  function emitMcpResult(commandId, method, success, result, errorMessage, targetKind) {
    var payload = {
      commandId: String(commandId || ""),
      method: String(method || ""),
      success: !!success,
      result: success ? serializeProbeValue(result, 0) : null,
      error: success ? null : String(errorMessage || "unknown_error"),
      targetKind: normalizeProbeTargetKind(targetKind)
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

  function emitCommandResultForMethod(commandId, targetKind, method, success, result, errorMessage) {
    if (method === "chat_snapshot") {
      if (success) {
        emitChatSnapshot(commandId, result);
      }
      return;
    }
    if (method === "chat_send") {
      emitChatSendResult(commandId, success, result, errorMessage);
      emitMcpResult(commandId, method, success, result, errorMessage, targetKind);
      return;
    }
    if (method === "chat_join_channel" || method === "chat_select_channel") {
      emitChatChannelResult(commandId, success, result, errorMessage);
      emitMcpResult(commandId, method, success, result, errorMessage, targetKind);
      return;
    }
    emitMcpResult(commandId, method, success, result, errorMessage, targetKind);
  }

  function invokeMcpCommandForTarget(commandId, targetKind, method, args) {
    var normalizedTarget = normalizeProbeTargetKind(targetKind);
    var normalizedMethod = String(method || "").trim().toLowerCase();
    var listArgs = Array.isArray(args) ? args : [];

    try {
      var result = null;
      if (normalizedMethod === "describe") {
        if (normalizedTarget === "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = describeProbeTarget(normalizedTarget);
      } else if (normalizedMethod === "chat_snapshot") {
        if (normalizedTarget !== "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = captureChatSnapshot();
      } else if (normalizedMethod === "chat_send") {
        if (normalizedTarget !== "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = sendChatMessage(listArgs[0], listArgs[1]);
      } else if (normalizedMethod === "chat_join_channel") {
        if (normalizedTarget !== "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = createOrJoinChatChannel(listArgs[0]);
      } else if (normalizedMethod === "chat_select_channel") {
        if (normalizedTarget !== "hud_chat") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectExistingChatChannel(listArgs[0]);
      } else if (normalizedMethod === "select_slot") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectSlotByName(listArgs[0]);
      } else if (normalizedMethod === "select_filter") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectFilterByEvent(listArgs[0]);
      } else if (normalizedMethod === "select_context") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectLuaEditorContext(listArgs[0], listArgs[1], listArgs[2]);
      } else if (normalizedMethod === "select_filter_index") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = selectFilterByIndex(listArgs[0]);
      } else if (normalizedMethod === "list_filters") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = listLuaEditorFilters();
      } else if (normalizedMethod === "set_code") {
        result = setCodeForProbeTarget(normalizedTarget, listArgs[0]);
      } else if (normalizedMethod === "apply") {
        result = applyChangesForProbeTarget(normalizedTarget);
      } else if (normalizedMethod === "cancel") {
        result = cancelChangesForProbeTarget(normalizedTarget);
      } else if (normalizedMethod === "add_filter") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        result = addFilterByEventName(listArgs[0]);
      } else if (normalizedMethod === "outer_html") {
        result = outerHtmlForTargetSelector(normalizedTarget, listArgs[0]);
      } else if (normalizedMethod === "raw_eval") {
        result = runRawProbeEval(listArgs[0]);
      } else if (normalizedMethod === "close_runtime_ui") {
        if (normalizedTarget !== "lua_editor") {
          throw new Error("unsupported_method_for_target:" + normalizedTarget + ":" + normalizedMethod);
        }
        if (!state.closeRuntimeModuleUi || typeof state.closeRuntimeModuleUi !== "function") {
          throw new Error("runtime_module_ui_close_unavailable");
        }
        result = state.closeRuntimeModuleUi(listArgs[0], listArgs[1] || "mcp-close-runtime-ui");
      } else {
        throw new Error("unsupported_method:" + normalizedMethod);
      }

      if (isPromiseLike(result)) {
        result.then(function(asyncResult) {
          emitCommandResultForMethod(commandId, normalizedTarget, normalizedMethod, true, asyncResult, null);
        }).catch(function(asyncErr) {
          var asyncMessage = String(asyncErr && asyncErr.message ? asyncErr.message : asyncErr);
          emitCommandResultForMethod(commandId, normalizedTarget, normalizedMethod, false, null, asyncMessage);
        });
        return null;
      }

      emitCommandResultForMethod(commandId, normalizedTarget, normalizedMethod, true, result, null);
      return result;
    } catch (err) {
      var message = String(err && err.message ? err.message : err);
      emitCommandResultForMethod(commandId, normalizedTarget, normalizedMethod, false, null, message);
      throw err;
    }
  }

  function invokeMcpCommand(commandId, method, args) {
    return invokeMcpCommandForTarget(commandId, "lua_editor", method, args);
  }

  state.describeLuaEditor = describeLuaEditor;
  state.describeScreenEditor = describeScreenEditor;
  state.getScreenEditorContextSnapshot = getScreenEditorContextSnapshot;
  state.selectSlotByName = selectSlotByName;
  state.selectFilterByEvent = selectFilterByEvent;
  state.selectLuaEditorContext = selectLuaEditorContext;
  state.selectFilterByIndex = selectFilterByIndex;
  state.listLuaEditorFilters = listLuaEditorFilters;
  state.setLuaEditorCode = setLuaEditorCode;
  state.setScreenEditorCode = setScreenEditorCode;
  state.applyLuaEditorChanges = applyLuaEditorChanges;
  state.applyScreenEditorChanges = applyScreenEditorChanges;
  state.hasRememberedScreenViewportForKey = hasRememberedScreenViewportForKey;
  state.rememberScreenEditorViewportForKey = rememberScreenEditorViewportForKey;
  state.restoreScreenEditorViewportForKey = restoreScreenEditorViewportForKey;
  state.detachScreenViewportBindings = detachScreenViewportBindings;
  state.ensureScreenViewportBindings = ensureScreenViewportBindings;
  state.addFilterByEventName = addFilterByEventName;
  state.captureChatSnapshot = captureChatSnapshot;
  state.sendChatMessage = sendChatMessage;
  state.createOrJoinChatChannel = createOrJoinChatChannel;
  state.outerHtmlForSelector = outerHtmlForSelector;
  state.runRawProbeEval = runRawProbeEval;
  state.invokeMcpCommandForTarget = invokeMcpCommandForTarget;
  state.invokeMcpCommand = invokeMcpCommand;
  state.mcp = {
    invokeForTarget: invokeMcpCommandForTarget,
    invoke: invokeMcpCommand,
    describeLuaEditor: describeLuaEditor,
    describeScreenEditor: describeScreenEditor,
    selectSlotByName: selectSlotByName,
    selectFilterByEvent: selectFilterByEvent,
    selectContext: selectLuaEditorContext,
    selectFilterByIndex: selectFilterByIndex,
    listFilters: listLuaEditorFilters,
    setCode: setLuaEditorCode,
    setScreenCode: setScreenEditorCode,
    apply: applyLuaEditorChanges,
    applyScreen: applyScreenEditorChanges,
    addFilter: addFilterByEventName,
    chatSnapshot: captureChatSnapshot,
    chatSend: sendChatMessage,
    chatJoinChannel: createOrJoinChatChannel,
    outerHtml: outerHtmlForSelector,
    rawEval: runRawProbeEval,
    closeRuntimeUi: function (moduleId, reason) {
      if (!state.closeRuntimeModuleUi || typeof state.closeRuntimeModuleUi !== "function") {
        throw new Error("runtime_module_ui_close_unavailable");
      }
      return state.closeRuntimeModuleUi(moduleId, reason || "mcp-direct-close-runtime-ui");
    }
  };
