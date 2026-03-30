// 120-dialogs.js - Dialog components (load, saveas, close confirm)
(function hudEditorDialogs() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;

  // ─── Dialog registry ───────────────────────────────────────────────

  var activeDialog = null;

  function showDialog(name) {
    if (activeDialog) hideDialog();
    var dlg = qs("#dialog-" + name);
    if (!dlg) return;
    dlg.style.display = "flex";
    activeDialog = dlg;
  }

  function hideDialog() {
    if (!activeDialog) return;
    activeDialog.style.display = "none";
    activeDialog = null;
  }

  // ─── Build all dialogs ────────────────────────────────────────────

  function buildDialogs() {
    var root = APP.getRoot();

    // ── Load dialog ──────────────────────────────────────────────
    var loadD = el("div", {
      id: "dialog-load",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-header" }, [
          el("h3", { textContent: "Load Script" }),
          el("button", {
            className: "dialog-close",
            dataset: { action: "close-load" },
            textContent: "\u00D7",
          }),
        ]),
        el("div", { className: "dialog-content" }, [
          el("div", { id: "script-list", className: "script-list" }),
        ]),
        el("div", { className: "dialog-footer" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-load" },
            textContent: "Cancel",
          }),
        ]),
      ]),
    ]);
    root.appendChild(loadD);

    // ── Save As dialog ────────────────────────────────────────────
    var saveasD = el("div", {
      id: "dialog-saveas",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-header" }, [
          el("h3", { textContent: "Save As" }),
          el("button", {
            className: "dialog-close",
            dataset: { action: "close-saveas" },
            textContent: "\u00D7",
          }),
        ]),
        el("div", { className: "dialog-content" }, [
          el("label", { textContent: "Script Name" }),
          el("input", {
            type: "text",
            id: "saveas-name",
            className: "saveas-input",
            placeholder: "my-layout",
          }),
          el("p", { className: "save-note", textContent: "Saves to linked databank" }),
        ]),
        el("div", { className: "dialog-footer" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-saveas" },
            textContent: "Cancel",
          }),
          el("button", {
            className: "btn primary",
            dataset: { action: "confirm-saveas" },
            textContent: "Save",
          }),
        ]),
      ]),
    ]);
    root.appendChild(saveasD);

    // ── Close confirmation dialog ─────────────────────────────────
    var closeD = el("div", {
      id: "dialog-close",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-content centered" }, [
          el("div", { className: "confirm-icon", textContent: "\u26A0" }),
          el("h3", { textContent: "Unsaved Changes" }),
          el("p", { textContent: "You have unsaved changes. What would you like to do?" }),
        ]),
        el("div", { className: "dialog-footer centered" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-cancel" },
            textContent: "Cancel",
          }),
          el("button", {
            className: "btn danger",
            dataset: { action: "close-discard" },
            textContent: "Discard",
          }),
          el("button", {
            className: "btn primary",
            dataset: { action: "close-save" },
            textContent: "Save & Close",
          }),
        ]),
      ]),
    ]);
    root.appendChild(closeD);
  }

  // ─── Load dialog content ───────────────────────────────────────────

  function populateScriptList(scripts) {
    var list = qs("#script-list");
    if (!list) return;

    // Clear existing
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (!scripts || scripts.length === 0) {
      var empty = el("div", {
        className: "empty-state",
        style: { padding: "20px", textAlign: "center", color: "#666" },
      }, [
        el("p", { textContent: "No saved scripts found." }),
      ]);
      list.appendChild(empty);
      return;
    }

    scripts.forEach(function (script) {
      var item = el("div", {
        className: "script-item",
        dataset: { scriptId: script.id },
      }, [
        el("div", { className: "script-name", textContent: script.name || script.id }),
        el("div", { className: "script-meta", textContent: formatDate(script.modified) }),
      ]);
      list.appendChild(item);
    });
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";
    var d = new Date(timestamp * 1000);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  }

  // ─── Click delegation ───────────────────────────────────────────────

  function onDialogClick(e) {
    var action = e.target.dataset.action;
    if (!action) return;

    if (action === "close-load") {
      hideDialog();
    } else if (action === "close-saveas") {
      hideDialog();
    } else if (action === "close-cancel") {
      hideDialog();
    } else if (action === "close-discard") {
      APP.state.isDirty = false;
      hideDialog();
      APP.goToStart();
    } else if (action === "close-save") {
      // Trigger save then close
      APP.emit("save");
      hideDialog();
      APP.goToStart();
    } else if (action === "confirm-saveas") {
      var nameInput = qs("#saveas-name");
      var name = nameInput ? nameInput.value.trim() : "";
      if (name) {
        APP.emit("saveas-confirm", name);
        hideDialog();
      }
    }
  }

  // ─── Script item click ─────────────────────────────────────────────

  function onScriptListClick(e) {
    var item = e.target.closest(".script-item");
    if (!item) return;
    var scriptId = item.dataset.scriptId;
    if (scriptId) {
      APP.emit("load-confirm", scriptId);
      hideDialog();
    }
  }

  // ─── Event listeners ───────────────────────────────────────────────

  APP.on("load-dialog-open", function () {
    showDialog("load");
    // Emit event to request script list (board/databank will respond)
    APP.emit("request-script-list");
  });

  APP.on("saveas-dialog-open", function () {
    showDialog("saveas");
    var input = qs("#saveas-name");
    if (input) input.value = "";
  });

  APP.on("close-editor", function () {
    if (APP.state.isDirty) {
      showDialog("close");
    } else {
      APP.goToStart();
    }
  });

  // Receive script list from board/databank
  APP.on("script-list-response", function (scripts) {
    populateScriptList(scripts);
  });

  APP.on("close-dialog", function () {
    hideDialog();
  });

  // ─── Bootstrap ─────────────────────────────────────────────────────

  APP.init = (function (origInit) {
    return function () {
      origInit();
      buildDialogs();

      // Attach click delegation to dialogs
      var root = APP.getRoot();
      root.addEventListener("click", onDialogClick);
      var scriptList = qs("#script-list", root);
      if (scriptList) {
        scriptList.addEventListener("click", onScriptListClick);
      }
    };
  })(APP.init);

  // If already initialized, build now
  if (APP.getRoot().childElementCount > 0) {
    buildDialogs();
    var root = APP.getRoot();
    root.addEventListener("click", onDialogClick);
    var scriptList = qs("#script-list", root);
    if (scriptList) {
      scriptList.addEventListener("click", onScriptListClick);
    }
  }

})();
