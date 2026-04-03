// 085-ide-export.js - Export generated board/screen code via mod IDE-import path
(function hudEditorIdeExport() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;
  if (!APP.screenCommands) return;

  var SCREEN_SCRIPT_LIMIT = 50000;
  var DEFAULT_PAINTERLIB_MODULE = "lib.painterlib";

  function getRuntimeCtx() {
    return window.__HUD_EDITOR_RUNTIME_CTX__ || null;
  }

  function getDocument() {
    return APP.state && APP.state.document ? APP.state.document : null;
  }

  function isNodeVisible(node) {
    if (!node) return false;
    if (node.classList && node.classList.contains("hide")) return false;
    if (node.style && node.style.display === "none") return false;
    return node.offsetParent !== null || node === document.activeElement;
  }

  function getVisibleScreenEditorPanel() {
    var panels = document.querySelectorAll(".screen_content_editor_panel");
    var index;
    var panel;
    for (index = 0; index < panels.length; index += 1) {
      panel = panels[index];
      if (isNodeVisible(panel)) {
        return panel;
      }
    }
    return null;
  }

  function luaEscapeString(value) {
    return JSON.stringify(String(value == null ? "" : value))
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  function toLua(value) {
    if (value === null || typeof value === "undefined") return "nil";
    if (typeof value === "number") {
      if (!isFinite(value)) return "0";
      if (Math.round(value) === value) return String(value);
      return String(Number(value.toFixed(4)));
    }
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return luaEscapeString(value);
    if (Array.isArray(value)) {
      if (!value.length) return "{}";
      return "{" + value.map(toLua).join(",") + "}";
    }
    if (typeof value === "object") {
      var keys = Object.keys(value);
      if (!keys.length) return "{}";
      return "{" + keys.map(function (key) {
        var safeKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
          ? key
          : "[" + luaEscapeString(key) + "]";
        return safeKey + "=" + toLua(value[key]);
      }).join(",") + "}";
    }
    return "nil";
  }

  function cloneDocument(doc) {
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  }

  function joinLuaArgs(values) {
    return values.map(function (value) {
      return toLua(value);
    }).join(", ");
  }

  function normalizeScreenCodeMode(options) {
    var mode = options;
    if (mode && typeof mode === "object") {
      mode = mode.mode;
    }
    mode = String(mode || "default").toLowerCase();
    if (mode === "readable") return "default";
    return mode === "compact" ? "compact" : "default";
  }

  function getPainterlibModuleName(options) {
    var moduleName = options && typeof options === "object" ? options.painterlib : null;
    moduleName = String(moduleName || DEFAULT_PAINTERLIB_MODULE).trim();
    return moduleName || DEFAULT_PAINTERLIB_MODULE;
  }

  function getPainterMethodName(command) {
    var kind = command && command.k ? String(command.k) : "box";
    if (!command || command.o === "shape") {
      if (kind === "boxRounded") return "br";
      if (kind === "circle") return "ci";
      if (kind === "triangle") return "tr";
      if (kind === "quad") return "qd";
      return "bx";
    }
    if (command.o === "text") return "tx";
    if (command.o === "line") return "ln";
    if (command.o === "bezier") return "bz";
    if (command.o === "image") return "ig";
    return "bx";
  }

  function buildPainterCall(command, layerVar) {
    return "P." + getPainterMethodName(command) + "(" + layerVar + ", " + toLua(command) + ")";
  }

  function describePainterCommand(command, index) {
    return "-- Command " + index + ": " + String(command && command.o || "shape") + (command && command.k ? (" " + String(command.k)) : "");
  }

  function buildReadableBaseStyle(command) {
    var style = {};
    if (command && command.rot) {
      style.rotation = command.rot;
    }
    if (command && command.sh) {
      style.shadow = {
        blur: command.sh.b,
        color: command.sh.c
      };
    }
    return style;
  }

  function buildReadableShapeStyle(command) {
    var style = buildReadableBaseStyle(command);
    style.fill = command && command.f ? command.f : [0.2, 0.2, 0.2, 1];
    style.stroke = command && command.s ? command.s : [1, 1, 1, 1];
    style.strokeWidth = command && command.sw != null ? command.sw : 0;
    return style;
  }

  function buildReadableStrokeStyle(command, defaultWidth) {
    var style = buildReadableBaseStyle(command);
    style.stroke = command && command.s ? command.s : [1, 1, 1, 1];
    style.strokeWidth = command && command.sw != null ? command.sw : defaultWidth;
    return style;
  }

  function buildReadableImageStyle(command) {
    var style = buildReadableBaseStyle(command);
    if (command && command.f) {
      style.fill = command.f;
    }
    return style;
  }

  function buildReadableTextStyle(command) {
    var style = buildReadableBaseStyle(command);
    style.stroke = command && command.s ? command.s : [0, 0, 0, 0];
    style.strokeWidth = command && command.sw != null ? command.sw : 0;
    style.textColor = command && command.tc ? command.tc : [1, 1, 1, 1];
    return style;
  }

  function appendReadableCommand(lines, command, index) {
    var kind;
    var style;
    if (!command) return;

    lines.push("");
    lines.push("-- Command " + index + ": " + String(command.o || "shape") + (command.k ? (" " + command.k) : ""));
    lines.push("resetStyle(layer)");

    if (command.o === "shape") {
      kind = String(command.k || "box");
      style = buildReadableShapeStyle(command);
      lines.push("applyShapeStyle(layer, " + toLua(style) + ")");
      if (kind === "circle") {
        lines.push("drawCircle(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      } else if (kind === "boxRounded") {
        lines.push("drawBoxRounded(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h, command.r != null ? command.r : 0]) + ")");
      } else if (kind === "triangle") {
        lines.push("drawTriangle(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      } else if (kind === "quad") {
        lines.push("drawQuad(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h, command.qi != null ? command.qi : 0.125]) + ")");
      } else {
        lines.push("drawBox(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      }
      return;
    }

    if (command.o === "bezier") {
      lines.push("applyStrokeStyle(layer, " + toLua(buildReadableStrokeStyle(command, 2)) + ")");
      lines.push("drawBezierArc(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      return;
    }

    if (command.o === "line") {
      lines.push("applyStrokeStyle(layer, " + toLua(buildReadableStrokeStyle(command, 2)) + ")");
      lines.push("drawLine(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      return;
    }

    if (command.o === "image") {
      lines.push("applyImageStyle(layer, " + toLua(buildReadableImageStyle(command)) + ")");
      lines.push("drawImageRect(layer, " + joinLuaArgs([command.src || "", command.x, command.y, command.w, command.h]) + ")");
      return;
    }

    if (command.o === "text") {
      lines.push("applyTextStyle(layer, " + toLua(buildReadableTextStyle(command)) + ")");
      lines.push("drawTextBlock(layer, " + joinLuaArgs([
        command.l || [],
        command.x,
        command.y,
        command.w,
        command.h,
        {
          size: command.ts != null ? command.ts : 16,
          align: command.ta || "left",
          valign: command.tv || "center",
          color: command.tc || [1, 1, 1, 1]
        }
      ]) + ")");
    }
  }

  function buildReadableRenderScriptFromCommands(commandDoc) {
    var commands = commandDoc && Array.isArray(commandDoc.c) ? commandDoc.c : [];
    var lines = [
      "-- Generated by Lua Painter",
      "-- Screen export mode: default",
      "-- Requires lua/" + getPainterlibModuleName() .replace(/\./g, "/") + ".lua",
      "local P = require(" + luaEscapeString(getPainterlibModuleName()) + ")",
      "P.bg(0, 0, 0)",
      "local layer = P.ly()"
    ];

    commands.forEach(function (command, index) {
      if (!command) return;
      lines.push("");
      lines.push(describePainterCommand(command, index + 1));
      lines.push(buildPainterCall(command, "layer"));
    });

    lines.push("");
    return lines.join("\n");
  }

  function buildCompactRenderScriptFromCommands(commandDoc, options) {
    var commands = commandDoc && Array.isArray(commandDoc.c) ? commandDoc.c : [];
    var painterlibModule = getPainterlibModuleName(options);
    var lines = [
      "-- Generated by Lua Painter",
      "-- Screen export mode: compact",
      "-- Requires lua/" + painterlibModule.replace(/\./g, "/") + ".lua",
      "local P=require(" + luaEscapeString(painterlibModule) + ")",
      "P.bg(0,0,0)",
      "local L=P.ly()"
    ];

    commands.forEach(function (command) {
      if (!command) return;
      lines.push(buildPainterCall(command, "L"));
    });

    lines.push("");
    return lines.join("\n");
  }

  function buildRenderScriptFromCommands(commandDoc, options) {
    var mode = normalizeScreenCodeMode(options);
    if (mode === "compact") {
      return buildCompactRenderScriptFromCommands(commandDoc, options);
    }
    return buildReadableRenderScriptFromCommands(commandDoc);
  }

  function buildBoardOnStartCode(doc) {
    var embedded = toLua(cloneDocument(doc));
    return [
      "-- Generated by Lua Painter",
      "-- Paste into the programming board onStart filter",
      "-- Requires HudEditorBoard.lua in library.onStart",
      "",
      "local HUD_EDITOR_BOOT_DOCUMENT = " + embedded,
      "",
      "if not HudEditorBoard then",
      "    system.print(\"ERROR: Failed to load HudEditorBoard module\")",
      "    return",
      "end",
      "",
      "HudEditorBoard.init(HUD_EDITOR_BOOT_DOCUMENT)",
      "",
      "function onInputReceived(input)",
      "    return HudEditorBoard.onInputReceived(input)",
      "end",
      "",
      "function onTimer(timerName)",
      "    HudEditorBoard.onTimer(timerName)",
      "end",
      "",
      "unit.hideWidget()",
      "unit.setTimer(\"startup\", 0.2)",
      "system.print(\"HudEditorBoard initialized\")",
      ""
    ].join("\n");
  }

  function buildScreenCode(doc, options) {
    var commandDoc = APP.screenCommands.buildCommandDocument(doc);
    return commandDoc ? buildRenderScriptFromCommands(commandDoc, options) : "";
  }

  function buildScreenCodeDefault(doc) {
    return buildScreenCode(doc, { mode: "default" });
  }

  function buildScreenCodeReadable(doc) {
    return buildScreenCodeDefault(doc);
  }

  function buildScreenCodeCompact(doc) {
    return buildScreenCode(doc, { mode: "compact" });
  }

  function queueIdeImport(targetKind, code) {
    var ctx = getRuntimeCtx();
    if (!ctx || typeof ctx.sendPacket !== "function") {
      return { ok: false, error: "runtime_ctx_unavailable" };
    }
    var requestId = "hud-editor-" + targetKind + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
    ctx.sendPacket("hud_editor_ide_export", {
      requestId: requestId,
      targetKind: targetKind,
      code: String(code || "")
    });
    return { ok: true, requestId: requestId };
  }

  function exportBoard() {
    var doc = getDocument();
    if (!doc) return { ok: false, error: "no_document" };
    return queueIdeImport("lua_editor", buildBoardOnStartCode(doc));
  }

  function exportScreen(options) {
    var doc = getDocument();
    var code;
    if (!doc) return { ok: false, error: "no_document" };
    if (!getVisibleScreenEditorPanel()) {
      return { ok: false, error: "screen_editor_not_visible" };
    }
    code = buildScreenCode(doc, options);
    if (!code) return { ok: false, error: "no_document" };
    if (code.length > SCREEN_SCRIPT_LIMIT) {
      return { ok: false, error: "screen_script_too_long", length: code.length };
    }
    return queueIdeImport("screen_editor", code);
  }

  function canPublishScreenViaBoard() {
    return !!(
      APP &&
      APP.databank &&
      typeof APP.databank.publishScreenViaBoard === "function" &&
      APP.bridge &&
      typeof APP.bridge.isAvailable === "function" &&
      APP.bridge.isAvailable()
    );
  }

  APP.ideExport = {
    toLua: toLua,
    buildBoardOnStartCode: buildBoardOnStartCode,
    buildRenderScriptFromCommands: buildRenderScriptFromCommands,
    buildDefaultRenderScriptFromCommands: buildReadableRenderScriptFromCommands,
    buildReadableRenderScriptFromCommands: buildReadableRenderScriptFromCommands,
    buildCompactRenderScriptFromCommands: buildCompactRenderScriptFromCommands,
    buildScreenCommandDocument: APP.screenCommands.buildCommandDocument,
    buildScreenCode: buildScreenCode,
    buildScreenCodeDefault: buildScreenCodeDefault,
    buildScreenCodeReadable: buildScreenCodeReadable,
    buildScreenCodeCompact: buildScreenCodeCompact,
    exportBoard: exportBoard,
    exportScreen: exportScreen
  };

  APP.on("export-board", function () {
    var result = exportBoard();
    if (result && result.ok) {
      APP.emit("toast", { type: "success", text: "Board export queued" });
    } else {
      APP.emit("toast", { type: "error", text: "Board export failed" });
    }
  });

  APP.on("export-screen", function () {
    if (!getVisibleScreenEditorPanel() && canPublishScreenViaBoard()) {
      APP.emit("publish-screen-via-board");
      return;
    }
    var result = exportScreen();
    if (result && result.ok) {
      APP.emit("toast", { type: "success", text: "Screen export queued" });
    } else if (result && result.error === "screen_editor_not_visible") {
      APP.emit("toast", { type: "error", text: "Open the linked screen editor, then export again" });
    } else if (result && result.error === "screen_script_too_long") {
      APP.emit("toast", { type: "error", text: "Screen export too long: " + result.length });
    } else {
      APP.emit("toast", { type: "error", text: "Screen export failed" });
    }
  });
})();
