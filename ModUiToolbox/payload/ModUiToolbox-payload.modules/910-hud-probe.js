(function () {
  "use strict";

  var api = window.__UI_TOOLBOX_PAYLOAD_API__;
  if (!api || typeof api.registerModeHandler !== "function") {
    return;
  }

  var DEFAULT_STYLE_ID = "ui-toolbox-hud-style";
  var DEFAULT_MAX_MATCHES = 8;
  var MAX_MATCHES = 25;
  var MAX_TEXT_SAMPLE_CHARS = 160;
  var MAX_ARRAY_ITEMS = 50;
  var MAX_OBJECT_KEYS = 50;
  var MAX_SERIALIZE_DEPTH = 5;
  var DEFAULT_COMPUTED_PROPERTIES = [
    "display",
    "position",
    "visibility",
    "opacity",
    "zIndex",
    "pointerEvents",
    "backgroundColor",
    "color",
    "fontSize",
    "transform"
  ];

  function trimString(value) {
    return String(value == null ? "" : value).trim();
  }

  function clampInt(value, min, max, fallback) {
    var parsed = Number(value);
    if (!isFinite(parsed)) {
      parsed = fallback;
    }
    parsed = Math.floor(parsed);
    if (parsed < min) {
      return min;
    }
    if (parsed > max) {
      return max;
    }
    return parsed;
  }

  function roundNumber(value) {
    var numeric = Number(value);
    if (!isFinite(numeric)) {
      return 0;
    }
    return Math.round(numeric * 100) / 100;
  }

  function isElementNode(value) {
    return !!(value && value.nodeType === 1 && typeof value.tagName === "string");
  }

  function isNodeCollection(value) {
    return !!(value && typeof value.length === "number" && typeof value.item === "function");
  }

  function normalizeStyleId(styleId) {
    var resolved = trimString(styleId);
    if (!resolved) {
      resolved = DEFAULT_STYLE_ID;
    }
    resolved = resolved.replace(/[^A-Za-z0-9._:-]/g, "-");
    if (!resolved) {
      resolved = DEFAULT_STYLE_ID;
    }
    return resolved;
  }

  function querySelectorAllSafe(selector) {
    var resolved = trimString(selector);
    if (!resolved) {
      throw new Error("missing_selector");
    }
    try {
      return Array.prototype.slice.call(document.querySelectorAll(resolved));
    } catch (_badSelector) {
      throw new Error("invalid_selector:" + resolved);
    }
  }

  function listManagedStyleIds() {
    var nodes = document.querySelectorAll("style[data-ui-toolbox-hud-probe='1']");
    var ids = [];
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      if (nodes[i] && nodes[i].id) {
        ids.push(String(nodes[i].id));
      }
    }
    return ids;
  }

  function getManagedStyleNode(styleId) {
    var resolved = normalizeStyleId(styleId);
    var node = document.getElementById(resolved);
    if (node && node.getAttribute && node.getAttribute("data-ui-toolbox-hud-probe") === "1") {
      return node;
    }
    return null;
  }

  function ensureStyleTag(styleId) {
    var resolved = normalizeStyleId(styleId);
    var node = getManagedStyleNode(resolved);
    if (!node) {
      node = document.createElement("style");
      node.type = "text/css";
      node.id = resolved;
      node.setAttribute("data-ui-toolbox-hud-probe", "1");
      (document.head || document.documentElement || document.body).appendChild(node);
    }
    return node;
  }

  function getNodeText(node) {
    if (!node) {
      return "";
    }
    try {
      return String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
    } catch (_ignoreNodeText) {
      return "";
    }
  }

  function buildRect(node) {
    var rect = null;
    try {
      rect = node && typeof node.getBoundingClientRect === "function" ? node.getBoundingClientRect() : null;
    } catch (_ignoreRect) {
      rect = null;
    }
    return {
      x: roundNumber(rect ? rect.x : 0),
      y: roundNumber(rect ? rect.y : 0),
      width: roundNumber(rect ? rect.width : 0),
      height: roundNumber(rect ? rect.height : 0)
    };
  }

  function buildComputedStyleSample(node) {
    var sample = {};
    var computed = null;
    var i;
    try {
      computed = node ? window.getComputedStyle(node) : null;
    } catch (_ignoreComputedStyle) {
      computed = null;
    }
    if (!computed) {
      return sample;
    }
    for (i = 0; i < DEFAULT_COMPUTED_PROPERTIES.length; i += 1) {
      sample[DEFAULT_COMPUTED_PROPERTIES[i]] = String(computed[DEFAULT_COMPUTED_PROPERTIES[i]] || "");
    }
    return sample;
  }

  function isNodeVisible(node, rect, computedStyle) {
    if (!node || !node.isConnected) {
      return false;
    }
    if (!computedStyle) {
      return rect.width > 0 && rect.height > 0;
    }
    if (computedStyle.display === "none" || computedStyle.visibility === "hidden" || computedStyle.visibility === "collapse") {
      return false;
    }
    if (computedStyle.opacity === "0") {
      return false;
    }
    return rect.width > 0 && rect.height > 0;
  }

  function buildNodeSummary(node) {
    var rect = buildRect(node);
    var computedStyle = buildComputedStyleSample(node);
    var textSample = getNodeText(node);
    if (textSample.length > MAX_TEXT_SAMPLE_CHARS) {
      textSample = textSample.slice(0, MAX_TEXT_SAMPLE_CHARS) + "...";
    }
    return {
      tagName: node && node.tagName ? String(node.tagName).toLowerCase() : "",
      id: node && node.id ? String(node.id) : null,
      classes: node && node.classList ? Array.prototype.slice.call(node.classList) : [],
      connected: !!(node && node.isConnected),
      visible: isNodeVisible(node, rect, computedStyle),
      childElementCount: node && typeof node.childElementCount === "number" ? node.childElementCount : 0,
      textSample: textSample || null,
      inlineStyle: node && node.getAttribute ? (node.getAttribute("style") || null) : null,
      rect: rect,
      computedStyle: computedStyle
    };
  }

  function serializeValue(value, depth, seen) {
    var i;
    var key;
    var output;
    var keys;

    if (value === null || typeof value === "undefined") {
      return value;
    }
    if (depth >= MAX_SERIALIZE_DEPTH) {
      return "[max-depth]";
    }
    if (value === window) {
      return "[window]";
    }
    if (value === document) {
      return "[document]";
    }
    if (isElementNode(value)) {
      return buildNodeSummary(value);
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (typeof value === "function") {
      return "[function " + (value.name || "anonymous") + "]";
    }
    if (Array.isArray(value) || isNodeCollection(value)) {
      output = [];
      for (i = 0; i < value.length && i < MAX_ARRAY_ITEMS; i += 1) {
        output.push(serializeValue(value[i], depth + 1, seen));
      }
      return output;
    }
    if (typeof value === "object") {
      if (seen.indexOf(value) >= 0) {
        return "[circular]";
      }
      seen.push(value);
      output = {};
      try {
        keys = Object.keys(value);
      } catch (_ignoreKeys) {
        seen.pop();
        return "[unserializable-object]";
      }
      for (i = 0; i < keys.length && i < MAX_OBJECT_KEYS; i += 1) {
        key = keys[i];
        output[key] = serializeValue(value[key], depth + 1, seen);
      }
      seen.pop();
      return output;
    }
    return String(value);
  }

  function describeSelector(selector, maxMatches) {
    var resolvedSelector = trimString(selector);
    var limitedMatches = clampInt(maxMatches, 1, MAX_MATCHES, DEFAULT_MAX_MATCHES);
    var allNodes = querySelectorAllSafe(resolvedSelector);
    var nodes = allNodes.slice(0, limitedMatches);
    var summaries = [];
    var i;

    for (i = 0; i < nodes.length; i += 1) {
      summaries.push(buildNodeSummary(nodes[i]));
    }

    return {
      selector: resolvedSelector,
      totalMatches: allNodes.length,
      returnedMatches: summaries.length,
      managedStyleIds: listManagedStyleIds(),
      runtime: {
        title: document.title || "",
        readyState: document.readyState || "",
        locationHref: window.location ? String(window.location.href || "") : "",
        viewport: {
          innerWidth: window.innerWidth || 0,
          innerHeight: window.innerHeight || 0
        }
      },
      nodes: summaries
    };
  }

  function applyCss(cssText, styleId, rootSelector) {
    var resolvedCssText = String(cssText == null ? "" : cssText).trim();
    var resolvedRootSelector = trimString(rootSelector);
    var resolvedStyleId = normalizeStyleId(styleId);
    var rootMatchedNodeCount = null;
    var effectiveCss = resolvedCssText;
    var scopeMode = "verbatim";
    var styleNode;

    if (!resolvedCssText) {
      throw new Error("css_empty");
    }

    if (resolvedRootSelector) {
      rootMatchedNodeCount = querySelectorAllSafe(resolvedRootSelector).length;
      if (resolvedCssText.indexOf("{") < 0) {
        effectiveCss = resolvedRootSelector + " {\n" + resolvedCssText + "\n}";
        scopeMode = "selector_declarations";
      } else {
        scopeMode = "verbatim_with_root_metadata";
      }
    }

    styleNode = ensureStyleTag(resolvedStyleId);
    styleNode.textContent = effectiveCss;
    return {
      applied: true,
      styleId: styleNode.id,
      cssLength: effectiveCss.length,
      sourceCssLength: resolvedCssText.length,
      rootSelector: resolvedRootSelector || null,
      rootMatchedNodeCount: rootMatchedNodeCount,
      scopeMode: scopeMode,
      managedStyleIds: listManagedStyleIds()
    };
  }

  function removeCss(styleId) {
    var resolvedStyleId = normalizeStyleId(styleId);
    var styleNode = getManagedStyleNode(resolvedStyleId);
    var removed = false;
    if (styleNode && styleNode.parentNode) {
      styleNode.parentNode.removeChild(styleNode);
      removed = true;
    }
    return {
      removed: removed,
      styleId: resolvedStyleId,
      managedStyleIds: listManagedStyleIds()
    };
  }

  function buildEvalScope(selector) {
    var resolvedSelector = trimString(selector);
    var nodes = resolvedSelector ? querySelectorAllSafe(resolvedSelector).slice(0, MAX_MATCHES) : [];
    return {
      selector: resolvedSelector || null,
      nodes: nodes,
      first: nodes.length > 0 ? nodes[0] : null,
      document: document,
      window: window,
      describeNode: buildNodeSummary,
      queryOne: function (nextSelector) {
        var matches = querySelectorAllSafe(nextSelector);
        return matches.length > 0 ? matches[0] : null;
      },
      queryAll: function (nextSelector, nextMaxMatches) {
        return querySelectorAllSafe(nextSelector).slice(0, clampInt(nextMaxMatches, 1, MAX_MATCHES, DEFAULT_MAX_MATCHES));
      },
      ensureStyleTag: ensureStyleTag,
      removeStyleTag: removeCss,
      listManagedStyleIds: listManagedStyleIds
    };
  }

  function runRawEval(selector, functionBody) {
    var resolvedFunctionBody = trimString(functionBody);
    var scope = buildEvalScope(selector);
    var factory;
    var value;

    if (!resolvedFunctionBody) {
      throw new Error("raw_eval_empty");
    }

    factory = new Function("scope", '"use strict";\n' + resolvedFunctionBody);
    value = factory(scope);
    return {
      selector: scope.selector,
      matchedNodeCount: scope.nodes.length,
      value: serializeValue(value, 0, [])
    };
  }

  function sendProbeResponse(config, method, success, result, errorMessage) {
    api.sendSection("hud_probe", {
      commandId: typeof config.commandId === "string" ? config.commandId : "",
      method: method,
      success: !!success,
      result: success ? result : null,
      error: success ? null : String(errorMessage || "unknown_error"),
      targetKind: "hud_page"
    });
    api.finalize();
  }

  api.registerModeHandler(function (config) {
    if (!api.isMode("hud_probe")) {
      return false;
    }

    var method = trimString(config.hudProbeMethod).toLowerCase();
    try {
      if (method === "describe") {
        sendProbeResponse(config, method, true, describeSelector(config.hudProbeSelector, config.hudProbeMaxMatches), null);
      } else if (method === "apply_css") {
        sendProbeResponse(config, method, true, applyCss(config.hudProbeCssText, config.hudProbeStyleId, config.hudProbeRootSelector), null);
      } else if (method === "remove_css") {
        sendProbeResponse(config, method, true, removeCss(config.hudProbeStyleId), null);
      } else if (method === "raw_eval") {
        sendProbeResponse(config, method, true, runRawEval(config.hudProbeSelector, config.hudProbeFunctionBody), null);
      } else {
        sendProbeResponse(config, method || "unknown", false, null, "unsupported_probe_method");
      }
    } catch (err) {
      sendProbeResponse(config, method || "unknown", false, null, String(err && err.message ? err.message : err));
    }

    return true;
  });
})();
