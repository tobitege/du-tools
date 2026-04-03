// 082-shape-snippets.js - Shared snippet catalog for reproducible HUD shape demos
(function hudEditorShapeSnippets() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var DEFAULT_IMAGE_PATH = "resources_generated/env/voxel/ore/aluminium-ore/icons/env_aluminium-ore_icon.png";
  var COLOR_SEQUENCE = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
    [0.5, 0.5, 0.5]
  ];

  function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function docFromRecipe(recipe) {
    var doc = {
      version: 1,
      revision: 1,
      id: String(recipe.id || APP.createLayoutId()),
      name: String(recipe.name || recipe.title || "Snippet"),
      screenWidth: recipe.screenWidth || 1920,
      screenHeight: recipe.screenHeight || 1080,
      elements: Array.isArray(recipe.elements) ? deepCopy(recipe.elements) : []
    };
    return APP.normalizeDocumentMeta ? APP.normalizeDocumentMeta(doc) : doc;
  }

  function elem(id, type, x, y, w, h, extra) {
    var base = {
      id: id,
      type: type,
      visible: true,
      x: x,
      y: y,
      w: w,
      h: h,
      radius: 0,
      fill: [0.12, 0.14, 0.18, 0.92],
      stroke: [0.86, 0.9, 0.96, 1],
      strokeWidth: 3,
      textLines: null,
      textColor: [1, 1, 1, 1],
      textSize: 18,
      textAlign: "center",
      rotation: 0,
      shadowBlur: 0,
      shadowColor: [0, 0, 0, 0],
      imageSrc: "",
      imageFit: "contain",
      quadInset: 0.125
    };
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        base[key] = extra[key];
      });
    }
    return base;
  }

  function addAlpha(index, alpha) {
    var source = COLOR_SEQUENCE[(index - 1) % COLOR_SEQUENCE.length];
    return [source[0], source[1], source[2], alpha == null ? 1 : alpha];
  }

  function createStyledState(size, colorIndex, rotation) {
    return {
      size: size,
      colorIndex: colorIndex || 1,
      rotation: rotation || 0
    };
  }

  function takeStyle(state, alpha) {
    var currentAlpha = alpha == null ? 1 : alpha;
    var fill = addAlpha(state.colorIndex, currentAlpha);
    state.colorIndex = state.colorIndex % COLOR_SEQUENCE.length + 1;
    var shadowColor = addAlpha(state.colorIndex, currentAlpha);
    state.colorIndex = state.colorIndex % COLOR_SEQUENCE.length + 1;
    var stroke = addAlpha(state.colorIndex, currentAlpha);
    state.colorIndex = state.colorIndex % COLOR_SEQUENCE.length + 1;
    return {
      fill: fill,
      rotation: state.rotation,
      shadowBlur: state.size / 4,
      shadowColor: shadowColor,
      stroke: stroke,
      strokeWidth: state.size / 8
    };
  }

  function defaultPrimitiveStyle(type, size) {
    if (type === "line" || type === "bezierArc") {
      return {
        fill: [0, 0, 0, 0],
        stroke: [0.92, 0.92, 0.94, 1],
        strokeWidth: size / 28,
        rotation: 0,
        shadowBlur: 0,
        shadowColor: [0, 0, 0, 0]
      };
    }
    if (type === "text") {
      return {
        fill: [0, 0, 0, 0],
        textColor: [0.92, 0.92, 0.94, 1],
        stroke: [0, 0, 0, 0],
        strokeWidth: 0,
        rotation: 0,
        shadowBlur: 0,
        shadowColor: [0, 0, 0, 0]
      };
    }
    if (type === "image") {
      return {
        fill: [0, 0, 0, 0],
        stroke: [0, 0, 0, 0],
        strokeWidth: 0,
        rotation: 0,
        shadowBlur: 0,
        shadowColor: [0, 0, 0, 0]
      };
    }
    return {
      fill: [0.94, 0.94, 0.95, 1],
      stroke: [0.76, 0.78, 0.82, 0.2],
      strokeWidth: size / 48,
      rotation: 0,
      shadowBlur: 0,
      shadowColor: [0, 0, 0, 0]
    };
  }

  function squareElement(id, type, x, y, size, style, extra) {
    var props = {
      rotation: style.rotation || 0,
      shadowBlur: style.shadowBlur || 0,
      shadowColor: deepCopy(style.shadowColor || [0, 0, 0, 0]),
      quadInset: extra && extra.quadInset != null ? extra.quadInset : 0.125
    };
    if (type === "text") {
      props.fill = [0, 0, 0, 0];
      props.stroke = deepCopy(style.stroke || [0, 0, 0, 0]);
      props.strokeWidth = style.strokeWidth || 0;
      props.textLines = [extra && extra.text || "E"];
      props.textColor = deepCopy(style.textColor || style.fill || [1, 1, 1, 1]);
      props.textSize = extra && extra.textSize != null ? extra.textSize : (size * 1.4);
      props.textAlign = "center";
    } else if (type === "image") {
      props.fill = deepCopy(style.fill || [0, 0, 0, 0]);
      props.stroke = deepCopy(style.stroke || [0, 0, 0, 0]);
      props.strokeWidth = style.strokeWidth || 0;
      props.imageSrc = extra && extra.imageSrc || DEFAULT_IMAGE_PATH;
      props.imageFit = "contain";
    } else if (type === "line" || type === "bezierArc") {
      props.fill = [0, 0, 0, 0];
      props.stroke = deepCopy(style.stroke || [1, 1, 1, 1]);
      props.strokeWidth = style.strokeWidth || 0;
    } else {
      props.fill = deepCopy(style.fill || [1, 1, 1, 1]);
      props.stroke = deepCopy(style.stroke || [0, 0, 0, 0]);
      props.strokeWidth = style.strokeWidth || 0;
    }
    if (type === "boxRounded") {
      props.radius = extra && extra.radius != null ? extra.radius : (size / 4);
    }
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        props[key] = extra[key];
      });
    }
    return elem(id, type, x, y, size, size, props);
  }

  function buildShapesLuaDemoRecipe() {
    var screenWidth = 1920;
    var screenHeight = 1080;
    var rowCount = 4;
    var shapeCount = 9;
    var size = Math.min(screenHeight / rowCount / 2, screenWidth / shapeCount / 2);
    var elements = [];
    var styleDefaults = {};
    var xStep;
    var xOff;
    var yOff;

    function resetRow(step, xStart, yStart) {
      xStep = step;
      xOff = xStart;
      yOff = yStart;
    }

    function nextX() {
      var current = xOff;
      xOff += xStep;
      return current;
    }

    function addDemo(type, label, x, y, style, extra) {
      elements.push(squareElement(label + "_" + elements.length, type, x, y, size, style, extra));
    }

    function defaultFor(type) {
      return defaultPrimitiveStyle(type, size);
    }

    // Row 1: default primitive sample
    resetRow(
      screenWidth / shapeCount,
      screenWidth / shapeCount - ((screenWidth / shapeCount) + size) / 2,
      screenHeight / rowCount / 2 - size / 2
    );
    addDemo("image", "row1_image", nextX(), yOff, defaultFor("image"), { imageSrc: DEFAULT_IMAGE_PATH });
    addDemo("bezierArc", "row1_bezier", nextX(), yOff, defaultFor("bezierArc"));
    addDemo("box", "row1_box", nextX(), yOff, defaultFor("box"));
    addDemo("boxRounded", "row1_rounded", nextX(), yOff, defaultFor("boxRounded"), { radius: size / 4 });
    addDemo("circle", "row1_circle", nextX(), yOff, defaultFor("circle"));
    addDemo("line", "row1_line", nextX(), yOff, defaultFor("line"));
    addDemo("triangle", "row1_triangle", nextX(), yOff, defaultFor("triangle"));
    addDemo("quad", "row1_quad", nextX(), yOff, defaultFor("quad"), { quadInset: 0.125 });
    addDemo("text", "row1_text", nextX(), yOff, defaultFor("text"), { text: "E", textSize: size * 1.4 });

    // Row 2: custom styled primitives
    resetRow(
      screenWidth / shapeCount,
      screenWidth / shapeCount - ((screenWidth / shapeCount) + size) / 2,
      screenHeight / rowCount + screenHeight / rowCount / 2 - size / 2
    );
    var styledState = createStyledState(size, 1, Math.PI / 4);
    addDemo("image", "row2_image", nextX(), yOff, takeStyle(styledState, 1), { imageSrc: DEFAULT_IMAGE_PATH });
    addDemo("bezierArc", "row2_bezier", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("box", "row2_box", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("boxRounded", "row2_rounded", nextX(), yOff, takeStyle(styledState, 1), { radius: size / 4 });
    addDemo("circle", "row2_circle", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("line", "row2_line", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("triangle", "row2_triangle", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("quad", "row2_quad", nextX(), yOff, takeStyle(styledState, 1), { quadInset: 0.125 });
    addDemo("text", "row2_text", nextX(), yOff, takeStyle(styledState, 1), { text: "E", textSize: size * 1.4 });

    // Row 3: same-type overlap with default styles + custom center style
    resetRow(
      screenWidth / shapeCount,
      screenWidth / shapeCount - ((screenWidth / shapeCount) + size) / 2,
      screenHeight / rowCount * 2 + screenHeight / rowCount / 2 - size / 2
    );
    var defaultState = createStyledState(size, 2, Math.PI / 8);
    styleDefaults.image = takeStyle(defaultState, 1);
    styleDefaults.bezierArc = takeStyle(defaultState, 1);
    styleDefaults.box = takeStyle(defaultState, 1);
    styleDefaults.boxRounded = takeStyle(defaultState, 1);
    styleDefaults.circle = takeStyle(defaultState, 1);
    styleDefaults.line = takeStyle(defaultState, 1);
    styleDefaults.polygon = takeStyle(defaultState, 1);
    styleDefaults.text = takeStyle(defaultState, 1);

    var overlapState = createStyledState(size, 3, -Math.PI / 8);
    function overlapTriple(type, key, baseX, extra) {
      addDemo(type, "row3_" + key + "_a", baseX - size / 4, yOff - size / 4, styleDefaults[key], extra);
      addDemo(type, "row3_" + key + "_b", baseX + size / 4, yOff + size / 4, styleDefaults[key], extra);
      addDemo(type, "row3_" + key + "_c", baseX, yOff, takeStyle(overlapState, 0.8), extra);
    }

    overlapTriple("image", "image", nextX(), { imageSrc: DEFAULT_IMAGE_PATH });
    overlapTriple("bezierArc", "bezierArc", nextX());
    overlapTriple("box", "box", nextX());
    overlapTriple("boxRounded", "boxRounded", nextX(), { radius: size / 4 });
    overlapTriple("circle", "circle", nextX());
    overlapTriple("line", "line", nextX());
    overlapTriple("triangle", "polygon", nextX());
    overlapTriple("quad", "polygon", nextX(), { quadInset: 0.125 });
    overlapTriple("text", "text", nextX(), { text: "E", textSize: size * 1.4 });

    // Row 4: mixed overlap in forward and reverse draw order
    resetRow(
      size / 2,
      screenWidth / 2 - (shapeCount + 2) * (size / 2),
      screenHeight / rowCount * 3 + screenHeight / rowCount / 2 - size / 2
    );
    var mixed = [
      { type: "image", key: "image", extra: { imageSrc: DEFAULT_IMAGE_PATH } },
      { type: "bezierArc", key: "bezierArc" },
      { type: "box", key: "box" },
      { type: "boxRounded", key: "boxRounded", extra: { radius: size / 4 } },
      { type: "circle", key: "circle" },
      { type: "line", key: "line" },
      { type: "triangle", key: "polygon" },
      { type: "quad", key: "polygon", extra: { quadInset: 0.125 } },
      { type: "text", key: "text", extra: { text: "E", textSize: size * 1.4 } }
    ];

    mixed.forEach(function (entry, index) {
      addDemo(entry.type, "row4_forward_" + index, nextX(), yOff, styleDefaults[entry.key], entry.extra);
    });

    xOff += xStep * 3;

    mixed.slice().reverse().forEach(function (entry, index) {
      addDemo(entry.type, "row4_reverse_" + index, nextX(), yOff, styleDefaults[entry.key], entry.extra);
    });

    return {
      id: "demo_shapes_lua_full",
      family: "demo/render-script",
      title: "DU shapes.lua Demo",
      capabilities: [
        "image",
        "bezierArc",
        "box",
        "boxRounded",
        "circle",
        "line",
        "triangle",
        "quad",
        "text",
        "rotation",
        "shadow",
        "alpha",
        "zOrder"
      ],
      screenWidth: screenWidth,
      screenHeight: screenHeight,
      elements: elements
    };
  }

  var RECIPES = [
    {
      id: "primitive_box_default",
      family: "primitive/default",
      title: "Primitive Box Default",
      capabilities: ["box", "fill", "stroke", "strokeWidth"],
      elements: [
        elem("box_default", "box", 780, 340, 360, 220, {
          fill: [0.92, 0.92, 0.94, 1],
          stroke: [0.74, 0.78, 0.84, 1],
          strokeWidth: 2
        })
      ]
    },
    {
      id: "primitive_rounded_default",
      family: "primitive/default",
      title: "Primitive Rounded Default",
      capabilities: ["boxRounded", "fill", "stroke", "radius"],
      elements: [
        elem("rounded_default", "boxRounded", 760, 320, 400, 260, {
          radius: 52,
          fill: [0.95, 0.95, 0.97, 1],
          stroke: [0.8, 0.84, 0.9, 1],
          strokeWidth: 2
        })
      ]
    },
    {
      id: "primitive_circle_default",
      family: "primitive/default",
      title: "Primitive Circle Default",
      capabilities: ["circle", "fill", "stroke"],
      elements: [
        elem("circle_default", "circle", 800, 260, 320, 320, {
          fill: [0.96, 0.95, 0.88, 1],
          stroke: [0.82, 0.78, 0.36, 1],
          strokeWidth: 2
        })
      ]
    },
    {
      id: "primitive_line_default",
      family: "primitive/default",
      title: "Primitive Line Default",
      capabilities: ["line", "stroke", "strokeWidth"],
      elements: [
        elem("line_default", "line", 720, 240, 500, 420, {
          fill: [0, 0, 0, 0],
          stroke: [0.92, 0.94, 0.98, 1],
          strokeWidth: 10
        })
      ]
    },
    {
      id: "primitive_text_default",
      family: "primitive/default",
      title: "Primitive Text Default",
      capabilities: ["text", "fill", "stroke", "textSize", "textAlign"],
      elements: [
        elem("text_default", "text", 640, 300, 640, 280, {
          radius: 24,
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["Lua", "Painter"],
          textColor: [0.92, 0.96, 1, 1],
          textSize: 72,
          textAlign: "center"
        })
      ]
    },
    {
      id: "primitive_box_styled",
      family: "primitive/styled",
      title: "Primitive Box Styled",
      capabilities: ["box", "fill", "stroke", "strokeWidth", "alpha"],
      elements: [
        elem("box_styled", "box", 740, 300, 440, 280, {
          fill: [0.83, 0.83, 0.85, 0.96],
          stroke: [0.05, 0.96, 0.12, 1],
          strokeWidth: 12
        }),
        elem("box_styled_shadow", "box", 724, 284, 472, 312, {
          fill: [0, 0, 0, 0],
          stroke: [1, 0.1, 0.1, 0.55],
          strokeWidth: 18
        })
      ]
    },
    {
      id: "primitive_circle_styled",
      family: "primitive/styled",
      title: "Primitive Circle Styled",
      capabilities: ["circle", "fill", "stroke", "strokeWidth", "alpha"],
      elements: [
        elem("circle_styled", "circle", 790, 255, 340, 340, {
          fill: [1, 0.95, 0.02, 1],
          stroke: [1, 0.12, 0.08, 1],
          strokeWidth: 14
        }),
        elem("circle_styled_halo", "circle", 774, 239, 372, 372, {
          fill: [0, 0, 0, 0],
          stroke: [1, 1, 1, 0.5],
          strokeWidth: 18
        })
      ]
    },
    {
      id: "overlap_same_type_boxes",
      family: "overlap/same-type",
      title: "Overlap Same Type Boxes",
      capabilities: ["box", "fill", "stroke", "strokeWidth", "alpha", "zOrder"],
      elements: [
        elem("overlap_box_a", "box", 640, 260, 320, 320, {
          fill: [0.88, 0.12, 0.16, 0.78],
          stroke: [0.08, 0.16, 1, 0.95],
          strokeWidth: 14
        }),
        elem("overlap_box_b", "box", 720, 320, 320, 320, {
          fill: [0.28, 0.92, 0.02, 0.72],
          stroke: [0.95, 0.88, 0.08, 0.94],
          strokeWidth: 14
        }),
        elem("overlap_box_c", "box", 800, 280, 320, 320, {
          fill: [0.25, 0.92, 1, 0.66],
          stroke: [0.96, 0.2, 0.94, 0.92],
          strokeWidth: 14
        })
      ]
    },
    {
      id: "overlap_same_type_circles",
      family: "overlap/same-type",
      title: "Overlap Same Type Circles",
      capabilities: ["circle", "fill", "stroke", "strokeWidth", "alpha", "zOrder"],
      elements: [
        elem("overlap_circle_a", "circle", 680, 250, 340, 340, {
          fill: [0.1, 0.95, 0.08, 0.7],
          stroke: [0.94, 0.94, 0.1, 0.92],
          strokeWidth: 14
        }),
        elem("overlap_circle_b", "circle", 760, 300, 340, 340, {
          fill: [0.22, 0.4, 1, 0.7],
          stroke: [0.15, 0.96, 0.16, 0.92],
          strokeWidth: 14
        }),
        elem("overlap_circle_c", "circle", 720, 280, 340, 340, {
          fill: [1, 0.25, 0.15, 0.72],
          stroke: [0.4, 0.1, 1, 0.92],
          strokeWidth: 14
        })
      ]
    },
    {
      id: "overlap_mixed_shapes_basic",
      family: "overlap/mixed-type",
      title: "Overlap Mixed Shapes Basic",
      capabilities: ["boxRounded", "circle", "line", "text", "fill", "stroke", "alpha", "zOrder"],
      elements: [
        elem("mixed_backplate", "boxRounded", 610, 260, 380, 340, {
          radius: 46,
          fill: [0.18, 0.14, 0.94, 0.92],
          stroke: [0.05, 0.95, 1, 0.9],
          strokeWidth: 14
        }),
        elem("mixed_circle", "circle", 790, 300, 300, 300, {
          fill: [1, 0.78, 0.15, 0.94],
          stroke: [1, 0.15, 0.15, 0.96],
          strokeWidth: 12
        }),
        elem("mixed_line_a", "line", 720, 360, 320, 140, {
          fill: [0, 0, 0, 0],
          stroke: [0.06, 0.95, 1, 0.95],
          strokeWidth: 12
        }),
        elem("mixed_line_b", "line", 720, 500, 320, -140, {
          fill: [0, 0, 0, 0],
          stroke: [1, 0.92, 0.05, 0.95],
          strokeWidth: 12
        }),
        elem("mixed_text", "text", 1120, 285, 260, 300, {
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["E"],
          textColor: [1, 0.96, 0.08, 1],
          textSize: 170,
          textAlign: "center"
        })
      ]
    },
    {
      id: "effect_text_rgb_split",
      family: "effect/text-treatment",
      title: "Effect Text RGB Split",
      capabilities: ["text", "fill", "stroke", "textSize", "alpha", "zOrder"],
      elements: [
        elem("rgb_text_r", "text", 760, 300, 320, 320, {
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["E"],
          textColor: [1, 0.18, 0.18, 0.85],
          textSize: 210,
          textAlign: "center"
        }),
        elem("rgb_text_g", "text", 790, 300, 320, 320, {
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["E"],
          textColor: [0.1, 1, 0.2, 0.82],
          textSize: 210,
          textAlign: "center"
        }),
        elem("rgb_text_b", "text", 775, 280, 320, 320, {
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["E"],
          textColor: [0.18, 0.48, 1, 0.85],
          textSize: 210,
          textAlign: "center"
        })
      ]
    },
    buildShapesLuaDemoRecipe()
  ];

  function getRecipeIndex(id) {
    var target = String(id || "");
    for (var i = 0; i < RECIPES.length; i += 1) {
      if (RECIPES[i].id === target) return i;
    }
    return -1;
  }

  function getRecipe(id) {
    var index = getRecipeIndex(id);
    return index >= 0 ? deepCopy(RECIPES[index]) : null;
  }

  function listRecipes() {
    return RECIPES.map(function (recipe) {
      return {
        id: recipe.id,
        family: recipe.family,
        title: recipe.title,
        capabilities: recipe.capabilities.slice(),
        elementCount: Array.isArray(recipe.elements) ? recipe.elements.length : 0
      };
    });
  }

  function buildDocument(id) {
    var recipe = getRecipe(id);
    return recipe ? docFromRecipe(recipe) : null;
  }

  function loadDocument(id) {
    var doc = buildDocument(id);
    if (!doc) return null;
    APP.state.document = doc;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.state.isDirty = false;
    APP.emit("document-loaded", doc);
    if (typeof APP.goToEditor === "function") {
      APP.goToEditor();
    } else if (typeof APP.showScreen === "function") {
      APP.showScreen("editor");
    }
    return deepCopy(doc);
  }

  APP.shapeSnippets = {
    ids: RECIPES.map(function (recipe) { return recipe.id; }),
    list: listRecipes,
    get: getRecipe,
    buildDocument: buildDocument,
    loadDocument: loadDocument
  };
})();
