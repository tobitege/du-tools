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

  function unwrapLuaEditorManager() {
    var manager = window.LUAEditorManager;
    if (!manager) {
      return;
    }

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

  function wrapLuaEditorManager() {
    var manager = window.LUAEditorManager;
    if (!manager || manager.__luaProbeWrapped) {
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

            if (info && info.forceEditorFocus) {
              enforceEditorFocusAndCaret();
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
            if (!info.seq || state.activeSwitchSeq === info.seq) {
              state.switchInProgress = false;
            }
          }
        });
      }
    });

    for (var i = 0; i < methodNames.length; i += 1) {
      wrapManagerMethod(manager, methodNames[i]);
    }

    return true;
  }

