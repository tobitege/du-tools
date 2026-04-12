(function () {
  "use strict";

  if (window.__UI_TOOLBOX_RUNNING__) {
    try {
      if (window.console && typeof window.console.warn === "function") {
        window.console.warn("[ModUiToolbox] extraction already running");
      }
    } catch (_ignore) {}
    return;
  }
  window.__UI_TOOLBOX_RUNNING__ = true;

  var VERSION = "1.0.0";
  var DEFAULT_CONFIG = {
    modName: "NQ.UIToolbox",
    actionId: 900001,
    mode: "full_dump",
    htmlSelector: "",
    targetStylesheetHref: "",
    targetStylesheetMaxChars: 12000000,
    targetScriptHref: "",
    targetScriptMaxChars: 12000000,
    targetScriptPacketDelayMs: 2,
    allStylesheetOnlyCssHref: true,
    allStylesheetMaxSheets: 512,
    allStylesheetMaxSheetChars: 12000000,
    allStylesheetPacketDelayMs: 2,
    allScriptsOnlyJsSrc: true,
    allScriptsExcludeUiToolbox: true,
    allScriptsMaxScripts: 512,
    allScriptsMaxScriptChars: 12000000,
    allScriptsPacketDelayMs: 2,
    dumpSectionPacketDelayMs: 1,
    dumpSectionBurstPacketCount: 100,
    dumpSectionBurstPauseMs: 250,
    chunkSize: 12000,
    phaseDelayMs: 10,
    initialDelayMs: 0,
    maxPayloadChars: 3000000,
    maxHtmlChars: 1500000,
    maxScripts: 400,
    maxStyleSheets: 120,
    maxCssRulesPerSheet: 1500,
    maxCssRuleTextLength: 2000,
    maxTotalCssChars: 1500000,
    maxDomNodesForClassScan: 120000,
    maxClassesReturned: 300,
    maxElementsPerSelector: 40,
    maxTextSampleChars: 180,
    maxStorageItems: 500,
    computedSelectors: [
      "body",
      ".mining_unit_panel",
      ".generic_button",
      ".header",
      ".panel_title",
      ".content",
      ".content_wrapper",
      ".close_button",
      ".contextual_menu",
      ".contextual_menu_entry"
    ],
    computedProperties: [
      "display",
      "position",
      "z-index",
      "width",
      "height",
      "min-width",
      "min-height",
      "margin",
      "padding",
      "border",
      "border-radius",
      "background",
      "background-color",
      "background-image",
      "color",
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "opacity",
      "box-shadow",
      "transform",
      "transition"
    ]
  };

  function copyObject(obj) {
    var out = {};
    if (!obj || typeof obj !== "object") {
      return out;
    }
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        out[k] = obj[k];
      }
    }
    return out;
  }

  function mergeConfig(baseCfg, userCfg) {
    var cfg = copyObject(baseCfg);
    if (!userCfg || typeof userCfg !== "object") {
      return cfg;
    }
    for (var k in userCfg) {
      if (Object.prototype.hasOwnProperty.call(userCfg, k)) {
        cfg[k] = userCfg[k];
      }
    }
    return cfg;
  }

  function numberOrDefault(value, fallback) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) {
      return fallback;
    }
    return Math.floor(n);
  }

  function toErrorString(err) {
    if (!err) {
      return "unknown";
    }
    if (typeof err === "string") {
      return err;
    }
    var msg = "";
    try {
      msg = (err.name ? err.name + ": " : "") + (err.message || String(err));
      if (err.stack) {
        msg += " | " + String(err.stack).split("\n")[0];
      }
    } catch (_ignore) {
      msg = "error-unserializable";
    }
    return msg;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function makeDumpId() {
    var rand = Math.floor(Math.random() * 1000000000);
    return "ui-" + Date.now() + "-" + rand;
  }

  function clipText(text, maxLen) {
    if (typeof text !== "string") {
      text = String(text);
    }
    if (text.length <= maxLen) {
      return text;
    }
    return text.slice(0, maxLen) + " ...<truncated>";
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return JSON.stringify({
        _stringifyError: toErrorString(err)
      });
    }
  }

  function splitIntoChunks(text, chunkSize) {
    var chunks = [];
    if (!text) {
      chunks.push("");
      return chunks;
    }
    for (var i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  function simpleNodeInfo(node) {
    if (!node) {
      return null;
    }
    var className = "";
    try {
      className = node.className || "";
    } catch (_ignore) {}
    return {
      tag: node.tagName || "",
      id: node.id || "",
      className: String(className)
    };
  }

  function normalizeHref(value) {
    if (!value) {
      return "";
    }
    var normalized = String(value).trim();
    if (!normalized) {
      return "";
    }
    normalized = normalized.replace(/[?#].*$/, "");
    return normalized.toLowerCase();
  }

  function hrefMatchesTarget(sheetHref, targetHref) {
    var sheet = normalizeHref(sheetHref);
    var target = normalizeHref(targetHref);
    if (!sheet || !target) {
      return false;
    }
    if (sheet === target) {
      return true;
    }
    var targetNoPrefix = target.replace(/^coui:\/\/data\//, "");
    var sheetNoPrefix = sheet.replace(/^coui:\/\/data\//, "");
    if (targetNoPrefix && (sheetNoPrefix === targetNoPrefix || sheetNoPrefix.slice(-targetNoPrefix.length) === targetNoPrefix)) {
      return true;
    }
    if (target.length < 120 && (sheet.indexOf(target) >= 0 || target.indexOf(sheet) >= 0)) {
      return true;
    }
    return false;
  }

  function isCssHref(href) {
    var normalized = normalizeHref(href);
    if (!normalized) {
      return false;
    }
    return /\.css$/.test(normalized);
  }

  function isLikelyJavaScriptHref(href, scriptType) {
    var normalized = normalizeHref(href);
    var type = String(scriptType || "").toLowerCase();

    if (normalized) {
      if (/\.(mjs|cjs|js)$/.test(normalized)) {
        return true;
      }
      if (normalized.indexOf("blob:") === 0 || normalized.indexOf("data:text/javascript") === 0) {
        return true;
      }
    }

    if (type.indexOf("javascript") >= 0 || type.indexOf("ecmascript") >= 0 || type === "module") {
      return true;
    }

    return false;
  }

  function extractHrefFileStem(href) {
    var normalized = normalizeHref(href);
    if (!normalized) {
      return "inline_stylesheet";
    }
    var slash = normalized.lastIndexOf("/");
    var filename = slash >= 0 ? normalized.slice(slash + 1) : normalized;
    if (!filename) {
      filename = "stylesheet";
    }
    filename = filename.replace(/\.css$/i, "");
    if (!filename) {
      filename = "stylesheet";
    }
    return filename;
  }

  function extractUrlFileStem(url, fallback) {
    var normalized = normalizeHref(url);
    var stem = String(fallback || "file");
    if (!normalized) {
      return stem;
    }

    var slash = normalized.lastIndexOf("/");
    var filename = slash >= 0 ? normalized.slice(slash + 1) : normalized;
    if (!filename) {
      return stem;
    }

    filename = filename.replace(/\.(mjs|cjs|js|css)$/i, "");
    filename = filename.replace(/[^a-z0-9._-]+/gi, "_");
    filename = filename.replace(/^_+|_+$/g, "");
    if (!filename) {
      return stem;
    }

    return filename;
  }

  function sanitizeSectionToken(value, maxLen) {
    var token = String(value || "").toLowerCase();
    token = token.replace(/[^a-z0-9_-]+/g, "_");
    token = token.replace(/_+/g, "_");
    token = token.replace(/^_+|_+$/g, "");
    if (!token) {
      token = "stylesheet";
    }
    if (token.length > maxLen) {
      token = token.slice(0, maxLen);
    }
    return token;
  }

  function leftPadNumber(value, width) {
    var s = String(value);
    while (s.length < width) {
      s = "0" + s;
    }
    return s;
  }

  var config = mergeConfig(DEFAULT_CONFIG, window.__UI_TOOLBOX_CONFIG || {});
  config.mode = typeof config.mode === "string" ? String(config.mode).toLowerCase() : DEFAULT_CONFIG.mode;
  config.htmlSelector = String(config.htmlSelector || "");
  config.targetStylesheetHref = String(config.targetStylesheetHref || "");
  config.targetStylesheetMaxChars = numberOrDefault(config.targetStylesheetMaxChars, DEFAULT_CONFIG.targetStylesheetMaxChars);
  config.allStylesheetOnlyCssHref = !!config.allStylesheetOnlyCssHref;
  config.allStylesheetMaxSheets = numberOrDefault(config.allStylesheetMaxSheets, DEFAULT_CONFIG.allStylesheetMaxSheets);
  config.allStylesheetMaxSheetChars = numberOrDefault(config.allStylesheetMaxSheetChars, DEFAULT_CONFIG.allStylesheetMaxSheetChars);
  config.allStylesheetPacketDelayMs = numberOrDefault(config.allStylesheetPacketDelayMs, DEFAULT_CONFIG.allStylesheetPacketDelayMs);
  config.allScriptsOnlyJsSrc = !!config.allScriptsOnlyJsSrc;
  config.allScriptsMaxScripts = numberOrDefault(config.allScriptsMaxScripts, DEFAULT_CONFIG.allScriptsMaxScripts);
  config.allScriptsMaxScriptChars = numberOrDefault(config.allScriptsMaxScriptChars, DEFAULT_CONFIG.allScriptsMaxScriptChars);
  config.allScriptsPacketDelayMs = numberOrDefault(config.allScriptsPacketDelayMs, DEFAULT_CONFIG.allScriptsPacketDelayMs);
  config.dumpSectionPacketDelayMs = numberOrDefault(config.dumpSectionPacketDelayMs, DEFAULT_CONFIG.dumpSectionPacketDelayMs);
  config.dumpSectionBurstPacketCount = numberOrDefault(config.dumpSectionBurstPacketCount, DEFAULT_CONFIG.dumpSectionBurstPacketCount);
  config.dumpSectionBurstPauseMs = numberOrDefault(config.dumpSectionBurstPauseMs, DEFAULT_CONFIG.dumpSectionBurstPauseMs);
  config.chunkSize = numberOrDefault(config.chunkSize, DEFAULT_CONFIG.chunkSize);
  config.phaseDelayMs = numberOrDefault(config.phaseDelayMs, DEFAULT_CONFIG.phaseDelayMs);
  config.initialDelayMs = numberOrDefault(config.initialDelayMs, DEFAULT_CONFIG.initialDelayMs);
  config.maxPayloadChars = numberOrDefault(config.maxPayloadChars, DEFAULT_CONFIG.maxPayloadChars);
  config.maxHtmlChars = numberOrDefault(config.maxHtmlChars, DEFAULT_CONFIG.maxHtmlChars);
  config.maxScripts = numberOrDefault(config.maxScripts, DEFAULT_CONFIG.maxScripts);
  config.maxStyleSheets = numberOrDefault(config.maxStyleSheets, DEFAULT_CONFIG.maxStyleSheets);
  config.maxCssRulesPerSheet = numberOrDefault(config.maxCssRulesPerSheet, DEFAULT_CONFIG.maxCssRulesPerSheet);
  config.maxCssRuleTextLength = numberOrDefault(config.maxCssRuleTextLength, DEFAULT_CONFIG.maxCssRuleTextLength);
  config.maxTotalCssChars = numberOrDefault(config.maxTotalCssChars, DEFAULT_CONFIG.maxTotalCssChars);
  config.maxDomNodesForClassScan = numberOrDefault(config.maxDomNodesForClassScan, DEFAULT_CONFIG.maxDomNodesForClassScan);
  config.maxClassesReturned = numberOrDefault(config.maxClassesReturned, DEFAULT_CONFIG.maxClassesReturned);
  config.maxElementsPerSelector = numberOrDefault(config.maxElementsPerSelector, DEFAULT_CONFIG.maxElementsPerSelector);
  config.maxTextSampleChars = numberOrDefault(config.maxTextSampleChars, DEFAULT_CONFIG.maxTextSampleChars);
  config.maxStorageItems = numberOrDefault(config.maxStorageItems, DEFAULT_CONFIG.maxStorageItems);

  if (!config.computedSelectors || !config.computedSelectors.length) {
    config.computedSelectors = DEFAULT_CONFIG.computedSelectors.slice(0);
  }
  if (!config.computedProperties || !config.computedProperties.length) {
    config.computedProperties = DEFAULT_CONFIG.computedProperties.slice(0);
  }

  var dumpId = makeDumpId();
  var startedAt = Date.now();
  var packetCount = 0;
  var errors = [];
  var warnings = [];
  var sectionReports = [];
  var extensionModeHandlers = [];
  var payloadApi = null;
  window.__UI_TOOLBOX_LAST_DUMP_ID__ = dumpId;

  function registerModeHandler(handler) {
    if (typeof handler === "function") {
      extensionModeHandlers.push(handler);
    }
  }

  function pushError(section, err) {
    errors.push({
      section: section,
      at: nowIso(),
      error: toErrorString(err)
    });
  }

  function pushWarning(section, message) {
    warnings.push({
      section: section,
      at: nowIso(),
      warning: String(message)
    });
  }

  function sendRawPacket(packet) {
    var raw = safeStringify(packet);
    try {
      if (window.CPPMod && typeof window.CPPMod.sendModAction === "function") {
        window.CPPMod.sendModAction(config.modName, config.actionId, [], raw);
        packetCount += 1;
        return true;
      }
    } catch (err) {
      pushError("sendRawPacket", err);
    }
    try {
      if (window.console && typeof window.console.warn === "function") {
        window.console.warn("[ModUiToolbox] CPPMod unavailable. Packet preview:", packet.type, packet.section || "");
      }
    } catch (_ignore) {}
    return false;
  }

  function normalizeSectionReportMeta(section, meta, originalPayloadLength, sentLength, chunkCount) {
    var sectionMeta = copyObject(meta || {});
    var originalLength = sectionMeta.originalLength;
    var sourceKind = sectionMeta.sourceKind || "";
    var selector = sectionMeta.selector;
    var requestedSelector = sectionMeta.requestedSelector;
    var collectionTruncated = !!sectionMeta.collectionTruncated;
    var transportTruncated = !!sectionMeta.transportTruncated;

    if (typeof originalLength !== "number" || !isFinite(originalLength) || originalLength < 0) {
      originalLength = originalPayloadLength;
    }
    if (typeof selector !== "string") {
      selector = "";
    }
    if (typeof requestedSelector !== "string") {
      requestedSelector = selector;
    }
    if (typeof sectionMeta.sentLength !== "number" || !isFinite(sectionMeta.sentLength) || sectionMeta.sentLength < 0) {
      sectionMeta.sentLength = sentLength;
    }
    sectionMeta.originalLength = originalLength;
    sectionMeta.sourceKind = sourceKind;
    sectionMeta.selector = selector;
    sectionMeta.requestedSelector = requestedSelector;
    sectionMeta.collectionTruncated = collectionTruncated;
    sectionMeta.transportTruncated = transportTruncated;
    sectionMeta.complete = !collectionTruncated && !transportTruncated;
    if (meta && meta.complete === false) {
      sectionMeta.complete = false;
    }
    sectionMeta.packetCount = chunkCount;
    return sectionMeta;
  }

  function recordSectionReport(section, meta) {
    var report = copyObject(meta || {});
    report.section = section;
    sectionReports.push(report);
  }

  function sendSection(section, data, meta, options) {
    var payload = typeof data === "string" ? data : safeStringify(data);
    var sendOptions = options || {};
    var originalPayloadLength = payload.length;
    var transportTruncated = false;

    if (!sendOptions.noPayloadClip && payload.length > config.maxPayloadChars) {
      payload = payload.slice(0, config.maxPayloadChars);
      transportTruncated = true;
    }

    var chunks = splitIntoChunks(payload, config.chunkSize);
    var sectionMeta = normalizeSectionReportMeta(section, meta, originalPayloadLength, payload.length, chunks.length);
    if (transportTruncated) {
      sectionMeta.transportTruncated = true;
      sectionMeta.payloadTruncated = true;
      sectionMeta.originalPayloadLength = originalPayloadLength;
      sectionMeta.complete = false;
      pushWarning(section, "section payload clipped before transport: sent " + payload.length + " of " + originalPayloadLength + " chars");
    }
    recordSectionReport(section, sectionMeta);
    for (var i = 0; i < chunks.length; i += 1) {
      sendRawPacket({
        type: "ui_dump",
        extractor: "ModUiToolbox",
        version: VERSION,
        dumpId: dumpId,
        section: section,
        part: i + 1,
        total: chunks.length,
        timestamp: nowIso(),
        meta: sectionMeta,
        data: chunks[i]
      });
    }
  }

  function sendSectionPaced(section, data, meta, options, done) {
    var payload = typeof data === "string" ? data : safeStringify(data);
    var sendOptions = options || {};
    var originalPayloadLength = payload.length;
    var packetDelay = Number(sendOptions.packetDelayMs);
    var burstPacketCount = Number(sendOptions.burstPacketCount);
    var burstPauseMs = Number(sendOptions.burstPauseMs);
    var transportTruncated = false;
    if (!isFinite(packetDelay) || packetDelay < 0) {
      packetDelay = 0;
    } else {
      packetDelay = Math.floor(packetDelay);
    }
    if (!isFinite(burstPacketCount) || burstPacketCount < 1) {
      burstPacketCount = 0;
    } else {
      burstPacketCount = Math.floor(burstPacketCount);
    }
    if (!isFinite(burstPauseMs) || burstPauseMs < 0) {
      burstPauseMs = 0;
    } else {
      burstPauseMs = Math.floor(burstPauseMs);
    }

    if (!sendOptions.noPayloadClip && payload.length > config.maxPayloadChars) {
      payload = payload.slice(0, config.maxPayloadChars);
      transportTruncated = true;
    }

    var chunks = splitIntoChunks(payload, config.chunkSize);
    var sectionMeta = normalizeSectionReportMeta(section, meta, originalPayloadLength, payload.length, chunks.length);
    if (transportTruncated) {
      sectionMeta.transportTruncated = true;
      sectionMeta.payloadTruncated = true;
      sectionMeta.originalPayloadLength = originalPayloadLength;
      sectionMeta.complete = false;
      pushWarning(section, "section payload clipped before paced transport: sent " + payload.length + " of " + originalPayloadLength + " chars");
    }
    recordSectionReport(section, sectionMeta);
    var idx = 0;

    function sendNext() {
      if (idx >= chunks.length) {
        if (typeof done === "function") {
          done();
        }
        return;
      }

      sendRawPacket({
        type: "ui_dump",
        extractor: "ModUiToolbox",
        version: VERSION,
        dumpId: dumpId,
        section: section,
        part: idx + 1,
        total: chunks.length,
        timestamp: nowIso(),
        meta: sectionMeta,
        data: chunks[idx]
      });
      idx += 1;

      if (burstPacketCount > 0 && burstPauseMs > 0 && idx < chunks.length && (idx % burstPacketCount) === 0) {
        setTimeout(sendNext, burstPauseMs);
      } else if (packetDelay > 0) {
        setTimeout(sendNext, packetDelay);
      } else {
        sendNext();
      }
    }

    sendNext();
  }

  function withSectionGuard(section, fn, fallback) {
    try {
      return fn();
    } catch (err) {
      pushError(section, err);
      return fallback;
    }
  }

  function installPayloadApi() {
    var api = window.__UI_TOOLBOX_PAYLOAD_API__;
    if (!api || typeof api !== "object") {
      api = {};
    }

    api.version = VERSION;
    api.dumpId = dumpId;
    api.getConfig = function () {
      return config;
    };
    api.copyObject = copyObject;
    api.safeStringify = safeStringify;
    api.withSectionGuard = withSectionGuard;
    api.sendSection = sendSection;
    api.pushWarning = pushWarning;
    api.pushError = pushError;
    api.finalize = finalize;
    api.registerModeHandler = registerModeHandler;
    api.isMode = function (name) {
      return String(config.mode || "").toLowerCase() === String(name || "").toLowerCase();
    };

    window.__UI_TOOLBOX_PAYLOAD_API__ = api;
    return api;
  }

  function collectRuntime() {
    return withSectionGuard("runtime", function () {
      var nav = window.navigator || {};
      var screenObj = window.screen || {};
      return {
        locationHref: window.location ? window.location.href : "",
        title: document.title || "",
        readyState: document.readyState || "",
        userAgent: nav.userAgent || "",
        platform: nav.platform || "",
        language: nav.language || "",
        viewport: {
          innerWidth: window.innerWidth || 0,
          innerHeight: window.innerHeight || 0,
          devicePixelRatio: window.devicePixelRatio || 1
        },
        screen: {
          width: screenObj.width || 0,
          height: screenObj.height || 0,
          availWidth: screenObj.availWidth || 0,
          availHeight: screenObj.availHeight || 0
        },
        has: {
          CPPMod: !!(window.CPPMod && typeof window.CPPMod.sendModAction === "function"),
          hudManager: !!window.hudManager,
          inputCaptureManager: !!window.inputCaptureManager,
          engine: !!window.engine,
          createElement: typeof window.createElement === "function",
          createSpriteSvg: typeof window.createSpriteSvg === "function",
          MousePage: typeof window.MousePage !== "undefined"
        }
      };
    }, {});
  }

  function collectDomSummary() {
    return withSectionGuard("dom_summary", function () {
      var all = document.getElementsByTagName("*");
      var nodeCount = all ? all.length : 0;
      var tags = {};
      var classHistogram = {};
      var maxNodes = Math.min(nodeCount, config.maxDomNodesForClassScan);

      for (var i = 0; i < nodeCount; i += 1) {
        var n = all[i];
        var tag = (n.tagName || "").toLowerCase();
        if (tag) {
          tags[tag] = (tags[tag] || 0) + 1;
        }
      }

      for (var j = 0; j < maxNodes; j += 1) {
        var node = all[j];
        var cn = "";
        try {
          cn = node.className || "";
        } catch (_ignore) {
          cn = "";
        }
        if (!cn) {
          continue;
        }
        var parts = String(cn).split(/\s+/);
        for (var k = 0; k < parts.length; k += 1) {
          var c = parts[k];
          if (!c) {
            continue;
          }
          classHistogram[c] = (classHistogram[c] || 0) + 1;
        }
      }

      var classPairs = [];
      for (var cls in classHistogram) {
        if (Object.prototype.hasOwnProperty.call(classHistogram, cls)) {
          classPairs.push({ className: cls, count: classHistogram[cls] });
        }
      }
      classPairs.sort(function (a, b) { return b.count - a.count; });
      if (classPairs.length > config.maxClassesReturned) {
        classPairs = classPairs.slice(0, config.maxClassesReturned);
      }

      return {
        totalNodes: nodeCount,
        classScanNodes: maxNodes,
        tags: tags,
        topClasses: classPairs
      };
    }, {});
  }

  function collectHtml() {
    return withSectionGuard("html", function () {
      var html = "";
      var requestedSelector = String(config.htmlSelector || "");
      var selector = requestedSelector;
      var sourceKind = requestedSelector ? "fragment" : "document";
      var fallbackToDocument = false;
      if (config.htmlSelector) {
        try {
          var el = document.querySelector(config.htmlSelector);
          if (el && typeof el.outerHTML === "string") {
            html = el.outerHTML;
          } else {
            pushWarning("html", "selector " + config.htmlSelector + " found no element or outerHTML, falling back to documentElement");
            selector = "";
            sourceKind = "document";
            fallbackToDocument = true;
          }
        } catch (_badSel) {
          pushWarning("html", "selector " + config.htmlSelector + " threw: " + String(_badSel));
          selector = "";
          sourceKind = "document";
          fallbackToDocument = true;
        }
      } else if (document.documentElement && typeof document.documentElement.outerHTML === "string") {
        html = document.documentElement.outerHTML;
      }
      var originalLength = html.length;
      return {
        html: html,
        originalLength: originalLength,
        sourceKind: sourceKind,
        selector: selector,
        requestedSelector: requestedSelector,
        fallbackToDocument: fallbackToDocument,
        collectionTruncated: false,
        complete: true
      };
    }, {
      html: "",
      originalLength: 0,
      sourceKind: "document",
      selector: "",
      requestedSelector: String(config.htmlSelector || ""),
      fallbackToDocument: false,
      collectionTruncated: false,
      complete: true
    });
  }

  function collectScripts() {
    return withSectionGuard("scripts", function () {
      var out = [];
      var scripts = document.scripts || [];
      var limit = Math.min(scripts.length, config.maxScripts);
      for (var i = 0; i < limit; i += 1) {
        var s = scripts[i];
        var textLen = 0;
        try {
          textLen = (s.text || "").length;
        } catch (_ignore) {}
        out.push({
          index: i,
          src: s.src || "",
          type: s.type || "",
          async: !!s.async,
          defer: !!s.defer,
          textLength: textLen,
          node: simpleNodeInfo(s)
        });
      }
      return {
        count: scripts.length,
        sampled: out.length,
        truncated: scripts.length > limit,
        items: out
      };
    }, {});
  }

  function collectStyleSheets() {
    return withSectionGuard("stylesheets", function () {
      var sheets = document.styleSheets || [];
      var result = {
        count: sheets.length,
        sampled: 0,
        sheetLimitHit: false,
        totalRulesScanned: 0,
        totalRuleChars: 0,
        globalRuleCharLimitHit: false,
        sheets: []
      };
      var limit = Math.min(sheets.length, config.maxStyleSheets);
      result.sampled = limit;
      result.sheetLimitHit = sheets.length > limit;

      for (var i = 0; i < limit; i += 1) {
        var entry = {
          index: i,
          href: "",
          disabled: false,
          media: "",
          ownerNode: null,
          ruleCount: null,
          ruleLimitHit: false,
          rules: []
        };

        var sheet = sheets[i];
        try {
          entry.href = sheet.href || "";
          entry.disabled = !!sheet.disabled;
          if (sheet.media && sheet.media.mediaText) {
            entry.media = String(sheet.media.mediaText);
          }
          entry.ownerNode = simpleNodeInfo(sheet.ownerNode || null);
        } catch (errMeta) {
          entry.metaError = toErrorString(errMeta);
        }

        var rules;
        try {
          rules = sheet.cssRules || sheet.rules || [];
          entry.ruleCount = rules.length;
        } catch (errRules) {
          entry.rulesAccessError = toErrorString(errRules);
          result.sheets.push(entry);
          continue;
        }

        var maxRules = config.maxCssRulesPerSheet;
        var ruleLimit = Math.min(rules.length, maxRules);
        if (rules.length > ruleLimit) {
          entry.ruleLimitHit = true;
        }

        for (var r = 0; r < ruleLimit; r += 1) {
          if (result.totalRuleChars >= config.maxTotalCssChars) {
            result.globalRuleCharLimitHit = true;
            break;
          }

          var ruleText = "";
          try {
            var ruleObj = rules[r];
            ruleText = ruleObj && typeof ruleObj.cssText === "string" ? ruleObj.cssText : String(ruleObj);
          } catch (errRuleText) {
            ruleText = "[ruleReadError] " + toErrorString(errRuleText);
          }

          ruleText = clipText(ruleText, config.maxCssRuleTextLength);
          result.totalRuleChars += ruleText.length;
          result.totalRulesScanned += 1;
          entry.rules.push(ruleText);
        }

        result.sheets.push(entry);

        if (result.globalRuleCharLimitHit) {
          break;
        }
      }

      return result;
    }, {});
  }

  function collectSingleStylesheet(targetHref) {
    return withSectionGuard("single_stylesheet", function () {
      var sheets = document.styleSheets || [];
      var found = null;
      var matchedIndex = -1;
      var matchedHref = "";

      for (var i = 0; i < sheets.length; i += 1) {
        var candidate = sheets[i];
        var candidateHref = "";
        try {
          candidateHref = candidate.href || "";
        } catch (_ignoreCandidateHref) {
          candidateHref = "";
        }

        if (hrefMatchesTarget(candidateHref, targetHref)) {
          found = candidate;
          matchedIndex = i;
          matchedHref = candidateHref || "";
          break;
        }
      }

      if (!found) {
        return {
          targetHref: String(targetHref || ""),
          found: false,
          scannedSheets: sheets.length,
          matchedIndex: -1,
          matchedHref: "",
          ruleCount: 0,
          exportedRuleCount: 0,
          cssText: "",
          truncated: false,
          reason: "stylesheet_not_found"
        };
      }

      var rules = [];
      try {
        rules = found.cssRules || found.rules || [];
      } catch (errReadRules) {
        return {
          targetHref: String(targetHref || ""),
          found: true,
          scannedSheets: sheets.length,
          matchedIndex: matchedIndex,
          matchedHref: matchedHref,
          ruleCount: 0,
          exportedRuleCount: 0,
          cssText: "",
          truncated: false,
          reason: "rules_access_error",
          rulesAccessError: toErrorString(errReadRules)
        };
      }

      var cssParts = [];
      var usedChars = 0;
      var maxChars = config.targetStylesheetMaxChars;
      var truncated = false;

      for (var r = 0; r < rules.length; r += 1) {
        var ruleText = "";
        try {
          var ruleObj = rules[r];
          ruleText = ruleObj && typeof ruleObj.cssText === "string" ? ruleObj.cssText : String(ruleObj);
        } catch (errRuleText) {
          ruleText = "/* rule read error: " + toErrorString(errRuleText) + " */";
        }

        var needed = ruleText.length + 1;
        if (usedChars + needed > maxChars) {
          truncated = true;
          var remaining = Math.max(0, maxChars - usedChars);
          if (remaining > 0) {
            cssParts.push(ruleText.slice(0, remaining));
            usedChars += remaining;
          }
          break;
        }

        cssParts.push(ruleText);
        usedChars += needed;
      }

      return {
        targetHref: String(targetHref || ""),
        found: true,
        scannedSheets: sheets.length,
        matchedIndex: matchedIndex,
        matchedHref: matchedHref,
        ruleCount: rules.length,
        exportedRuleCount: cssParts.length,
        cssText: cssParts.join("\n"),
        truncated: truncated,
        reason: "ok"
      };
    }, {
      targetHref: String(targetHref || ""),
      found: false,
      scannedSheets: 0,
      matchedIndex: -1,
      matchedHref: "",
      ruleCount: 0,
      exportedRuleCount: 0,
      cssText: "",
      truncated: false,
      reason: "guard_error"
    });
  }

  function collectSheetCssText(sheet, maxChars) {
    var rules = [];
    var cssParts = [];
    var usedChars = 0;
    var truncated = false;

    try {
      rules = sheet.cssRules || sheet.rules || [];
    } catch (errReadRules) {
      return {
        cssText: "",
        ruleCount: 0,
        exportedRuleCount: 0,
        truncated: false,
        readError: toErrorString(errReadRules)
      };
    }

    for (var r = 0; r < rules.length; r += 1) {
      var ruleText = "";
      try {
        var ruleObj = rules[r];
        ruleText = ruleObj && typeof ruleObj.cssText === "string" ? ruleObj.cssText : String(ruleObj);
      } catch (errRuleText) {
        ruleText = "/* rule read error: " + toErrorString(errRuleText) + " */";
      }

      var needed = ruleText.length + 1;
      if (usedChars + needed > maxChars) {
        truncated = true;
        var remaining = Math.max(0, maxChars - usedChars);
        if (remaining > 0) {
          cssParts.push(ruleText.slice(0, remaining));
          usedChars += remaining;
        }
        break;
      }

      cssParts.push(ruleText);
      usedChars += needed;
    }

    return {
      cssText: cssParts.join("\n"),
      ruleCount: rules.length,
      exportedRuleCount: cssParts.length,
      truncated: truncated,
      readError: ""
    };
  }

  function makeAllStylesheetSectionName(sheetIndex, href) {
    var stem = sanitizeSectionToken(extractHrefFileStem(href), 40);
    return "all_stylesheet_css_" + leftPadNumber(sheetIndex, 3) + "_" + stem;
  }

  function makeAllScriptSectionName(scriptIndex, srcHref) {
    var stem = sanitizeSectionToken(extractUrlFileStem(srcHref, "inline_script"), 40);
    return "all_script_js_" + leftPadNumber(scriptIndex, 3) + "_" + stem;
  }

  function makeSingleScriptSectionName(srcHref) {
    var stem = sanitizeSectionToken(extractUrlFileStem(srcHref, "target_script"), 40);
    return "all_script_js_000_" + stem;
  }

  function isUiToolboxScriptSource(srcHref) {
    var normalized = normalizeHref(srcHref || "");
    if (!normalized) {
      return false;
    }

    return (
      normalized.indexOf("moduitoolbox-payload.js") >= 0 ||
      normalized.indexOf("moduitoolbox-payload.override.js") >= 0 ||
      normalized.indexOf("moduitoolbox-payload.modules/") >= 0 ||
      normalized.indexOf("lua-editor-probe.js") >= 0 ||
      normalized.indexOf("lua-editor-probe.override.js") >= 0 ||
      normalized.indexOf("lua-editor-probe.modules/") >= 0 ||
      normalized.indexOf("lua-editor-runtime-modules/") >= 0
    );
  }

  function isUiToolboxScriptBody(scriptText) {
    var text = String(scriptText || "");
    if (!text) {
      return false;
    }

    return (
      text.indexOf("__UI_TOOLBOX_RUNNING__") >= 0 ||
      text.indexOf("__UI_TOOLBOX_CONFIG") >= 0 ||
      text.indexOf("__UI_TOOLBOX_PAYLOAD_API__") >= 0 ||
      text.indexOf("__UI_TOOLBOX_LUA_PROBE_") >= 0 ||
      text.indexOf("__UI_TOOLBOX_LUA_PROBE_STATE__") >= 0 ||
      text.indexOf("NQ.UIToolbox") >= 0
    );
  }

  function isUiToolboxScript(scriptNode, srcHref, bodyText) {
    if (isUiToolboxScriptSource(srcHref)) {
      return true;
    }

    if (isUiToolboxScriptBody(bodyText)) {
      return true;
    }

    try {
      var scriptId = scriptNode && scriptNode.id ? String(scriptNode.id) : "";
      if (scriptId && /ui[_-]?toolbox|lua[_-]?probe/i.test(scriptId)) {
        return true;
      }
    } catch (_ignoreScriptId) {}

    return false;
  }

  function buildScriptSourceCandidates(srcHref) {
    var out = [];
    var seen = {};

    function pushCandidate(value) {
      var candidate = String(value || "").trim();
      if (!candidate) {
        return;
      }
      var key = candidate.toLowerCase();
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      out.push(candidate);
    }

    var raw = String(srcHref || "").trim();
    if (!raw) {
      return out;
    }

    pushCandidate(raw);

    var normalized = normalizeHref(raw);
    if (normalized.indexOf("coui://data/") === 0) {
      var noScheme = raw.replace(/^coui:\/\/data/i, "");
      pushCandidate(noScheme);
      pushCandidate(noScheme.replace(/^\//, ""));
      pushCandidate(raw.replace(/^coui:\/\/data/i, "data"));
      pushCandidate(raw.replace(/^coui:\/\/data/i, "/data"));
    } else if (normalized.indexOf("coui://") === 0) {
      var genericNoScheme = raw.replace(/^coui:\/\//i, "");
      pushCandidate(genericNoScheme);
      pushCandidate(genericNoScheme.replace(/^\//, ""));
    }

    return out;
  }

  function collectScriptBodyAsync(scriptNode, srcHref, maxChars, done) {
    var inlineText = "";
    var candidates = buildScriptSourceCandidates(srcHref);
    var attemptErrors = [];
    var finished = false;

    function finish(text, method, readError) {
      if (finished) {
        return;
      }
      finished = true;

      var finalText = String(text || "");
      var sourceLength = finalText.length;
      var truncated = false;
      if (finalText.length > maxChars) {
        finalText = finalText.slice(0, maxChars);
        truncated = true;
      }

      done({
        text: finalText,
        sourceLength: sourceLength,
        truncated: truncated,
        readError: readError || "",
        method: method || (srcHref ? "none" : "inline_empty")
      });
    }

    function recordError(message) {
      var text = String(message || "");
      if (!text) {
        return;
      }
      attemptErrors.push(text);
    }

    function finishWithAttempts() {
      var joined = attemptErrors.join(" || ");
      if (joined && /invalidaccesserror/i.test(joined)) {
        finish("", "", "permission_blocked");
        return;
      }
      if (joined.length > 500) {
        joined = joined.slice(0, 500) + " ...<truncated>";
      }
      finish("", "", joined || "script_read_unavailable");
    }

    function tryXhrCandidate(index) {
      if (index >= candidates.length) {
        finishWithAttempts();
        return;
      }

      if (typeof XMLHttpRequest === "undefined") {
        recordError("xmlhttprequest_unavailable");
        finishWithAttempts();
        return;
      }

      var candidate = candidates[index];
      var xhr = null;
      var settled = false;

      function failAttempt(reason) {
        if (settled) {
          return;
        }
        settled = true;
        recordError(candidate + ": " + reason);
        tryXhrCandidate(index + 1);
      }

      function succeedAttempt(responseText) {
        if (settled) {
          return;
        }
        settled = true;
        finish(responseText, "xhr", "");
      }

      try {
        xhr = new XMLHttpRequest();
      } catch (errCtor) {
        failAttempt("ctor_" + toErrorString(errCtor));
        return;
      }

      xhr.onreadystatechange = function () {
        if (!xhr || xhr.readyState !== 4) {
          return;
        }

        var status = 0;
        try {
          status = xhr.status || 0;
        } catch (_ignoreStatusRead) {
          status = 0;
        }

        var okStatus = (status >= 200 && status < 300) || status === 0;
        if (!okStatus) {
          failAttempt("http_status_" + String(status));
          return;
        }

        var responseText = "";
        try {
          responseText = String(xhr.responseText || "");
        } catch (errRead) {
          failAttempt("read_" + toErrorString(errRead));
          return;
        }

        if (!responseText || responseText.replace(/\s+/g, "").length === 0) {
          failAttempt("empty_response");
          return;
        }

        succeedAttempt(responseText);
      };

      xhr.onerror = function () {
        failAttempt("network_error");
      };
      xhr.ontimeout = function () {
        failAttempt("timeout");
      };

      try {
        xhr.open("GET", candidate, true);
        try {
          xhr.timeout = 2000;
        } catch (_ignoreTimeoutSet) {}
        xhr.send(null);
      } catch (errOpenSend) {
        failAttempt(toErrorString(errOpenSend));
      }
    }

    try {
      inlineText = String(scriptNode && (scriptNode.text || scriptNode.textContent) || "");
    } catch (_ignoreInlineRead) {
      inlineText = "";
    }

    // External script tags in DU often contain only formatting whitespace.
    // Treat whitespace-only inline payloads as empty so we attempt src fetch.
    if (inlineText && inlineText.replace(/\s+/g, "").length > 0) {
      finish(inlineText, "inline", "");
      return;
    }

    if (!srcHref) {
      finish("", "inline_empty", "");
      return;
    }

    if (!candidates.length) {
      finish("", "", "missing_script_src");
      return;
    }

    tryXhrCandidate(0);
  }

  function runAllStylesheetsExtraction() {
    var sheets = document.styleSheets || [];
    var maxSheets = Math.min(sheets.length, config.allStylesheetMaxSheets);
    var manifest = [];
    var skippedNoHref = 0;
    var skippedNonCss = 0;
    var exported = 0;

    function sendManifestAndFinish() {
      sendSection("all_stylesheets_manifest", {
        mode: "all_stylesheets",
        scannedSheets: sheets.length,
        processedSheets: maxSheets,
        sheetLimitHit: sheets.length > maxSheets,
        exportedSheets: exported,
        skippedNoHref: skippedNoHref,
        skippedNonCssHref: skippedNonCss,
        items: manifest
      });
      finalize();
    }

    function processSheet(index) {
      if (index >= maxSheets) {
        sendManifestAndFinish();
        return;
      }

      var sheet = sheets[index];
      var href = "";
      var media = "";
      var disabled = false;
      var ownerNode = null;

      try {
        href = sheet.href || "";
      } catch (_ignoreHref) {
        href = "";
      }

      try {
        disabled = !!sheet.disabled;
        media = sheet.media && sheet.media.mediaText ? String(sheet.media.mediaText) : "";
        ownerNode = simpleNodeInfo(sheet.ownerNode || null);
      } catch (_ignoreMeta) {}

      if (!href) {
        skippedNoHref += 1;
        if (config.allStylesheetOnlyCssHref) {
          setTimeout(function () { processSheet(index + 1); }, config.phaseDelayMs);
          return;
        }
      }

      if (config.allStylesheetOnlyCssHref && !isCssHref(href)) {
        skippedNonCss += 1;
        setTimeout(function () { processSheet(index + 1); }, config.phaseDelayMs);
        return;
      }

      var cssResult = collectSheetCssText(sheet, config.allStylesheetMaxSheetChars);
      var sectionName = makeAllStylesheetSectionName(index, href);
      var item = {
        section: sectionName,
        sheetIndex: index,
        href: href,
        disabled: disabled,
        media: media,
        ownerNode: ownerNode,
        ruleCount: cssResult.ruleCount,
        exportedRuleCount: cssResult.exportedRuleCount,
        cssLength: (cssResult.cssText || "").length,
        truncated: !!cssResult.truncated,
        readError: cssResult.readError || ""
      };
      manifest.push(item);

      if (cssResult.readError) {
        pushWarning("all_stylesheets", "failed to read css rules for " + (href || ("sheet#" + index)) + ": " + cssResult.readError);
        setTimeout(function () { processSheet(index + 1); }, config.phaseDelayMs);
        return;
      }

      sendSectionPaced(
        sectionName,
        cssResult.cssText || "",
        {
          href: href,
          sheetIndex: index,
          ruleCount: cssResult.ruleCount,
          exportedRuleCount: cssResult.exportedRuleCount,
          truncated: !!cssResult.truncated
        },
        {
          noPayloadClip: true,
          packetDelayMs: config.allStylesheetPacketDelayMs
        },
        function () {
          exported += 1;
          setTimeout(function () { processSheet(index + 1); }, config.phaseDelayMs);
        });
    }

    processSheet(0);
  }

  function runAllScriptsExtraction() {
    var scripts = document.scripts || [];
    var maxScripts = Math.min(scripts.length, config.allScriptsMaxScripts);
    var manifest = [];
    var skippedNonJs = 0;
    var skippedUiToolbox = 0;
    var exported = 0;

    function sendManifestAndFinish() {
      sendSection("all_scripts_manifest", {
        mode: "all_scripts",
        scannedScripts: scripts.length,
        processedScripts: maxScripts,
        scriptLimitHit: scripts.length > maxScripts,
        exportedScripts: exported,
        skippedNonJavascript: skippedNonJs,
        skippedUiToolbox: skippedUiToolbox,
        items: manifest
      });
      finalize();
    }

    function processScript(index) {
      if (index >= maxScripts) {
        sendManifestAndFinish();
        return;
      }

      var scriptNode = scripts[index];
      var srcHref = "";
      var scriptType = "";
      var scriptAsync = false;
      var scriptDefer = false;
      var ownerNode = null;

      try {
        srcHref = scriptNode && scriptNode.src ? String(scriptNode.src) : "";
      } catch (_ignoreSrc) {
        srcHref = "";
      }
      try {
        scriptType = scriptNode && scriptNode.type ? String(scriptNode.type) : "";
      } catch (_ignoreType) {
        scriptType = "";
      }
      try {
        scriptAsync = !!(scriptNode && scriptNode.async);
        scriptDefer = !!(scriptNode && scriptNode.defer);
        ownerNode = simpleNodeInfo(scriptNode || null);
      } catch (_ignoreMeta) {}

      if (config.allScriptsOnlyJsSrc && srcHref && !isLikelyJavaScriptHref(srcHref, scriptType)) {
        skippedNonJs += 1;
        setTimeout(function () { processScript(index + 1); }, config.phaseDelayMs);
        return;
      }

      collectScriptBodyAsync(scriptNode, srcHref, config.allScriptsMaxScriptChars, function (body) {
        var sectionName = makeAllScriptSectionName(index, srcHref || ("inline_script_" + index));
        var excludedUiToolbox = !!config.allScriptsExcludeUiToolbox && isUiToolboxScript(scriptNode, srcHref, body.text || "");

        var item = {
          section: sectionName,
          scriptIndex: index,
          src: srcHref,
          type: scriptType,
          async: scriptAsync,
          defer: scriptDefer,
          ownerNode: ownerNode,
          extractionMethod: body.method,
          sourceLength: body.sourceLength,
          exportedLength: (body.text || "").length,
          truncated: !!body.truncated,
          readError: body.readError || "",
          excludedUiToolbox: excludedUiToolbox
        };
        manifest.push(item);

        if (excludedUiToolbox) {
          skippedUiToolbox += 1;
          setTimeout(function () { processScript(index + 1); }, config.phaseDelayMs);
          return;
        }

        if (!body.text && body.readError) {
          pushWarning("all_scripts", "failed to read script body for " + (srcHref || ("script#" + index)) + ": " + body.readError);
        }

        sendSectionPaced(
          sectionName,
          body.text || "",
          {
            src: srcHref,
            scriptIndex: index,
            type: scriptType,
            async: scriptAsync,
            defer: scriptDefer,
            extractionMethod: body.method,
            sourceLength: body.sourceLength,
            exportedLength: (body.text || "").length,
            truncated: !!body.truncated,
            readError: body.readError || ""
          },
          {
            noPayloadClip: true,
            packetDelayMs: config.allScriptsPacketDelayMs
          },
          function () {
            exported += 1;
            setTimeout(function () { processScript(index + 1); }, config.phaseDelayMs);
          });
      });
    }

    processScript(0);
  }

  function runSingleScriptExtraction() {
    var targetHref = String(config.targetScriptHref || "");
    var scripts = document.scripts || [];
    var matchedNode = null;
    var matchedIndex = -1;
    var matchedHref = "";
    var scriptType = "";
    var scriptAsync = false;
    var scriptDefer = false;
    var ownerNode = null;
    var i;

    if (!targetHref) {
      pushWarning("single_script", "targetScriptHref is empty");
    }

    for (i = 0; i < scripts.length; i += 1) {
      var scriptNode = scripts[i];
      var srcHref = "";
      try {
        srcHref = scriptNode && scriptNode.src ? String(scriptNode.src) : "";
      } catch (_ignoreSrcRead) {
        srcHref = "";
      }

      if (!hrefMatchesTarget(srcHref, targetHref)) {
        continue;
      }

      matchedNode = scriptNode;
      matchedIndex = i;
      matchedHref = srcHref;
      try {
        scriptType = scriptNode && scriptNode.type ? String(scriptNode.type) : "";
      } catch (_ignoreTypeRead) {
        scriptType = "";
      }
      try {
        scriptAsync = !!(scriptNode && scriptNode.async);
        scriptDefer = !!(scriptNode && scriptNode.defer);
        ownerNode = simpleNodeInfo(scriptNode || null);
      } catch (_ignoreMetaRead) {}
      break;
    }

    if (!matchedNode) {
      sendSection("single_script_manifest", {
        mode: "single_script",
        targetHref: targetHref,
        found: false,
        scannedScripts: scripts.length
      });
      pushWarning("single_script", "script not found: " + targetHref);
      finalize();
      return;
    }

    collectScriptBodyAsync(matchedNode, matchedHref, config.targetScriptMaxChars, function (body) {
      sendSection("single_script_manifest", {
        mode: "single_script",
        targetHref: targetHref,
        found: true,
        matchedHref: matchedHref,
        scriptIndex: matchedIndex,
        type: scriptType,
        async: scriptAsync,
        defer: scriptDefer,
        ownerNode: ownerNode,
        extractionMethod: body.method,
        sourceLength: body.sourceLength,
        exportedLength: (body.text || "").length,
        truncated: !!body.truncated,
        readError: body.readError || ""
      });

      if (!body.text && body.readError) {
        pushWarning("single_script", "failed to read script body for " + matchedHref + ": " + body.readError);
      }

      sendSectionPaced(
        makeSingleScriptSectionName(matchedHref || targetHref),
        body.text || "",
        {
          targetHref: targetHref,
          matchedHref: matchedHref,
          scriptIndex: matchedIndex,
          type: scriptType,
          async: scriptAsync,
          defer: scriptDefer,
          extractionMethod: body.method,
          sourceLength: body.sourceLength,
          exportedLength: (body.text || "").length,
          truncated: !!body.truncated,
          readError: body.readError || ""
        },
        {
          noPayloadClip: true,
          packetDelayMs: config.targetScriptPacketDelayMs
        },
        function () {
          finalize();
        });
    });
  }

  function collectComputedStyles() {
    return withSectionGuard("computed_styles", function () {
      var output = {
        selectors: []
      };

      for (var i = 0; i < config.computedSelectors.length; i += 1) {
        var selector = String(config.computedSelectors[i]);
        var nodeList = null;
        var selectorEntry = {
          selector: selector,
          count: 0,
          sampled: 0,
          limitHit: false,
          samples: []
        };

        try {
          nodeList = document.querySelectorAll(selector);
          selectorEntry.count = nodeList.length;
        } catch (errSelector) {
          selectorEntry.error = toErrorString(errSelector);
          output.selectors.push(selectorEntry);
          continue;
        }

        var elementLimit = Math.min(nodeList.length, config.maxElementsPerSelector);
        selectorEntry.sampled = elementLimit;
        selectorEntry.limitHit = nodeList.length > elementLimit;

        for (var j = 0; j < elementLimit; j += 1) {
          var node = nodeList[j];
          var textValue = "";
          try {
            textValue = (node.textContent || "").replace(/\s+/g, " ").trim();
          } catch (_ignore) {
            textValue = "";
          }

          var sample = {
            node: simpleNodeInfo(node),
            textSample: clipText(textValue, config.maxTextSampleChars),
            styles: {}
          };

          try {
            var cs = window.getComputedStyle(node);
            for (var p = 0; p < config.computedProperties.length; p += 1) {
              var prop = config.computedProperties[p];
              var val = "";
              try {
                val = cs.getPropertyValue(prop) || "";
              } catch (_ignoreProp) {
                val = "";
              }
              sample.styles[prop] = val;
            }
          } catch (errStyle) {
            sample.styleError = toErrorString(errStyle);
          }

          selectorEntry.samples.push(sample);
        }

        output.selectors.push(selectorEntry);
      }

      return output;
    }, {});
  }

  function collectStorage() {
    return withSectionGuard("storage", function () {
      function readStorage(storage, label) {
        var out = {
          kind: label,
          available: false,
          length: 0,
          sampled: 0,
          limitHit: false,
          items: []
        };
        if (!storage) {
          return out;
        }
        out.available = true;
        try {
          out.length = storage.length || 0;
          var limit = Math.min(out.length, config.maxStorageItems);
          out.sampled = limit;
          out.limitHit = out.length > limit;
          for (var i = 0; i < limit; i += 1) {
            var key = storage.key(i);
            var value = storage.getItem(key);
            out.items.push({
              key: key,
              valueSample: clipText(value || "", 512),
              valueLength: value ? value.length : 0
            });
          }
        } catch (err) {
          out.error = toErrorString(err);
        }
        return out;
      }

      return {
        localStorage: readStorage(window.localStorage, "localStorage"),
        sessionStorage: readStorage(window.sessionStorage, "sessionStorage")
      };
    }, {});
  }

  function collectGlobals() {
    return withSectionGuard("globals", function () {
      var keys = [];
      try {
        for (var k in window) {
          if (Object.prototype.hasOwnProperty.call(window, k)) {
            keys.push(k);
          }
        }
      } catch (_ignore) {}

      var prefixed = [];
      for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        if (/^(NQ|DU|CPP|hud|engine|input)/.test(key)) {
          prefixed.push(key);
        }
      }
      prefixed.sort();

      return {
        keyCount: keys.length,
        interestingKeys: prefixed.slice(0, 500)
      };
    }, {});
  }

  function collectLinkAndStyleNodes() {
    return withSectionGuard("nodes", function () {
      var links = document.querySelectorAll("link");
      var styles = document.querySelectorAll("style");
      var outLinks = [];
      var outStyles = [];

      for (var i = 0; i < links.length && i < config.maxScripts; i += 1) {
        var l = links[i];
        outLinks.push({
          index: i,
          rel: l.rel || "",
          href: l.href || "",
          type: l.type || "",
          media: l.media || "",
          disabled: !!l.disabled
        });
      }

      for (var j = 0; j < styles.length && j < config.maxScripts; j += 1) {
        var st = styles[j];
        var txt = "";
        try {
          txt = st.textContent || "";
        } catch (_ignore) {}
        outStyles.push({
          index: j,
          textLength: txt.length,
          textSample: clipText(txt, 400)
        });
      }

      return {
        links: {
          count: links.length,
          sampled: outLinks.length,
          items: outLinks
        },
        styleNodes: {
          count: styles.length,
          sampled: outStyles.length,
          items: outStyles
        }
      };
    }, {});
  }

  function finalize() {
    var incompleteSections = [];
    for (var i = 0; i < sectionReports.length; i += 1) {
      if (sectionReports[i] && sectionReports[i].complete === false) {
        incompleteSections.push(copyObject(sectionReports[i]));
      }
    }
    sendSection("errors", {
      count: errors.length,
      items: errors
    });
    sendSection("warnings", {
      count: warnings.length,
      items: warnings
    });

    sendRawPacket({
      type: "ui_dump_complete",
      extractor: "ModUiToolbox",
      version: VERSION,
      dumpId: dumpId,
      timestamp: nowIso(),
      elapsedMs: Date.now() - startedAt,
      sentPackets: packetCount,
      errorCount: errors.length,
      warningCount: warnings.length,
      complete: incompleteSections.length === 0,
      sectionCount: sectionReports.length,
      incompleteSectionCount: incompleteSections.length,
      incompleteSections: incompleteSections
    });

    window.__UI_TOOLBOX_RUNNING__ = false;
  }

  function fatal(section, err) {
    pushError(section, err);
    sendRawPacket({
      type: "ui_dump_fatal",
      extractor: "ModUiToolbox",
      version: VERSION,
      dumpId: dumpId,
      timestamp: nowIso(),
      section: section,
      error: toErrorString(err)
    });
    window.__UI_TOOLBOX_RUNNING__ = false;
  }

  function runSingleStylesheetExtraction() {
    var targetHref = String(config.targetStylesheetHref || "");
    if (!targetHref) {
      pushWarning("single_stylesheet", "targetStylesheetHref is empty");
    }

    var extract = collectSingleStylesheet(targetHref);
    var meta = copyObject(extract);
    delete meta.cssText;

    sendSection("stylesheet_extract_meta", meta);

    if (extract.found) {
      sendSection(
        "stylesheet_extract_css",
        extract.cssText || "",
        {
          targetHref: targetHref,
          matchedHref: extract.matchedHref || "",
          ruleCount: extract.ruleCount || 0,
          exportedRuleCount: extract.exportedRuleCount || 0,
          truncated: !!extract.truncated
        },
        { noPayloadClip: true });
    } else {
      pushWarning("single_stylesheet", "stylesheet not found: " + targetHref);
    }

    finalize();
  }

  function runPhases() {
    function sendPhaseSection(section, data, meta, options, done) {
      var sendOptions = copyObject(options || {});
      if (typeof sendOptions.packetDelayMs !== "number" || !isFinite(sendOptions.packetDelayMs)) {
        sendOptions.packetDelayMs = config.dumpSectionPacketDelayMs;
      }
      if (typeof sendOptions.burstPacketCount !== "number" || !isFinite(sendOptions.burstPacketCount)) {
        sendOptions.burstPacketCount = config.dumpSectionBurstPacketCount;
      }
      if (typeof sendOptions.burstPauseMs !== "number" || !isFinite(sendOptions.burstPauseMs)) {
        sendOptions.burstPauseMs = config.dumpSectionBurstPauseMs;
      }
      sendSectionPaced(section, data, meta, sendOptions, done);
    }

    var phases = [
      {
        name: "runtime",
        fn: function (done) {
          sendPhaseSection("runtime", collectRuntime(), null, null, done);
        }
      },
      {
        name: "dom_summary",
        fn: function (done) {
          sendPhaseSection("dom_summary", collectDomSummary(), null, null, done);
        }
      },
      {
        name: "html",
        fn: function (done) {
          var htmlData = collectHtml();
          sendPhaseSection("html", htmlData.html, {
            originalLength: htmlData.originalLength,
            sourceKind: htmlData.sourceKind,
            selector: htmlData.selector,
            requestedSelector: htmlData.requestedSelector,
            fallbackToDocument: !!htmlData.fallbackToDocument,
            collectionTruncated: !!htmlData.collectionTruncated,
            complete: !!htmlData.complete
          }, {
            noPayloadClip: true
          }, done);
        }
      },
      {
        name: "scripts",
        fn: function (done) {
          sendPhaseSection("scripts", collectScripts(), null, null, done);
        }
      },
      {
        name: "style_and_link_nodes",
        fn: function (done) {
          sendPhaseSection("style_and_link_nodes", collectLinkAndStyleNodes(), null, null, done);
        }
      },
      {
        name: "stylesheets",
        fn: function (done) {
          sendPhaseSection("stylesheets", collectStyleSheets(), null, null, done);
        }
      },
      {
        name: "computed_styles",
        fn: function (done) {
          sendPhaseSection("computed_styles", collectComputedStyles(), null, null, done);
        }
      },
      {
        name: "storage",
        fn: function (done) {
          sendPhaseSection("storage", collectStorage(), null, null, done);
        }
      },
      {
        name: "globals",
        fn: function (done) {
          sendPhaseSection("globals", collectGlobals(), null, null, done);
        }
      }
    ];

    function step(index) {
      if (index >= phases.length) {
        finalize();
        return;
      }

      var phase = phases[index];
      setTimeout(function () {
        try {
          phase.fn(function () {
            step(index + 1);
          });
        } catch (err) {
          pushError("phase:" + phase.name, err);
          step(index + 1);
        }
      }, config.phaseDelayMs);
    }

    step(0);
  }

  function bootstrap() {
    try {
      sendRawPacket({
        type: "ui_dump_start",
        extractor: "ModUiToolbox",
        version: VERSION,
        dumpId: dumpId,
        timestamp: nowIso(),
        config: {
          modName: config.modName,
          actionId: config.actionId,
          mode: config.mode,
          targetStylesheetHref: config.targetStylesheetHref,
          targetStylesheetMaxChars: config.targetStylesheetMaxChars,
          targetScriptHref: config.targetScriptHref,
          targetScriptMaxChars: config.targetScriptMaxChars,
          targetScriptPacketDelayMs: config.targetScriptPacketDelayMs,
          allStylesheetOnlyCssHref: config.allStylesheetOnlyCssHref,
          allStylesheetMaxSheets: config.allStylesheetMaxSheets,
          allStylesheetMaxSheetChars: config.allStylesheetMaxSheetChars,
          allStylesheetPacketDelayMs: config.allStylesheetPacketDelayMs,
          allScriptsOnlyJsSrc: config.allScriptsOnlyJsSrc,
          allScriptsMaxScripts: config.allScriptsMaxScripts,
          allScriptsMaxScriptChars: config.allScriptsMaxScriptChars,
          allScriptsPacketDelayMs: config.allScriptsPacketDelayMs,
          dumpSectionPacketDelayMs: config.dumpSectionPacketDelayMs,
          dumpSectionBurstPacketCount: config.dumpSectionBurstPacketCount,
          dumpSectionBurstPauseMs: config.dumpSectionBurstPauseMs,
          chunkSize: config.chunkSize,
          phaseDelayMs: config.phaseDelayMs,
          maxPayloadChars: config.maxPayloadChars,
          maxHtmlChars: config.maxHtmlChars,
          maxScripts: config.maxScripts,
          maxStyleSheets: config.maxStyleSheets,
          maxCssRulesPerSheet: config.maxCssRulesPerSheet,
          maxTotalCssChars: config.maxTotalCssChars,
          maxElementsPerSelector: config.maxElementsPerSelector,
          htmlSelector: config.htmlSelector,
          initialDelayMs: config.initialDelayMs
        }
      });

      function startDispatch() {
        var handlerIndex = 0;
        for (handlerIndex = 0; handlerIndex < extensionModeHandlers.length; handlerIndex += 1) {
          try {
            if (extensionModeHandlers[handlerIndex](config, payloadApi) === true) {
              return;
            }
          } catch (handlerErr) {
            pushError("mode_handler:" + handlerIndex, handlerErr);
          }
        }

        if (config.mode === "single_stylesheet") {
          runSingleStylesheetExtraction();
        } else if (config.mode === "all_stylesheets") {
          runAllStylesheetsExtraction();
        } else if (config.mode === "single_script") {
          runSingleScriptExtraction();
        } else if (config.mode === "all_scripts") {
          runAllScriptsExtraction();
        } else {
          runPhases();
        }
      }

      if (config.initialDelayMs > 0) {
        setTimeout(startDispatch, config.initialDelayMs);
      } else {
        startDispatch();
      }
    } catch (errTop) {
      fatal("bootstrap", errTop);
    }
  }

  payloadApi = installPayloadApi();
  setTimeout(bootstrap, 0);
})();
