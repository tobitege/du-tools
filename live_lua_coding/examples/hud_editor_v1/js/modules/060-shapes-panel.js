// 060-shapes-panel.js - Floating layers / shapes list panel
(function hudEditorShapesPanel() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;

  // ─── Type display info ──────────────────────────────────────────────

  var TYPE_INFO = {
    box:        { icon: "\u25AD", label: "Box" },
    boxRounded: { icon: "\u25A2", label: "Rounded" },
    circle:     { icon: "\u25CB", label: "Circle" },
    line:       { icon: "\u2571", label: "Line" },
    text:       { icon: "T",      label: "Text" },
  };

  // ─── Panel DOM ──────────────────────────────────────────────────────

  var panelEl = null;
  var listEl = null;

  function buildPanel() {
    listEl = el("div", { className: "shapes-list" });

    panelEl = el("div", { id: "shapes-panel" }, [
      el("div", { className: "panel-header" }, [
        el("span", { textContent: "Layers" }),
        el("button", { className: "panel-toggle", dataset: { action: "toggle-collapse" }, textContent: "\u25BE" }),
      ]),
      listEl,
    ]);

    return panelEl;
  }

  // ─── Render the layer list ──────────────────────────────────────────

  function refreshList() {
    if (!listEl) return;

    var doc = APP.state.document;
    var elements = (doc && doc.elements) || [];
    var selIds = APP.state.selectedElementIds || [];

    // Clear
    listEl.innerHTML = "";

    if (elements.length === 0) {
      listEl.appendChild(
        el("div", { className: "layers-empty", textContent: "No shapes yet" })
      );
      return;
    }

    // Show top-most first (reverse of array order)
    for (var i = elements.length - 1; i >= 0; i--) {
      var elem = elements[i];
      var info = TYPE_INFO[elem.type] || { icon: "?", label: elem.type };
      var isSelected = APP.selection.isSelected(elem.id);
      var isVisible = elem.visible !== false;

      var item = el("div", {
        className: "layer-item" + (isSelected ? " selected" : ""),
        dataset: { elementId: elem.id },
      }, [
        // Visibility toggle
        el("button", {
          className: "layer-btn layer-vis" + (isVisible ? "" : " off"),
          dataset: { action: "toggle-vis", elementId: elem.id },
          title: isVisible ? "Hide" : "Show",
        }),
        // Type icon
        el("span", { className: "layer-icon", textContent: info.icon }),
        // Name
        el("span", {
          className: "layer-name",
          textContent: info.label + " " + elem.id.replace("el_", "#"),
        }),
        // Z-order: move forward (toward top of stack)
        el("button", {
          className: "layer-btn layer-z",
          dataset: { action: "move-up", elementId: elem.id },
          title: "Move forward",
          textContent: "\u25B4",
        }),
        // Z-order: move backward (toward bottom of stack)
        el("button", {
          className: "layer-btn layer-z",
          dataset: { action: "move-down", elementId: elem.id },
          title: "Move backward",
          textContent: "\u25BE",
        }),
      ]);

      listEl.appendChild(item);
    }
  }

  // ─── Actions ────────────────────────────────────────────────────────

  function toggleVisibility(elementId) {
    var elem = APP.canvas.getElementById(elementId);
    if (!elem) return;

    if (APP.undoRedo) APP.undoRedo.push();
    elem.visible = (elem.visible === false) ? true : false;
    APP.state.isDirty = true;
    APP.canvas.updateElement(elementId);
    APP.emit("element-updated", elementId);
    refreshList();
  }

  function moveElement(elementId, direction) {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return;

    var idx = -1;
    for (var i = 0; i < doc.elements.length; i++) {
      if (doc.elements[i].id === elementId) { idx = i; break; }
    }
    if (idx < 0) return;

    // "up" in visual list = higher z-order = move toward end of array
    var newIdx = direction === "up" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= doc.elements.length) return;

    if (APP.undoRedo) APP.undoRedo.push();
    var tmp = doc.elements[idx];
    doc.elements[idx] = doc.elements[newIdx];
    doc.elements[newIdx] = tmp;

    APP.state.isDirty = true;
    APP.canvas.render();
    refreshList();
  }

  // ─── Click delegation ──────────────────────────────────────────────

  function onPanelClick(e) {
    var btn = e.target.closest("[data-action]");
    if (btn) {
      var action = btn.dataset.action;
      var id = btn.dataset.elementId;
      if (action === "toggle-collapse") { toggleCollapse(); return; }
      if (action === "toggle-vis") { toggleVisibility(id); return; }
      if (action === "move-up")    { moveElement(id, "up"); return; }
      if (action === "move-down")  { moveElement(id, "down"); return; }
    }

    // Click on item body -> select (shift = toggle in multi-select)
    var item = e.target.closest(".layer-item");
    if (item && item.dataset.elementId) {
      if (e.shiftKey || e.ctrlKey) {
        APP.selection.toggleIn(item.dataset.elementId);
      } else {
        APP.selection.select(item.dataset.elementId);
      }
    }
  }

  // ─── Collapse / expand ──────────────────────────────────────────────

  var COLLAPSE_KEY = "hud_shapes_panel_collapsed";

  function toggleCollapse() {
    if (!panelEl) return;
    var collapsed = !panelEl.classList.contains("collapsed");
    panelEl.classList.toggle("collapsed", collapsed);
    var btn = qs(".panel-toggle", panelEl);
    if (btn) btn.textContent = collapsed ? "\u25B8" : "\u25BE";
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : ""); } catch (e) { /* ignore */ }
  }

  function restoreCollapse() {
    if (!panelEl) return;
    var collapsed = false;
    try { collapsed = localStorage.getItem(COLLAPSE_KEY) === "1"; } catch (e) { /* ignore */ }
    panelEl.classList.toggle("collapsed", collapsed);
    var btn = qs(".panel-toggle", panelEl);
    if (btn) btn.textContent = collapsed ? "\u25B8" : "\u25BE";
  }

  // ─── Panel visibility ──────────────────────────────────────────────

  function showPanel() {
    if (!panelEl) return;
    panelEl.classList.add("visible");
    restorePanelPos(panelEl);
    restoreCollapse();
    refreshList();
  }

  function hidePanel() {
    if (panelEl) panelEl.classList.remove("visible");
  }

  // ─── Panel position persistence ────────────────────────────────────

  var POS_KEY = "hud_shapes_panel_pos";

  function savePanelPos(panel) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({
        left: panel.style.left,
        top: panel.style.top,
      }));
    } catch (e) { /* ignore */ }
  }

  function restorePanelPos(panel) {
    var left = null;
    var top = 72;
    try {
      var saved = localStorage.getItem(POS_KEY);
      if (saved) {
        var pos = JSON.parse(saved);
        if (pos.left) left = parseFloat(pos.left);
        if (pos.top)  top  = parseFloat(pos.top) || 72;
      }
    } catch (e) { /* ignore */ }

    // Default: right side of editor
    var editorScreen = panel.closest('[data-screen="editor"]');
    if (left === null && editorScreen) {
      left = editorScreen.clientWidth - (panel.offsetWidth || 240) - 12;
    }
    if (left === null) left = 12;

    // Clamp to editor bounds
    if (editorScreen) {
      left = Math.max(0, Math.min(left, editorScreen.clientWidth  - (panel.offsetWidth  || 240)));
      top  = Math.max(0, Math.min(top,  editorScreen.clientHeight - (panel.offsetHeight || 80)));
    }

    panel.style.left  = left + "px";
    panel.style.top   = top  + "px";
    panel.style.right = "auto";
  }

  // ─── Panel header drag ─────────────────────────────────────────────

  var drag = { active: false, offX: 0, offY: 0, editorRect: null };

  function attachDragListener() {
    if (!panelEl) return;
    var header = qs(".panel-header", panelEl);
    if (!header || header.__hudShapesDragBound) return;
    header.__hudShapesDragBound = true;

    header.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      if (e.target.closest(".panel-toggle")) return;
      var editorScreen = panelEl.closest('[data-screen="editor"]');
      if (!editorScreen) return;
      var editorRect = editorScreen.getBoundingClientRect();
      var panelRect  = panelEl.getBoundingClientRect();

      drag.active = true;
      drag.offX = e.clientX - panelRect.left;
      drag.offY = e.clientY - panelRect.top;
      drag.editorRect = editorRect;

      panelEl.style.right = "auto";
      panelEl.style.left  = (panelRect.left - editorRect.left) + "px";
      panelEl.style.top   = (panelRect.top  - editorRect.top)  + "px";

      e.preventDefault();
    });

    document.addEventListener("mousemove", function (e) {
      if (!drag.active) return;
      var er = drag.editorRect;
      var x = e.clientX - drag.offX - er.left;
      var y = e.clientY - drag.offY - er.top;
      x = Math.max(0, Math.min(x, er.width  - panelEl.offsetWidth));
      y = Math.max(0, Math.min(y, er.height - panelEl.offsetHeight));
      panelEl.style.left = x + "px";
      panelEl.style.top  = y + "px";
    });

    document.addEventListener("mouseup", function () {
      if (drag.active) savePanelPos(panelEl);
      drag.active = false;
    });
  }

  // ─── Mount into editor screen ──────────────────────────────────────

  function mount() {
    var root = APP.getRoot ? APP.getRoot() : document;
    var editorScreen = qs('[data-screen="editor"]', root);
    if (!editorScreen) return;
    if (qs("#shapes-panel", editorScreen)) return;

    var panel = buildPanel();
    editorScreen.appendChild(panel);
    panel.addEventListener("click", onPanelClick);
    attachDragListener();
  }

  // ─── Events ────────────────────────────────────────────────────────

  APP.on("enter-edit", function () {
    setTimeout(function () { mount(); showPanel(); }, 0);
  });

  APP.on("document-created", function () {
    setTimeout(function () { mount(); showPanel(); }, 0);
  });

  APP.on("document-loaded", function () {
    setTimeout(function () { mount(); showPanel(); }, 0);
  });

  APP.on("exit-edit", function () {
    hidePanel();
  });

  APP.on("element-added",     function () { refreshList(); });
  APP.on("element-deleted",   function () { refreshList(); });
  APP.on("element-updated",   function () { refreshList(); });
  APP.on("selection-changed", function () { refreshList(); });

})();
