// 085-ide-export.js - Export generated board/screen code via mod IDE-import path
(function hudEditorIdeExport() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;
  if (!APP.screenCommands) return;

  var SCREEN_SCRIPT_LIMIT = 50000;

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
    mode = String(mode || "readable").toLowerCase();
    return mode === "compact" ? "compact" : "readable";
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
      "-- Generated by HUD Editor",
      "-- Screen export mode: readable",
      "local FONT_CACHE = {}",
      "local IMAGE_CACHE = {}",
      "",
      "local function loadFontCached(size)",
      "    size = math.max(1, math.floor(tonumber(size) or 16))",
      "    local font = FONT_CACHE[size]",
      "    if not font then",
      "        font = loadFont(\"Play\", size)",
      "        FONT_CACHE[size] = font",
      "    end",
      "    return font",
      "end",
      "",
      "local function loadImageCached(path)",
      "    if type(path) ~= \"string\" or path == \"\" then",
      "        return nil",
      "    end",
      "    local image = IMAGE_CACHE[path]",
      "    if not image then",
      "        image = loadImage(path)",
      "        IMAGE_CACHE[path] = image",
      "    end",
      "    return image",
      "end",
      "",
      "local function applyFillColor(layer, color, fallback)",
      "    local source = color or fallback",
      "    setNextFillColor(",
      "        layer,",
      "        tonumber(source[1]) or fallback[1],",
      "        tonumber(source[2]) or fallback[2],",
      "        tonumber(source[3]) or fallback[3],",
      "        tonumber(source[4]) or fallback[4]",
      "    )",
      "end",
      "",
      "local function applyStrokeColor(layer, color, fallback)",
      "    local source = color or fallback",
      "    setNextStrokeColor(",
      "        layer,",
      "        tonumber(source[1]) or fallback[1],",
      "        tonumber(source[2]) or fallback[2],",
      "        tonumber(source[3]) or fallback[3],",
      "        tonumber(source[4]) or fallback[4]",
      "    )",
      "end",
      "",
      "local function resetStyle(layer)",
      "    setNextRotation(layer, 0)",
      "    setNextShadow(layer, 0, 0, 0, 0, 0)",
      "    setNextFillColor(layer, 0, 0, 0, 0)",
      "    setNextStrokeColor(layer, 0, 0, 0, 0)",
      "    setNextStrokeWidth(layer, 0)",
      "    setNextTextAlign(layer, AlignH_Left, AlignV_Middle)",
      "end",
      "",
      "local function applyRotationAndShadow(layer, style)",
      "    if type(style) ~= \"table\" then",
      "        return",
      "    end",
      "    local rotation = tonumber(style.rotation) or 0",
      "    if rotation ~= 0 then",
      "        setNextRotation(layer, rotation)",
      "    end",
      "    local shadow = style.shadow",
      "    local color = shadow and shadow.color or nil",
      "    local blur = shadow and tonumber(shadow.blur) or 0",
      "    if color and blur > 0 then",
      "        setNextShadow(",
      "            layer,",
      "            blur,",
      "            tonumber(color[1]) or 0,",
      "            tonumber(color[2]) or 0,",
      "            tonumber(color[3]) or 0,",
      "            tonumber(color[4]) or 0",
      "        )",
      "    end",
      "end",
      "",
      "local function applyShapeStyle(layer, style)",
      "    applyRotationAndShadow(layer, style)",
      "    applyFillColor(layer, style and style.fill, {0.2, 0.2, 0.2, 1})",
      "    applyStrokeColor(layer, style and style.stroke, {1, 1, 1, 1})",
      "    setNextStrokeWidth(layer, tonumber(style and style.strokeWidth) or 0)",
      "end",
      "",
      "local function applyStrokeStyle(layer, style)",
      "    applyRotationAndShadow(layer, style)",
      "    applyStrokeColor(layer, style and style.stroke, {1, 1, 1, 1})",
      "    setNextStrokeWidth(layer, tonumber(style and style.strokeWidth) or 0)",
      "end",
      "",
      "local function applyImageStyle(layer, style)",
      "    applyRotationAndShadow(layer, style)",
      "    if style and style.fill then",
      "        applyFillColor(layer, style.fill, {0.2, 0.2, 0.2, 1})",
      "    end",
      "end",
      "",
      "local function applyTextStyle(layer, style)",
      "    applyRotationAndShadow(layer, style)",
      "    applyStrokeColor(layer, style and style.stroke, {0, 0, 0, 0})",
      "    setNextStrokeWidth(layer, tonumber(style and style.strokeWidth) or 0)",
      "end",
      "",
      "local function drawBox(layer, x, y, w, h)",
      "    addBox(layer, x, y, w, h)",
      "end",
      "",
      "local function drawBoxRounded(layer, x, y, w, h, radius)",
      "    addBoxRounded(layer, x, y, w, h, tonumber(radius) or 0)",
      "end",
      "",
      "local function drawCircle(layer, x, y, w, h)",
      "    addCircle(layer, x + w * 0.5, y + h * 0.5, math.min(w, h) * 0.5)",
      "end",
      "",
      "local function drawTriangle(layer, x, y, w, h)",
      "    addTriangle(layer, x, y, x + w, y, x, y + h)",
      "end",
      "",
      "local function drawQuad(layer, x, y, w, h, inset)",
      "    local qi = tonumber(inset) or 0.125",
      "    addQuad(layer, x, y, x + w * (1 - qi), y + h * qi, x + w, y + h, x + w * qi, y + h * (1 - qi))",
      "end",
      "",
      "local function drawBezierArc(layer, x, y, w, h)",
      "    addBezier(layer, x, y + h, x + w * 0.5, y, x + w, y + h)",
      "end",
      "",
      "local function drawLine(layer, x, y, w, h)",
      "    addLine(layer, x, y, x + w, y + h)",
      "end",
      "",
      "local function drawImageRect(layer, path, x, y, w, h)",
      "    local image = loadImageCached(path)",
      "    if not image then",
      "        return",
      "    end",
      "    addImage(layer, image, x, y, w, h)",
      "end",
      "",
      "local function drawTextBlock(layer, lines, x, y, w, h, options)",
      "    if type(lines) ~= \"table\" or #lines == 0 then",
      "        return",
      "    end",
      "    local size = math.max(1, math.floor(tonumber(options and options.size) or 16))",
      "    local font = loadFontCached(size)",
      "    if not font then",
      "        return",
      "    end",
      "    local align = options and options.align or \"left\"",
      "    local valign = options and options.valign or \"center\"",
      "    local textX = x + 12",
      "    local alignH = AlignH_Left",
      "    local alignV = AlignV_Middle",
      "    if align == \"center\" then",
      "        textX = x + w * 0.5",
      "        alignH = AlignH_Center",
      "    elseif align == \"right\" then",
      "        textX = x + w - 12",
      "        alignH = AlignH_Right",
      "    end",
      "    if valign == \"top\" then",
      "        alignV = AlignV_Top",
      "    elseif valign == \"bottom\" then",
      "        alignV = AlignV_Bottom",
      "    end",
      "    local gap = math.max(2, math.floor(size * 0.2))",
      "    local blockHeight = #lines * size + (#lines - 1) * gap",
      "    local startY = y + h * 0.5 - (blockHeight - size) * 0.5",
      "    if valign == \"top\" then",
      "        startY = y + 12",
      "    elseif valign == \"bottom\" then",
      "        startY = y + h - 12 - (blockHeight - size)",
      "    end",
      "    local color = options and options.color or {1, 1, 1, 1}",
      "    for index = 1, #lines do",
      "        setNextTextAlign(layer, alignH, alignV)",
      "        applyFillColor(layer, color, {1, 1, 1, 1})",
      "        addText(layer, font, tostring(lines[index] or \"\"), textX, startY + (index - 1) * (size + gap))",
      "    end",
      "end",
      "",
      "setBackgroundColor(0, 0, 0)",
      "local layer = createLayer()"
    ];

    commands.forEach(function (command, index) {
      appendReadableCommand(lines, command, index + 1);
    });

    lines.push("");
    return lines.join("\n");
  }

  function buildCompactRenderScriptFromCommands(commandDoc) {
    return [
      "-- Generated by HUD Editor",
      "-- Screen export mode: compact",
      "local D=" + toLua(commandDoc),
      "local F={}",
      "local I={}",
      "local function G(s)",
      "    s=math.max(1,math.floor(tonumber(s) or 16))",
      "    local f=F[s]",
      "    if not f then",
      "        f=loadFont(\"Play\",s)",
      "        F[s]=f",
      "    end",
      "    return f",
      "end",
      "local function IM(p)",
      "    if type(p)~=\"string\" or p==\"\" then return nil end",
      "    local img=I[p]",
      "    if not img then",
      "        img=loadImage(p)",
      "        I[p]=img",
      "    end",
      "    return img",
      "end",
      "local function FC(l,c,d)",
      "    c=c or d",
      "    setNextFillColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])",
      "end",
      "local function SC(l,c,d)",
      "    c=c or d",
      "    setNextStrokeColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])",
      "end",
      "local function ST(l,c)",
      "    local r=tonumber(c.rot) or 0",
      "    if r~=0 then",
      "        setNextRotation(l,r)",
      "    end",
      "    local sh=c.sh",
      "    local sc=sh and sh.c or nil",
      "    local sb=sh and tonumber(sh.b) or 0",
      "    if sc and sb and sb>0 then",
      "        setNextShadow(l,sb,tonumber(sc[1]) or 0,tonumber(sc[2]) or 0,tonumber(sc[3]) or 0,tonumber(sc[4]) or 0)",
      "    end",
      "end",
      "local function TX(l,c)",
      "    local lines=c.l",
      "    if not lines or #lines==0 then return end",
      "    ST(l,c)",
      "    SC(l,c.s,{0,0,0,0})",
      "    setNextStrokeWidth(l,tonumber(c.sw) or 0)",
      "    local s=math.max(1,math.floor(tonumber(c.ts) or 16))",
      "    local f=G(s)",
      "    if not f then return end",
      "    local a=c.ta or \"left\"",
      "    local va=c.tv or \"center\"",
      "    local x=(tonumber(c.x) or 0)+12",
      "    local h=AlignH_Left",
      "    local v=AlignV_Middle",
      "    local w=tonumber(c.w) or 0",
      "    if a==\"center\" then",
      "        x=(tonumber(c.x) or 0)+w*0.5",
      "        h=AlignH_Center",
      "    elseif a==\"right\" then",
      "        x=(tonumber(c.x) or 0)+w-12",
      "        h=AlignH_Right",
      "    end",
      "    if va==\"top\" then",
      "        v=AlignV_Top",
      "    elseif va==\"bottom\" then",
      "        v=AlignV_Bottom",
      "    end",
      "    local g=math.max(2,math.floor(s*0.2))",
      "    local bh=#lines*s+(#lines-1)*g",
      "    local y=(tonumber(c.y) or 0)+(tonumber(c.h) or 0)*0.5-(bh-s)*0.5",
      "    if va==\"top\" then",
      "        y=(tonumber(c.y) or 0)+12",
      "    elseif va==\"bottom\" then",
      "        y=(tonumber(c.y) or 0)+(tonumber(c.h) or 0)-12-(bh-s)",
      "    end",
      "    local tc=c.tc or {1,1,1,1}",
      "    for i=1,#lines do",
      "        setNextTextAlign(l,h,v)",
      "        FC(l,tc,{1,1,1,1})",
      "        addText(l,f,tostring(lines[i] or \"\"),x,y+(i-1)*(s+g))",
      "    end",
      "end",
      "local function SH(l,c)",
      "    ST(l,c)",
      "    FC(l,c.f,{0.2,0.2,0.2,1})",
      "    SC(l,c.s,{1,1,1,1})",
      "    setNextStrokeWidth(l,tonumber(c.sw) or 0)",
      "    local x=tonumber(c.x) or 0",
      "    local y=tonumber(c.y) or 0",
      "    local w=tonumber(c.w) or 0",
      "    local h=tonumber(c.h) or 0",
      "    local k=c.k or \"box\"",
      "    if k==\"circle\" then",
      "        addCircle(l,x+w*0.5,y+h*0.5,math.min(w,h)*0.5)",
      "    elseif k==\"boxRounded\" then",
      "        addBoxRounded(l,x,y,w,h,tonumber(c.r) or 0)",
      "    elseif k==\"triangle\" then",
      "        addTriangle(l,x,y,x+w,y,x,y+h)",
      "    elseif k==\"quad\" then",
      "        local qi=tonumber(c.qi) or 0.125",
      "        addQuad(l,x,y,x+w*(1-qi),y+h*qi,x+w,y+h,x+w*qi,y+h*(1-qi))",
      "    else",
      "        addBox(l,x,y,w,h)",
      "    end",
      "end",
      "local function BZ(l,c)",
      "    ST(l,c)",
      "    SC(l,c.s,{1,1,1,1})",
      "    setNextStrokeWidth(l,tonumber(c.sw) or 2)",
      "    local x=tonumber(c.x) or 0",
      "    local y=tonumber(c.y) or 0",
      "    local w=tonumber(c.w) or 0",
      "    local h=tonumber(c.h) or 0",
      "    addBezier(l,x,y+h,x+w*0.5,y,x+w,y+h)",
      "end",
      "local function LN(l,c)",
      "    ST(l,c)",
      "    SC(l,c.s,{1,1,1,1})",
      "    setNextStrokeWidth(l,tonumber(c.sw) or 2)",
      "    local x=tonumber(c.x) or 0",
      "    local y=tonumber(c.y) or 0",
      "    addLine(l,x,y,x+(tonumber(c.w) or 0),y+(tonumber(c.h) or 0))",
      "end",
      "local function IG(l,c)",
      "    if c.f then",
      "        FC(l,c.f,{0.2,0.2,0.2,1})",
      "    end",
      "    ST(l,c)",
      "    local img=IM(c.src)",
      "    if not img then return end",
      "    addImage(l,img,tonumber(c.x) or 0,tonumber(c.y) or 0,tonumber(c.w) or 0,tonumber(c.h) or 0)",
      "end",
      "setBackgroundColor(0,0,0)",
      "local layer=createLayer()",
      "for i=1,#(D.c or {}) do",
      "    local c=D.c[i]",
      "    if c then",
      "        local op=c.o or \"shape\"",
      "        if op==\"text\" then",
      "            TX(layer,c)",
      "        elseif op==\"line\" then",
      "            LN(layer,c)",
      "        elseif op==\"bezier\" then",
      "            BZ(layer,c)",
      "        elseif op==\"image\" then",
      "            IG(layer,c)",
      "        else",
      "            SH(layer,c)",
      "        end",
      "    end",
      "end",
      ""
    ].join("\n");
  }

  function buildRenderScriptFromCommands(commandDoc, options) {
    var mode = normalizeScreenCodeMode(options);
    if (mode === "compact") {
      return buildCompactRenderScriptFromCommands(commandDoc);
    }
    return buildReadableRenderScriptFromCommands(commandDoc);
  }

  function buildBoardOnStartCode(doc) {
    var embedded = toLua(cloneDocument(doc));
    return [
      "-- Generated by HUD Editor",
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

  function buildScreenCodeReadable(doc) {
    return buildScreenCode(doc, { mode: "readable" });
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
    buildReadableRenderScriptFromCommands: buildReadableRenderScriptFromCommands,
    buildCompactRenderScriptFromCommands: buildCompactRenderScriptFromCommands,
    buildScreenCommandDocument: APP.screenCommands.buildCommandDocument,
    buildScreenCode: buildScreenCode,
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
    if (canPublishScreenViaBoard()) {
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
