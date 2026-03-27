  function markMenuHits(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return;
    }

    ensureQuickLuaMenuEntries(menuRoot);

    var nodes = menuRoot.querySelectorAll("li,a,span,div");
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (node.__luaProbeBound) {
        continue;
      }

      var txt = textOf(node);
      if (!txt) {
        continue;
      }

      var txtLower = txt.toLowerCase();
      if (!isInterestingMenuText(txtLower)) {
        continue;
      }

      node.__luaProbeBound = true;
      node.setAttribute("data-lua-probe-hit", "1");
      state.menuHits += 1;

      sendPacket("lua_menu_item_seen", {
        text: txt,
        tag: node.tagName || "",
        className: String(node.className || "")
      });

      node.addEventListener("click", function (ev) {
        var target = ev.currentTarget || ev.target;
        sendPacket("lua_menu_click", {
          text: textOf(target),
          tag: target && target.tagName ? target.tagName : "",
          className: target ? String(target.className || "") : ""
        });
      }, true);
    }
  }

  function observeMenuRoot(menuRoot) {
    if (!menuRoot || menuRoot.__luaProbeObserverAttached) {
      return;
    }
    menuRoot.__luaProbeObserverAttached = true;
    state.menuObserved = true;

    sendPacket("context_menu_observed", {
      id: menuRoot.id || "",
      className: String(menuRoot.className || "")
    });

    markMenuHits(menuRoot);

    if (window.MutationObserver) {
      if (state.menuObserver && typeof state.menuObserver.disconnect === "function") {
        try {
          state.menuObserver.disconnect();
        } catch (_ignoreDisconnect) {}
      }

      var menuObserver = new MutationObserver(function () {
        ensureQuickLuaMenuEntries(menuRoot);
        markMenuHits(menuRoot);
      });
      menuObserver.observe(menuRoot, {
        childList: true,
        subtree: true
      });
      state.menuObserver = menuObserver;
    }
  }

  function tryAttachMenuObserver() {
    var menuRoot = document.getElementById("main_context_menu");
    if (!menuRoot) {
      return false;
    }
    observeMenuRoot(menuRoot);
    return true;
  }

  function getWrappedMethodNames() {
    return [
      "showDEM",
      "initDEM",
      "apply",
      "cancel",
      "addNewFilter",
      "deleteFilter",
      "changeFontSize",
      "reduceSizeActionsList",
      "resizeErrorList",
      "setCodeLuaEditor"
    ];
  }

  function getLuaEditorEngineBindings() {
    return [
      { eventName: "DPUEditorShow", methodName: "showDEM" },
      { eventName: "DPUEditorInit", methodName: "initDEM" },
      { eventName: "DPUEditorCancel", methodName: "cancel" }
    ];
  }

  function getHudEngine() {
    try {
      if (window.engine) {
        return window.engine;
      }
    } catch (_ignoreWindowEngine) {}
    try {
      if (typeof engine !== "undefined" && engine) {
        return engine;
      }
    } catch (_ignoreGlobalEngine) {}
    return null;
  }

  function rebindLuaEditorEngineHandlers(manager, useWrappedHandlers) {
    if (!manager) {
      return false;
    }

    var engineRef = getHudEngine();
    if (!engineRef || typeof engineRef.on !== "function" || typeof engineRef.off !== "function") {
      sendPacket("lua_engine_rebind", {
        mode: useWrappedHandlers ? "wrapped" : "original",
        status: "engine_unavailable"
      });
      return false;
    }

    var bindings = getLuaEditorEngineBindings();
    var results = [];
    var reboundAny = false;

    for (var i = 0; i < bindings.length; i += 1) {
      var binding = bindings[i];
      var currentFn = manager[binding.methodName];
      var wrappedFn = typeof currentFn === "function" && currentFn.__luaProbeWrapped ? currentFn : null;
      var originalFn = wrappedFn && typeof wrappedFn.__luaProbeOriginal === "function"
        ? wrappedFn.__luaProbeOriginal
        : (typeof currentFn === "function" ? currentFn : null);
      var fromFn = useWrappedHandlers ? originalFn : wrappedFn;
      var toFn = useWrappedHandlers ? wrappedFn : originalFn;

      if (typeof fromFn !== "function" || typeof toFn !== "function" || fromFn === toFn) {
        results.push({
          eventName: binding.eventName,
          methodName: binding.methodName,
          status: "skipped"
        });
        continue;
      }

      try {
        engineRef.off(binding.eventName, fromFn);
        engineRef.on(binding.eventName, toFn);
        reboundAny = true;
        results.push({
          eventName: binding.eventName,
          methodName: binding.methodName,
          status: "rebound"
        });
      } catch (err) {
        try {
          engineRef.on(binding.eventName, fromFn);
        } catch (_ignoreRebindRollback) {}
        results.push({
          eventName: binding.eventName,
          methodName: binding.methodName,
          status: "error",
          error: String(err && err.message ? err.message : err)
        });
      }
    }

    manager.__luaProbeEngineBindingsRebound = useWrappedHandlers && reboundAny;
    sendPacket("lua_engine_rebind", {
      mode: useWrappedHandlers ? "wrapped" : "original",
      status: reboundAny ? "ok" : "noop",
      results: results
    });
    return reboundAny;
  }

  function unwrapLuaEditorManager() {
    var manager = window.LUAEditorManager;
    if (!manager) {
      return;
    }

    rebindLuaEditorEngineHandlers(manager, false);

    var methodNames = getWrappedMethodNames();
    for (var i = 0; i < methodNames.length; i += 1) {
      var methodName = methodNames[i];
      var fn = manager[methodName];
      if (typeof fn === "function" && typeof fn.__luaProbeOriginal === "function") {
        manager[methodName] = fn.__luaProbeOriginal;
      }
    }

    try {
      delete manager.__luaProbeWrapped;
    } catch (_ignore) {
      manager.__luaProbeWrapped = false;
    }
    try {
      delete manager.__luaProbeEngineBindingsRebound;
    } catch (_ignoreEngineRebindFlag) {
      manager.__luaProbeEngineBindingsRebound = false;
    }
  }

  function wrapManagerMethodWithHooks(manager, methodName, hooks) {
    if (!manager) {
      return;
    }
    var fn = manager[methodName];
    if (typeof fn !== "function" || fn.__luaProbeWrapped) {
      return;
    }

    var wrapped = function () {
      var args = [];
      for (var i = 0; i < arguments.length; i += 1) {
        args.push(arguments[i]);
      }
      var hookContext = null;
      if (hooks && typeof hooks.before === "function") {
        try {
          hookContext = hooks.before(args);
        } catch (_ignoreBefore) {}
      }
      sendPacket("lua_manager_call", {
        method: methodName,
        args: summarizeArgs(args),
        context: getContextSnapshot()
      });
      var result = null;
      try {
        result = fn.apply(this, arguments);
      } catch (err) {
        sendPacket("lua_manager_call_error", {
          method: methodName,
          error: String(err && err.message ? err.message : err),
          context: getContextSnapshot()
        });
        throw err;
      }
      sendPacket("lua_manager_call_result", {
        method: methodName,
        result: summarizeArg(result),
        context: getContextSnapshot()
      });
      if (hooks && typeof hooks.after === "function") {
        try {
          hooks.after(args, result, hookContext);
        } catch (_ignoreAfter) {}
      }
      return result;
    };

    wrapped.__luaProbeWrapped = true;
    wrapped.__luaProbeOriginal = fn;
    manager[methodName] = wrapped;
  }

  function wrapManagerMethod(manager, methodName) {
    wrapManagerMethodWithHooks(manager, methodName, null);
  }

  function restoreSnippetAfterSwitch(info) {
    var restored = false;
    if (info && info.targetSnippetKey) {
      state.currentSnippetKey = info.targetSnippetKey;
      restored = restoreTopLineForCurrentKey(info.targetSnippetKey);
    } else {
      syncCurrentSnippetKeyFromEditor();
    }

    if (!restored) {
      syncCurrentContextKey(true);
      restoreTopLineForCurrentKey();
    }

    refreshActiveFilterMarker();
    updateCaretLineHighlight();
  }

  function waitForCodeMirrorSettle(info, onReady) {
    var seq = info && info.seq ? info.seq : 0;
    var targetSnippetKey = info && typeof info.targetSnippetKey === "string" ? info.targetSnippetKey : "";
    var startedAt = Date.now();
    var maxWaitMs = 5000;
    var quietWindowMs = 250;
    var pollIntervalMs = 40;
    var signalCount = 0;
    var lastSignalAt = startedAt;
    var lastViewportSignature = "";
    var currentCodeMirror = null;
    var currentHandlers = null;
    var targetSnippetSeen = !targetSnippetKey;
    var active = true;
    var timerId = 0;

    var isStaleSeq = function () {
      return !!(seq && state.activeSwitchSeq && seq !== state.activeSwitchSeq);
    };

    var markSignal = function (kind) {
      signalCount += 1;
      lastSignalAt = Date.now();
      if (signalCount <= 6 || signalCount % 20 === 0) {
        sendPacket("lua_cm_settle_signal", {
          seq: seq,
          kind: kind,
          signalCount: signalCount,
          elapsedMs: lastSignalAt - startedAt
        });
      }
    };

    var detachFromCodeMirror = function (codeMirror) {
      if (!codeMirror || !currentHandlers || typeof codeMirror.off !== "function") {
        return;
      }
      try { codeMirror.off("changes", currentHandlers.changes); } catch (_ignoreOffChanges) {}
      try { codeMirror.off("scroll", currentHandlers.scroll); } catch (_ignoreOffScroll) {}
      try { codeMirror.off("viewportChange", currentHandlers.viewportChange); } catch (_ignoreOffViewport) {}
      try { codeMirror.off("refresh", currentHandlers.refresh); } catch (_ignoreOffRefresh) {}
      try { codeMirror.off("update", currentHandlers.update); } catch (_ignoreOffUpdate) {}
      currentHandlers = null;
    };

    var attachToCodeMirror = function (codeMirror) {
      if (!codeMirror || codeMirror === currentCodeMirror) {
        return;
      }

      if (currentCodeMirror) {
        detachFromCodeMirror(currentCodeMirror);
      }
      currentCodeMirror = codeMirror;

      if (typeof codeMirror.on !== "function") {
        markSignal("cm-no-on");
        return;
      }

      currentHandlers = {
        changes: function () { markSignal("changes"); },
        scroll: function () { markSignal("scroll"); },
        viewportChange: function () { markSignal("viewportChange"); },
        refresh: function () { markSignal("refresh"); },
        update: function () { markSignal("update"); }
      };

      try { codeMirror.on("changes", currentHandlers.changes); } catch (_ignoreOnChanges) {}
      try { codeMirror.on("scroll", currentHandlers.scroll); } catch (_ignoreOnScroll) {}
      try { codeMirror.on("viewportChange", currentHandlers.viewportChange); } catch (_ignoreOnViewport) {}
      try { codeMirror.on("refresh", currentHandlers.refresh); } catch (_ignoreOnRefresh) {}
      try { codeMirror.on("update", currentHandlers.update); } catch (_ignoreOnUpdate) {}
      markSignal("cm-attached");
    };

    var getViewportSignature = function () {
      var viewport = getEditorViewportSnapshot();
      if (!viewport) {
        return "";
      }
      return [
        typeof viewport.lineCount === "number" ? viewport.lineCount : "na",
        typeof viewport.scrollTopPx === "number" ? viewport.scrollTopPx : "na",
        typeof viewport.cmScrollerTopPx === "number" ? viewport.cmScrollerTopPx : "na",
        typeof viewport.cmVScrollbarTopPx === "number" ? viewport.cmVScrollbarTopPx : "na",
        typeof viewport.scrollHeightPx === "number" ? viewport.scrollHeightPx : "na",
        typeof viewport.clientHeightPx === "number" ? viewport.clientHeightPx : "na",
        typeof viewport.cursorLine === "number" ? viewport.cursorLine : "na"
      ].join("|");
    };

    var finish = function (reason) {
      if (!active) {
        return;
      }
      active = false;
      if (timerId) {
        try {
          window.clearTimeout(timerId);
        } catch (_ignoreClearSettleTimer) {}
        timerId = 0;
      }
      if (currentCodeMirror) {
        detachFromCodeMirror(currentCodeMirror);
      }
      onReady({
        reason: reason,
        elapsedMs: Date.now() - startedAt,
        signalCount: signalCount,
        quietForMs: Date.now() - lastSignalAt
      });
    };

    var tick = function () {
      if (!active) {
        return;
      }
      if (isStaleSeq()) {
        finish("stale-seq");
        return;
      }

      var codeMirror = getLuaCodeMirror();
      if (codeMirror !== currentCodeMirror) {
        attachToCodeMirror(codeMirror);
        markSignal("cm-instance");
      }

      var signature = getViewportSignature();
      if (signature && signature !== lastViewportSignature) {
        lastViewportSignature = signature;
        markSignal("viewport");
      }

      if (!targetSnippetSeen && currentCodeMirror) {
        var currentSnippetKey = getSnippetMemoryKeyFromEditor(currentCodeMirror);
        if (currentSnippetKey && currentSnippetKey === targetSnippetKey) {
          targetSnippetSeen = true;
          markSignal("target-snippet");
        }
      }

      var now = Date.now();
      if (targetSnippetSeen && lastViewportSignature && (now - lastSignalAt) >= quietWindowMs) {
        finish("quiet-window");
        return;
      }
      if ((now - startedAt) >= maxWaitMs) {
        finish(targetSnippetSeen ? "timeout" : "timeout-no-target");
        return;
      }

      timerId = window.setTimeout(tick, pollIntervalMs);
    };

    attachToCodeMirror(getLuaCodeMirror());
    markSignal("start");
    tick();
  }

  function parseInitDemJsonArg(raw) {
    if (typeof raw !== "string" || !raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (_ignoreParseInitDem) {}
    return null;
  }

  function summarizeInitDemRawArg(raw) {
    if (typeof raw !== "string") {
      return summarizeArg(raw);
    }
    return {
      type: "string",
      len: raw.length,
      hash: hashStringFNV1a(raw),
      preview: limitText(raw, 160)
    };
  }

  function getObjectOwnKeysSafe(obj, maxCount) {
    try {
      return Object.getOwnPropertyNames(obj || {}).slice(0, maxCount || 80);
    } catch (_ignoreOwnKeys) {}
    return [];
  }

  function getObjectProtoKeysSafe(obj, maxCount) {
    try {
      var proto = Object.getPrototypeOf(obj);
      return proto ? Object.getOwnPropertyNames(proto).slice(0, maxCount || 80) : [];
    } catch (_ignoreProtoKeys) {}
    return [];
  }

  function collectInterestingObjectFields(obj, maxCount) {
    var out = {};
    if (!obj) {
      return out;
    }
    var keys = getObjectOwnKeysSafe(obj, 120);
    var count = 0;
    for (var i = 0; i < keys.length; i += 1) {
      var key = String(keys[i] || "");
      var lower = key.toLowerCase();
      if (!(lower.indexOf("id") >= 0 ||
          lower.indexOf("name") >= 0 ||
          lower.indexOf("slot") >= 0 ||
          lower.indexOf("element") >= 0 ||
          lower.indexOf("uuid") >= 0 ||
          lower.indexOf("nq") >= 0 ||
          lower.indexOf("construct") >= 0 ||
          lower.indexOf("board") >= 0 ||
          lower.indexOf("item") >= 0 ||
          lower.indexOf("owner") >= 0 ||
          lower.indexOf("data") >= 0)) {
        continue;
      }
      try {
        var value = obj[key];
        if (value === null || typeof value === "undefined") {
          out[key] = null;
        } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          out[key] = limitText(String(value), 160);
        } else if (Array.isArray(value)) {
          out[key] = "array:" + value.length;
        } else if (typeof value === "function") {
          out[key] = "function";
        } else if (typeof value === "object") {
          out[key] = "object";
        } else {
          out[key] = limitText(String(value), 160);
        }
      } catch (err) {
        out[key] = "error:" + limitText(String(err && err.message ? err.message : err), 160);
      }
      count += 1;
      if (count >= (maxCount || 20)) {
        break;
      }
    }
    return out;
  }

  function summarizeInitDemObject(obj) {
    return {
      keys: getObjectOwnKeysSafe(obj, 80),
      interesting: collectInterestingObjectFields(obj, 20),
      protoKeys: getObjectProtoKeysSafe(obj, 80)
    };
  }

  function summarizeInitDemSlotRow(slot) {
    if (!slot || typeof slot !== "object") {
      return null;
    }
    var eventCount = 0;
    try {
      if (slot.events && typeof slot.events.length === "number") {
        eventCount = slot.events.length;
      }
    } catch (_ignoreSlotEventCount) {}
    return {
      slotKey: slot.slotKey,
      slotElementName: slot.slotElementName || null,
      eventCount: eventCount
    };
  }

  function findInitDemSelfSlot(slotRows) {
    if (!slotRows || typeof slotRows.length !== "number") {
      return null;
    }
    for (var i = 0; i < slotRows.length; i += 1) {
      var row = slotRows[i];
      if (row && String(row.slotKey || "") === "-1") {
        return row;
      }
    }
    return null;
  }

  function getLuaEditorTitleForDebug() {
    try {
      var root = document.getElementById("dpu_editor");
      var titleNode = root ? root.querySelector(".editor_header .title, .editor_header .header_bar .title") : null;
      return titleNode ? String(titleNode.textContent || "").replace(/\s+/g, " ").trim() : "";
    } catch (_ignoreLuaTitle) {}
    return "";
  }

  function buildInitDemReference(parsedData, parsedSlotData) {
    var manager = window.LUAEditorManager || null;
    var currentData = manager && manager.currentData ? manager.currentData : null;
    var currentSlot = currentData && currentData.currentSlot ? currentData.currentSlot : null;
    var currentFilter = currentData && currentData.currentFilter ? currentData.currentFilter : null;
    var currentSlotData = currentSlot && currentSlot.slotData ? currentSlot.slotData : null;
    var selfSlot = findInitDemSelfSlot(parsedSlotData);
    var slotRows = [];
    if (parsedSlotData && typeof parsedSlotData.length === "number") {
      for (var i = 0; i < parsedSlotData.length && i < 16; i += 1) {
        slotRows.push(summarizeInitDemSlotRow(parsedSlotData[i]));
      }
    }

    return {
      constructId: cfg && typeof cfg.constructId !== "undefined" ? cfg.constructId : null,
      editorTitle: getLuaEditorTitleForDebug(),
      currentSlotName: currentSlot && typeof currentSlot.name !== "undefined" ? currentSlot.name : null,
      currentSlotKey: currentSlot && typeof currentSlot.slotKey !== "undefined" ? currentSlot.slotKey : null,
      currentSlotElementName: currentSlotData && typeof currentSlotData.slotElementName !== "undefined" ? currentSlotData.slotElementName : null,
      currentFilterKey: currentFilter && typeof currentFilter.key !== "undefined" ? currentFilter.key : null,
      currentFilterSlotKey: currentFilter && typeof currentFilter.slotKey !== "undefined" ? currentFilter.slotKey : null,
      currentFilterSignature: currentFilter && typeof currentFilter.signature !== "undefined" ? currentFilter.signature : null,
      parsedDataInteresting: collectInterestingObjectFields(parsedData, 20),
      parsedSelfSlot: summarizeInitDemSlotRow(selfSlot),
      parsedSlotRows: slotRows,
      dpuEditorObject: summarizeInitDemObject(window.dpuEditorObject || null)
    };
  }

  function emitInitDemObserved(args, hookContext) {
    var parsedData = parseInitDemJsonArg(args && args.length > 0 ? args[0] : null);
    var parsedSlotData = parseInitDemJsonArg(args && args.length > 1 ? args[1] : null);
    var parsedLuaActions = parseInitDemJsonArg(args && args.length > 2 ? args[2] : null);
    var parsedLuaErrors = parseInitDemJsonArg(args && args.length > 3 ? args[3] : null);
    var reference = buildInitDemReference(parsedData, parsedSlotData);
    var beforeContext = hookContext && hookContext.beforeContext ? hookContext.beforeContext : null;
    var afterContext = getContextSnapshot();
    var payload = {
      beforeContext: beforeContext,
      afterContext: afterContext,
      argSummary: {
        data: summarizeInitDemRawArg(args && args.length > 0 ? args[0] : null),
        slotData: summarizeInitDemRawArg(args && args.length > 1 ? args[1] : null),
        luaActions: summarizeInitDemRawArg(args && args.length > 2 ? args[2] : null),
        luaErrors: summarizeInitDemRawArg(args && args.length > 3 ? args[3] : null)
      },
      parsedSummary: {
        data: summarizeInitDemObject(parsedData),
        slotDataCount: parsedSlotData && typeof parsedSlotData.length === "number" ? parsedSlotData.length : 0,
        luaActions: summarizeInitDemObject(parsedLuaActions),
        luaErrors: summarizeArg(parsedLuaErrors)
      },
      reference: reference
    };

    state.lastInitDemReference = cloneIdeSyncObject(reference);

    sendPacket("lua_initdem_observed", payload);

    sendJsonPacketChunked("lua_initdem_payload", {
      beforeContext: beforeContext,
      afterContext: afterContext,
      reference: reference,
      rawArgs: {
        data: typeof (args && args.length > 0 ? args[0] : null) === "string" ? args[0] : null,
        slotData: typeof (args && args.length > 1 ? args[1] : null) === "string" ? args[1] : null,
        luaActions: typeof (args && args.length > 2 ? args[2] : null) === "string" ? args[2] : null,
        luaErrors: typeof (args && args.length > 3 ? args[3] : null) === "string" ? args[3] : null
      }
    }, 6000);
  }

  function wrapLuaEditorManager() {
    var manager = window.LUAEditorManager;
    if (!manager) {
      return false;
    }

    if (manager.__luaProbeWrapped) {
      if (!manager.__luaProbeEngineBindingsRebound) {
        return rebindLuaEditorEngineHandlers(manager, true);
      }
      return false;
    }

    manager.__luaProbeWrapped = true;
    state.managerWrapped = true;

    var keys = [];
    try {
      keys = Object.keys(manager);
    } catch (_ignore) {
      keys = [];
    }

    sendPacket("lua_manager_found", {
      keys: keys
    });

    var methodNames = getWrappedMethodNames();

    wrapManagerMethodWithHooks(manager, "initDEM", {
      before: function () {
        return {
          beforeContext: getContextSnapshot()
        };
      },
      after: function (args, _result, hookContext) {
        emitInitDemObserved(args, hookContext);
      }
    });

    wrapManagerMethodWithHooks(manager, "setCodeLuaEditor", {
      before: function (args) {
        var targetSnippetKey = getSnippetMemoryKeyFromCode(args && args.length > 0 ? args[0] : null);
        var hasRememberedTarget = hasRememberedTopLineForKey(targetSnippetKey);
        var suppressRestore = (!!state.skipNextSetCodeRestore || !!state.suppressRestoreUntilInteraction) && !hasRememberedTarget;
        state.skipNextSetCodeRestore = false;
        if (hasRememberedTarget && state.suppressRestoreUntilInteraction) {
          state.suppressRestoreUntilInteraction = false;
          removeFreshOpenViewportGuard();
        }
        var forceEditorFocus = !!state.forceEditorFocusOnNextSwitch;
        if (forceEditorFocus) {
          state.forceEditorFocusOnNextSwitch = false;
        }

        syncCurrentSnippetKeyFromEditor();
        if (!suppressRestore && state.currentSnippetKey) {
          rememberTopLineForKey(state.currentSnippetKey);
        }
        if (!suppressRestore) {
          rememberTopLineForKey(state.lastContextKey);
        }
        var seq = state.setCodeSwitchSeq + 1;
        state.setCodeSwitchSeq = seq;
        state.switchInProgress = true;
        state.activeSwitchSeq = seq;
        var switchInfo = {
          seq: seq,
          before: getContextSnapshot(),
          beforeViewport: getEditorViewportSnapshot(),
          code: summarizeCodeForSwitch(args && args.length > 0 ? args[0] : null),
          targetSnippetKey: targetSnippetKey,
          targetHasRememberedTopLine: hasRememberedTarget,
          suppressRestore: suppressRestore,
          forceEditorFocus: forceEditorFocus
        };
        sendPacket("lua_snippet_switch_begin", switchInfo);
        return switchInfo;
      },
      after: function (args, _result, switchInfo) {
        var info = switchInfo || {
          seq: 0,
          before: getContextSnapshot(),
          code: summarizeCodeForSwitch(args && args.length > 0 ? args[0] : null)
        };

        waitForCodeMirrorSettle(info, function (settle) {
          if (info.seq && state.activeSwitchSeq && info.seq !== state.activeSwitchSeq) {
            return;
          }

          var settleInfo = settle || {
            reason: "unknown",
            elapsedMs: 0,
            signalCount: 0,
            quietForMs: 0
          };

          try {
            ensureCaretHighlightBindings();

            // Refresh once at settle point so we work on the final CodeMirror instance.
            var currentCm = getLuaCodeMirror();
            if (currentCm && typeof currentCm.refresh === "function") {
              try {
                currentCm.refresh();
              } catch (_ignoreRefreshAtSettle) {}
            }

            if (info && info.suppressRestore) {
              syncCurrentSnippetKeyFromEditor();
              syncCurrentContextKey(true);
              refreshActiveFilterMarker();
              resetEditorViewportToTop();
              updateCaretLineHighlight();
            } else {
              restoreSnippetAfterSwitch(info);
            }

            sendPacket("lua_snippet_switch_end", {
              seq: info.seq,
              before: info.before,
              beforeViewport: info.beforeViewport || null,
              after: getContextSnapshot(),
              afterViewport: getEditorViewportSnapshot(),
              restoreDelayMs: settleInfo.elapsedMs,
              settleReason: settleInfo.reason,
              settleSignalCount: settleInfo.signalCount,
              settleQuietForMs: settleInfo.quietForMs,
              code: info.code
            });

            sendPacket("lua_snippet_switch_settled", {
              seq: info.seq,
              after: getContextSnapshot(),
              afterViewport: getEditorViewportSnapshot(),
              settleReason: settleInfo.reason,
              settleSignalCount: settleInfo.signalCount
            });
          } catch (_ignoreRestoreAfterSettle) {
          } finally {
            var isActiveSeq = !info.seq || state.activeSwitchSeq === info.seq;
            if (isActiveSeq) {
              state.switchInProgress = false;
              if (info && info.forceEditorFocus) {
                enforceEditorFocusAndCaret();
              } else {
                updateCaretLineHighlight();
              }
            }
          }
        });
      }
    });

    for (var i = 0; i < methodNames.length; i += 1) {
      wrapManagerMethod(manager, methodNames[i]);
    }

    rebindLuaEditorEngineHandlers(manager, true);

    return true;
  }

