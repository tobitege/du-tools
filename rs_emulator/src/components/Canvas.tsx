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
  darkBg: boolean;
  showFps: boolean;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ width, height, showGrid, darkBg, showFps }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stats, setStats] = useState({ drawCalls: 0, ms: 0 });

    useImperativeHandle(ref, () => ({
      render(buffer: DrawBuffer, opts?: { showGrid?: boolean }) {
        if (!canvasRef.current) return;

        const t0 = performance.now();
        renderBuffer(canvasRef.current, buffer);
        const elapsed = performance.now() - t0;

        const drawGrid = opts?.showGrid ?? showGrid;
        if (drawGrid) {
          drawGridOverlay(canvasRef.current);
        }

        setStats({ drawCalls: buffer.commands.length, ms: elapsed });
      },
      getCanvas() {
        return canvasRef.current;
      },
    }));

    return (
      <div
        style={{
          padding: 16,
          background: darkBg ? "#0a0a14" : "#c8c8c8",
          borderRadius: 8,
          display: "inline-flex",
          position: "relative",
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            display: "block",
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
              background: "rgba(0,0,0,0.75)",
              color: "#0f0",
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "monospace",
              pointerEvents: "none",
              lineHeight: 1.5,
            }}
          >
            <div>{Math.max(1, Math.round(1000 / Math.max(stats.ms, 0.1)))} fps</div>
            <div>{stats.ms.toFixed(1)} ms</div>
            <div>{stats.drawCalls} draw calls</div>
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
