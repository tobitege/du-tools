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
      + "--lua-probe-cm-comment:#75715e;"
      + "--lua-probe-cm-linenumber:#90908a;"
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
      + "--lua-probe-btn-cancel-active-bg:linear-gradient(180deg,#45423a 0%,#35322d 45%,#282622 100%);}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper{"
      + "background-color:var(--lua-probe-surface-main) !important;"
      + "filter:drop-shadow(var(--lua-probe-shadow) 0 0 5px) !important;"
      + "box-shadow:0 0 0 1px var(--lua-probe-accent), 0 0 22px var(--lua-probe-accent) !important;"
      + "border-color:var(--lua-probe-accent) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .header_col{"
      + "background-color:var(--lua-probe-surface-elevated) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .header_col .header_col_description{"
      + "color:var(--lua-probe-text-muted) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .editor_header .header_bar .title{"
      + "background:transparent !important;color:#f8f8f2 !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot{"
      + "background-color:var(--lua-probe-surface-row) !important;color:#f8f8f2 !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:not(.disabled):not(.selected):not(.active):not(.active_tab):hover{"
      + "background-color:var(--lua-probe-surface-row) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot:not(.disabled):hover{"
      + "border-color:var(--lua-probe-border-hover) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.slots .slots_container .slot.selected{"
      + "background-color:var(--lua-probe-surface-row) !important;color:#f8f8f2 !important;}"
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
      + "background-color:var(--lua-probe-surface-row) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .lua_editor_filters_wrapper .filter:hover{"
      + "border-color:var(--lua-probe-border-hover) !important;}"
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
      + "border:1px solid rgba(250,212,122,0.58) !important;"
      + "color:rgb(250,222,145) !important;"
      + "background:linear-gradient(180deg,rgba(64,67,58,0.96) 0%,rgba(37,43,34,0.96) 100%) !important;"
      + "background-image:none !important;"
      + "text-shadow:rgba(20,40,52,0.9) 0px 1px 0px !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),inset 0 -1px 0 rgba(0,0,0,0.58),0 0 0 1px rgba(0,0,0,0.28) !important;"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:hover:not(.disabled){"
      + "border-color:rgba(228,244,252,0.85) !important;color:rgb(245,252,255) !important;"
      + "background:linear-gradient(180deg,rgba(56,82,99,0.98) 0%,rgba(26,48,61,0.98) 100%) !important;"
      + "background-image:none !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:active:not(.disabled){"
      + "transform:translateY(1px);"
      + "background:linear-gradient(180deg,rgba(30,48,60,0.98) 0%,rgba(18,32,41,0.98) 100%) !important;"
      + "background-image:none !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:not(.disabled) .icon{"
      + "fill:rgb(250,222,145) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:hover:not(.disabled) .icon{"
      + "fill:rgb(245,252,255) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:active:not(.disabled) svg,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button:active:not(.disabled):hover svg{"
      + "fill:rgb(245,252,255) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button.disabled{"
      + "border-color:rgba(84,122,135,0.45) !important;color:rgba(132,160,170,0.72) !important;"
      + "background:linear-gradient(180deg,rgba(28,40,48,0.85) 0%,rgba(18,28,34,0.85) 100%) !important;"
      + "background-image:none !important;"
      + "text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button.disabled .icon{"
      + "fill:rgba(132,160,170,0.72) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.filters .bottom_filter .lua_add_filter_button.active{"
      + "color:rgb(250,222,145) !important;border-color:rgba(250,212,122,0.72) !important;"
      + "background:linear-gradient(180deg,rgba(64,67,58,0.96) 0%,rgba(37,43,34,0.96) 100%) !important;"
      + "background-image:none !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper{"
      + "background-color:var(--lua-probe-surface-elevated) !important;"
      + "box-shadow:var(--lua-probe-shadow) 3px 3px 5px !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror{"
      + "background-color:var(--lua-probe-surface-deep) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .script_window_editor_wrapper .window_code .CodeMirror .CodeMirror-gutters{"
      + "background-color:var(--lua-probe-surface-deep) !important;"
      + "border-right-color:var(--lua-probe-gutter-border) !important;}"
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
      + "border-color:var(--lua-probe-border-hover) !important;color:#ffffff !important;}"
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
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col.scripts .error_ctn .header .reduce_size{"
      + "fill:var(--lua-probe-accent-solid) !important;}"
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
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle,#dpu_editor #ModUiExtractor-lua-ide-sync{"
      + "font-family:Play,sans-serif;font-size:1.11111111vh;font-weight:900;text-transform:uppercase;"
      + "display:flex;justify-content:center;align-items:center;text-align:center;overflow:hidden;"
      + "height:2.31481481vh;min-height:2.31481481vh;max-height:2.31481481vh;padding:0 1.11111111vh;"
      + "margin-left:0.37037037vh;cursor:pointer;line-height:2.12962963vh;"
      + "border-radius:0.55555556vh;"
      + "border:1px solid rgba(165,194,210,0.52);"
      + "background:linear-gradient(180deg,rgba(42,62,75,0.96) 0%,rgba(18,33,43,0.96) 100%);"
      + "color:rgb(199,227,240);"
      + "text-shadow:rgba(20,40,52,0.9) 0px 1px 0px;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),inset 0 -1px 0 rgba(0,0,0,0.58),0 0 0 1px rgba(0,0,0,0.28);"
      + "transition:background-color 0.14s ease,border-color 0.14s ease,color 0.14s ease,box-shadow 0.14s ease,transform 0.05s ease;}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle{"
      + "min-width:9.25925926vh;}"
      + "#dpu_editor #ModUiExtractor-lua-ide-sync{"
      + "min-width:8.7962963vh;color:rgb(250,222,145);border-color:rgba(250,212,122,0.58);"
      + "background:linear-gradient(180deg,rgba(64,67,58,0.96) 0%,rgba(37,43,34,0.96) 100%);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle[data-on=\"1\"]{"
      + "border-color:rgba(103,214,141,0.82);color:#ffffff;"
      + "background:linear-gradient(180deg,rgba(64,148,89,0.96) 0%,rgba(41,110,66,0.96) 100%);"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.11),inset 0 -1px 0 rgba(0,0,0,0.45),0 0 10px rgba(103,214,141,0.22);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:hover,#dpu_editor #ModUiExtractor-lua-ide-sync:hover{"
      + "border-color:rgba(228,244,252,0.85);color:rgb(245,252,255);"
      + "background:linear-gradient(180deg,rgba(56,82,99,0.98) 0%,rgba(26,48,61,0.98) 100%);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:active,#dpu_editor #ModUiExtractor-lua-ide-sync:active{"
      + "transform:translateY(1px);"
      + "background:linear-gradient(180deg,rgba(30,48,60,0.98) 0%,rgba(18,32,41,0.98) 100%);}"
      + "#dpu_editor #ModUiExtractor-lua-caret-toggle:focus,#dpu_editor #ModUiExtractor-lua-ide-sync:focus{"
      + "outline:none;}"
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
      + "border-color:var(--lua-probe-border-hover) !important;color:#f5fcff !important;"
      + "background:var(--lua-probe-btn-apply-hover-bg) !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -2px 0 rgba(0,0,0,0.38),0 2px 10px rgba(0,0,0,0.34) !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:hover:not(.disabled){"
      + "border-color:rgba(245,252,255,0.48) !important;color:#f2f5f8 !important;"
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
      + "fill:#f5fcff !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button:hover:not(.disabled) .icon{"
      + "fill:#f2f5f8 !important;}"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_apply_button.disabled,"
      + "#dpu_editor[data-lua-probe-active=\"1\"] .main_wrapper .wrapper .editor_wrapper .col .btn_bar .lua_editor_cancel_button.disabled{"
      + "border-color:rgba(84,122,135,0.45) !important;color:rgba(132,160,170,0.72) !important;"
      + "background:linear-gradient(180deg,rgba(28,40,48,0.85) 0%,rgba(18,28,34,0.85) 100%) !important;"
      + "background-image:none !important;"
      + "text-shadow:none !important;"
      + "box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 0 -1px 0 rgba(0,0,0,0.5) !important;}"
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

