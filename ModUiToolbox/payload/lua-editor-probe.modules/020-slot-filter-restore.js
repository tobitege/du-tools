  function getSlotStableKey(slotNode) {
    if (!slotNode) {
      return "";
    }
    var parts = [];
    try {
      var id = slotNode.getAttribute ? String(slotNode.getAttribute("id") || "") : "";
      if (id) {
        parts.push("id=" + limitText(id, 48));
      }
    } catch (_ignoreSlotId) {}
    try {
      var dataValue = slotNode.getAttribute ? String(
        slotNode.getAttribute("data-slot") ||
        slotNode.getAttribute("data-name") ||
        slotNode.getAttribute("data-index") ||
        ""
      ) : "";
      if (dataValue) {
        parts.push("data=" + limitText(dataValue, 48));
      }
    } catch (_ignoreSlotData) {}
    try {
      if (slotNode.parentNode && slotNode.parentNode.children) {
        var idx = Array.prototype.indexOf.call(slotNode.parentNode.children, slotNode);
        if (idx >= 0) {
          parts.push("idx=" + idx);
        }
      }
    } catch (_ignoreSlotIdx) {}
    return parts.join("|");
  }

  function normalizeProbeText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function getVisibleFilterNodes() {
    var root = document.getElementById("filters_container");
    if (!root || !root.querySelectorAll) {
      return [];
    }

    var nodes = root.querySelectorAll(".filter");
    var out = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || !node.classList) {
        continue;
      }
      if (node.classList.contains("filterTemplate")) {
        continue;
      }
      try {
        var computed = window.getComputedStyle ? window.getComputedStyle(node, null) : null;
        if (computed && computed.display === "none") {
          continue;
        }
      } catch (_ignoreComputed) {}
      out.push(node);
    }
    return out;
  }

  function getFilterActionText(filterNode) {
    if (!filterNode || !filterNode.querySelector) {
      return "";
    }
    return textOf(filterNode.querySelector(".actionName"));
  }

  function getFilterArgumentDisplayValues(filterNode) {
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
        var displayValue = String(rawValue || "").replace(/\s+/g, " ").trim();
        if (displayValue) {
          args.push(displayValue);
        }
      }
    } catch (_ignoreDisplayInputs) {}

    return args;
  }

  function getFilterDisplaySignature(filterNode) {
    if (!filterNode) {
      return "";
    }

    var actionName = String(getFilterActionText(filterNode) || "").replace(/\s+/g, " ").trim();
    if (!actionName) {
      return "";
    }

    var args = getFilterArgumentDisplayValues(filterNode);
    return actionName + "(" + args.join(", ") + ")";
  }

  function getFilterSignature(filterNode) {
    if (!filterNode) {
      return "";
    }

    var actionName = normalizeProbeText(getFilterActionText(filterNode));
    var displayArgs = getFilterArgumentDisplayValues(filterNode);
    var args = [];
    for (var i = 0; i < displayArgs.length; i += 1) {
      var normalized = normalizeProbeText(displayArgs[i]);
      if (normalized) {
        args.push(normalized);
      }
    }

    return actionName + "|" + args.join("|");
  }

  function clearActiveFilterMarker() {
    var nodes = getVisibleFilterNodes();
    for (var i = 0; i < nodes.length; i += 1) {
      try {
        nodes[i].removeAttribute("data-lua-probe-active-filter");
      } catch (_ignoreAttr) {}
    }
  }

  function getResolvedActiveFilterNode() {
    var selectedNode = findDomSelectedFilterNode();
    if (selectedNode) {
      return selectedNode;
    }
    return findFilterNodeByHints(getManagerFilterHints());
  }

  function getResolvedActiveFilterDisplaySignature() {
    var filterNode = getResolvedActiveFilterNode();
    if (!filterNode) {
      return "";
    }
    return getFilterDisplaySignature(filterNode);
  }

  function setActiveFilterMarker(filterNode) {
    var nodes = getVisibleFilterNodes();
    var activeIndex = -1;
    var found = false;

    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var isActive = node === filterNode;
      if (isActive) {
        activeIndex = i;
        found = true;
      }
      try {
        if (isActive) {
          node.setAttribute("data-lua-probe-active-filter", "1");
        } else {
          node.removeAttribute("data-lua-probe-active-filter");
        }
      } catch (_ignoreSetAttr) {}
    }

    if (found) {
      state.activeFilterIndex = activeIndex;
      state.activeFilterFingerprint = getFilterSignature(filterNode);
    } else {
      state.activeFilterIndex = -1;
      state.activeFilterFingerprint = "";
    }
  }

  function getManagerFilterHints() {
    var manager = window.LUAEditorManager;
    if (!manager || !manager.currentData || typeof manager.currentData !== "object") {
      return [];
    }

    var data = manager.currentData;
    var keys = ["filterName", "filter", "actionName", "action", "eventName", "event", "filterId", "eventId"];
    var hints = [];

    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var value = data[key];
      if (value === null || typeof value === "undefined") {
        continue;
      }
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        continue;
      }
      var normalized = normalizeProbeText(String(value));
      if (!normalized) {
        continue;
      }

      var alreadyPresent = false;
      for (var j = 0; j < hints.length; j += 1) {
        if (hints[j] === normalized) {
          alreadyPresent = true;
          break;
        }
      }
      if (!alreadyPresent) {
        hints.push(normalized);
      }
    }

    return hints;
  }

  function findDomSelectedFilterNode() {
    var visibleNodes = getVisibleFilterNodes();
    for (var i = 0; i < visibleNodes.length; i += 1) {
      var visibleNode = visibleNodes[i];
      if (!visibleNode || !visibleNode.classList) {
        continue;
      }
      if (visibleNode.classList.contains("selected") ||
          visibleNode.classList.contains("active") ||
          visibleNode.classList.contains("current") ||
          visibleNode.classList.contains("focus")) {
        return visibleNode;
      }
      try {
        if (visibleNode.getAttribute("data-selected") === "true" ||
            visibleNode.getAttribute("aria-selected") === "true") {
          return visibleNode;
        }
      } catch (_ignoreVisibleAttr) {}
    }

    var selectors = [
      "#filters_container .filter.selected",
      "#filters_container .filter.active",
      "#filters_container .filter.current",
      "#filters_container .filter.focus",
      "#filters_container .filter[data-selected=\"true\"]",
      "#filters_container .filter[aria-selected=\"true\"]"
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var node = document.querySelector(selectors[i]);
        if (node && node.classList && !node.classList.contains("filterTemplate")) {
          try {
            var computed = window.getComputedStyle ? window.getComputedStyle(node, null) : null;
            if (computed && (computed.display === "none" || computed.visibility === "hidden")) {
              continue;
            }
          } catch (_ignoreNodeComputed) {}
          return node;
        }
      } catch (_ignoreSelector) {}
    }
    return null;
  }

  function findFilterNodeByHints(hints) {
    if (!hints || hints.length <= 0) {
      return null;
    }

    var nodes = getVisibleFilterNodes();
    if (nodes.length <= 0) {
      return null;
    }

    for (var i = 0; i < nodes.length; i += 1) {
      var actionText = normalizeProbeText(getFilterActionText(nodes[i]));
      if (!actionText) {
        continue;
      }
      for (var j = 0; j < hints.length; j += 1) {
        if (actionText === hints[j]) {
          return nodes[i];
        }
      }
    }

    for (var k = 0; k < nodes.length; k += 1) {
      var rowText = normalizeProbeText(textOf(nodes[k]));
      if (!rowText) {
        continue;
      }
      for (var h = 0; h < hints.length; h += 1) {
        if (rowText.indexOf(hints[h]) >= 0) {
          return nodes[k];
        }
      }
    }

    return null;
  }

  function refreshActiveFilterMarker() {
    var selectedNode = findDomSelectedFilterNode();
    if (selectedNode) {
      setActiveFilterMarker(selectedNode);
      return;
    }

    var hintedNode = findFilterNodeByHints(getManagerFilterHints());
    if (hintedNode) {
      setActiveFilterMarker(hintedNode);
      return;
    }

    var nodes = getVisibleFilterNodes();
    if (nodes.length <= 0) {
      state.activeFilterIndex = -1;
      state.activeFilterFingerprint = "";
      return;
    }

    if (state.activeFilterFingerprint) {
      for (var i = 0; i < nodes.length; i += 1) {
        if (getFilterSignature(nodes[i]) === state.activeFilterFingerprint) {
          setActiveFilterMarker(nodes[i]);
          return;
        }
      }
    }

    if (state.activeFilterIndex >= 0 && state.activeFilterIndex < nodes.length) {
      setActiveFilterMarker(nodes[state.activeFilterIndex]);
      return;
    }

    clearActiveFilterMarker();
  }

  function getEditorContextKey(codeMirror) {
    var managerKey = getManagerContextKey();
    if (managerKey) {
      return managerKey;
    }

    var domKey = getDomContextKey();
    if (domKey) {
      return domKey;
    }

    if (codeMirror) {
      try {
        var lineCount = typeof codeMirror.lineCount === "function" ? codeMirror.lineCount() : 0;
        var firstLine = lineCount > 0 && typeof codeMirror.getLine === "function" ? codeMirror.getLine(0) : "";
        return "code:" + lineCount + ":" + limitText(firstLine, 64);
      } catch (_ignore) {}
    }

    return "";
  }

  function syncCurrentContextKey(forceDuringSwitch) {
    if (!forceDuringSwitch && state.switchInProgress) {
      return;
    }
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }
    var snippetKey = getSnippetMemoryKeyFromEditor(codeMirror);
    if (snippetKey) {
      state.currentSnippetKey = snippetKey;
    }
    var key = getEditorContextKey(codeMirror);
    if (key) {
      state.lastContextKey = key;
    }
  }

  function rememberTopLineForKey(keyHint) {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror || typeof codeMirror.getScrollInfo !== "function") {
      return;
    }

    var key = keyHint || getEditorContextKey(codeMirror) || state.lastContextKey || "default";
    state.lastContextKey = key;

    try {
      var scrollInfo = codeMirror.getScrollInfo();
      var topPx = scrollInfo && typeof scrollInfo.top === "number" ? scrollInfo.top : 0;
      var topLine = 0;
      var hasTopLine = false;
      var cursorLine = 0;
      var cursorCh = 0;
      var hadFocus = false;

      if (typeof codeMirror.lineAtHeight === "function") {
        topLine = codeMirror.lineAtHeight(topPx, "local");
        hasTopLine = typeof topLine === "number" && topLine >= 0;
      }

      if (typeof codeMirror.getCursor === "function") {
        var cursor = codeMirror.getCursor();
        if (cursor && typeof cursor.line === "number") {
          cursorLine = cursor.line;
        }
        if (cursor && typeof cursor.ch === "number") {
          cursorCh = cursor.ch;
        }
        if (!hasTopLine) {
          topLine = cursorLine;
        }
      }

      if (typeof codeMirror.hasFocus === "function") {
        hadFocus = codeMirror.hasFocus();
      }

      if (typeof topLine === "number" && topLine >= 0) {
        state.scrollTopByContext[key] = {
          topLine: topLine,
          cursorLine: cursorLine,
          cursorCh: cursorCh,
          hadFocus: hadFocus
        };
      }
    } catch (_ignore) {}
  }

  function hasRememberedTopLineForKey(key) {
    if (!key) {
      return false;
    }
    var remembered = state.scrollTopByContext[key];
    if (typeof remembered === "number") {
      return remembered >= 0;
    }
    return !!(remembered && typeof remembered === "object" && typeof remembered.topLine === "number" && remembered.topLine >= 0);
  }

  function restoreTopLineForCurrentKey(keyHint) {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return false;
    }

    var key = keyHint || getEditorContextKey(codeMirror) || state.lastContextKey;
    if (!key) {
      return false;
    }
    state.lastContextKey = key;

    var remembered = state.scrollTopByContext[key];
    var rememberedTopLine = -1;
    var rememberedCursorLine = -1;
    var rememberedCursorCh = 0;
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
      shouldFocus = !!remembered.hadFocus;
    }

    if (typeof rememberedTopLine !== "number" || rememberedTopLine < 0) {
      return false;
    }

    try {
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

      var performScroll = function() {
        if (typeof codeMirror.heightAtLine === "function" && typeof codeMirror.scrollTo === "function") {
          var topPx = codeMirror.heightAtLine(rememberedTopLine, "local");
          // Add small vertical offset buffer so top line isn't exactly at 0px
          codeMirror.scrollTo(null, topPx > 0 ? topPx - 5 : 0);
        }

        var allowCursorRestore = shouldFocus;
        if (!allowCursorRestore && typeof codeMirror.hasFocus === "function") {
          allowCursorRestore = codeMirror.hasFocus();
        }

        if (allowCursorRestore && typeof codeMirror.setCursor === "function") {
          codeMirror.setCursor({ line: rememberedCursorLine, ch: rememberedCursorCh });
        }
        if (shouldFocus && typeof codeMirror.focus === "function") {
          codeMirror.focus();
        }
      };

      // Single apply here; switch lifecycle settles before restore runs.
      performScroll();

    } catch (_ignore) {}

    if (state.caretHighlightEnabled) {
      window.setTimeout(function () {
        updateCaretLineHighlight();
      }, 0);
    }
    return true;
  }

  function resetEditorViewportToTop() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }

    try {
      if (typeof codeMirror.setCursor === "function") {
        codeMirror.setCursor({ line: 0, ch: 0 });
      }
    } catch (_ignoreCursorTop) {}

    try {
      if (typeof codeMirror.scrollTo === "function") {
        codeMirror.scrollTo(0, 0);
        codeMirror.scrollTo(null, 0);
      }
    } catch (_ignoreScrollTop) {}

    try {
      if (typeof codeMirror.getScrollerElement === "function") {
        var scroller = codeMirror.getScrollerElement();
        if (scroller) {
          scroller.scrollTop = 0;
          scroller.scrollLeft = 0;
        }
      }
    } catch (_ignoreScroller) {}

    try {
      var wrapper = typeof codeMirror.getWrapperElement === "function" ? codeMirror.getWrapperElement() : null;
      var root = wrapper && wrapper.parentNode ? wrapper.parentNode : wrapper;
      if (root && root.querySelector) {
        var vScrollbar = root.querySelector(".CodeMirror-vscrollbar");
        if (vScrollbar) {
          vScrollbar.scrollTop = 0;
        }
      }
    } catch (_ignoreVScrollbarReset) {}

    try {
      var textArea = document.getElementById("editor_window");
      if (textArea) {
        textArea.scrollTop = 0;
        textArea.selectionStart = 0;
        textArea.selectionEnd = 0;
      }
    } catch (_ignoreTextArea) {}
  }

  function installFreshOpenViewportGuard() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }

    if (state.cursorGuardCodeMirror && state.cursorGuardCodeMirror !== codeMirror) {
      removeFreshOpenViewportGuard();
    }

    if (state.cursorGuardCodeMirror === codeMirror) {
      return;
    }

    try {
      if (typeof codeMirror.setCursor === "function" &&
          typeof codeMirror.__luaProbeOriginalSetCursor !== "function") {
        codeMirror.__luaProbeOriginalSetCursor = codeMirror.setCursor;
        codeMirror.setCursor = function (cursor) {
          if (state.suppressRestoreUntilInteraction) {
            return codeMirror.__luaProbeOriginalSetCursor.call(this, { line: 0, ch: 0 });
          }
          return codeMirror.__luaProbeOriginalSetCursor.apply(this, arguments);
        };
      }
    } catch (_ignoreWrapSetCursor) {}

    try {
      if (typeof codeMirror.scrollTo === "function" &&
          typeof codeMirror.__luaProbeOriginalScrollTo !== "function") {
        codeMirror.__luaProbeOriginalScrollTo = codeMirror.scrollTo;
        codeMirror.scrollTo = function (_x, _y) {
          if (state.suppressRestoreUntilInteraction) {
            return codeMirror.__luaProbeOriginalScrollTo.call(this, 0, 0);
          }
          return codeMirror.__luaProbeOriginalScrollTo.apply(this, arguments);
        };
      }
    } catch (_ignoreWrapScrollTo) {}

    state.cursorGuardCodeMirror = codeMirror;
  }

  function removeFreshOpenViewportGuard() {
    var codeMirror = state.cursorGuardCodeMirror || getLuaCodeMirror();
    if (!codeMirror) {
      state.cursorGuardCodeMirror = null;
      return;
    }

    try {
      if (typeof codeMirror.__luaProbeOriginalSetCursor === "function") {
        codeMirror.setCursor = codeMirror.__luaProbeOriginalSetCursor;
      }
      codeMirror.__luaProbeOriginalSetCursor = null;
    } catch (_ignoreUnwrapSetCursor) {}

    try {
      if (typeof codeMirror.__luaProbeOriginalScrollTo === "function") {
        codeMirror.scrollTo = codeMirror.__luaProbeOriginalScrollTo;
      }
      codeMirror.__luaProbeOriginalScrollTo = null;
    } catch (_ignoreUnwrapScrollTo) {}

    state.cursorGuardCodeMirror = null;
  }

  function enforceEditorFocusAndCaret() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return;
    }

    var apply = function () {
      try {
        if (typeof codeMirror.focus === "function") {
          codeMirror.focus();
        }
      } catch (_ignoreFocus) {}

      try {
        if (typeof codeMirror.getCursor === "function" && typeof codeMirror.setCursor === "function") {
          var cursor = codeMirror.getCursor();
          var line = cursor && typeof cursor.line === "number" ? cursor.line : 0;
          var ch = cursor && typeof cursor.ch === "number" ? cursor.ch : 0;
          codeMirror.setCursor({ line: line, ch: ch });
        }
      } catch (_ignoreCursorRestore) {}

      updateCaretLineHighlight();
    };

    apply();
    window.setTimeout(apply, 50);
  }

  function captureTopLineFromUiInteraction(ev) {
    try {
      var target = ev.target;
      if (!target || target.nodeType !== 1 || typeof target.closest !== "function") {
        return;
      }

      if (ev && ev.type && ev.type !== "mousedown") {
        return;
      }

      var editorNode = target.closest("#editor_window_code") || target.closest(".CodeMirror") || target.closest("#editor_window");
      if (editorNode) {
        if (state.suppressRestoreUntilInteraction) {
          state.suppressRestoreUntilInteraction = false;
          removeFreshOpenViewportGuard();
        }
        syncCurrentContextKey();
        syncCurrentSnippetKeyFromEditor();
        if (state.currentSnippetKey) {
          rememberTopLineForKey(state.currentSnippetKey);
        }
        rememberTopLineForKey(state.lastContextKey);
        return;
      }

      var slotNode = target.closest("#slots_container .slot");
      var filterNode = target.closest("#filters_container .filter");
      if (slotNode || filterNode) {
        var selectedSlotNode = slotNode ? getDomSelectedSlotNode() : null;
        var selectedSlotKey = slotNode ? getSlotStableKey(selectedSlotNode) : "";
        var clickedSlotKey = slotNode ? getSlotStableKey(slotNode) : "";
        var isSlotTransition = !!slotNode && (
          (selectedSlotKey && clickedSlotKey && selectedSlotKey !== clickedSlotKey) ||
          (!selectedSlotKey || !clickedSlotKey) ||
          (selectedSlotNode && slotNode && selectedSlotNode !== slotNode)
        );
        var wasSuppressed = !!state.suppressRestoreUntilInteraction;
        if (wasSuppressed && (filterNode || isSlotTransition)) {
          // First interaction after open/reinject must never inherit stale viewport state.
          state.skipNextSetCodeRestore = true;
          resetEditorViewportToTop();
        }

        if (filterNode) {
          state.suppressRestoreUntilInteraction = false;
          removeFreshOpenViewportGuard();
          // Manual filter navigation should return focus to editor once code loads.
          state.forceEditorFocusOnNextSwitch = true;
        } else if (isSlotTransition) {
          // Keep suppression active through slot click until a concrete filter is selected.
          state.suppressRestoreUntilInteraction = true;
          installFreshOpenViewportGuard();
        }

        if (!wasSuppressed) {
          syncCurrentSnippetKeyFromEditor();
          if (state.currentSnippetKey) {
            rememberTopLineForKey(state.currentSnippetKey);
          }

          var codeMirror = getLuaCodeMirror();
          var currentContextKey = getEditorContextKey(codeMirror) || state.lastContextKey;
          if (currentContextKey) {
            rememberTopLineForKey(currentContextKey);
          }
        }

        if (filterNode) {
          clearPendingSlotAutoOpen();
          setActiveFilterMarker(filterNode);
        } else if (slotNode) {
          if (isSlotTransition) {
            clearActiveFilterMarker();
            state.activeFilterIndex = -1;
            state.activeFilterFingerprint = "";
            armPendingSlotAutoOpen(slotNode, selectedSlotNode);
          } else {
            clearPendingSlotAutoOpen();
          }
        }
        sendPacket("lua_ui_snippet_nav_click", {
          kind: slotNode ? "slot" : "filter",
          text: limitText(textOf(slotNode || filterNode), 96),
          contextBefore: getContextSnapshot()
        });
      }
    } catch (_ignore) {}
  }

  function ensureEditorSwitchHooks() {
    var root = document.getElementById("dpu_editor");
    if (!root || root.__luaProbeSwitchHooksBound) {
      return;
    }

    root.__luaProbeSwitchHooksBound = true;
    root.addEventListener("mousedown", captureTopLineFromUiInteraction, true);
  }

  function clearPendingSlotAutoOpen() {
    if (state.pendingSlotAutoOpenTimeoutId) {
      try {
        window.clearTimeout(state.pendingSlotAutoOpenTimeoutId);
      } catch (_ignorePendingTimeout) {}
      state.pendingSlotAutoOpenTimeoutId = 0;
    }
    if (state.pendingSlotAutoOpenRetryTimeoutId) {
      try {
        window.clearTimeout(state.pendingSlotAutoOpenRetryTimeoutId);
      } catch (_ignorePendingRetryTimeout) {}
      state.pendingSlotAutoOpenRetryTimeoutId = 0;
    }
    state.pendingSlotAutoOpen = null;
  }

  function isNodeInsideFiltersContainer(node) {
    if (!node) {
      return false;
    }
    var container = document.getElementById("filters_container");
    if (!container) {
      return false;
    }
    var current = node;
    while (current) {
      if (current === container) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  function resolveAutoOpenFilterCandidate(pending) {
    var selected = findDomSelectedFilterNode();
    var hasStaleSelected = !!(pending && pending.oldSelected && selected === pending.oldSelected);
    if (selected && isNodeInsideFiltersContainer(selected) && !hasStaleSelected) {
      return selected;
    }

    var hinted = findFilterNodeByHints(getManagerFilterHints());
    if (hinted && isNodeInsideFiltersContainer(hinted)) {
      if (pending && pending.oldSelected && hinted === pending.oldSelected) {
        // Hint still points to previous slot node; keep searching for a fresh candidate.
      } else {
        return hinted;
      }
    }

    var nodes = getVisibleFilterNodes();
    if (nodes.length <= 0) {
      return null;
    }

    if (hasStaleSelected && nodes.length > 1) {
      return nodes[1];
    }

    if (!hasStaleSelected) {
      return nodes[0];
    }

    var elapsedMs = Date.now() - pending.startedAt;
    if (elapsedMs < 180 && pending.mutationCount <= 0) {
      return null;
    }
    return nodes[0];
  }

  function tryAutoOpenSelectedFilter() {
    var pending = state.pendingSlotAutoOpen;
    if (!pending || state.switchInProgress) {
      return false;
    }

    pending.attempts = (pending.attempts || 0) + 1;

    if (Date.now() > pending.expiresAt) {
      sendPacket("lua_slot_auto_open", {
        seq: pending.seq,
        attempts: pending.attempts || 0,
        status: "expired",
        mutationCount: pending.mutationCount || 0
      });
      clearPendingSlotAutoOpen();
      return false;
    }

    var elapsedMs = Date.now() - pending.startedAt;
    var currentSelectedSlotNode = getDomSelectedSlotNode();
    var currentSelectedSlotIdentity = getNodeIdentity(currentSelectedSlotNode, "slot");
    var currentSelectedSlotKey = getSlotStableKey(currentSelectedSlotNode);
    if (pending.targetSlotKey && currentSelectedSlotKey && currentSelectedSlotKey !== pending.targetSlotKey) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "waiting-target-slot",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }
    if (!pending.targetSlotKey && pending.targetSlotIdentity && currentSelectedSlotIdentity && currentSelectedSlotIdentity !== pending.targetSlotIdentity) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "waiting-target-slot-identity",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }

    if (pending.previousSlotKey && currentSelectedSlotKey && currentSelectedSlotKey === pending.previousSlotKey && elapsedMs < 600) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "waiting-slot-switch",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }
    if (!pending.previousSlotKey && pending.previousSlotIdentity && currentSelectedSlotIdentity && currentSelectedSlotIdentity === pending.previousSlotIdentity && elapsedMs < 600) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "waiting-slot-switch-identity",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }

    var candidate = resolveAutoOpenFilterCandidate(pending);
    if (!candidate) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "no-candidate",
          mutationCount: pending.mutationCount || 0
        });
      }
      return false;
    }

    var sameAsOld = !!pending.oldSelected && candidate === pending.oldSelected;
    // Guard against stale pre-switch selected node during asynchronous list rebuild.
    if (sameAsOld && elapsedMs < 220 && pending.mutationCount < 2) {
      if (pending.attempts <= 3 || pending.attempts % 10 === 0) {
        sendPacket("lua_slot_auto_open", {
          seq: pending.seq,
          attempts: pending.attempts,
          status: "stale-selected",
          mutationCount: pending.mutationCount || 0,
          elapsedMs: elapsedMs
        });
      }
      return false;
    }

    if (triggerElementClick(candidate)) {
      // Slot-driven auto-open should start at top for the new filter.
      state.skipNextSetCodeRestore = true;
      state.forceEditorFocusOnNextSwitch = true;
      sendPacket("lua_slot_auto_open", {
        seq: pending.seq,
        attempts: pending.attempts,
        status: "clicked",
        mutationCount: pending.mutationCount || 0,
        text: limitText(textOf(candidate), 96)
      });
      setActiveFilterMarker(candidate);
      clearPendingSlotAutoOpen();
      return true;
    }

    return false;
  }

  function armPendingSlotAutoOpen(slotNode, previousSelectedSlotNode) {
    clearPendingSlotAutoOpen();
    ensureAutoClickObserver();

    state.pendingSlotAutoOpenSeq += 1;
    var seq = state.pendingSlotAutoOpenSeq;
    var targetSlotIdentity = getNodeIdentity(slotNode, "slot");
    var previousSlotIdentity = getNodeIdentity(previousSelectedSlotNode, "slot");
    var targetSlotKey = getSlotStableKey(slotNode);
    var previousSlotKey = getSlotStableKey(previousSelectedSlotNode);
    state.pendingSlotAutoOpen = {
      seq: seq,
      startedAt: Date.now(),
      expiresAt: Date.now() + 5000,
      mutationCount: 0,
      attempts: 0,
      oldSelected: findDomSelectedFilterNode(),
      targetSlotKey: targetSlotKey || "",
      previousSlotKey: previousSlotKey || "",
      targetSlotIdentity: targetSlotIdentity || "",
      previousSlotIdentity: previousSlotIdentity || ""
    };

    sendPacket("lua_slot_auto_open", {
      seq: seq,
      status: "armed",
      targetSlotKey: targetSlotKey || "",
      previousSlotKey: previousSlotKey || "",
      targetSlotIdentity: targetSlotIdentity || "",
      previousSlotIdentity: previousSlotIdentity || ""
    });

    var scheduleRetry = function (delayMs) {
      state.pendingSlotAutoOpenRetryTimeoutId = window.setTimeout(function () {
        if (!state.pendingSlotAutoOpen || state.pendingSlotAutoOpen.seq !== seq) {
          return;
        }
        if (tryAutoOpenSelectedFilter()) {
          return;
        }
        if (Date.now() > state.pendingSlotAutoOpen.expiresAt) {
          clearPendingSlotAutoOpen();
          return;
        }
        scheduleRetry(120);
      }, delayMs);
    };

    // Initial delayed kick + persistent retry loop for sluggish Coherent GT refreshes.
    state.pendingSlotAutoOpenTimeoutId = window.setTimeout(function () {
      if (!state.pendingSlotAutoOpen || state.pendingSlotAutoOpen.seq !== seq) {
        return;
      }
      if (tryAutoOpenSelectedFilter()) {
        return;
      }
      scheduleRetry(120);
    }, 70);
  }

  function ensureAutoClickObserver() {
    var root = document.getElementById("dpu_editor");
    if (!root) {
      return;
    }

    if (!window.MutationObserver) {
      return;
    }

    if (state.filtersObserver && state.filtersObserverRoot === root) {
      return;
    }

    try {
      if (state.filtersObserver && typeof state.filtersObserver.disconnect === "function") {
        state.filtersObserver.disconnect();
      }
    } catch (_ignoreReconnectObserver) {}

    var observer = new MutationObserver(function (mutations) {
      var pending = state.pendingSlotAutoOpen;
      if (!pending) {
        return;
      }

      if (Date.now() > pending.expiresAt) {
        clearPendingSlotAutoOpen();
        return;
      }

      if (mutations && typeof mutations.length === "number") {
        pending.mutationCount += mutations.length;
      }

      if (!tryAutoOpenSelectedFilter()) {
        return;
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-selected", "aria-selected"]
    });

    state.filtersObserver = observer;
    state.filtersObserverRoot = root;
  }
