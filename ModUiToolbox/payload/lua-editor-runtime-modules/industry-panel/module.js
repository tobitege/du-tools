(function (ctx) {
  "use strict";

  var KEBAB_STYLE_ID = "ModUiToolbox-industry-panel-kebab-style";
  var KEBAB_BUTTON_ID = "ModUiToolbox-industry-panel-kebab-button";
  var KEBAB_PANEL_ID = "ModUiToolbox-industry-panel-kebab-panel";
  var TIME_LABEL_NODE_ID = "industryPanel_productionSubPanel_remainingTime";
  var LEGACY_TIME_LABEL_HELPER_NODE_ID = "ModUiToolbox-industry-panel-remaining-time-helper";
  var SHARED_TIME_PRECISION_KEY = "__uiToolboxIndustryPanelTimePrecisionUnits";
  var desiredTimePrecisionUnits = 1;
  var desiredTimePrecisionLoopId = 0;

  function resolveTimePrecisionUnits(value, fallback) {
    var units = Number(value);
    if (!isFinite(units) || units <= 0) {
      units = Number(fallback);
    }
    if (!isFinite(units) || units <= 0) {
      units = 1;
    }
    return Math.max(1, Math.floor(units));
  }

  function getSharedTimePrecisionUnits(fallback) {
    return resolveTimePrecisionUnits(window[SHARED_TIME_PRECISION_KEY], fallback);
  }

  function setSharedTimePrecisionUnits(value) {
    var resolved = resolveTimePrecisionUnits(value, 1);
    window[SHARED_TIME_PRECISION_KEY] = resolved;
    return resolved;
  }

  function getPanel() {
    if (typeof window.industryPanel === "undefined" || !window.industryPanel) {
      return null;
    }
    return window.industryPanel;
  }

  function getThemeApi() {
    var state = window.__UI_TOOLBOX_LUA_PROBE_STATE__;
    return state && state.theming ? state.theming : null;
  }

  function getProductionEnum(name, fallback) {
    if (typeof enumTypeProduction !== "undefined" &&
        enumTypeProduction &&
        typeof enumTypeProduction[name] !== "undefined") {
      return enumTypeProduction[name];
    }
    return fallback;
  }

  function getNodeText(node) {
    if (!node) {
      return "";
    }
    try {
      return String(node.innerText || node.textContent || "").trim();
    } catch (_ignore) {
      return "";
    }
  }

  function getButtonState(node) {
    return {
      present: !!node,
      text: getNodeText(node),
      disabled: !!(node && node.classList && node.classList.contains("disabled"))
    };
  }

  function getNumberInputValue(inputComponent) {
    if (!inputComponent) {
      return null;
    }
    var value = Number(inputComponent.value);
    if (!isFinite(value)) {
      return null;
    }
    return value;
  }

  function bindClick(node, handler) {
    if (!node) {
      return false;
    }
    node.onclick = handler;
    return true;
  }

  function bindChange(node, handler) {
    if (!node) {
      return false;
    }
    node.onchange = handler;
    return true;
  }

  function removeManagedNode(nodeId) {
    var node = document.getElementById(nodeId);
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  function clearIndustryThemeRootFlags() {
    var rootNode = document.getElementById("industry_panel");
    if (!rootNode) {
      return;
    }
    try {
      rootNode.removeAttribute("data-modui-theme-target");
      rootNode.removeAttribute("data-lua-probe-active");
    } catch (_ignoreThemeRootFlags) {}
  }

  function destroyIndustryKebab() {
    removeManagedNode(KEBAB_BUTTON_ID);
    removeManagedNode(KEBAB_PANEL_ID);
    removeManagedNode(KEBAB_STYLE_ID);
    clearIndustryThemeRootFlags();
  }

  function getIndustryThemeAnchorRoot(panel) {
    return document.getElementById("industry_panel") || getIndustryPanelRootNode(panel);
  }

  function syncIndustryThemeUi(panel) {
    var api = getThemeApi();
    var rootNode = getIndustryThemeAnchorRoot(panel);
    var activeThemeName;
    var themeEnabled = !api || typeof api.isThemeEnabled !== "function" ? true : api.isThemeEnabled();
    if (!rootNode) {
      clearIndustryThemeRootFlags();
      return false;
    }

    rootNode.setAttribute("data-modui-theme-target", "1");
    if (themeEnabled) {
      rootNode.setAttribute("data-lua-probe-active", "1");
    } else {
      rootNode.removeAttribute("data-lua-probe-active");
    }

    if (!api) {
      return false;
    }

    activeThemeName = typeof api.getActiveThemeName === "function" ? api.getActiveThemeName() : null;
    if (typeof api.applyTheme === "function") {
      api.applyTheme(activeThemeName || "daisy-black", false);
    }
    return true;
  }

  function isNodeVisible(node) {
    if (!node) {
      return false;
    }
    try {
      var computed = window.getComputedStyle ? window.getComputedStyle(node, null) : null;
      if (computed && (computed.display === "none" || computed.visibility === "hidden" || computed.opacity === "0")) {
        return false;
      }
    } catch (_ignoreComputedStyle) {}
    try {
      if (typeof node.getClientRects === "function" && node.getClientRects().length === 0) {
        return false;
      }
    } catch (_ignoreClientRects) {}
    return true;
  }

  function getIndustryPanelRootNode(panel) {
    var productionSubPanel = panel && panel.productionSubPanel;
    var htmlNodes = productionSubPanel && productionSubPanel.HTMLNodes ? productionSubPanel.HTMLNodes : null;
    return document.getElementById("industryPanel_productionSubPanel_wrapper") ||
      (htmlNodes && htmlNodes.productionArea) ||
      (htmlNodes && htmlNodes.statusDisplay) ||
      null;
  }

  function isIndustryPanelVisible(panel) {
    return isNodeVisible(getIndustryThemeAnchorRoot(panel));
  }

  function getTimeLabelNode(panel) {
    var productionSubPanel = panel && panel.productionSubPanel;
    var htmlNodes = productionSubPanel && productionSubPanel.HTMLNodes ? productionSubPanel.HTMLNodes : null;
    return (htmlNodes && htmlNodes.remainingTime) || document.getElementById(TIME_LABEL_NODE_ID) || null;
  }

  function removeLegacyTimeHelperNode() {
    removeManagedNode(LEGACY_TIME_LABEL_HELPER_NODE_ID);
  }

  function ensureIndustryKebabStyle() {
    var style = document.getElementById(KEBAB_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = KEBAB_STYLE_ID;
      style.textContent =
        "#" + KEBAB_BUTTON_ID + "{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147482600;min-width:176px;height:34px;padding:0 14px;border:1px solid var(--lua-probe-accent,rgba(130,170,190,.7));border-radius:17px;background:var(--lua-probe-header-bg,rgba(14,20,24,.92));color:var(--lua-probe-text-muted,#d7edf6);font:600 14px/1 'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28);}" +
        "#" + KEBAB_BUTTON_ID + ":hover{background:var(--lua-probe-surface-elevated,rgba(25,34,40,.96));border-color:var(--lua-probe-border-hover,rgba(170,220,240,.95));}" +
        "#" + KEBAB_PANEL_ID + "{position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:2147482600;min-width:260px;max-width:360px;max-height:60vh;overflow:auto;padding:10px;background:var(--lua-probe-surface-main,rgba(10,14,18,.97));border:1px solid var(--lua-probe-accent,rgba(100,150,170,.7));border-radius:10px;box-shadow:0 14px 36px rgba(0,0,0,.4);color:var(--lua-probe-text-muted,#dce8ee);font:13px/1.35 'Segoe UI',sans-serif;}" +
        "#" + KEBAB_PANEL_ID + "[data-open='0']{display:none;}" +
        ".ModUiToolbox-industry-kebab-title{margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--lua-probe-text-dim,#8fb3c2);}" +
        ".ModUiToolbox-industry-kebab-row{display:block;margin:0 0 8px 0;}" +
        ".ModUiToolbox-industry-kebab-row input{vertical-align:middle;}" +
        ".ModUiToolbox-industry-kebab-buttons{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px 0;}" +
        ".ModUiToolbox-industry-kebab-buttons button{padding:6px 10px;border:1px solid var(--lua-probe-border-strong,rgba(100,150,170,.7));border-radius:6px;background:var(--lua-probe-surface-row,rgba(20,30,36,.95));color:var(--lua-probe-text-muted,#dce8ee);cursor:pointer;}" +
        ".ModUiToolbox-industry-kebab-buttons button:hover{background:var(--lua-probe-surface-row-alt,rgba(30,44,52,.98));border-color:var(--lua-probe-border-hover,rgba(170,220,240,.95));}" +
        ".ModUiToolbox-industry-kebab-state{font-size:11px;color:var(--lua-probe-text-dim,#9ab1bc);white-space:pre-wrap;}";
      (document.head || document.documentElement || document.body).appendChild(style);
    }
    return style;
  }

  function clickNode(node) {
    if (!node) {
      return {
        ok: false,
        reason: "button_missing"
      };
    }

    if (node.classList && node.classList.contains("disabled")) {
      return {
        ok: false,
        reason: "button_disabled"
      };
    }

    try {
      if (typeof node.click === "function") {
        node.click();
      } else {
        node.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        }));
      }

      return {
        ok: true
      };
    } catch (err) {
      return {
        ok: false,
        reason: "click_failed",
        error: String(err && err.message ? err.message : err)
      };
    }
  }

  function applyModeAction(panel, modeAction, makeAmount, maintainAmount) {
    var productionSubPanel = panel && panel.productionSubPanel;
    if (!productionSubPanel || typeof productionSubPanel.setMode !== "function") {
      return {
        ok: false,
        reason: "production_subpanel_missing"
      };
    }

    if (panel.currentState !== 0) {
      return {
        ok: false,
        reason: "panel_not_stopped"
      };
    }

    var selectedMode = String(modeAction || "").toLowerCase();
    var nextMode = productionSubPanel.selectedMode;
    var nextAmount;

    if (selectedMode === "run") {
      nextMode = getProductionEnum("RUN_INFINITY", 0);
      nextAmount = 0;
    } else if (selectedMode === "make") {
      nextMode = getProductionEnum("MAKE_BATCHS", 1);
      nextAmount = makeAmount;
      if (nextAmount === null || typeof nextAmount === "undefined") {
        nextAmount = getNumberInputValue(productionSubPanel.inputNumberMake);
      }
    } else if (selectedMode === "maintain") {
      nextMode = getProductionEnum("MAINTAIN_AMOUNT", 2);
      nextAmount = maintainAmount;
      if (nextAmount === null || typeof nextAmount === "undefined") {
        nextAmount = getNumberInputValue(productionSubPanel.inputNumberMaintain);
      }
    } else {
      return {
        ok: false,
        reason: "unknown_mode_action",
        modeAction: selectedMode
      };
    }

    if (typeof nextAmount !== "undefined" && nextAmount !== null) {
      nextAmount = Number(nextAmount);
      if (!isFinite(nextAmount) || nextAmount < 0) {
        nextAmount = 0;
      } else {
        nextAmount = Math.floor(nextAmount);
      }
    }

    productionSubPanel.setMode(nextMode, nextAmount);
    return {
      ok: true,
      selectedMode: selectedMode,
      appliedAmount: typeof nextAmount === "undefined" ? null : nextAmount
    };
  }

  function resolveActionNode(panel, action) {
    var htmlNodes = panel && panel.productionSubPanel && panel.productionSubPanel.HTMLNodes;
    if (!htmlNodes) {
      return null;
    }

    if (action === "start") {
      return htmlNodes.startButton || null;
    }
    if (action === "finish_stop") {
      return htmlNodes.finishButton || null;
    }
    if (action === "stop") {
      return htmlNodes.stopButton || null;
    }

    return null;
  }

  function formatDurationParts(totalSeconds, precisionUnits) {
    var remainingSeconds = Math.max(0, Math.floor(totalSeconds));
    var maxParts = precisionUnits > 0 ? Math.floor(precisionUnits) : 1;
    var units = [
      { size: 86400, label: "d" },
      { size: 3600, label: "h" },
      { size: 60, label: "min" },
      { size: 1, label: "s" }
    ];
    var parts = [];
    var i;

    for (i = 0; i < units.length; i += 1) {
      var unit = units[i];
      var value = Math.floor(remainingSeconds / unit.size);
      if (parts.length === 0 && value <= 0 && unit.size !== 1) {
        continue;
      }
      if (value > 0 || parts.length > 0 || unit.size === 1) {
        parts.push(String(value) + " " + unit.label);
        remainingSeconds -= value * unit.size;
      }
      if (parts.length >= maxParts) {
        break;
      }
    }

    if (!parts.length) {
      return "0 s";
    }

    return parts.join(" ");
  }

  function getDurationString(durationMs, precisionUnits) {
    var resolvedUnits = precisionUnits > 0 ? Math.floor(precisionUnits) : 1;
    if (resolvedUnits >= 2) {
      return formatDurationParts(durationMs / 1000, resolvedUnits);
    }

    if (typeof window.FormatNumber !== "undefined" &&
        window.FormatNumber &&
        typeof window.FormatNumber.getDurationString === "function") {
      return window.FormatNumber.getDurationString(durationMs, resolvedUnits);
    }

    return formatDurationParts(durationMs / 1000, resolvedUnits);
  }

  function getRemainingTimeMs(panel) {
    if (!panel || !panel.currentRecipe || panel.currentState === 0) {
      return null;
    }

    var progression = Number(panel.currentProgression);
    if (!isFinite(progression)) {
      progression = 0;
    }

    var durationModified = Number(panel.currentRecipe.durationModified);
    if (!isFinite(durationModified) || durationModified <= 0) {
      return null;
    }

    return Math.max(0, (1 - progression) * durationModified);
  }

  function applyTimeLabelOverride(panel) {
    if (!panel || !panel.__uiToolboxIndustryTimePatch) {
      return;
    }

    removeLegacyTimeHelperNode();

    var precisionUnits = panel.__uiToolboxIndustryTimePatch.units > 0 ? panel.__uiToolboxIndustryTimePatch.units : 1;
    if (precisionUnits < 2) {
      return;
    }

    var remainingMs = getRemainingTimeMs(panel);
    if (remainingMs === null || remainingMs < 60000) {
      return;
    }

    var labelNode = getTimeLabelNode(panel);
    var label = getDurationString(remainingMs, precisionUnits);
    if (!labelNode || !label) {
      return;
    }

    if (getNodeText(labelNode) !== label) {
      labelNode.innerText = label;
    }
  }

  function restoreTimeOverride(panel) {
    removeLegacyTimeHelperNode();
    var productionSubPanel = panel && panel.productionSubPanel;
    if (productionSubPanel && typeof productionSubPanel.__uiToolboxOriginalOnStatusChange === "function") {
      productionSubPanel._onStatusChange = productionSubPanel.__uiToolboxOriginalOnStatusChange;
      delete productionSubPanel.__uiToolboxOriginalOnStatusChange;
    }
    if (panel && typeof panel.__uiToolboxOriginalUpdateStatus === "function") {
      panel.updateStatus = panel.__uiToolboxOriginalUpdateStatus;
      delete panel.__uiToolboxOriginalUpdateStatus;
    }
  }

  function installTimeOverride(panel, precisionUnits) {
    if (!panel || !panel.productionSubPanel) {
      return {
        installed: false,
        reason: "panel_missing_or_invalid"
      };
    }

    if (!panel.__uiToolboxIndustryTimePatch) {
      panel.__uiToolboxIndustryTimePatch = {
        units: 2
      };
    }

    panel.__uiToolboxIndustryTimePatch.units = resolveTimePrecisionUnits(precisionUnits, panel.__uiToolboxIndustryTimePatch.units);
    if (panel.__uiToolboxIndustryTimePatch.units < 2) {
      var hadOverride = !!(typeof panel.__uiToolboxOriginalUpdateStatus === "function" ||
        typeof panel.productionSubPanel.__uiToolboxOriginalOnStatusChange === "function");
      restoreTimeOverride(panel);
      if (hadOverride && panel.productionSubPanel && typeof panel.productionSubPanel._onStatusChange === "function") {
        panel.productionSubPanel._onStatusChange();
      }
      return {
        installed: true,
        units: panel.__uiToolboxIndustryTimePatch.units
      };
    }

    if (typeof panel.__uiToolboxOriginalUpdateStatus !== "function" &&
        typeof panel.updateStatus === "function") {
      panel.__uiToolboxOriginalUpdateStatus = panel.updateStatus;
      panel.updateStatus = function () {
        var result = panel.__uiToolboxOriginalUpdateStatus.apply(this, arguments);
        applyTimeLabelOverride(panel);
        return result;
      };
    }

    if (typeof panel.productionSubPanel.__uiToolboxOriginalOnStatusChange !== "function" &&
        typeof panel.productionSubPanel._onStatusChange === "function") {
      panel.productionSubPanel.__uiToolboxOriginalOnStatusChange = panel.productionSubPanel._onStatusChange;
      panel.productionSubPanel._onStatusChange = function () {
        var result = panel.productionSubPanel.__uiToolboxOriginalOnStatusChange.apply(this, arguments);
        applyTimeLabelOverride(panel);
        return result;
      };
    }

    applyTimeLabelOverride(panel);

    return {
      installed: true,
      units: panel.__uiToolboxIndustryTimePatch.units
    };
  }

  function clearDesiredTimePrecisionLoop() {
    if (!desiredTimePrecisionLoopId) {
      return;
    }
    try {
      window.clearInterval(desiredTimePrecisionLoopId);
    } catch (_ignoreClearDesiredTimeLoop) {}
    desiredTimePrecisionLoopId = 0;
  }

  function ensureDesiredTimePrecisionLoop() {
    desiredTimePrecisionUnits = getSharedTimePrecisionUnits(desiredTimePrecisionUnits);
    if (desiredTimePrecisionUnits < 2) {
      clearDesiredTimePrecisionLoop();
      return;
    }
    if (desiredTimePrecisionLoopId) {
      return;
    }
    desiredTimePrecisionLoopId = window.setInterval(function () {
      desiredTimePrecisionUnits = getSharedTimePrecisionUnits(desiredTimePrecisionUnits);
      if (desiredTimePrecisionUnits < 2) {
        clearDesiredTimePrecisionLoop();
        return;
      }
      var livePanel = getPanel();
      if (!livePanel || !livePanel.productionSubPanel) {
        return;
      }
      installTimeOverride(livePanel, desiredTimePrecisionUnits);
    }, 500);
  }

  function collectPanelState(panel) {
    var htmlNodes = panel && panel.productionSubPanel && panel.productionSubPanel.HTMLNodes;
    var recipe = panel && panel.currentRecipe ? panel.currentRecipe : null;
    var productionSubPanel = panel && panel.productionSubPanel ? panel.productionSubPanel : null;
    return {
      panelFound: !!panel,
      currentState: panel ? panel.currentState : null,
      selectedMode: productionSubPanel ? productionSubPanel.selectedMode : null,
      inputValues: {
        make: getNumberInputValue(productionSubPanel ? productionSubPanel.inputNumberMake : null),
        maintain: getNumberInputValue(productionSubPanel ? productionSubPanel.inputNumberMaintain : null)
      },
      recipe: recipe ? {
        id: recipe.id,
        name: recipe.name || recipe.displayName || recipe.localizedName || "",
        durationModified: recipe.durationModified,
        batchSize: recipe.batchSize
      } : null,
      labels: {
        status: htmlNodes ? getNodeText(htmlNodes.statusDisplay) : "",
        remainingTime: htmlNodes ? getNodeText(htmlNodes.remainingTime) : ""
      },
      buttons: {
        start: getButtonState(htmlNodes ? htmlNodes.startButton : null),
        finishStop: getButtonState(htmlNodes ? htmlNodes.finishButton : null),
        stop: getButtonState(htmlNodes ? htmlNodes.stopButton : null)
      },
      kebab: {
        installed: !!document.getElementById(KEBAB_BUTTON_ID),
        open: !!(document.getElementById(KEBAB_PANEL_ID) && document.getElementById(KEBAB_PANEL_ID).getAttribute("data-open") === "1")
      },
      timeOverride: panel && panel.__uiToolboxIndustryTimePatch ? {
        installed: true,
        units: panel.__uiToolboxIndustryTimePatch.units
      } : {
        installed: false,
        units: 0
      }
    };
  }

  function updateIndustryKebabState(panel) {
    var stateNode = document.getElementById("ModUiToolbox-industry-kebab-state");
    var timeToggle = document.getElementById("ModUiToolbox-industry-kebab-time-toggle");
    var state = collectPanelState(panel);
    if (timeToggle) {
      timeToggle.checked = desiredTimePrecisionUnits >= 2;
    }
    if (stateNode) {
      stateNode.textContent =
        "Status: " + (state.labels.status || "n/a") + "\n" +
        "Time: " + (state.labels.remainingTime || "---") + "\n" +
        "Mode: " + String(state.selectedMode) + "\n" +
        "Make: " + String(state.inputValues.make) + " | Maintain: " + String(state.inputValues.maintain);
    }
  }

  function ensureIndustryKebab(panel) {
    if (!isIndustryPanelVisible(panel)) {
      destroyIndustryKebab();
      return false;
    }

    ensureIndustryKebabStyle();

    var button = document.getElementById(KEBAB_BUTTON_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = KEBAB_BUTTON_ID;
      button.type = "button";
      button.innerHTML = "\u22ee&nbsp;Industry Helper";
      button.title = "Industry Helper";
      button.onclick = function () {
        var livePanel = document.getElementById(KEBAB_PANEL_ID);
        if (!livePanel) {
          return;
        }
        livePanel.setAttribute("data-open", livePanel.getAttribute("data-open") === "1" ? "0" : "1");
        updateIndustryKebabState(getPanel());
      };
      (document.body || document.documentElement).appendChild(button);
    }

    var panelNode = document.getElementById(KEBAB_PANEL_ID);
    if (!panelNode) {
      panelNode = document.createElement("div");
      panelNode.id = KEBAB_PANEL_ID;
      panelNode.setAttribute("data-open", "0");
      panelNode.innerHTML =
        '<div class="ModUiToolbox-industry-kebab-title">Industry Quick Controls</div>' +
        '<label class="ModUiToolbox-industry-kebab-row"><input id="ModUiToolbox-industry-kebab-time-toggle" type="checkbox">&nbsp;2-unit time display</label>' +
        '<div class="ModUiToolbox-industry-kebab-buttons">' +
          '<button type="button" id="ModUiToolbox-industry-kebab-run">Run</button>' +
          '<button type="button" id="ModUiToolbox-industry-kebab-make">Make</button>' +
          '<button type="button" id="ModUiToolbox-industry-kebab-maintain">Maintain</button>' +
        '</div>' +
        '<div class="ModUiToolbox-industry-kebab-buttons">' +
          '<button type="button" id="ModUiToolbox-industry-kebab-start">Start</button>' +
          '<button type="button" id="ModUiToolbox-industry-kebab-finish">Finish & stop</button>' +
          '<button type="button" id="ModUiToolbox-industry-kebab-stop">Stop</button>' +
        '</div>' +
        '<div id="ModUiToolbox-industry-kebab-state" class="ModUiToolbox-industry-kebab-state"></div>';
      (document.body || document.documentElement).appendChild(panelNode);
      bindChange(document.getElementById("ModUiToolbox-industry-kebab-time-toggle"), function () {
        var livePanel = getPanel();
        desiredTimePrecisionUnits = setSharedTimePrecisionUnits(this.checked ? 2 : 1);
        ctx.setState("timePrecisionUnits", desiredTimePrecisionUnits);
        if (livePanel) {
          installTimeOverride(livePanel, desiredTimePrecisionUnits);
        }
        ensureDesiredTimePrecisionLoop();
        updateIndustryKebabState(livePanel);
      });
      bindClick(document.getElementById("ModUiToolbox-industry-kebab-run"), function () {
        var livePanel = getPanel();
        if (livePanel) {
          applyModeAction(livePanel, "run");
          updateIndustryKebabState(livePanel);
        }
      });
      bindClick(document.getElementById("ModUiToolbox-industry-kebab-make"), function () {
        var livePanel = getPanel();
        if (livePanel) {
          applyModeAction(livePanel, "make");
          updateIndustryKebabState(livePanel);
        }
      });
      bindClick(document.getElementById("ModUiToolbox-industry-kebab-maintain"), function () {
        var livePanel = getPanel();
        if (livePanel) {
          applyModeAction(livePanel, "maintain");
          updateIndustryKebabState(livePanel);
        }
      });
      bindClick(document.getElementById("ModUiToolbox-industry-kebab-start"), function () {
        var livePanel = getPanel();
        if (livePanel) {
          clickNode(resolveActionNode(livePanel, "start"));
          window.setTimeout(function () { updateIndustryKebabState(getPanel()); }, 50);
        }
      });
      bindClick(document.getElementById("ModUiToolbox-industry-kebab-finish"), function () {
        var livePanel = getPanel();
        if (livePanel) {
          clickNode(resolveActionNode(livePanel, "finish_stop"));
          window.setTimeout(function () { updateIndustryKebabState(getPanel()); }, 50);
        }
      });
      bindClick(document.getElementById("ModUiToolbox-industry-kebab-stop"), function () {
        var livePanel = getPanel();
        if (livePanel) {
          clickNode(resolveActionNode(livePanel, "stop"));
          window.setTimeout(function () { updateIndustryKebabState(getPanel()); }, 50);
        }
      });
    }

    syncIndustryThemeUi(panel);
    updateIndustryKebabState(panel);
    return true;
  }

  function syncIndustryPanelUi() {
    desiredTimePrecisionUnits = getSharedTimePrecisionUnits(ctx.getState("timePrecisionUnits", desiredTimePrecisionUnits));
    var panel = getPanel();
    if (!panel || !panel.productionSubPanel) {
      destroyIndustryKebab();
      return;
    }
    if (desiredTimePrecisionUnits >= 2) {
      installTimeOverride(panel, desiredTimePrecisionUnits);
    } else {
      restoreTimeOverride(panel);
    }
    ensureDesiredTimePrecisionLoop();
    ensureIndustryKebab(panel);
  }

  return {
    install: function () {
      desiredTimePrecisionUnits = setSharedTimePrecisionUnits(ctx.getState("timePrecisionUnits", desiredTimePrecisionUnits));
      ensureDesiredTimePrecisionLoop();
      syncIndustryPanelUi();
      ctx.setInterval(syncIndustryPanelUi, 500);
    },
    closeUi: function () {
      var panelNode = document.getElementById(KEBAB_PANEL_ID);
      if (!panelNode) {
        return {
          handled: false,
          reason: "industry_panel_kebab_not_open"
        };
      }
      panelNode.setAttribute("data-open", "0");
      return {
        handled: true,
        closed: true
      };
    },
    uninstall: function () {
      clearDesiredTimePrecisionLoop();
      restoreTimeOverride(getPanel());
      destroyIndustryKebab();
    }
  };
})
