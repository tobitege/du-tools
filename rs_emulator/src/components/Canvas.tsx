import { useRef, forwardRef, useImperativeHandle, useState } from "react";
import { DrawBuffer, renderBuffer } from "../emulator";

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
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ width, height, showGrid, showFps, themeMode }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastRenderAtRef = useRef<number | null>(null);
    const [stats, setStats] = useState({ drawCalls: 0, textCalls: 0, frameMs: 0, fps: 0 });

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
        style={{
          width: "100%",
          height: "100%",
          padding: 16,
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
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            display: "block",
            width: "auto",
            height: "auto",
            maxWidth: "100%",
            maxHeight: "100%",
            imageRendering: "pixelated",
            borderRadius: 4,
            boxShadow: "0 0 20px rgba(0,0,0,0.5)",
          }}
        />
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
