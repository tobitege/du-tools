  function triggerEditLuaFromQuickMenu(menuRoot) {
    sendPacket("lua_quick_menu_edit_lua", {
      source: "quick-menu"
    });

    var clicked = false;
    var nativeAttempt = 0;
    var maxNativeAttempts = 1;

    function getMenuRootForAttempt() {
      var liveMenuRoot = null;
      try {
        liveMenuRoot = document.getElementById("main_context_menu");
      } catch (_ignoreMenuLookup) {
        liveMenuRoot = null;
      }
      return liveMenuRoot || menuRoot || null;
    }

    function runFallbackPath() {
      if (isEditorVisible()) {
        sendPacket("lua_quick_menu_edit_lua_result", {
          step: "fallback-skip-visible",
          clicked: !!clicked
        });
        return;
      }

      var shortcutTriggered = triggerCtrlLShortcut();
      sendPacket("lua_quick_menu_edit_lua_result", {
        step: "fallback-ctrl-l",
        clicked: !!clicked,
        shortcutTriggered: !!shortcutTriggered
      });
    }

    function runNativeAttempt() {
      if (isEditorVisible()) {
        sendPacket("lua_quick_menu_edit_lua_result", {
          step: "native-already-open",
          attempt: nativeAttempt,
          clicked: !!clicked
        });
        return;
      }

      nativeAttempt += 1;
      var bridgeInvokedThisAttempt = false;
      var advancedEntryUsed = null;
      var targetPathUsed = "fallback-any";
      var targetForAttempt = null;

      try {
        var menuRootNow = getMenuRootForAttempt();
        if (!menuRootNow) {
          sendPacket("lua_quick_menu_edit_lua_result", {
            step: "native-click",
            attempt: nativeAttempt,
            clicked: false,
            reason: "no-menu-root"
          });
        } else {
          var advancedEntry = findAdvancedMenuEntry(menuRootNow);
          advancedEntryUsed = advancedEntry;
          var target = null;
          var targetPath = "fallback-any";
          if (advancedEntry) {
            target = findEditLuaEntryUnderAdvanced(advancedEntry);
            targetPath = "advanced-direct";
            if (!target) {
              activateAdvancedEntry(advancedEntry);
              target = findEditLuaEntryUnderAdvanced(advancedEntry);
              targetPath = "advanced-after-activate";
            }
          }

          target = target || findEditLuaEntryInside(advancedEntry || menuRootNow) ||
            findNativeEditLuaEntry(menuRootNow);
          targetForAttempt = target;
          targetPathUsed = targetPath;
          if (target) {
            var helperId = "";
            try {
              helperId = String(target.getAttribute("helperid") || "");
            } catch (_ignoreHelperId) {
              helperId = "";
            }

            var bridgeResult = tryInvokeContextMenuBridge(helperId);
            bridgeInvokedThisAttempt = !!(bridgeResult && bridgeResult.invoked);
            var clickDispatched = false;
            var handlerTriggered = false;
            if (!bridgeInvokedThisAttempt) {
              clickDispatched = triggerElementClick(target);
              handlerTriggered = triggerNativeMenuHandlers(target);
            }
            clicked = bridgeInvokedThisAttempt || clickDispatched || handlerTriggered || clicked;
            sendPacket("lua_quick_menu_edit_lua_result", {
              step: "native-click",
              attempt: nativeAttempt,
              clicked: !!clicked,
              clickDispatched: !!clickDispatched,
              handlerTriggered: !!handlerTriggered,
              bridgeInvoked: !!(bridgeResult && bridgeResult.invoked),
              bridgeAttempts: bridgeResult ? bridgeResult.attempts : [],
              targetText: limitText(textOf(target), 96)
            });
          } else {
            sendPacket("lua_quick_menu_edit_lua_result", {
              step: "native-click",
              attempt: nativeAttempt,
              clicked: false,
              reason: "no-native-target"
            });
          }
        }
      } catch (_ignoreNativeEdit) {}

      if (!bridgeInvokedThisAttempt && !isEditorVisible() && advancedEntryUsed && targetForAttempt && targetPathUsed.indexOf("advanced") === 0) {
        window.setTimeout(function () {
          if (isEditorVisible()) {
            return;
          }
          try {
            var delayedTarget = findEditLuaEntryUnderAdvanced(advancedEntryUsed) || targetForAttempt;
            var delayedClickDispatched = triggerElementClick(delayedTarget);
            var delayedHandlerTriggered = triggerNativeMenuHandlers(delayedTarget);
            clicked = delayedClickDispatched || delayedHandlerTriggered || clicked;
            sendPacket("lua_quick_menu_edit_lua_result", {
              step: "native-delayed-click",
              attempt: nativeAttempt,
              clicked: !!clicked,
              clickDispatched: !!delayedClickDispatched,
              handlerTriggered: !!delayedHandlerTriggered
            });
          } catch (_ignoreDelayedNative) {}
        }, 220);
      }

      var settleDelayMs = bridgeInvokedThisAttempt ? 750 : 140;
      window.setTimeout(function () {
        if (isEditorVisible()) {
          state.suppressRestoreUntilInteraction = true;
          state.skipNextSetCodeRestore = true;
          installFreshOpenViewportGuard();
          resetEditorViewportToTop();
          sendPacket("lua_quick_menu_edit_lua_result", {
            step: "native-opened",
            attempt: nativeAttempt,
            clicked: !!clicked,
            bridgeInvoked: !!bridgeInvokedThisAttempt
          });
          return;
        }

        if (nativeAttempt < maxNativeAttempts) {
          runNativeAttempt();
          return;
        }

        runFallbackPath();
      }, settleDelayMs);
    }

    // Defer to next tick so we don't compete with the current menu click stack.
    window.setTimeout(function () {
      var shortcutTriggered = triggerCtrlLShortcut();
      sendPacket("lua_quick_menu_edit_lua_result", {
        step: "shortcut-first",
        shortcutTriggered: !!shortcutTriggered
      });

      window.setTimeout(function () {
        if (isEditorVisible()) {
          sendPacket("lua_quick_menu_edit_lua_result", {
            step: "shortcut-first-opened",
            clicked: !!clicked
          });
          return;
        }
        runNativeAttempt();
      }, 120);
    }, 0);
  }

  function createQuickMenuEntry(id, label, onClick, templateEntry) {
    var li = document.createElement("li");
    li.id = id;

    var className = templateEntry ? String(templateEntry.className || "") : "menu";
    className = className.replace(/\bright_dropdown\b/g, "").replace(/\s+/g, " ").trim();
    li.className = className || "menu";
    li.setAttribute("data-ModUiExtractor-quick", "1");
    li.style.textAlign = "left";

    var a = null;
    try {
      var templateAnchor = templateEntry && templateEntry.querySelector
        ? templateEntry.querySelector(":scope > a")
        : null;
      if (templateAnchor && templateAnchor.cloneNode) {
        a = templateAnchor.cloneNode(false);
      }
    } catch (_ignoreTemplateAnchor) {
      a = null;
    }
    if (!a) {
      a = document.createElement("a");
    }
    a.textContent = label;
    a.style.textAlign = "left";
    a.style.display = "block";
    a.style.width = "100%";
    li.appendChild(a);

    var handleActivation = function (ev) {
      if (ev && typeof ev.preventDefault === "function") {
        ev.preventDefault();
      }
      if (ev && typeof ev.stopPropagation === "function") {
        ev.stopPropagation();
      }
      if (li.__luaProbeActivating) {
        return;
      }
      li.__luaProbeActivating = true;
      try {
        onClick();
      } catch (_ignoreQuickClick) {}
      window.setTimeout(function () {
        li.__luaProbeActivating = false;
      }, 180);
    };

    li.addEventListener("click", handleActivation, true);

    return li;
  }

  function getDirectMenuEntries(container) {
    var out = [];
    if (!container || !container.children) {
      return out;
    }
    for (var i = 0; i < container.children.length; i += 1) {
      var child = container.children[i];
      if (!isMenuEntryNode(child)) {
        continue;
      }
      if (child.id === quickEditLuaMenuItemId || child.id === quickInjectProbeMenuItemId) {
        continue;
      }
      out.push(child);
    }
    return out;
  }

  function moveModMenuEntryToBottom(topContainer) {
    if (!topContainer || !topContainer.appendChild) {
      return;
    }
    var entries = getDirectMenuEntries(topContainer);
    if (!entries.length) {
      return;
    }
    var modEntry = null;
    for (var i = 0; i < entries.length; i += 1) {
      var normalized = normalizeProbeText(getMenuEntryLabel(entries[i]));
      if (normalized.indexOf("mod: ui toolbox") >= 0 || normalized.indexOf("mod: ui extractor") >= 0) {
        modEntry = entries[i];
        break;
      }
    }
    if (!modEntry) {
      return;
    }
    if (modEntry !== topContainer.lastElementChild) {
      topContainer.appendChild(modEntry);
    }
  }

  function getMenuEntryLabel(entry) {
    if (!entry) {
      return "";
    }

    var labelNode = null;
    try {
      labelNode = entry.querySelector(":scope > a, :scope > span, :scope > div");
    } catch (_ignoreScopeQuery) {
      labelNode = null;
    }

    if (!labelNode) {
      var first = entry.firstElementChild;
      if (first) {
        var tag = String(first.tagName || "").toUpperCase();
        if (tag !== "UL" && tag !== "OL") {
          labelNode = first;
        }
      }
    }

    if (labelNode) {
      return textOf(labelNode);
    }

    try {
      var clone = entry.cloneNode(true);
      var nestedLists = clone.querySelectorAll("ul,ol");
      for (var i = 0; i < nestedLists.length; i += 1) {
        var list = nestedLists[i];
        if (list && list.parentNode) {
          list.parentNode.removeChild(list);
        }
      }
      return textOf(clone);
    } catch (_ignoreClone) {}

    return textOf(entry);
  }

  function ensureQuickLuaMenuEntries(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return;
    }

    var topContainer = findTopLevelMenuContainer(menuRoot);
    var editLuaEntry = findNativeMenuEntryByText(menuRoot, "edit lua script");
    if (!topContainer || !editLuaEntry) {
      removeQuickLuaMenuEntries(menuRoot);
      return;
    }

    var topEntries = getDirectMenuEntries(topContainer);
    if (topEntries.length <= 0) {
      removeQuickLuaMenuEntries(menuRoot);
      return;
    }

    var hasTopLevelEdit = false;
    for (var i = 0; i < topEntries.length; i += 1) {
      var normalized = normalizeProbeText(getMenuEntryLabel(topEntries[i]));
      if (normalized.indexOf("edit lua script") >= 0) {
        hasTopLevelEdit = true;
        break;
      }
    }

    var templateEntry = topEntries[0];
    var quickEdit = menuRoot.querySelector("#" + quickEditLuaMenuItemId);
    if (!hasTopLevelEdit && !quickEdit) {
      quickEdit = createQuickMenuEntry(
        quickEditLuaMenuItemId,
        "Edit Lua script",
        function () {
          triggerEditLuaFromQuickMenu(menuRoot);
        },
        templateEntry);
    }
    if (hasTopLevelEdit && quickEdit && quickEdit.parentNode) {
      quickEdit.parentNode.removeChild(quickEdit);
      quickEdit = null;
    }

    var insertionEntries = getDirectMenuEntries(topContainer);
    var insertionPoint = insertionEntries.length > 1 ? insertionEntries[1] : null;

    if (quickEdit) {
      if (quickEdit.parentNode !== topContainer) {
        if (insertionPoint) {
          topContainer.insertBefore(quickEdit, insertionPoint);
        } else {
          topContainer.appendChild(quickEdit);
        }
      }
    }

    var quickInject = menuRoot.querySelector("#" + quickInjectProbeMenuItemId);
    if (quickInject && quickInject.parentNode) {
      quickInject.parentNode.removeChild(quickInject);
    }

    moveModMenuEntryToBottom(topContainer);
  }

  function waitForLuaEditorOpen(timeoutMs, pollIntervalMs) {
    var timeout = Math.max(250, Math.min(15000, parseInt(timeoutMs, 10) || 6000));
    var poll = Math.max(25, Math.min(1000, parseInt(pollIntervalMs, 10) || 100));
    var startedAt = Date.now();

    return new Promise(function (resolve) {
      function finish(opened, reason) {
        var snapshot = null;
        try {
          snapshot = typeof describeLuaEditor === "function" ? describeLuaEditor() : null;
        } catch (_ignoreDescribe) {
          snapshot = null;
        }

        resolve({
          opened: !!opened,
          reason: reason || "",
          waitedMs: Date.now() - startedAt,
          visible: !!(snapshot && snapshot.visible),
          title: snapshot && snapshot.title ? String(snapshot.title) : "",
          selectedSlot: snapshot && snapshot.selectedSlot ? String(snapshot.selectedSlot) : "",
          selectedFilter: snapshot && snapshot.selectedFilter ? String(snapshot.selectedFilter) : ""
        });
      }

      function pollOnce() {
        if (isEditorVisible()) {
          finish(true, "opened");
          return;
        }
        if (Date.now() - startedAt >= timeout) {
          finish(false, "timeout");
          return;
        }
        window.setTimeout(pollOnce, poll);
      }

      pollOnce();
    });
  }

  function hasUsableMenuRoot(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return false;
    }

    try {
      var menuEntries = menuRoot.querySelectorAll("li[helperid], li.menu, li.menu_checked, li.dev_menu, li.warning, li.info");
      if (menuEntries && menuEntries.length > 0) {
        return true;
      }
    } catch (_ignoreMenuEntries) {}

    try {
      if ((menuRoot.children && menuRoot.children.length > 0) || String(menuRoot.innerHTML || "").trim() !== "") {
        return true;
      }
    } catch (_ignoreHtml) {}

    return false;
  }

  function openLuaEditorFromMcp(options) {
    var settings = options && typeof options === "object" ? options : {};
    var timeoutMs = settings.timeoutMs;
    var pollIntervalMs = settings.pollIntervalMs;
    var allowShortcutFallback = settings.allowShortcutFallback !== false;
    var menuRoot = null;

    if (isEditorVisible()) {
      return Promise.resolve({
        opened: true,
        reason: "already_visible",
        waitedMs: 0,
        visible: true,
        title: "",
        selectedSlot: "",
        selectedFilter: "",
        usedMenuRoot: false,
        usedShortcutFallback: false
      });
    }

    try {
      menuRoot = document.getElementById("main_context_menu");
    } catch (_ignoreMenuLookup) {
      menuRoot = null;
    }

    if (hasUsableMenuRoot(menuRoot)) {
      triggerEditLuaFromQuickMenu(menuRoot);
      return waitForLuaEditorOpen(timeoutMs, pollIntervalMs).then(function (result) {
        result.usedMenuRoot = true;
        result.usedShortcutFallback = false;
        return result;
      });
    }

    if (!allowShortcutFallback) {
      return Promise.resolve({
        opened: false,
        reason: menuRoot ? "menu_root_not_usable" : "no_menu_root",
        waitedMs: 0,
        visible: false,
        title: "",
        selectedSlot: "",
        selectedFilter: "",
        usedMenuRoot: false,
        usedShortcutFallback: false
      });
    }

    var shortcutTriggered = triggerCtrlLShortcut();
    return waitForLuaEditorOpen(timeoutMs, pollIntervalMs).then(function (result) {
      result.usedMenuRoot = false;
      result.usedShortcutFallback = true;
      result.shortcutTriggered = !!shortcutTriggered;
      if (!result.opened && result.reason === "timeout" && !shortcutTriggered) {
        result.reason = "shortcut_not_triggered";
      }
      return result;
    });
  }

  state.openLuaEditorFromMcp = openLuaEditorFromMcp;

