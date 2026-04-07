function parseHexColor(hex) {
  var value = String(hex || "").replace(/[^0-9a-f]/gi, "");
  if (value.length === 3) {
    value = value.charAt(0) + value.charAt(0) + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2);
  }
  if (value.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function clampColorByte(value) {
  var n = Math.round(Number(value) || 0);
  if (n < 0) {
    return 0;
  }
  if (n > 255) {
    return 255;
  }
  return n;
}

function toHexColor(rgb) {
  function toPart(value) {
    var part = clampColorByte(value).toString(16);
    return part.length < 2 ? "0" + part : part;
  }
  return "#" + toPart(rgb.r) + toPart(rgb.g) + toPart(rgb.b);
}

function mixHexColor(a, b, amount) {
  var left = parseHexColor(a);
  var right = parseHexColor(b);
  var t = typeof amount === "number" ? amount : 0.5;
  if (t < 0) {
    t = 0;
  }
  if (t > 1) {
    t = 1;
  }
  return toHexColor({
    r: left.r + (right.r - left.r) * t,
    g: left.g + (right.g - left.g) * t,
    b: left.b + (right.b - left.b) * t
  });
}

function withAlpha(hex, alpha) {
  var rgb = parseHexColor(hex);
  var a = typeof alpha === "number" ? alpha : 1;
  if (a < 0) {
    a = 0;
  }
  if (a > 1) {
    a = 1;
  }
  return "rgba(" + clampColorByte(rgb.r) + "," + clampColorByte(rgb.g) + "," + clampColorByte(rgb.b) + "," + a + ")";
}

function isLightHexColor(hex) {
  var rgb = parseHexColor(hex);
  var luminance = (rgb.r * 0.299) + (rgb.g * 0.587) + (rgb.b * 0.114);
  return luminance >= 160;
}

function getRelativeLuminance(hex) {
  var rgb = parseHexColor(hex);
  function toLinear(value) {
    var n = clampColorByte(value) / 255;
    return n <= 0.03928 ? (n / 12.92) : Math.pow((n + 0.055) / 1.055, 2.4);
  }
  return (0.2126 * toLinear(rgb.r)) + (0.7152 * toLinear(rgb.g)) + (0.0722 * toLinear(rgb.b));
}

function getContrastRatio(a, b) {
  var left = getRelativeLuminance(a);
  var right = getRelativeLuminance(b);
  var lighter = left > right ? left : right;
  var darker = left > right ? right : left;
  return (lighter + 0.05) / (darker + 0.05);
}

function pickReadableTextColor(background, preferred, dark, light, minRatio) {
  var bg = String(background || "#000000");
  var want = String(preferred || "");
  var darkText = String(dark || "#111111");
  var lightText = String(light || "#f8f8f2");
  var min = typeof minRatio === "number" ? minRatio : 4.5;
  var best = want;
  var bestRatio = best ? getContrastRatio(bg, best) : 0;
  if (best && bestRatio >= min) {
    return best;
  }
  var darkRatio = getContrastRatio(bg, darkText);
  var lightRatio = getContrastRatio(bg, lightText);
  return darkRatio >= lightRatio ? darkText : lightText;
}

function pickReadableTextColorForBackgrounds(backgrounds, preferred, dark, light, minRatio) {
  var list = Array.isArray(backgrounds) ? backgrounds : [backgrounds];
  var want = String(preferred || "");
  var darkText = String(dark || "#111111");
  var lightText = String(light || "#f8f8f2");
  var min = typeof minRatio === "number" ? minRatio : 4.5;
  var i;
  var bg;
  var preferredMin = Infinity;
  var darkMin = Infinity;
  var lightMin = Infinity;
  for (i = 0; i < list.length; i += 1) {
    bg = String(list[i] || "#000000");
    if (want) {
      preferredMin = Math.min(preferredMin, getContrastRatio(bg, want));
    }
    darkMin = Math.min(darkMin, getContrastRatio(bg, darkText));
    lightMin = Math.min(lightMin, getContrastRatio(bg, lightText));
  }
  if (want && preferredMin >= min) {
    return want;
  }
  if (darkMin >= min || lightMin >= min) {
    return darkMin >= lightMin ? darkText : lightText;
  }
  return darkMin >= lightMin ? darkText : lightText;
}

function ensureReadableAccentColor(background, color, minRatio) {
  var bg = String(background || "#000000");
  var candidate = String(color || "");
  var min = typeof minRatio === "number" ? minRatio : 3.4;
  if (candidate && getContrastRatio(bg, candidate) >= min) {
    return candidate;
  }
  var target = isLightHexColor(bg) ? "#111111" : "#f8f8f2";
  if (!candidate) {
    candidate = target;
  }
  for (var i = 1; i <= 10; i += 1) {
    var mixed = mixHexColor(candidate, target, i / 10);
    if (getContrastRatio(bg, mixed) >= min) {
      return mixed;
    }
  }
  return pickReadableTextColor(bg, candidate, "#111111", "#f8f8f2", min);
}

function shadeHexColor(hex, amount) {
  return amount >= 0
    ? mixHexColor(hex, "#ffffff", amount)
    : mixHexColor(hex, "#000000", -amount);
}

function buildLinearGradient(top, mid, bottom) {
  return "linear-gradient(180deg," + top + " 0%," + mid + " 45%," + bottom + " 100%)";
}
