import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";
import { DrawBuffer, renderBuffer } from "../emulator";

const CANVAS_SHELL_PADDING = 16;

export interface CanvasHandle {
  render: (buffer: DrawBuffer, opts?: { showGrid?: boolean }) => void;
  getCanvas: () => HTMLCanvasElement | null;
}

interface CanvasProps {
  width: number;
  height: number;
  showGrid: boolean;
  showFps: boolean;
  themeMode: "light" | "dark";
  rotationDegrees: number;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onResetRotation: () => void;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ width, height, showGrid, showFps, themeMode, rotationDegrees, onRotateLeft, onRotateRight, onResetRotation }, ref) => {
    const shellRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastRenderAtRef = useRef<number | null>(null);
    const resizeFrameRef = useRef<number>(0);
    const [shellSize, setShellSize] = useState({ width: 0, height: 0 });
    const [stats, setStats] = useState({ drawCalls: 0, textCalls: 0, frameMs: 0, fps: 0 });
    const normalizedRotation = normalizeRotation(rotationDegrees);
    const rotatedByQuarterTurn = normalizedRotation % 180 !== 0;
    const rotatedWidth = rotatedByQuarterTurn ? height : width;
    const rotatedHeight = rotatedByQuarterTurn ? width : height;
    const contentWidth = Math.max(0, shellSize.width - CANVAS_SHELL_PADDING * 2);
    const contentHeight = Math.max(0, shellSize.height - CANVAS_SHELL_PADDING * 2);
    const stageSize = fitRectWithin(
      contentWidth || rotatedWidth,
      contentHeight || rotatedHeight,
      rotatedWidth,
      rotatedHeight
    );
    // Keep the toolbar pinned to the pane corner, but choose the slimmer
    // orientation if that overlaps the rendered stage less.
    const stageOffsetLeft = CANVAS_SHELL_PADDING + Math.max(0, (contentWidth - stageSize.width) / 2);
    const stageOffsetTop = CANVAS_SHELL_PADDING + Math.max(0, (contentHeight - stageSize.height) / 2);
    const toolbarOrientation = getRotationToolbarOrientation({
      left: stageOffsetLeft,
      top: stageOffsetTop,
      right: stageOffsetLeft + stageSize.width,
      bottom: stageOffsetTop + stageSize.height,
    });
    const displayCanvasWidth = rotatedByQuarterTurn ? stageSize.height : stageSize.width;
    const displayCanvasHeight = rotatedByQuarterTurn ? stageSize.width : stageSize.height;

    useEffect(() => {
      const shell = shellRef.current;
      if (!shell) {
        return;
      }

      const updateShellSize = (nextWidth: number, nextHeight: number) => {
        // ResizeObserver can emit tiny fractional changes in quick bursts.
        // Round and coalesce them so we only re-render for real size changes.
        const width = Math.max(0, Math.round(nextWidth));
        const height = Math.max(0, Math.round(nextHeight));

        if (resizeFrameRef.current) {
          cancelAnimationFrame(resizeFrameRef.current);
        }

        resizeFrameRef.current = requestAnimationFrame(() => {
          resizeFrameRef.current = 0;
          setShellSize((current) => {
            if (current.width === width && current.height === height) {
              return current;
            }

            return { width, height };
          });
        });
      };

      const measure = () => {
        const bounds = shell.getBoundingClientRect();
        updateShellSize(bounds.width, bounds.height);
      };

      measure();

      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) {
            return;
          }
          updateShellSize(entry.contentRect.width, entry.contentRect.height);
        });
        observer.observe(shell);
        return () => {
          observer.disconnect();
          if (resizeFrameRef.current) {
            cancelAnimationFrame(resizeFrameRef.current);
            resizeFrameRef.current = 0;
          }
        };
      }

      window.addEventListener("resize", measure);
      return () => {
        window.removeEventListener("resize", measure);
        if (resizeFrameRef.current) {
          cancelAnimationFrame(resizeFrameRef.current);
          resizeFrameRef.current = 0;
        }
      };
    }, []);

    useImperativeHandle(ref, () => ({
      render(buffer: DrawBuffer, opts?: { showGrid?: boolean }) {
        if (!canvasRef.current) return;

        renderBuffer(canvasRef.current, buffer);
        const t1 = performance.now();
        const frameDelta = lastRenderAtRef.current === null ? 0 : t1 - lastRenderAtRef.current;
        lastRenderAtRef.current = t1;
        const frameMs = buffer.deltaTime > 0 ? buffer.deltaTime * 1000 : frameDelta;

        const drawGrid = opts?.showGrid ?? showGrid;
        if (drawGrid) {
          drawGridOverlay(canvasRef.current);
        }

        setStats({
          drawCalls: buffer.commands.length,
          textCalls: buffer.commands.filter((command) => command.op === "AddText").length,
          frameMs,
          fps: frameMs > 0 ? 1000 / frameMs : 0,
        });
      },
      getCanvas() {
        return canvasRef.current;
      },
    }));

    return (
      <div
        ref={shellRef}
        style={{
          width: "100%",
          height: "100%",
          padding: CANVAS_SHELL_PADDING,
          background: "var(--color-base-200)",
          borderRadius: 8,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 2,
            display: "flex",
            flexDirection: toolbarOrientation === "vertical" ? "column" : "row",
            alignItems: "center",
            gap: 6,
            padding: 6,
            borderRadius: 18,
            border: "1px solid color-mix(in srgb, var(--color-base-300) 82%, transparent)",
            background: "color-mix(in srgb, var(--color-base-100) 88%, transparent)",
            boxShadow: "0 12px 26px color-mix(in srgb, black 22%, transparent)",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            type="button"
            onClick={onRotateLeft}
            className="btn btn-ghost btn-sm btn-square"
            title="Rotate canvas 90° left"
            aria-label="Rotate canvas 90 degrees left"
          >
            <RotateCanvasLeftIcon />
          </button>
          <button
            type="button"
            onClick={onRotateRight}
            className="btn btn-ghost btn-sm btn-square"
            title="Rotate canvas 90° right"
            aria-label="Rotate canvas 90 degrees right"
          >
            <RotateCanvasRightIcon />
          </button>
          <button
            type="button"
            onClick={onResetRotation}
            className="btn btn-ghost btn-sm btn-square"
            disabled={normalizedRotation === 0}
            title="Reset canvas rotation"
            aria-label="Reset canvas rotation"
          >
            <ResetCanvasRotationIcon />
          </button>
          <span
            className="badge badge-outline badge-sm min-w-12 justify-center font-mono"
            style={toolbarOrientation === "vertical" ? { minHeight: 32 } : undefined}
          >
            {normalizedRotation}°
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              width: Math.max(1, stageSize.width),
              height: Math.max(1, stageSize.height),
              flex: "0 0 auto",
            }}
          >
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                display: "block",
                width: Math.max(1, displayCanvasWidth),
                height: Math.max(1, displayCanvasHeight),
                transform: `translate(-50%, -50%) rotate(${normalizedRotation}deg)`,
                transformOrigin: "center center",
                imageRendering: "pixelated",
                borderRadius: 4,
                boxShadow: "0 0 20px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        </div>
        {showFps && (
          <div
            style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: themeMode === "dark" ? "rgba(8, 11, 18, 0.78)" : "rgba(255, 255, 255, 0.84)",
            color: themeMode === "dark" ? "var(--color-success)" : "var(--color-neutral)",
            padding: "3px 8px",
            borderRadius: 4,
            fontSize: 11,
              fontFamily: "monospace",
              pointerEvents: "none",
              lineHeight: 1.5,
            }}
          >
            <div>{stats.fps > 0 ? Math.round(stats.fps) : "-"} fps</div>
            <div>{stats.frameMs > 0 ? stats.frameMs.toFixed(1) : "-"} ms frame</div>
            <div>{stats.drawCalls} draw calls</div>
            <div>{stats.textCalls} text calls</div>
          </div>
        )}
      </div>
    );
  }
);

type ToolbarOrientation = "horizontal" | "vertical";

function RotateCanvasLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M9 5L4 10L9 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 19a8 8 0 0 0-8-8H4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RotateCanvasRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M15 5L20 10L15 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19a8 8 0 0 1 8-8H20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetCanvasRotationIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M7 7h10v10H7z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 3v3M21 12h-3M12 21v-3M3 12h3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function normalizeRotation(rotationDegrees: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotationDegrees % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

function fitRectWithin(boundsWidth: number, boundsHeight: number, contentWidth: number, contentHeight: number) {
  if (boundsWidth <= 0 || boundsHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(boundsWidth / contentWidth, boundsHeight / contentHeight);
  return {
    width: contentWidth * scale,
    height: contentHeight * scale,
  };
}

function getRotationToolbarOrientation(stageRect: { left: number; top: number; right: number; bottom: number }): ToolbarOrientation {
  // The toolbar stays in the top-left corner of the pane; only the shape flips.
  const horizontal = { left: 8, top: 8, width: 184, height: 48 };
  const vertical = { left: 8, top: 8, width: 60, height: 150 };

  const horizontalOverlap = getRectOverlapArea(horizontal, stageRect);
  const verticalOverlap = getRectOverlapArea(vertical, stageRect);

  if (verticalOverlap < horizontalOverlap) {
    return "vertical";
  }

  return "horizontal";
}

function getRectOverlapArea(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; right: number; bottom: number }
) {
  const aRight = a.left + a.width;
  const aBottom = a.top + a.height;
  const overlapWidth = Math.max(0, Math.min(aRight, b.right) - Math.max(a.left, b.left));
  const overlapHeight = Math.max(0, Math.min(aBottom, b.bottom) - Math.max(a.top, b.top));
  return overlapWidth * overlapHeight;
}


function drawGridOverlay(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const step = 64;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;

  for (let x = step; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }

  // center crosshair
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.moveTo(w / 2 + 0.5, 0);
  ctx.lineTo(w / 2 + 0.5, h);
  ctx.moveTo(0, h / 2 + 0.5);
  ctx.lineTo(w, h / 2 + 0.5);
  ctx.stroke();

  // corner labels
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "10px monospace";
  ctx.textBaseline = "top";
  ctx.fillText("0,0", 4, 4);
  ctx.textAlign = "right";
  ctx.fillText(`${w},${h}`, w - 4, h - 14);

  ctx.restore();
}
