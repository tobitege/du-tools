  function collectManagerIdentifiers() {
    var manager = window.LUAEditorManager;
    if (!manager || !manager.currentData || typeof manager.currentData !== "object") {
      return null;
    }

    var data = manager.currentData;
    var keys = [];
    try {
      keys = Object.keys(data);
    } catch (_ignoreKeys) {
      keys = [];
    }

    var identifiers = {};
    var count = 0;
    for (var i = 0; i < keys.length; i += 1) {
      var key = String(keys[i] || "");
      if (!key) {
        continue;
      }

      var lower = key.toLowerCase();
      var isInteresting = lower === "slot" ||
        lower === "filter" ||
        lower === "event" ||
        lower === "action" ||
        lower.indexOf("id") >= 0 ||
        lower.indexOf("uuid") >= 0 ||
        lower.indexOf("name") >= 0;
      if (!isInteresting) {
        continue;
      }

      var value = data[key];
      if (value === null || typeof value === "undefined") {
        continue;
      }

      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        identifiers[key] = limitText(String(value), 96);
        count += 1;
      } else if (Array.isArray(value)) {
        identifiers[key] = "array:" + value.length;
        count += 1;
      }

      if (count >= 20) {
        break;
      }
    }

    if (count <= 0) {
      return {
        keys: keys.slice(0, 24)
      };
    }

    return {
      keys: keys.slice(0, 24),
      identifiers: identifiers
    };
  }

  function hashStringFNV1a(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  function summarizeCodeForSwitch(value) {
    if (typeof value !== "string") {
      return summarizeArg(value);
    }

    var wasSampled = value.length > 16384;
    var sample = wasSampled ? (value.slice(0, 8192) + "\n...\n" + value.slice(value.length - 8192)) : value;
    return {
      type: "string",
      len: value.length,
      hash: hashStringFNV1a(sample),
      sampled: wasSampled,
      preview: value.slice(0, 96)
    };
  }

  function getSnippetMemoryKeyFromCode(code) {
    if (typeof code !== "string") {
      return "";
    }

    var normalized = code.replace(/\r\n?/g, "\n");
    var sample = normalized;
    if (sample.length > 65536) {
      sample = sample.slice(0, 32768) + "\n...\n" + sample.slice(sample.length - 32768);
    }
    return "snippet:" + normalized.length + ":" + hashStringFNV1a(sample);
  }

  function getSnippetMemoryKeyFromEditor(codeMirror) {
    if (!codeMirror || typeof codeMirror.getValue !== "function") {
      return "";
    }
    try {
      return getSnippetMemoryKeyFromCode(String(codeMirror.getValue() || ""));
    } catch (_ignoreGetValue) {
      return "";
    }
  }

  function syncCurrentSnippetKeyFromEditor() {
    var key = getSnippetMemoryKeyFromEditor(getLuaCodeMirror());
    if (key) {
      state.currentSnippetKey = key;
    }
  }

  function getContextSnapshot() {
    var codeMirror = getLuaCodeMirror();
    var managerKey = getManagerContextKey();
    var domKey = getDomContextKey();
    var contextKey = managerKey || domKey || getEditorContextKey(codeMirror) || state.lastContextKey || "";
    var snapshot = {
      contextKey: contextKey
    };

    if (managerKey) {
      snapshot.managerKey = managerKey;
    }
    if (domKey) {
      snapshot.domKey = domKey;
    }

    var managerData = collectManagerIdentifiers();
    if (managerData) {
      snapshot.managerData = managerData;
    }

    if (codeMirror && typeof codeMirror.getCursor === "function") {
      try {
        var cursor = codeMirror.getCursor();
        if (cursor && typeof cursor.line === "number") {
          snapshot.cursor = {
            line: cursor.line,
            ch: typeof cursor.ch === "number" ? cursor.ch : 0
          };
        }
      } catch (_ignoreCursor) {}
    }

    return snapshot;
  }

  function getEditorViewportSnapshot() {
    var codeMirror = getLuaCodeMirror();
    if (!codeMirror) {
      return null;
    }

    var out = {};
    try {
      if (typeof codeMirror.getScrollInfo === "function") {
        var s = codeMirror.getScrollInfo();
        if (s) {
          if (typeof s.top === "number") { out.scrollTopPx = s.top; }
          if (typeof s.left === "number") { out.scrollLeftPx = s.left; }
          if (typeof s.height === "number") { out.scrollHeightPx = s.height; }
          if (typeof s.clientHeight === "number") { out.clientHeightPx = s.clientHeight; }
          if (typeof s.width === "number") { out.scrollWidthPx = s.width; }
          if (typeof s.clientWidth === "number") { out.clientWidthPx = s.clientWidth; }
        }
      }
    } catch (_ignoreScrollInfo) {}

    try {
      if (typeof codeMirror.lineCount === "function") {
        out.lineCount = codeMirror.lineCount();
      }
    } catch (_ignoreLineCount) {}

    try {
      if (typeof out.scrollTopPx === "number" && typeof codeMirror.lineAtHeight === "function") {
        out.topLine = codeMirror.lineAtHeight(out.scrollTopPx, "local");
      }
    } catch (_ignoreTopLine) {}

    try {
      if (typeof codeMirror.getScrollerElement === "function") {
        var cmScroller = codeMirror.getScrollerElement();
        if (cmScroller) {
          out.cmScrollerTopPx = cmScroller.scrollTop;
          out.cmScrollerLeftPx = cmScroller.scrollLeft;
          out.cmScrollerHeightPx = cmScroller.scrollHeight;
          out.cmScrollerClientHeightPx = cmScroller.clientHeight;
        }
      }
    } catch (_ignoreCmScroller) {}

    try {
      var wrapper = typeof codeMirror.getWrapperElement === "function" ? codeMirror.getWrapperElement() : null;
      var root = wrapper && wrapper.parentNode ? wrapper.parentNode : wrapper;
      if (root && root.querySelector) {
        var vScrollbar = root.querySelector(".CodeMirror-vscrollbar");
        if (vScrollbar) {
          out.cmVScrollbarTopPx = vScrollbar.scrollTop;
          out.cmVScrollbarHeightPx = vScrollbar.scrollHeight;
          out.cmVScrollbarClientHeightPx = vScrollbar.clientHeight;
        }
      }
    } catch (_ignoreVScrollbar) {}

    try {
      var textArea = document.getElementById("editor_window");
      if (textArea) {
        out.textAreaTopPx = textArea.scrollTop;
      }
    } catch (_ignoreTextAreaTop) {}

    try {
      if (typeof codeMirror.getCursor === "function") {
        var c = codeMirror.getCursor();
        if (c && typeof c.line === "number") { out.cursorLine = c.line; }
        if (c && typeof c.ch === "number") { out.cursorCh = c.ch; }
      }
    } catch (_ignoreCursor) {}

    return out;
  }

  function addProbeStyle() {
    if (document.getElementById("ModUiExtractor-lua-probe-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "ModUiExtractor-lua-probe-style";
    style.type = "text/css";
    style.textContent = ""
      + "#dpu_editor[data-lua-probe-active=\"1\"]{"
      + "--lua-probe-accent:rgba(244,210,93,0.95);"
      + "--lua-probe-header-bg:rgba(54,45,18,0.96);"
      + "--lua-probe-caret-line-bg:rgba(244,210,93,0.20);}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper{"
      + "box-shadow:0 0 0 1px var(--lua-probe-accent), 0 0 22px var(--lua-probe-accent) !important;"
      + "border-color:var(--lua-probe-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .editor_header .header_container{"
      + "position:relative;"
      + "background:var(--lua-probe-header-bg) !important;"
      + "border-bottom:1px solid var(--lua-probe-accent) !important;}"
      + "#dpu_editor #ModUiExtractor-lua-theme-dots{"
      + "position:absolute;left:12px;top:50%;transform:translateY(-50%);"
      + "display:flex;gap:8px;align-items:center;z-index:11;}"
      + "#dpu_editor #ModUiExtractor-lua-theme-dots .lua-theme-dot{"
      + "width:12px;height:12px;border-radius:999px;border:1px solid rgba(255,255,255,0.6);"
      + "padding:0;cursor:pointer;opacity:0.88;}"
      + "#dpu_editor #ModUiExtractor-lua-theme-dots .lua-theme-dot[data-active=\"1\"]{"
      + "transform:scale(1.1);opacity:1;box-shadow:0 0 0 1px rgba(0,0,0,0.55),0 0 8px rgba(255,255,255,0.35);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle{"
      + "font-family:Play,sans-serif;font-size:1.11111111vh;font-weight:900;text-transform:uppercase;"
      + "color:rgb(182,223,237);border:1px solid rgb(182,223,237);display:flex;justify-content:center;align-items:center;text-align:center;"
      + "background-color:rgb(25,40,49);text-shadow:rgba(0,255,255,0.6) 0px -2px 26px;box-shadow:rgb(0,0,0) 1px 1px 0px inset,rgb(0,0,0) -1px -1px 0px inset;"
      + "overflow:hidden;min-width:9.25925926vh;height:2.31481481vh;min-height:2.31481481vh;max-height:2.31481481vh;padding:0 1.11111111vh;"
      + "margin-left:0.37037037vh;cursor:pointer;line-height:2.12962963vh;}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle[data-on=\"1\"]{"
      + "border-color:var(--lua-probe-accent);color:#ffffff;"
      + "box-shadow:0 0 0 1px rgba(0,0,0,0.35) inset;}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:hover,#dpu_editor #ModUiExtractor-lua-ide-sync:hover{"
      + "background-color:rgb(34,57,72);border-color:rgb(255,255,255);color:rgb(255,255,255);transition-duration:0.2s;}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:active,#dpu_editor #ModUiExtractor-lua-ide-sync:active{"
      + "background-color:rgb(182,223,237);color:rgb(28,52,60);transition-duration:0s;}"
      + "#dpu_editor #ModUiExtractor-lua-ide-sync{"
      + "font-family:Play,sans-serif;font-size:1.11111111vh;font-weight:900;text-transform:uppercase;"
      + "color:rgb(250,212,122);border:1px solid rgba(250,212,122,0.5);display:flex;justify-content:center;align-items:center;text-align:center;"
      + "background-color:rgba(9,19,24,0.8);text-shadow:rgba(0,255,255,0.45) 0px -2px 20px;box-shadow:rgb(0,0,0) 1px 1px 0px inset,rgb(0,0,0) -1px -1px 0px inset;"
      + "overflow:hidden;min-width:8.7962963vh;height:2.31481481vh;min-height:2.31481481vh;max-height:2.31481481vh;padding:0 1.11111111vh;"
      + "margin-left:0.37037037vh;cursor:pointer;line-height:2.12962963vh;}"
      + "#dpu_editor .CodeMirror .lua-probe-caret-line{"
      + "background:var(--lua-probe-caret-line-bg) !important;}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"]{"
      + "border-color:var(--lua-probe-accent) !important;"
      + "box-shadow:inset 0 0 0 1px rgba(0,0,0,0.38);}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"]::after{"
      + "content:\"\";position:absolute;top:0;left:-7px;width:4px;height:100%;"
      + "background-color:var(--lua-probe-accent);box-shadow:0 1px 2px 1px rgba(0,0,0,0.72);}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"] .actionName{"
      + "color:#ffffff;}"
      + "#main_context_menu [data-lua-probe-hit=\"1\"]{"
      + "outline:1px dashed rgba(250,212,122,0.75);outline-offset:-1px;}";

    (document.head || document.documentElement).appendChild(style);
  }

  function addProbeBadge() {
    var existing = document.getElementById("ModUiExtractor-lua-probe-badge");
    if (existing) {
      return;
    }

    var badge = document.createElement("div");
    badge.id = "ModUiExtractor-lua-probe-badge";
    badge.textContent = "LUA PROBE ACTIVE";
    badge.style.position = "fixed";
    badge.style.top = "14px";
    badge.style.right = "14px";
    badge.style.zIndex = "999999";
    badge.style.background = "rgba(8,16,20,0.9)";
    badge.style.color = "#fad47a";
    badge.style.border = "2px solid rgba(250,212,122,0.9)";
    badge.style.padding = "8px 14px";
    badge.style.fontSize = "15px";
    badge.style.letterSpacing = "0.6px";
    badge.style.fontFamily = "monospace";
    badge.style.pointerEvents = "none";

    document.body.appendChild(badge);
  }

  function textOf(node) {
    if (!node) {
      return "";
    }
    var txt = "";
    try {
      txt = node.textContent || node.innerText || "";
    } catch (_ignore) {
      txt = "";
    }
    return String(txt).replace(/\s+/g, " ").trim();
  }

  function limitText(value, maxLength) {
    var s = String(value || "");
    if (s.length <= maxLength) {
      return s;
    }
    return s.slice(0, maxLength);
  }

  function getLuaCodeMirror() {
    try {
      var textArea = document.getElementById("editor_window");
      if (textArea && textArea.CodeMirror) {
        return textArea.CodeMirror;
      }
    } catch (_ignore1) {}

    try {
      var wrapper = document.querySelector("#editor_window_code .CodeMirror");
      if (wrapper && wrapper.CodeMirror) {
        return wrapper.CodeMirror;
      }
    } catch (_ignore2) {}

    return null;
  }

  function getManagerContextKey() {
    var manager = window.LUAEditorManager;
    if (!manager || !manager.currentData) {
      return "";
    }

    var data = manager.currentData;
    var keys = [
      "slotId",
      "slot",
      "slotName",
      "slotUuid",
      "slotIndex",
      "filterId",
      "filter",
      "filterName",
      "action",
      "actionName",
      "eventName",
      "event",
      "eventId"
    ];
    var parts = [];

    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var value = data[key];
      if (value === null || typeof value === "undefined") {
        continue;
      }
      var strValue = String(value);
      if (!strValue) {
        continue;
      }
      parts.push(key + "=" + limitText(strValue, 48));
    }

    if (parts.length > 0) {
      return "mgr:" + parts.join("|");
    }

    try {
      var json = JSON.stringify(data);
      if (json) {
        return "mgrjson:" + limitText(json, 180);
      }
    } catch (_ignore) {}

    return "";
  }

  function findFirstText(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var node = document.querySelector(selectors[i]);
        var text = textOf(node);
        if (text) {
          return limitText(text, 64);
        }
      } catch (_ignore) {}
    }
    return "";
  }

  function findFirstNode(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var node = document.querySelector(selectors[i]);
        if (node) {
          return node;
        }
      } catch (_ignore) {}
    }
    return null;
  }

  function getNodeIdentity(node, prefix) {
    if (!node) {
      return "";
    }
    var parts = [];
    try {
      var text = limitText(textOf(node), 64);
      if (text) {
        parts.push("text=" + text);
      }
    } catch (_ignoreText) {}
    try {
      var id = node.getAttribute ? String(node.getAttribute("id") || "") : "";
      if (id) {
        parts.push("id=" + limitText(id, 48));
      }
    } catch (_ignoreId) {}
    try {
      var ds = node.getAttribute ? String(node.getAttribute("data-slot") || node.getAttribute("data-name") || node.getAttribute("data-index") || "") : "";
      if (ds) {
        parts.push("data=" + limitText(ds, 48));
      }
    } catch (_ignoreData) {}
    try {
      var className = node.className ? String(node.className) : "";
      if (className) {
        parts.push("class=" + limitText(className, 64));
      }
    } catch (_ignoreClass) {}
    try {
      if (node.parentNode && node.parentNode.children) {
        var idx = Array.prototype.indexOf.call(node.parentNode.children, node);
        if (idx >= 0) {
          parts.push("idx=" + idx);
        }
      }
    } catch (_ignoreIdx) {}
    if (parts.length <= 0) {
      return "";
    }
    return prefix + "{" + parts.join("|") + "}";
  }

  function getDomContextKey() {
    var slotNode = findFirstNode(SLOT_SELECTORS);
    var filterNode = findFirstNode(FILTER_SELECTORS);
    var slotText = findFirstText(SLOT_SELECTORS);
    var filterText = findFirstText(FILTER_SELECTORS);
    var slotIdentity = getNodeIdentity(slotNode, "slot");
    var filterIdentity = getNodeIdentity(filterNode, "filter");

    if (!slotText && !filterText && !slotIdentity && !filterIdentity) {
      return "";
    }

    return "dom:" + (slotText || slotIdentity) + "::" + (filterText || filterIdentity);
  }

  function getDomSelectedSlotNode() {
    return findFirstNode(SLOT_SELECTORS);
  }

