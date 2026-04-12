(function () {
  "use strict";

  var api = window.__UI_TOOLBOX_PAYLOAD_API__;
  var shared = window.__UI_TOOLBOX_INDUSTRY_PANEL_SHARED__;
  if (!api || typeof api.registerModeHandler !== "function" || !shared) {
    return;
  }

  function normalizePrecisionUnits(rawValue) {
    var precisionUnits = Number(rawValue);
    if (!isFinite(precisionUnits) || precisionUnits <= 0) {
      precisionUnits = 2;
    } else {
      precisionUnits = Math.floor(precisionUnits);
    }
    return precisionUnits;
  }

  api.registerModeHandler(function (config) {
    if (!api.isMode("industry_panel_probe")) {
      return false;
    }

    var panel = shared.getPanel();
    var buttonAction = String(config.industryPanelButtonAction || "").toLowerCase();
    var modeAction = String(config.industryPanelModeAction || "").toLowerCase();
    var installOverride = !!config.industryPanelInstallTimeOverride;
    var hasExplicitPrecisionUnits = Object.prototype.hasOwnProperty.call(config, "industryPanelTimePrecisionUnits");
    var cssText = typeof config.industryPanelCssText === "string" ? config.industryPanelCssText : "";
    var cssStyleId = String(config.industryPanelCssStyleId || "ui-toolbox-industry-panel-style");
    var htmlText = typeof config.industryPanelHtml === "string" ? config.industryPanelHtml : "";
    var htmlTargetSelector = String(config.industryPanelHtmlTargetSelector || "#industryPanel_productionSubPanel_wrapper");
    var htmlApplyMode = String(config.industryPanelHtmlApplyMode || "replace_inner");
    var kebabEnabled = typeof config.industryPanelKebabEnabled === "boolean" ? config.industryPanelKebabEnabled : null;
    var makeAmount = config.industryPanelMakeAmount;
    var maintainAmount = config.industryPanelMaintainAmount;
    var precisionUnits = normalizePrecisionUnits(config.industryPanelTimePrecisionUnits);

    var response = {
      commandId: typeof config.commandId === "string" ? config.commandId : "",
      mode: "industry_panel_probe",
      buttonActionRequested: buttonAction || "",
      modeActionRequested: modeAction || "",
      cssRequested: !!cssText,
      htmlRequested: !!htmlText,
      kebabRequested: kebabEnabled,
      installTimeOverrideRequested: installOverride,
      requestedTimePrecisionUnits: precisionUnits
    };

    if (!panel) {
      response.panelFound = false;
      api.sendSection("industry_panel_probe", response);
      api.finalize();
      return true;
    }

    if (installOverride || hasExplicitPrecisionUnits) {
      shared.applyRequestedTimePrecision(precisionUnits);
      response.timeOverrideResult = shared.installTimeOverride(panel, precisionUnits);
    }

    if (cssText) {
      response.cssApplyResult = shared.applyIndustryCss(cssText, cssStyleId);
    }

    if (htmlText) {
      response.htmlApplyResult = shared.applyIndustryHtml(panel, htmlTargetSelector, htmlText, htmlApplyMode);
    }

    if (typeof kebabEnabled === "boolean") {
      response.kebabResult = shared.setIndustryKebab(panel, kebabEnabled);
    }

    if (modeAction) {
      response.modeActionResult = shared.applyModeAction(panel, modeAction, makeAmount, maintainAmount);
    }

    if (!buttonAction) {
      response.state = shared.collectPanelState(panel);
      api.sendSection("industry_panel_probe", response);
      api.finalize();
      return true;
    }

    response.buttonActionResult = shared.clickNode(shared.resolveActionNode(panel, buttonAction));
    window.setTimeout(function () {
      response.state = shared.collectPanelState(panel);
      api.sendSection("industry_panel_probe", response);
      api.finalize();
    }, 50);
    return true;
  });
})();
