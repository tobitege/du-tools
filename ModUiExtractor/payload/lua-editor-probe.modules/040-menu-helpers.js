  function isInterestingMenuText(txtLower) {
    return txtLower.indexOf("lua") >= 0 ||
      txtLower.indexOf("script") >= 0 ||
      txtLower.indexOf("program") >= 0;
  }

  function getInjectProbeActionId() {
    var raw = cfg.injectActionId;
    if (typeof raw === "number" && raw > 0) {
      return raw;
    }

    var parsed = parseInt(String(raw || ""), 10);
    if (parsed > 0) {
      return parsed;
    }

    return 5;
  }

  function isMenuEntryNode(node) {
    if (!node || node.nodeType !== 1) {
      return false;
    }
    if (String(node.tagName || "").toUpperCase() !== "LI") {
      return false;
    }
    if (!node.classList) {
      return false;
    }
    return node.classList.contains("menu");
  }

  function findMenuEntryByText(menuRoot, textNeedle) {
    if (!menuRoot || !menuRoot.querySelectorAll || !textNeedle) {
      return null;
    }

    var needle = normalizeProbeText(textNeedle);
    var entries = menuRoot.querySelectorAll("li.menu");
    var best = null;
    var bestLength = Number.MAX_SAFE_INTEGER;

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      var txt = normalizeProbeText(getMenuEntryLabel(entry) || textOf(entry));
      if (!txt || txt.indexOf(needle) < 0) {
        continue;
      }

      if (txt.length < bestLength) {
        best = entry;
        bestLength = txt.length;
      }
    }

    return best;
  }

  function isQuickInjectedMenuEntry(entry) {
    if (!entry) {
      return false;
    }
    if (entry.id === quickEditLuaMenuItemId || entry.id === quickInjectProbeMenuItemId) {
      return true;
    }
    try {
      return entry.getAttribute && entry.getAttribute("data-ModUiExtractor-quick") === "1";
    } catch (_ignoreQuickAttr) {}
    return false;
  }

  function findNativeMenuEntryByText(menuRoot, textNeedle) {
    if (!menuRoot || !menuRoot.querySelectorAll || !textNeedle) {
      return null;
    }

    var needle = normalizeProbeText(textNeedle);
    var entries = menuRoot.querySelectorAll("li.menu");
    var best = null;
    var bestLength = Number.MAX_SAFE_INTEGER;

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (isQuickInjectedMenuEntry(entry)) {
        continue;
      }
      var txt = normalizeProbeText(getMenuEntryLabel(entry) || textOf(entry));
      if (!txt || txt.indexOf(needle) < 0) {
        continue;
      }

      if (txt.length < bestLength) {
        best = entry;
        bestLength = txt.length;
      }
    }

    return best;
  }

  function findNativeEditLuaEntry(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return null;
    }

    var entries = menuRoot.querySelectorAll("li.menu");
    var best = null;
    var bestScore = -1;

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (isQuickInjectedMenuEntry(entry)) {
        continue;
      }

      var label = normalizeProbeText(getMenuEntryLabel(entry));
      if (!label || label.indexOf("edit lua script") !== 0) {
        continue;
      }

      var score = 0;
      if (label === "edit lua script") {
        score += 3;
      }
      if (label.indexOf("ctrl") >= 0) {
        score += 2;
      }
      if (entry.classList && !entry.classList.contains("right_dropdown")) {
        score += 2;
      }
      if (isNodeVisible(entry)) {
        score += 1;
      }

      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }

    return best || findNativeMenuEntryByText(menuRoot, "edit lua script");
  }

  function isNodeVisible(node) {
    if (!node) {
      return false;
    }
    try {
      var computed = window.getComputedStyle ? window.getComputedStyle(node, null) : null;
      if (!computed) {
        return true;
      }
      return computed.display !== "none" && computed.visibility !== "hidden" && computed.opacity !== "0";
    } catch (_ignoreVisibleCheck) {}
    return true;
  }

  function findAdvancedMenuEntry(menuRoot) {
    if (!menuRoot) {
      return null;
    }

    // Important: only target top-level "Advanced", never nested submenus like Construct -> Advanced.
    var topContainer = findTopLevelMenuContainer(menuRoot);
    var entries = getDirectMenuEntries(topContainer);
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (isQuickInjectedMenuEntry(entry)) {
        continue;
      }
      var label = normalizeProbeText(getMenuEntryLabel(entry));
      if (!label || label.indexOf("advanced") < 0) {
        continue;
      }

      var score = 0;
      if (label === "advanced") {
        score += 4;
      } else if (label.indexOf("advanced") === 0) {
        score += 2;
      }
      if (entry.classList && entry.classList.contains("right_dropdown")) {
        score += 1;
      }
      if (isNodeVisible(entry)) {
        score += 1;
      }

      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }

    return best;
  }

  function getDirectSubmenuContainer(entry) {
    if (!entry || !entry.children) {
      return null;
    }
    for (var i = 0; i < entry.children.length; i += 1) {
      var child = entry.children[i];
      if (!child || !child.tagName) {
        continue;
      }
      var tag = String(child.tagName).toUpperCase();
      if (tag === "UL" || tag === "OL") {
        return child;
      }
    }
    return null;
  }

  function findDirectMenuEntryByText(container, textNeedle) {
    if (!container || !container.children || !textNeedle) {
      return null;
    }
    var needle = normalizeProbeText(textNeedle);
    var best = null;
    var bestLength = Number.MAX_SAFE_INTEGER;
    for (var i = 0; i < container.children.length; i += 1) {
      var child = container.children[i];
      if (!isMenuEntryNode(child) || isQuickInjectedMenuEntry(child)) {
        continue;
      }
      var label = normalizeProbeText(getMenuEntryLabel(child) || textOf(child));
      if (!label || label.indexOf(needle) < 0) {
        continue;
      }
      if (label.length < bestLength) {
        best = child;
        bestLength = label.length;
      }
    }
    return best;
  }

  function findEditLuaEntryUnderAdvanced(advancedEntry) {
    if (!advancedEntry) {
      return null;
    }
    var sub = getDirectSubmenuContainer(advancedEntry);
    if (!sub) {
      return null;
    }
    return findDirectMenuEntryByText(sub, "edit lua script");
  }

  function findEditLuaEntryInside(rootNode) {
    if (!rootNode || !rootNode.querySelectorAll) {
      return null;
    }

    var entries = rootNode.querySelectorAll("li.menu");
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (isQuickInjectedMenuEntry(entry)) {
        continue;
      }
      var txt = normalizeProbeText(textOf(entry));
      if (!txt || txt.indexOf("edit lua script") < 0) {
        continue;
      }
      var score = 0;
      if (txt.indexOf("ctrl") >= 0) {
        score += 2;
      }
      if (txt.indexOf("advanced") < 0) {
        score += 1;
      }
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }
    return best;
  }

  function findTopLevelMenuContainer(menuRoot) {
    if (!menuRoot) {
      return null;
    }

    var anchorTexts = ["activate", "inspect item", "advanced", "report abuse"];
    for (var i = 0; i < anchorTexts.length; i += 1) {
      var anchorEntry = findMenuEntryByText(menuRoot, anchorTexts[i]);
      if (anchorEntry && anchorEntry.parentElement) {
        return anchorEntry.parentElement;
      }
    }

    try {
      var directChildList = menuRoot.querySelector(":scope > ul, :scope > ol");
      if (directChildList) {
        return directChildList;
      }
    } catch (_ignoreScope) {}

    return menuRoot;
  }

  function removeQuickLuaMenuEntries(menuRoot) {
    if (!menuRoot || !menuRoot.querySelectorAll) {
      return;
    }

    var ids = [quickEditLuaMenuItemId, quickInjectProbeMenuItemId];
    for (var i = 0; i < ids.length; i += 1) {
      try {
        var node = menuRoot.querySelector("#" + ids[i]);
        if (node && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      } catch (_ignoreRemoveQuick) {}
    }
  }

  function triggerElementClick(el) {
    if (!el) {
      return false;
    }

    var clickable = null;
    try {
      clickable = el.querySelector("a");
    } catch (_ignoreClickable) {}
    if (!clickable) {
      clickable = el;
    }

    var dispatched = false;
    var clientX = 0;
    var clientY = 0;
    var screenX = 0;
    var screenY = 0;
    try {
      if (clickable && typeof clickable.getBoundingClientRect === "function") {
        var rect = clickable.getBoundingClientRect();
        clientX = Math.floor(rect.left + (rect.width / 2));
        clientY = Math.floor(rect.top + (rect.height / 2));
        screenX = clientX;
        screenY = clientY;
      }
    } catch (_ignoreCoords) {}

    // Older in-game UI handlers may rely on full mouse sequence.
    try {
      var evDown = document.createEvent("MouseEvents");
      evDown.initMouseEvent("mousedown", true, true, window, 1, screenX, screenY, clientX, clientY, false, false, false, false, 0, null);
      clickable.dispatchEvent(evDown);
      dispatched = true;
    } catch (_ignoreDown) {}

    try {
      var evUp = document.createEvent("MouseEvents");
      evUp.initMouseEvent("mouseup", true, true, window, 1, screenX, screenY, clientX, clientY, false, false, false, false, 0, null);
      clickable.dispatchEvent(evUp);
      dispatched = true;
    } catch (_ignoreUp) {}

    try {
      var evClick = document.createEvent("MouseEvents");
      evClick.initMouseEvent("click", true, true, window, 1, screenX, screenY, clientX, clientY, false, false, false, false, 0, null);
      clickable.dispatchEvent(evClick);
      dispatched = true;
    } catch (_ignoreDispatch) {}

    try {
      if (typeof clickable.click === "function") {
        clickable.click();
        dispatched = true;
      }
    } catch (_ignoreClick) {}
    return dispatched;
  }

  function activateAdvancedEntry(advancedEntry) {
    if (!advancedEntry) {
      return;
    }
    try {
      if (advancedEntry.classList) {
        advancedEntry.classList.add("hover");
      }
    } catch (_ignoreHoverClass) {}

    var target = advancedEntry;
    try {
      var anchor = advancedEntry.querySelector("a");
      if (anchor) {
        target = anchor;
      }
    } catch (_ignoreAnchorLookup) {}

    try {
      var rect = target && typeof target.getBoundingClientRect === "function"
        ? target.getBoundingClientRect()
        : null;
      var clientX = rect ? Math.floor(rect.left + (rect.width / 2)) : 0;
      var clientY = rect ? Math.floor(rect.top + (rect.height / 2)) : 0;
      var screenX = clientX;
      var screenY = clientY;

      var evEnter = document.createEvent("MouseEvents");
      evEnter.initMouseEvent("mouseenter", true, true, window, 1, screenX, screenY, clientX, clientY, false, false, false, false, 0, null);
      target.dispatchEvent(evEnter);
    } catch (_ignoreEnter) {}

    try {
      var evMove = document.createEvent("MouseEvents");
      var rectMove = target && typeof target.getBoundingClientRect === "function"
        ? target.getBoundingClientRect()
        : null;
      var clientXMove = rectMove ? Math.floor(rectMove.left + (rectMove.width / 2)) : 0;
      var clientYMove = rectMove ? Math.floor(rectMove.top + (rectMove.height / 2)) : 0;
      evMove.initMouseEvent("mousemove", true, true, window, 1, clientXMove, clientYMove, clientXMove, clientYMove, false, false, false, false, 0, null);
      target.dispatchEvent(evMove);
    } catch (_ignoreMove) {}
  }

  function triggerNativeMenuHandlers(entry) {
    if (!entry) {
      return false;
    }

    var triggered = false;
    var clickable = null;
    try {
      clickable = entry.querySelector("a");
    } catch (_ignoreClickable) {}
    if (!clickable) {
      clickable = entry;
    }

    try {
      if (typeof entry.onclick === "function") {
        entry.onclick.call(entry);
        triggered = true;
      }
    } catch (_ignoreEntryOnClick) {}

    try {
      if (clickable && typeof clickable.onclick === "function") {
        clickable.onclick.call(clickable);
        triggered = true;
      }
    } catch (_ignoreClickableOnClick) {}

    return triggered;
  }

  function tryInvokeContextMenuBridge(helperId) {
    var bridges = [
      { name: "CPPMainContextMenu", obj: window.CPPMainContextMenu },
      { name: "CPPContextMenu", obj: window.CPPContextMenu },
      { name: "ContextMenu", obj: window.ContextMenu }
    ];

    var attempts = [];
    var invoked = false;
    var helperIndex = NaN;
    try {
      var parsed = String(helperId || "").match(/(\d+)/);
      if (parsed && parsed[1]) {
        helperIndex = parseInt(parsed[1], 10);
      }
    } catch (_ignoreHelperIndex) {
      helperIndex = NaN;
    }

    function tryCall(bridgeName, fnName, fn, args, signatureName, callThis) {
      try {
        fn.apply(callThis || null, args);
        attempts.push({
          bridge: bridgeName,
          method: fnName,
          signature: signatureName,
          ok: true
        });
        return true;
      } catch (err) {
        attempts.push({
          bridge: bridgeName,
          method: fnName,
          signature: signatureName,
          ok: false,
          err: limitText(String(err && err.message ? err.message : err), 260)
        });
        return false;
      }
    }

    for (var i = 0; i < bridges.length; i += 1) {
      var bridge = bridges[i];
      var obj = bridge.obj;
      if (!obj || isNaN(helperIndex)) {
        continue;
      }

      var executeAction = null;
      try {
        executeAction = obj.executeAction;
      } catch (_ignoreExecuteActionRead) {
        executeAction = null;
      }
      if (typeof executeAction !== "function") {
        continue;
      }

      // Breakthrough: executeAction expects numeric action id.
      invoked = tryCall(bridge.name, "executeAction", executeAction, [helperIndex], "helperIndex", obj) || invoked;
      if (!invoked) {
        invoked = tryCall(bridge.name, "executeAction", executeAction, [helperIndex, true], "helperIndex,true", obj) || invoked;
        invoked = tryCall(bridge.name, "executeAction", executeAction, [helperIndex, false], "helperIndex,false", obj) || invoked;
      }
    }

    return {
      invoked: invoked,
      attempts: attempts
    };
  }

  function triggerCtrlLShortcut() {
    var triggered = false;

    function dispatchKeyEvent(target, type, key, keyCode, ctrlKey) {
      if (!target || typeof target.dispatchEvent !== "function") {
        return false;
      }

      var sent = false;
      try {
        var keyboardCtor = window.KeyboardEvent;
        if (typeof keyboardCtor === "function") {
          var ke = new keyboardCtor(type, {
            key: key,
            code: key === "Control" ? "ControlLeft" : "KeyL",
            keyCode: keyCode,
            which: keyCode,
            ctrlKey: !!ctrlKey,
            bubbles: true,
            cancelable: true
          });
          target.dispatchEvent(ke);
          sent = true;
        }
      } catch (_ignoreCtor) {}

      if (sent) {
        return true;
      }

      try {
        var ev = document.createEvent("Event");
        ev.initEvent(type, true, true);
        ev.key = key;
        ev.keyCode = keyCode;
        ev.which = keyCode;
        ev.ctrlKey = !!ctrlKey;
        ev.shiftKey = false;
        ev.altKey = false;
        ev.metaKey = false;
        target.dispatchEvent(ev);
        return true;
      } catch (_ignoreLegacy) {}

      return false;
    }

    try {
      var targets = [];
      var active = null;
      try {
        active = document && document.activeElement ? document.activeElement : null;
      } catch (_ignoreActive) {
        active = null;
      }
      if (active) {
        targets.push(active);
      }
      if (document && document.body) {
        targets.push(document.body);
      }
      if (document) {
        targets.push(document);
      }
      if (window) {
        targets.push(window);
      }

      for (var i = 0; i < targets.length; i += 1) {
        var t = targets[i];
        var sentAny = false;
        sentAny = dispatchKeyEvent(t, "keydown", "Control", 17, false) || sentAny;
        sentAny = dispatchKeyEvent(t, "keydown", "l", 76, true) || sentAny;
        sentAny = dispatchKeyEvent(t, "keypress", "l", 76, true) || sentAny;
        sentAny = dispatchKeyEvent(t, "keyup", "l", 76, true) || sentAny;
        sentAny = dispatchKeyEvent(t, "keyup", "Control", 17, false) || sentAny;
        triggered = triggered || sentAny;
      }
    } catch (_ignoreShortcut) {}

    return triggered;
  }

  function triggerInjectProbeFromQuickMenu() {
    try {
      if (!window.CPPMod || typeof window.CPPMod.sendModAction !== "function") {
        return false;
      }

      var injectActionId = getInjectProbeActionId();
      window.CPPMod.sendModAction(modName, injectActionId, [], "");
      sendPacket("lua_quick_menu_inject_probe", {
        injectActionId: injectActionId
      });
      return true;
    } catch (err) {
      safeLog("quick inject failed", String(err && err.message ? err.message : err));
      return false;
    }
  }

