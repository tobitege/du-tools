import { DrawBuffer } from "./drawBuffer";
import { RSShape, RSAlignHor, RSAlignVer } from "./types";
import type { RGBA, LayerStyle } from "./types";

function rgbaStr(c: RGBA): string {
  return `rgba(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)},${c[3]})`;
}

function resolveStyle(buffer: DrawBuffer, layer: number, shape: RSShape): LayerStyle {
  const layerMap = buffer.layerStyles.get(layer);
  const defaults = layerMap?.[shape] ?? layerMap?.[RSShape.Box] ?? {
    fillColor: [1,1,1,1] as RGBA,
    strokeColor: [0,0,0,1] as RGBA,
    strokeWidth: 0,
    shadow: { radius: 0, color: [0,0,0,0.5] as RGBA },
    rotation: 0,
    textAlign: { hor: RSAlignHor.Left, ver: RSAlignVer.Baseline },
  };
  const next = buffer.nextOverrides.get(layer);
  if (!next) return defaults;
  return {
    fillColor: next.fillColor ?? defaults.fillColor,
    strokeColor: next.strokeColor ?? defaults.strokeColor,
    strokeWidth: next.strokeWidth ?? defaults.strokeWidth,
    shadow: next.shadow ?? defaults.shadow,
    rotation: next.rotation ?? defaults.rotation,
    textAlign: next.textAlign ?? defaults.textAlign,
  };
}

function applyLayerTransform(ctx: CanvasRenderingContext2D, buffer: DrawBuffer, layer: number) {
  const lt = buffer.layerTransforms.get(layer);
  if (!lt) return;
  ctx.translate(lt.translation[0], lt.translation[1]);
  ctx.translate(lt.origin[0], lt.origin[1]);
  ctx.rotate(lt.rotation);
  ctx.scale(lt.scale[0], lt.scale[1]);
  ctx.translate(-lt.origin[0], -lt.origin[1]);
}

function applyStyle(ctx: CanvasRenderingContext2D, style: LayerStyle, hasStroke: boolean) {
  ctx.fillStyle = rgbaStr(style.fillColor);
  if (hasStroke && style.strokeWidth > 0) {
    ctx.strokeStyle = rgbaStr(style.strokeColor);
    ctx.lineWidth = style.strokeWidth;
  }
  if (style.shadow.radius > 0) {
    ctx.shadowBlur = style.shadow.radius;
    ctx.shadowColor = rgbaStr(style.shadow.color);
  } else {
    ctx.shadowBlur = 0;
  }
}

function alignToCanvas(hor: number, _ver: number): CanvasTextAlign {
  if (hor === RSAlignHor.Center) return "center";
  if (hor === RSAlignHor.Right) return "right";
  return "left";
}

function verToBaseline(ver: number): CanvasTextBaseline {
  if (ver === RSAlignVer.Top) return "top";
  if (ver === RSAlignVer.Middle) return "middle";
  if (ver === RSAlignVer.Bottom) return "bottom";
  return "alphabetic";
}

export function renderBuffer(canvas: HTMLCanvasElement, buffer: DrawBuffer) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const [w, h] = buffer.GetResolution();
  canvas.width = w;
  canvas.height = h;

  // clear
  const bg = buffer.screen.backgroundColor;
  ctx.fillStyle = rgbaStr(bg);
  ctx.fillRect(0, 0, w, h);

  // consume next overrides after each shape
  const shapeOps = new Set(["AddBezier","AddBox","AddBoxRounded","AddCircle","AddLine","AddQuad","AddTriangle","AddText","AddImage","AddImageSub"]);

  for (const cmd of buffer.commands) {
    // determine shape type for style resolution
    let shape: RSShape = RSShape.Box;
    if (cmd.op === "AddBezier") shape = RSShape.Bezier;
    else if (cmd.op === "AddBox") shape = RSShape.Box;
    else if (cmd.op === "AddBoxRounded") shape = RSShape.BoxRounded;
    else if (cmd.op === "AddCircle") shape = RSShape.Circle;
    else if (cmd.op === "AddLine") shape = RSShape.Line;
    else if (cmd.op === "AddText") shape = RSShape.Text;
    else if (cmd.op === "AddImage" || cmd.op === "AddImageSub") shape = RSShape.Image;
    else if (cmd.op === "AddQuad" || cmd.op === "AddTriangle") shape = RSShape.Polygon;

    if ("layer" in cmd) {
      const layer = (cmd as any).layer as number;
      ctx.save();

      // layer transform
      applyLayerTransform(ctx, buffer, layer);

      // clip rect
      const lt = buffer.layerTransforms.get(layer);
      if (lt?.clipRect) {
        ctx.beginPath();
        ctx.rect(lt.clipRect.x, lt.clipRect.y, lt.clipRect.w, lt.clipRect.h);
        ctx.clip();
      }

      const style = resolveStyle(buffer, layer, shape);
      const rot = style.rotation;

      switch (cmd.op) {
        case "AddBox": {
          ctx.save();
          applyStyle(ctx, style, true);
          if (rot !== 0) {
            ctx.translate(cmd.x + cmd.w / 2, cmd.y + cmd.h / 2);
            ctx.rotate(rot);
            ctx.translate(-(cmd.x + cmd.w / 2), -(cmd.y + cmd.h / 2));
          }
          ctx.beginPath();
          ctx.rect(cmd.x, cmd.y, cmd.w, cmd.h);
          ctx.fill();
          if (style.strokeWidth > 0) ctx.stroke();
          ctx.restore();
          break;
        }
        case "AddBoxRounded": {
          ctx.save();
          applyStyle(ctx, style, true);
          if (rot !== 0) {
            ctx.translate(cmd.x + cmd.w / 2, cmd.y + cmd.h / 2);
            ctx.rotate(rot);
            ctx.translate(-(cmd.x + cmd.w / 2), -(cmd.y + cmd.h / 2));
          }
          const r = Math.min(cmd.radius, cmd.w / 2, cmd.h / 2);
          ctx.beginPath();
          ctx.moveTo(cmd.x + r, cmd.y);
          ctx.lineTo(cmd.x + cmd.w - r, cmd.y);
          ctx.quadraticCurveTo(cmd.x + cmd.w, cmd.y, cmd.x + cmd.w, cmd.y + r);
          ctx.lineTo(cmd.x + cmd.w, cmd.y + cmd.h - r);
          ctx.quadraticCurveTo(cmd.x + cmd.w, cmd.y + cmd.h, cmd.x + cmd.w - r, cmd.y + cmd.h);
          ctx.lineTo(cmd.x + r, cmd.y + cmd.h);
          ctx.quadraticCurveTo(cmd.x, cmd.y + cmd.h, cmd.x, cmd.y + cmd.h - r);
          ctx.lineTo(cmd.x, cmd.y + r);
          ctx.quadraticCurveTo(cmd.x, cmd.y, cmd.x + r, cmd.y);
          ctx.closePath();
          ctx.fill();
          if (style.strokeWidth > 0) ctx.stroke();
          ctx.restore();
          break;
        }
        case "AddCircle": {
          ctx.save();
          applyStyle(ctx, style, true);
          ctx.beginPath();
          ctx.arc(cmd.x, cmd.y, cmd.radius, 0, Math.PI * 2);
          ctx.fill();
          if (style.strokeWidth > 0) ctx.stroke();
          ctx.restore();
          break;
        }
        case "AddLine": {
          ctx.save();
          applyStyle(ctx, style, true);
          ctx.beginPath();
          ctx.moveTo(cmd.x1, cmd.y1);
          ctx.lineTo(cmd.x2, cmd.y2);
          if (style.strokeWidth > 0) ctx.stroke();
          ctx.restore();
          break;
        }
        case "AddBezier": {
          ctx.save();
          applyStyle(ctx, style, true);
          ctx.beginPath();
          ctx.moveTo(cmd.x1, cmd.y1);
          ctx.quadraticCurveTo(cmd.x2, cmd.y2, cmd.x3, cmd.y3);
          if (style.strokeWidth > 0) ctx.stroke();
          ctx.restore();
          break;
        }
        case "AddQuad": {
          ctx.save();
          applyStyle(ctx, style, true);
          ctx.beginPath();
          ctx.moveTo(cmd.x1, cmd.y1);
          ctx.lineTo(cmd.x2, cmd.y2);
          ctx.lineTo(cmd.x3, cmd.y3);
          ctx.lineTo(cmd.x4, cmd.y4);
          ctx.closePath();
          ctx.fill();
          if (style.strokeWidth > 0) ctx.stroke();
          ctx.restore();
          break;
        }
        case "AddTriangle": {
          ctx.save();
          applyStyle(ctx, style, true);
          ctx.beginPath();
          ctx.moveTo(cmd.x1, cmd.y1);
          ctx.lineTo(cmd.x2, cmd.y2);
          ctx.lineTo(cmd.x3, cmd.y3);
          ctx.closePath();
          ctx.fill();
          if (style.strokeWidth > 0) ctx.stroke();
          ctx.restore();
          break;
        }
        case "AddText": {
          ctx.save();
          applyStyle(ctx, style, false);
          const font = buffer.fonts.find(f => f.id === cmd.fontId);
          const fontStr = font ? `${font.size}px "${font.name}"` : "16px sans-serif";
          ctx.font = fontStr;
          ctx.textAlign = alignToCanvas(style.textAlign.hor, style.textAlign.ver);
          ctx.textBaseline = verToBaseline(style.textAlign.ver);
          ctx.fillText(cmd.text, cmd.x, cmd.y);
          ctx.restore();
          break;
        }
        case "AddImage": {
          const imgEntry = buffer.images.find(i => i.id === cmd.imageId);
          if (imgEntry?.loaded && imgEntry.element) {
            ctx.save();
            if (rot !== 0) {
              ctx.translate(cmd.x + cmd.w / 2, cmd.y + cmd.h / 2);
              ctx.rotate(rot);
              ctx.translate(-(cmd.x + cmd.w / 2), -(cmd.y + cmd.h / 2));
            }
            ctx.drawImage(imgEntry.element, cmd.x, cmd.y, cmd.w, cmd.h);
            ctx.restore();
          }
          break;
        }
        case "AddImageSub": {
          const imgEntry = buffer.images.find(i => i.id === cmd.imageId);
          if (imgEntry?.loaded && imgEntry.element) {
            ctx.save();
            ctx.drawImage(imgEntry.element, cmd.subX, cmd.subY, cmd.subW, cmd.subH, cmd.x, cmd.y, cmd.w, cmd.h);
            ctx.restore();
          }
          break;
        }
      }

      ctx.restore();

      // consume next override after drawing a shape
      if (shapeOps.has(cmd.op)) {
        buffer.nextOverrides.delete((cmd as any).layer);
      }
    }
  }
}
