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
    if (document.getElementById("ModUiToolbox-lua-probe-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "ModUiToolbox-lua-probe-style";
    style.type = "text/css";
    style.textContent = ""
      + "#dpu_editor[data-lua-probe-active=\"1\"]{"
      + "--lua-probe-accent:rgba(166,226,46,0.92);"
      + "--lua-probe-header-bg:rgba(39,40,34,0.97);"
      + "--lua-probe-caret-line-bg:rgba(166,226,46,0.18);"
      + "--lua-probe-accent-solid:#a6e22e;"
      + "--lua-probe-on-accent:#272822;"
      + "--lua-probe-surface-main:#272822;"
      + "--lua-probe-surface-elevated:#3e3d32;"
      + "--lua-probe-surface-row:#49483e;"
      + "--lua-probe-surface-deep:#1e1f1c;"
      + "--lua-probe-surface-row-alt:#423f36;"
      + "--lua-probe-border-strong:#75715e;"
      + "--lua-probe-border-hover:#66d9ef;"
      + "--lua-probe-shadow:rgba(0,0,0,0.5);"
      + "--lua-probe-text-muted:#cfcfc2;"
      + "--lua-probe-text-dim:#90908a;"
      + "--lua-probe-cm-text:#f8f8f2;"
      + "--lua-probe-cm-comment:#75715e;"
      + "--lua-probe-cm-linenumber:#90908a;"
      + "--lua-probe-cm-keyword:#f92672;"
      + "--lua-probe-cm-atom:#ae81ff;"
      + "--lua-probe-cm-string:#e6db74;"
      + "--lua-probe-cm-number:#ae81ff;"
      + "--lua-probe-cm-def:#a6e22e;"
      + "--lua-probe-cm-builtin:#66d9ef;"
      + "--lua-probe-cm-variable:#f8f8f2;"
      + "--lua-probe-cm-variable-2:#fd971f;"
      + "--lua-probe-cm-operator:#f8f8f2;"
      + "--lua-probe-cm-property:#a6e22e;"
      + "--lua-probe-gutter-border:#49483e;"
      + "--lua-probe-btn-apply-bg:linear-gradient(180deg,#646e52 0%,#4a5540 45%,#343c30 100%);"
      + "--lua-probe-btn-apply-border:rgba(166,226,46,0.78);"
      + "--lua-probe-btn-apply-color:#f8f8f2;"
      + "--lua-probe-btn-apply-hover-bg:linear-gradient(180deg,#727c60 0%,#586348 45%,#3e4836 100%);"
      + "--lua-probe-btn-apply-active-bg:linear-gradient(180deg,#525a48 0%,#3a4236 45%,#2b3028 100%);"
      + "--lua-probe-btn-cancel-bg:linear-gradient(180deg,#525046 0%,#403e38 45%,#302e2a 100%);"
      + "--lua-probe-btn-cancel-border:rgba(183,174,140,0.55);"
      + "--lua-probe-btn-cancel-color:#cfcfc2;"
      + "--lua-probe-btn-cancel-hover-bg:linear-gradient(180deg,#5e5a50 0%,#4a4640 45%,#38342f 100%);"
      + "--lua-probe-btn-cancel-active-bg:linear-gradient(180deg,#45423a 0%,#35322d 45%,#282622 100%);"
      + "--lua-probe-btn-disabled-bg:linear-gradient(180deg,rgba(28,40,48,0.85) 0%,rgba(18,28,34,0.85) 100%);"
      + "--lua-probe-btn-disabled-border:rgba(84,122,135,0.45);"
      + "--lua-probe-btn-disabled-color:rgba(132,160,170,0.72);}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper{"
      + "background-color:var(--lua-probe-surface-main) !important;"
      + "filter:drop-shadow(var(--lua-probe-shadow) 0 0 5px) !important;"
      + "box-shadow:0 0 0 1px var(--lua-probe-accent), 0 0 22px var(--lua-probe-accent) !important;"
      + "border-color:var(--lua-probe-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .header_col{"
      + "background-color:var(--lua-probe-surface-elevated) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .header_col *{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .header_col .header_col_description{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .editor_header .header_bar .title{"
      + "background:transparent !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot{"
      + "background-color:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-muted) !important;"
      + "border:1px solid var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:not(.disabled):not(.selected):not(.active):not(.active_tab):hover{"
      + "background-color:var(--lua-probe-surface-row) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:not(.disabled):hover{"
      + "border-color:var(--lua-probe-border-hover) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.selected{"
      + "background-color:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.selected::after{"
      + "background-color:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.active,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.active_tab{"
      + "background-color:var(--lua-probe-accent-solid) !important;color:var(--lua-probe-on-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.active .icon,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.active_tab .icon{"
      + "fill:var(--lua-probe-on-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.disabled{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.disabled input{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot input{"
      + "background-color:transparent !important;box-shadow:none !important;"
      + "border-color:var(--lua-probe-border-strong) !important;"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot input::-webkit-input-placeholder{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot input[type=\"text\"]:focus{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:nth-child(2)::before,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:nth-child(5)::before{"
      + "background-color:var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .filters_window_wrapper{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .filters_window_wrapper .lua_editor_filters_wrapper{"
      + "background-color:var(--lua-probe-surface-elevated) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter{"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "border:1px solid var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter *{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter:hover{"
      + "border-color:var(--lua-probe-border-hover) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .actionName{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_header .delete_btn{"
      + "fill:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_header .delete_btn:hover{"
      + "fill:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .action_list_button_wrapper .ddContainer svg{"
      + "fill:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionInputs input{"
      + "background-color:var(--lua-probe-surface-main) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionInputs input[type=\"text\"]:focus{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionBindList{"
      + "background-color:var(--lua-probe-surface-row) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionBindList li{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;"
      + "border-color:var(--lua-probe-text-muted) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .actionBindList li:hover{"
      + "background-color:var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter.selected .filter_wrapper::after{"
      + "background-color:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .lua_empty_container{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .actions_container .actions_list_wrapper .action_element{"
      + "background-color:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .action_list_button_wrapper .ddContainer .actionsList li{"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "color:var(--lua-probe-text-muted) !important;border-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter .filter_wrapper .filter_container .actionsContainer .toggleBtnContainer .action_list_button_wrapper .ddContainer .actionsList li:hover{"
      + "background-color:var(--lua-probe-text-muted) !important;color:var(--lua-probe-surface-main) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;"
      + "border:1px solid var(--lua-probe-btn-apply-border) !important;"
      + "color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3) !important;"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;"
      + "}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:active:not(.disabled){"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-apply-active-bg) !important;"
      + "}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:hover:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:active:not(.disabled) svg,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:active:not(.disabled):hover svg{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button.disabled{"
      + "border-color:var(--lua-probe-btn-disabled-border) !important;color:var(--lua-probe-btn-disabled-color) !important;"
      + "background:var(--lua-probe-btn-disabled-bg) !important;"
      + "background-image:none !important;"
      + "text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button.disabled .icon{"
      + "fill:var(--lua-probe-btn-disabled-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button.active{"
      + "color:var(--lua-probe-btn-apply-color) !important;border-color:var(--lua-probe-btn-apply-border) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;"
      + "}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror{"
      + "background-color:var(--lua-probe-surface-deep) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror pre,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror pre{"
      + "color:var(--lua-probe-cm-text) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror .CodeMirror-gutters{"
      + "background-color:var(--lua-probe-surface-deep) !important;"
      + "border-right-color:var(--lua-probe-gutter-border) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-keyword,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-keyword{"
      + "color:var(--lua-probe-cm-keyword) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-atom,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-atom{"
      + "color:var(--lua-probe-cm-atom) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-string,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-string{"
      + "color:var(--lua-probe-cm-string) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-number,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-number{"
      + "color:var(--lua-probe-cm-number) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-def,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-def{"
      + "color:var(--lua-probe-cm-def) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-builtin,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-builtin{"
      + "color:var(--lua-probe-cm-builtin) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-variable,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-variable{"
      + "color:var(--lua-probe-cm-variable) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-variable-2,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-variable-2{"
      + "color:var(--lua-probe-cm-variable-2) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-operator,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-operator{"
      + "color:var(--lua-probe-cm-operator) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-property,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror span.cm-property{"
      + "color:var(--lua-probe-cm-property) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror span.cm-comment{"
      + "color:var(--lua-probe-cm-comment) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror .CodeMirror-linenumber{"
      + "color:var(--lua-probe-cm-linenumber) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .codeMirror{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .font_size_wrapper .lua_change_font_size,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .lua_change_font_size{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;"
      + "border-color:var(--lua-probe-text-muted) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .font_size_wrapper .lua_change_font_size:hover:not(.disabled),"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .lua_change_font_size:hover:not(.disabled){"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .font_size_wrapper .lua_change_font_size.active,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .lua_change_font_size.active{"
      + "background-color:var(--lua-probe-accent-solid) !important;color:var(--lua-probe-on-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .checkbox{"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "outline-color:var(--lua-probe-border-hover) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .header_editor .right_wrapper .wrap_line_wrapper .checkbox:checked{"
      + "background-color:var(--lua-probe-accent-solid) !important;"
      + "outline-color:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list_header{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "border-bottom-color:var(--lua-probe-border-strong) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list_header span{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list{"
      + "background-color:var(--lua-probe-surface-elevated) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list .error_li{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "border-top-color:var(--lua-probe-surface-main) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list .error_li:nth-child(odd){"
      + "background-color:var(--lua-probe-surface-row-alt) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .error_list .error_li:hover{"
      + "background-color:var(--lua-probe-surface-row) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .lua_error_header_wrapper .value{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .lua_error_header_wrapper .value .lua_error_ctn_value{"
      + "color:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .lua_error_header_wrapper{"
      + "display:flex;align-items:center;gap:10px;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .lua_error_header_wrapper .lua-probe-buffer-size{"
      + "display:flex;flex:1 1 auto;justify-content:center;align-items:center;text-align:center;"
      + "margin-left:16px;color:#ffffff !important;white-space:nowrap;"
      + "font-family:Play,sans-serif;font-size:13.59814835px;font-weight:600;line-height:16px;text-transform:uppercase;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .reduce_size{"
      + "fill:var(--lua-probe-accent-solid) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .editor_header .header_container{"
      + "position:relative;"
      + "background:var(--lua-probe-header-bg) !important;"
      + "border-bottom:1px solid var(--lua-probe-accent) !important;}"
      + "#dpu_editor #ModUiToolbox-lua-theme-dots{"
      + "position:absolute;left:12px;top:50%;transform:translateY(-50%);"
      + "display:flex;gap:8px;align-items:center;z-index:11;overflow:visible;}"
      + "#dpu_editor #ModUiToolbox-lua-theme-dots .lua-theme-dot{"
      + "width:12px;height:12px;border-radius:999px;border:1px solid rgba(255,255,255,0.6);"
      + "padding:0;cursor:pointer;opacity:0.88;}"
      + "#dpu_editor #ModUiToolbox-lua-theme-dots .lua-theme-dot[data-active=\"1\"]{"
      + "transform:scale(1.1);opacity:1;box-shadow:0 0 0 1px rgba(0,0,0,0.55),0 0 8px rgba(255,255,255,0.35);}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-trigger,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-trigger{"
      + "width:18px;height:18px;padding:0;border-radius:6px;cursor:pointer;"
      + "display:flex;align-items:center;justify-content:center;"
      + "margin-left:3px;"
      + "border:1px solid rgba(255,255,255,0.22);background:rgba(0,0,0,0.28);"
      + "color:var(--lua-probe-text-muted) !important;font-family:Play,sans-serif;font-size:11px;font-weight:900;line-height:1;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-trigger:hover,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-trigger:hover{"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-text-muted) !important;background:rgba(0,0,0,0.42);}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-panel,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-panel{"
      + "display:none;position:absolute;left:0;top:calc(100% + 8px);z-index:40;width:420px;max-height:52vh;overflow:auto;"
      + "padding:10px;border-radius:10px;background:var(--lua-probe-surface-elevated) !important;"
      + "border:1px solid var(--lua-probe-accent) !important;box-shadow:0 10px 26px rgba(0,0,0,0.42);}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-panel[data-open=\"1\"],"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-panel[data-open=\"1\"]{display:block;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-status,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-status{"
      + "color:var(--lua-probe-text-dim) !important;font-family:Play,sans-serif;font-size:12px;font-weight:700;margin-bottom:8px;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-list,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-right:-6px;margin-bottom:-8px;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-item,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-item{"
      + "display:flex;align-items:center;width:calc(100% - 6px);min-height:30px;padding:7px 10px;border-radius:8px;cursor:pointer;"
      + "margin:0 6px 8px 0;"
      + "border:1px solid transparent;background:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-muted) !important;"
      + "text-align:left;font-family:Play,sans-serif;font-size:13px;font-weight:700;outline:none;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-item:hover,"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-item:focus,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-item:hover{"
      + "border-color:var(--lua-probe-border-hover) !important;background:var(--lua-probe-surface-row-alt) !important;color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-item:focus{"
      + "border-color:var(--lua-probe-border-hover) !important;background:var(--lua-probe-surface-row-alt) !important;color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-item[data-active=\"1\"],"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-item[data-active=\"1\"]{"
      + "border-color:var(--lua-probe-accent) !important;box-shadow:0 0 0 1px rgba(0,0,0,0.25) inset;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-swatch,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-swatch{"
      + "width:12px;height:12px;border-radius:999px;flex:0 0 12px;border:1px solid rgba(255,255,255,0.55);margin-right:8px;}"
      + "#dpu_editor .modui-theme-switcher .lua-theme-catalog-label,"
      + ".screen_content_editor_panel .modui-theme-switcher .lua-theme-catalog-label{"
      + "display:block;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase;}"
      + "#dpu_editor #ModUiToolbox-lua-caret-toggle,#dpu_editor #ModUiToolbox-lua-ide-sync{"
      + "font-family:Play,sans-serif;font-size:1.11111111vh;font-weight:900;text-transform:uppercase;"
      + "display:flex;justify-content:center;align-items:center;text-align:center;overflow:hidden;"
      + "height:2.31481481vh;min-height:2.31481481vh;max-height:2.31481481vh;padding:0 1.11111111vh;"
      + "margin-left:0.37037037vh;cursor:pointer;line-height:2.12962963vh;"
      + "border-radius:0.55555556vh;"
      + "border:1px solid var(--lua-probe-btn-cancel-border);"
      + "background:var(--lua-probe-btn-cancel-bg);"
      + "color:var(--lua-probe-btn-cancel-color);"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -2px 0 rgba(0,0,0,0.46),0 1px 0 rgba(0,0,0,0.2),0 3px 10px rgba(0,0,0,0.28);"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor #ModUiToolbox-lua-caret-toggle{"
      + "min-width:9.25925926vh;}"
      + "#dpu_editor #ModUiToolbox-lua-ide-sync{"
      + "min-width:8.7962963vh;color:var(--lua-probe-btn-apply-color);border-color:var(--lua-probe-btn-apply-border);"
      + "background:var(--lua-probe-btn-apply-bg);}"
      + "#dpu_editor #ModUiToolbox-lua-caret-toggle[data-on=\"1\"]{"
      + "border-color:var(--lua-probe-btn-apply-border);color:var(--lua-probe-btn-apply-color);"
      + "background:var(--lua-probe-btn-apply-bg);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3);}"
      + "#dpu_editor #ModUiToolbox-lua-caret-toggle:hover,#dpu_editor #ModUiToolbox-lua-ide-sync:hover{"
      + "border-color:var(--lua-probe-border-hover);color:var(--lua-probe-btn-cancel-color);"
      + "background:var(--lua-probe-btn-cancel-hover-bg);}"
      + "#dpu_editor #ModUiToolbox-lua-caret-toggle:active,#dpu_editor #ModUiToolbox-lua-ide-sync:active{"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-cancel-active-bg);}"
      + "#dpu_editor #ModUiToolbox-lua-caret-toggle:focus,#dpu_editor #ModUiToolbox-lua-ide-sync:focus{"
      + "outline:none;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"]{"
      + "background-color:var(--lua-probe-surface-main) !important;"
      + "border-color:var(--lua-probe-accent) !important;"
      + "filter:drop-shadow(var(--lua-probe-shadow) 0 0 5px) !important;"
      + "box-shadow:0 0 0 1px var(--lua-probe-accent),0 0 22px var(--lua-probe-accent) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .header_block{"
      + "position:relative;background:var(--lua-probe-header-bg) !important;"
      + "border-bottom:1px solid var(--lua-probe-accent) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .header_block .panel_title{"
      + "color:var(--lua-probe-text-muted) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42) !important;"
      + "padding-left:4.25925926vh !important;"
      + "padding-right:4.25925926vh !important;"
      + "box-sizing:border-box;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content{"
      + "background:var(--lua-probe-surface-main) !important;color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line{"
      + "background:var(--lua-probe-surface-elevated) !important;"
      + "border:1px solid var(--lua-probe-border-strong) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .code_editor_header{"
      + "background:transparent !important;border-bottom-color:var(--lua-probe-border-strong) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .left_wrapper,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .right_wrapper,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .mode_switch_wrapper{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .sub_title_wrapper .sub_title{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .sub_title_wrapper .icon{"
      + "fill:var(--lua-probe-accent-solid) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .wrap_line_wrapper,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .mode_switch_wrapper{"
      + "background:var(--lua-probe-surface-row) !important;"
      + "border:1px solid var(--lua-probe-border-strong) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),0 1px 0 rgba(0,0,0,0.16) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .wrap_line_wrapper:hover,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper:hover,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .mode_switch_wrapper:hover{"
      + "border-color:var(--lua-probe-border-hover) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .wrap_line_wrapper .label,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper .label,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .mode_switch_wrapper .label{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper .font_button{"
      + "background:var(--lua-probe-surface-row-alt) !important;"
      + "border-color:var(--lua-probe-border-strong) !important;"
      + "color:var(--lua-probe-text-muted) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.35) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper .font_button:hover{"
      + "background:var(--lua-probe-surface-row) !important;"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .content .top_line .font_size_wrapper .font_button:active{"
      + "background:var(--lua-probe-surface-deep) !important;}"
      + ".screen_content_editor_panel #ModUiToolbox-screen-theme-dots{"
      + "position:absolute;left:12px;top:50%;transform:translateY(-50%);"
      + "display:flex;gap:8px;align-items:center;z-index:11;overflow:visible;}"
      + ".screen_content_editor_panel #ModUiToolbox-screen-theme-dots .lua-theme-dot{"
      + "width:12px;height:12px;border-radius:999px;border:1px solid rgba(255,255,255,0.6);"
      + "padding:0;cursor:pointer;opacity:0.88;}"
      + ".screen_content_editor_panel #ModUiToolbox-screen-theme-dots .lua-theme-dot[data-active=\"1\"]{"
      + "transform:scale(1.1);opacity:1;box-shadow:0 0 0 1px rgba(0,0,0,0.55),0 0 8px rgba(255,255,255,0.35);}"
      + ".screen_content_editor_panel #ModUiToolbox-screen-ide-sync{"
      + "font-family:Play,sans-serif;font-size:1.11111111vh;font-weight:900;text-transform:uppercase;"
      + "display:flex;justify-content:center;align-items:center;text-align:center;overflow:hidden;"
      + "height:2.31481481vh;min-height:2.31481481vh;max-height:2.31481481vh;padding:0 1.11111111vh;"
      + "margin-left:0.37037037vh;cursor:pointer;line-height:2.12962963vh;border-radius:0.55555556vh;"
      + "border:1px solid var(--lua-probe-btn-apply-border);background:var(--lua-probe-btn-apply-bg);"
      + "color:var(--lua-probe-btn-apply-color);text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3);"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;"
      + "min-width:8.7962963vh;}"
      + ".screen_content_editor_panel #ModUiToolbox-screen-ide-sync:hover{"
      + "border-color:var(--lua-probe-border-hover);color:var(--lua-probe-btn-apply-color);"
      + "background:var(--lua-probe-btn-apply-hover-bg);}"
      + ".screen_content_editor_panel #ModUiToolbox-screen-ide-sync:active{"
      + "transform:translateY(1px);background:var(--lua-probe-btn-apply-active-bg);}"
      + ".screen_content_editor_panel #ModUiToolbox-screen-ide-sync:focus{"
      + "outline:none;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror{"
      + "background-color:var(--lua-probe-surface-deep) !important;color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror .CodeMirror-gutters{"
      + "background-color:var(--lua-probe-surface-deep) !important;"
      + "border-right-color:var(--lua-probe-gutter-border) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .CodeMirror .CodeMirror-linenumber{"
      + "color:var(--lua-probe-cm-linenumber) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line{"
      + "background:var(--lua-probe-surface-elevated) !important;"
      + "border-top:1px solid var(--lua-probe-border-strong) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block{"
      + "background:var(--lua-probe-surface-elevated) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block .error_header{"
      + "background:var(--lua-probe-surface-elevated) !important;"
      + "border-bottom:1px solid var(--lua-probe-border-strong) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block .error_area{"
      + "background:var(--lua-probe-surface-main) !important;"
      + "border-top:1px solid var(--lua-probe-gutter-border) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block .error_header .left_wrapper{"
      + "display:flex;align-items:center;gap:10px;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .error_block .error_header .left_wrapper .lua-probe-screen-buffer-size{"
      + "display:flex;flex:1 1 auto;justify-content:center;align-items:center;text-align:center;"
      + "margin-left:16px;color:var(--lua-probe-text-dim) !important;white-space:nowrap;"
      + "font-family:Play,sans-serif;font-size:19.56111145px;font-weight:600;line-height:23px;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .editor_error_ctn{"
      + "background:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .editor_error_ctn .editor_error_ctn_value{"
      + "color:var(--lua-probe-accent-solid) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .wrap_line_wrapper .checkbox,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .enable_logs_wrapper .checkbox{"
      + "background-color:var(--lua-probe-surface-row) !important;"
      + "outline-color:var(--lua-probe-border-hover) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .wrap_line_wrapper .checkbox:checked,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .enable_logs_wrapper .checkbox:checked{"
      + "background-color:var(--lua-probe-accent-solid) !important;"
      + "outline-color:var(--lua-probe-accent-solid) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch{"
      + "background-color:var(--lua-probe-surface-row-alt) !important;"
      + "border-color:var(--lua-probe-border-strong) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch .slider{"
      + "background:var(--lua-probe-btn-cancel-bg) !important;"
      + "border-color:var(--lua-probe-btn-apply-border) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 1px 4px rgba(0,0,0,0.28) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch .switch_label{"
      + "color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch .unchecked_option{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch input:checked ~ .checked_option,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .mode_switch_wrapper .checkbox_switch input:not(:checked) ~ .unchecked_option{"
      + "color:var(--lua-probe-on-accent) !important;font-weight:700 !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .character_count{"
      + "color:var(--lua-probe-text-dim) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button::before,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button::after{"
      + "display:none !important;content:none !important;animation:none !important;opacity:0 !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;border:1px solid var(--lua-probe-btn-apply-border) !important;"
      + "color:var(--lua-probe-btn-apply-color) !important;background:var(--lua-probe-btn-apply-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3) !important;"
      + "transition:background 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .cancel_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;border:1px solid var(--lua-probe-btn-cancel-border) !important;"
      + "color:var(--lua-probe-btn-cancel-color) !important;background:var(--lua-probe-btn-cancel-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -2px 0 rgba(0,0,0,0.46),0 1px 0 rgba(0,0,0,0.2),0 3px 10px rgba(0,0,0,0.28) !important;"
      + "transition:background 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -2px 0 rgba(0,0,0,0.38),0 2px 10px rgba(0,0,0,0.34) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .cancel_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-cancel-color) !important;"
      + "background:var(--lua-probe-btn-cancel-hover-bg) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.18),inset 0 -2px 0 rgba(0,0,0,0.4),0 2px 10px rgba(0,0,0,0.3) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button:active:not(.disabled){"
      + "transform:translateY(1px);background:var(--lua-probe-btn-apply-active-bg) !important;"
      + "box-shadow:inset 0 2px 0 rgba(0,0,0,0.38),inset 0 1px 0 rgba(255,255,255,0.08),0 1px 3px rgba(0,0,0,0.28) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .cancel_button:active:not(.disabled){"
      + "transform:translateY(1px);background:var(--lua-probe-btn-cancel-active-bg) !important;"
      + "box-shadow:inset 0 2px 0 rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06),0 1px 3px rgba(0,0,0,0.26) !important;}"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .save_button.disabled,"
      + ".screen_content_editor_panel[data-lua-probe-active=\"1\"] .footer_line .cancel_button.disabled{"
      + "border-color:var(--lua-probe-btn-disabled-border) !important;color:var(--lua-probe-btn-disabled-color) !important;"
      + "background:var(--lua-probe-btn-disabled-bg) !important;"
      + "background-image:none !important;text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
      + ".main_chat #ModUiToolbox-chat-copy-plain{"
      + "position:absolute;top:2.87037037vh;right:2.59259259vh;z-index:30;"
      + "font-family:Play,sans-serif;font-size:0.92592593vh;font-weight:900;text-transform:uppercase;"
      + "display:flex;justify-content:center;align-items:center;text-align:center;overflow:hidden;"
      + "min-height:2.03703704vh;padding:0 0.92592593vh;cursor:pointer;line-height:1.85185185vh;"
      + "border-radius:0.46296296vh;border:1px solid var(--lua-probe-btn-cancel-border);"
      + "background:var(--lua-probe-btn-cancel-bg);"
      + "color:var(--lua-probe-btn-cancel-color);text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -2px 0 rgba(0,0,0,0.46),0 1px 0 rgba(0,0,0,0.2),0 3px 10px rgba(0,0,0,0.28);"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + ".main_chat #ModUiToolbox-chat-copy-plain:hover:not([data-disabled=\"1\"]){"
      + "border-color:var(--lua-probe-border-hover);color:var(--lua-probe-btn-cancel-color);"
      + "background:var(--lua-probe-btn-cancel-hover-bg);}"
      + ".main_chat #ModUiToolbox-chat-copy-plain:active:not([data-disabled=\"1\"]){"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-cancel-active-bg);}"
      + ".main_chat #ModUiToolbox-chat-copy-plain:focus{"
      + "outline:none;}"
      + ".main_chat #ModUiToolbox-chat-copy-plain[data-disabled=\"1\"],"
      + ".main_chat #ModUiToolbox-chat-copy-plain:disabled{"
      + "cursor:default;border-color:var(--lua-probe-btn-disabled-border);color:var(--lua-probe-btn-disabled-color);"
      + "background:var(--lua-probe-btn-disabled-bg);"
      + "text-shadow:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5);}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button::before,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button::after{"
      + "display:none !important;content:none !important;animation:none !important;opacity:0 !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;"
      + "border:1px solid var(--lua-probe-btn-apply-border) !important;"
      + "color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.4),0 1px 0 rgba(0,0,0,0.22),0 3px 10px rgba(0,0,0,0.3) !important;"
      + "transition:background 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:not(.disabled){"
      + "font-family:Play,sans-serif !important;font-weight:900 !important;"
      + "border-radius:0.55555556vh !important;"
      + "border:1px solid var(--lua-probe-btn-cancel-border) !important;"
      + "color:var(--lua-probe-btn-cancel-color) !important;"
      + "background:var(--lua-probe-btn-cancel-bg) !important;"
      + "text-shadow:0 1px 0 rgba(0,0,0,0.42),0 0 1px rgba(0,0,0,0.35) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -2px 0 rgba(0,0,0,0.46),0 1px 0 rgba(0,0,0,0.2),0 3px 10px rgba(0,0,0,0.28) !important;"
      + "transition:background 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-apply-color) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -2px 0 rgba(0,0,0,0.38),0 2px 10px rgba(0,0,0,0.34) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:hover:not(.disabled){"
      + "border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-btn-cancel-color) !important;"
      + "background:var(--lua-probe-btn-cancel-hover-bg) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.18),inset 0 -2px 0 rgba(0,0,0,0.4),0 2px 10px rgba(0,0,0,0.3) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:active:not(.disabled){"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-apply-active-bg) !important;"
      + "box-shadow:inset 0 2px 0 rgba(0,0,0,0.38),inset 0 1px 0 rgba(255,255,255,0.08),0 1px 3px rgba(0,0,0,0.28) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:active:not(.disabled){"
      + "transform:translateY(1px);"
      + "background:var(--lua-probe-btn-cancel-active-bg) !important;"
      + "box-shadow:inset 0 2px 0 rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06),0 1px 3px rgba(0,0,0,0.26) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-cancel-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button:hover:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-apply-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:hover:not(.disabled) .icon{"
      + "fill:var(--lua-probe-btn-cancel-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button.disabled,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button.disabled{"
      + "border-color:var(--lua-probe-btn-disabled-border) !important;color:var(--lua-probe-btn-disabled-color) !important;"
      + "background:var(--lua-probe-btn-disabled-bg) !important;"
      + "background-image:none !important;"
      + "text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button[data-lua-probe-force-disabled=\"1\"]{"
      + "pointer-events:none !important;cursor:default !important;"
      + "border-color:var(--lua-probe-btn-disabled-border) !important;color:var(--lua-probe-btn-disabled-color) !important;"
      + "background:var(--lua-probe-btn-disabled-bg) !important;"
      + "background-image:none !important;text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button[data-lua-probe-force-disabled=\"1\"] .icon{"
      + "fill:var(--lua-probe-btn-disabled-color) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button.active{"
      + "color:var(--lua-probe-btn-apply-color) !important;border-color:var(--lua-probe-btn-apply-border) !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button.active{"
      + "color:var(--lua-probe-btn-cancel-color) !important;border-color:var(--lua-probe-btn-cancel-border) !important;"
      + "background:var(--lua-probe-btn-cancel-hover-bg) !important;}"
      + "#dpu_editor .CodeMirror .lua-probe-caret-line{"
      + "background:var(--lua-probe-caret-line-bg) !important;}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"]{"
      + "border-color:var(--lua-probe-accent) !important;"
      + "box-shadow:inset 0 0 0 1px rgba(0,0,0,0.38);}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"]::after{"
      + "content:\"\";position:absolute;top:0;left:-7px;width:4px;height:100%;"
      + "background-color:var(--lua-probe-accent);box-shadow:0 1px 2px 1px rgba(0,0,0,0.72);}"
      + "#dpu_editor #filters_container .filter[data-lua-probe-active-filter=\"1\"] .actionName{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#main_context_menu [data-lua-probe-hit=\"1\"]{"
      + "outline:1px dashed rgba(250,212,122,0.75);outline-offset:-1px;}";

    (document.head || document.documentElement).appendChild(style);
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
