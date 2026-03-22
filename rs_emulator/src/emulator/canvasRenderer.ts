import { DrawBuffer } from "./drawBuffer";
import { RSAlignHor, RSAlignVer } from "./types";
import type { DrawCommand, RGBA, LayerStyle } from "./types";
import { getFontString, measureFontMetrics } from "./textMetrics";

type RenderableCommand = Extract<DrawCommand, { style: LayerStyle }>;

function rgbaStr(c: RGBA): string {
  return `rgba(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)},${c[3]})`;
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

function resolveTextY(fontName: string, fontSize: number, ver: number, y: number): number {
  const metrics = measureFontMetrics(fontName, fontSize);

  if (ver === RSAlignVer.Top) {
    return y + metrics.ascent;
  }
  if (ver === RSAlignVer.Middle) {
    return y + (metrics.ascent - metrics.descent) / 2;
  }
  if (ver === RSAlignVer.Bottom || ver === RSAlignVer.Descender) {
    return y - metrics.descent;
  }

  return y;
}

function isRenderableCommand(command: DrawCommand): command is RenderableCommand {
  return command.op.startsWith("Add");
}

function drawImagePlaceholder(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  ctx.strokeStyle = "rgba(255,0,0,1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  ctx.stroke();
  ctx.fillStyle = "rgba(255,0,0,1)";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.restore();
}

export function renderBuffer(canvas: HTMLCanvasElement, buffer: DrawBuffer) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const [w, h] = buffer.GetResolution();
  canvas.width = w;
  canvas.height = h;

  // clear
  const bg = buffer.screen.backgroundColor;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = rgbaStr(bg);
  ctx.fillRect(0, 0, w, h);

  const renderCommands = buffer.commands
    .filter(isRenderableCommand)
    .map((command, index) => ({ command, index }))
    .sort((left, right) => {
      if (left.command.layer !== right.command.layer) {
        return left.command.layer - right.command.layer;
      }
      return left.index - right.index;
    });

  for (const { command: cmd } of renderCommands) {

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

      const style = cmd.style;
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
          applyStyle(ctx, style, true);
          const font = buffer.fonts.find(f => f.id === cmd.fontId);
          const fontName = font?.name ?? "sans-serif";
          const fontSize = font?.size ?? 16;
          const fontStr = getFontString(fontName, fontSize);
          ctx.font = fontStr;
          ctx.textAlign = alignToCanvas(style.textAlign.hor, style.textAlign.ver);
          ctx.textBaseline = verToBaseline(RSAlignVer.Baseline);
          ctx.lineJoin = "round";
          const textY = resolveTextY(fontName, fontSize, style.textAlign.ver, cmd.y);
          if (style.strokeWidth > 0 && style.strokeColor[3] > 0) {
            ctx.strokeText(cmd.text, cmd.x, textY);
          }
          ctx.fillText(cmd.text, cmd.x, textY);
          ctx.restore();
          break;
        }
        case "AddImage": {
          const imgEntry = buffer.images.find(i => i.id === cmd.imageId);
          if (imgEntry?.loaded && imgEntry.element) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (rot !== 0) {
              ctx.translate(cmd.x + cmd.w / 2, cmd.y + cmd.h / 2);
              ctx.rotate(rot);
              ctx.translate(-(cmd.x + cmd.w / 2), -(cmd.y + cmd.h / 2));
            }
            ctx.drawImage(
              imgEntry.element,
              Math.round(cmd.x),
              Math.round(cmd.y),
              Math.round(cmd.w),
              Math.round(cmd.h)
            );
            ctx.restore();
          } else if (imgEntry?.placeholderText) {
            drawImagePlaceholder(ctx, imgEntry.placeholderText, cmd.x, cmd.y, cmd.w, cmd.h);
          }
          break;
        }
        case "AddImageSub": {
          const imgEntry = buffer.images.find(i => i.id === cmd.imageId);
          if (imgEntry?.loaded && imgEntry.element) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
              imgEntry.element,
              Math.round(cmd.subX),
              Math.round(cmd.subY),
              Math.round(cmd.subW),
              Math.round(cmd.subH),
              Math.round(cmd.x),
              Math.round(cmd.y),
              Math.round(cmd.w),
              Math.round(cmd.h)
            );
            ctx.restore();
          } else if (imgEntry?.placeholderText) {
            drawImagePlaceholder(ctx, imgEntry.placeholderText, cmd.x, cmd.y, cmd.w, cmd.h);
          }
          break;
        }
      }

      ctx.restore();
    }
  }
}
