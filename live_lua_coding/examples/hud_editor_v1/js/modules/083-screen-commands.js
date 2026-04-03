// 083-screen-commands.js - Normalize editor elements into screen draw commands
(function hudEditorScreenCommands() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var DEFAULT_FILL = [0.2, 0.2, 0.2, 1];
  var DEFAULT_STROKE = [1, 1, 1, 1];
  var DEFAULT_TEXT = [1, 1, 1, 1];
  var DEFAULT_SHADOW = [0, 0, 0, 0];

  function cloneDocument(doc) {
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  }

  function toFiniteNumber(value, fallback) {
    var numeric = Number(value);
    return isFinite(numeric) ? numeric : fallback;
  }

  function compactColor(color, fallback) {
    var source = Array.isArray(color) ? color : fallback;
    return [
      toFiniteNumber(source && source[0], fallback[0]),
      toFiniteNumber(source && source[1], fallback[1]),
      toFiniteNumber(source && source[2], fallback[2]),
      toFiniteNumber(source && source[3], fallback[3])
    ];
  }

  function compactTextLines(lines) {
    if (!Array.isArray(lines) || !lines.length) return null;
    return lines.map(function (line) {
      return String(line == null ? "" : line);
    });
  }

  function hasVisibleColor(color) {
    return Array.isArray(color) && toFiniteNumber(color[3], 0) > 0;
  }

  function normalizeType(rawType) {
    var type = String(rawType || "box");
    return type === "rounded" ? "boxRounded" : type;
  }

  function buildCommonStyle(raw, command) {
    var rotation = toFiniteNumber(raw.rotation, 0);
    var shadowBlur = Math.max(0, toFiniteNumber(raw.shadowBlur, 0));
    var shadowColor = compactColor(raw.shadowColor, DEFAULT_SHADOW);
    if (rotation) {
      command.rot = rotation;
    }
    if (shadowBlur > 0 && shadowColor[3] > 0) {
      command.sh = {
        b: shadowBlur,
        c: shadowColor
      };
    }
    return command;
  }

  function buildTextCommand(raw) {
    var lines = compactTextLines(raw.textLines);
    var command;
    if (!lines) return null;
    command = {
      o: "text",
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      l: lines,
      tc: compactColor(raw.textColor, DEFAULT_TEXT),
      s: compactColor(raw.stroke, DEFAULT_STROKE),
      sw: toFiniteNumber(raw.strokeWidth, 0),
      ts: toFiniteNumber(raw.textSize, 16),
      ta: String(raw.textAlign || "left")
    };
    return buildCommonStyle(raw, command);
  }

  function buildShapeCommand(raw, shapeKind) {
    var command = {
      o: "shape",
      k: shapeKind,
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      f: compactColor(raw.fill, DEFAULT_FILL),
      s: compactColor(raw.stroke, DEFAULT_STROKE),
      sw: toFiniteNumber(raw.strokeWidth, 0)
    };
    if (shapeKind === "boxRounded") {
      command.r = toFiniteNumber(raw.radius, 0);
    }
    if (shapeKind === "quad") {
      command.qi = toFiniteNumber(raw.quadInset, 0.125);
    }
    return buildCommonStyle(raw, command);
  }

  function buildBezierCommand(raw) {
    return buildCommonStyle(raw, {
      o: "bezier",
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      s: compactColor(raw.stroke, DEFAULT_STROKE),
      sw: toFiniteNumber(raw.strokeWidth, 2)
    });
  }

  function buildImageCommand(raw) {
    var command = {
      o: "image",
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      src: String(raw.imageSrc || ""),
      fit: String(raw.imageFit || "contain")
    };
    if (hasVisibleColor(raw.fill)) {
      command.f = compactColor(raw.fill, DEFAULT_FILL);
    }
    return buildCommonStyle(raw, command);
  }

  function buildLineCommand(raw) {
    return buildCommonStyle(raw, {
      o: "line",
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      s: compactColor(raw.stroke, DEFAULT_STROKE),
      sw: toFiniteNumber(raw.strokeWidth, 2)
    });
  }

  function buildCommandsForElement(raw) {
    var commands = [];
    var type;
    var textCommand;
    if (!raw || typeof raw !== "object" || raw.visible === false) return commands;

    type = normalizeType(raw.type);
    if (type === "text") {
      textCommand = buildTextCommand(raw);
      if (textCommand) commands.push(textCommand);
      return commands;
    }

    if (type === "line") {
      commands.push(buildLineCommand(raw));
      textCommand = buildTextCommand(raw);
      if (textCommand) commands.push(textCommand);
      return commands;
    }

    if (type === "bezierArc") {
      commands.push(buildBezierCommand(raw));
      textCommand = buildTextCommand(raw);
      if (textCommand) commands.push(textCommand);
      return commands;
    }

    if (type === "image") {
      commands.push(buildImageCommand(raw));
      textCommand = buildTextCommand(raw);
      if (textCommand) commands.push(textCommand);
      return commands;
    }

    commands.push(buildShapeCommand(raw, type));
    textCommand = buildTextCommand(raw);
    if (textCommand) commands.push(textCommand);
    return commands;
  }

  function buildCommandDocument(doc) {
    var source = cloneDocument(doc);
    var commands = [];
    if (!source) return null;

    (Array.isArray(source.elements) ? source.elements : []).forEach(function (element) {
      Array.prototype.push.apply(commands, buildCommandsForElement(element));
    });

    return {
      w: toFiniteNumber(source.screenWidth, 1920),
      h: toFiniteNumber(source.screenHeight, 1080),
      c: commands
    };
  }

  APP.screenCommands = {
    buildCommandDocument: buildCommandDocument,
    buildCommandsForElement: buildCommandsForElement,
    normalizeType: normalizeType
  };
})();
