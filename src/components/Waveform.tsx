import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../lib/format";

interface Props {
  peaks: number[]; // min/max pairs
  duration: number;
  a: number;
  b: number;
  position: number;
  /** visible window [viewStart, viewEnd] in seconds (zoom) */
  viewStart: number;
  viewEnd: number;
  onSetA: (t: number) => void;
  onSetB: (t: number) => void;
  onScrub: (t: number) => void;
  onViewChange: (start: number, end: number) => void;
}

type Drag = "a" | "b" | "scrub" | "pan" | null;

export default function Waveform({
  peaks,
  duration,
  a,
  b,
  position,
  viewStart,
  viewEnd,
  onSetA,
  onSetB,
  onScrub,
  onViewChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 200 });
  const [drag, setDrag] = useState<Drag>(null);
  const panRef = useRef<{ x: number; vs: number; ve: number } | null>(null);

  // observe size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ w: Math.max(200, cr.width), h: Math.max(120, cr.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const span = Math.max(0.001, viewEnd - viewStart);
  const tToX = useCallback(
    (t: number) => ((t - viewStart) / span) * size.w,
    [viewStart, span, size.w],
  );
  const xToT = useCallback(
    (x: number) => viewStart + (x / size.w) * span,
    [viewStart, span, size.w],
  );

  // draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = size.w;
    const H = size.h;
    const mid = H / 2;
    ctx.clearRect(0, 0, W, H);

    // center line
    ctx.strokeStyle = "rgba(139,148,163,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(W, mid);
    ctx.stroke();

    // loop region shade
    const ax = clamp(tToX(a), 0, W);
    const bx = clamp(tToX(b), 0, W);
    ctx.fillStyle = "rgba(34,227,214,0.07)";
    ctx.fillRect(ax, 0, Math.max(0, bx - ax), H);

    // waveform — map view window to peak buckets
    const buckets = peaks.length / 2;
    if (buckets > 0 && duration > 0) {
      const startFrac = viewStart / duration;
      const endFrac = viewEnd / duration;
      const startBucket = startFrac * buckets;
      const endBucket = endFrac * buckets;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#c6ff3f");
      grad.addColorStop(0.5, "#9fe04a");
      grad.addColorStop(1, "#16998f");
      ctx.fillStyle = grad;
      const colW = 1;
      for (let px = 0; px < W; px += colW) {
        const f0 = startBucket + (px / W) * (endBucket - startBucket);
        const f1 = startBucket + ((px + colW) / W) * (endBucket - startBucket);
        let min = 1;
        let max = -1;
        const i0 = Math.max(0, Math.floor(f0));
        const i1 = Math.min(buckets - 1, Math.ceil(f1));
        for (let i = i0; i <= i1; i++) {
          const lo = peaks[i * 2];
          const hi = peaks[i * 2 + 1];
          if (lo < min) min = lo;
          if (hi > max) max = hi;
        }
        if (min > max) {
          min = 0;
          max = 0;
        }
        const yTop = mid - max * (mid - 6);
        const yBot = mid - min * (mid - 6);
        ctx.fillRect(px, yTop, colW, Math.max(1, yBot - yTop));
      }

      // dim everything outside the loop region (overlay)
      ctx.fillStyle = "rgba(12,14,16,0.55)";
      if (ax > 0) ctx.fillRect(0, 0, ax, H);
      if (bx < W) ctx.fillRect(bx, 0, W - bx, H);
    }

    // A / B boundary lines
    drawHandle(ctx, ax, H, "#22e3d6", "A");
    drawHandle(ctx, bx, H, "#ff7849", "B");

    // playhead
    const px = tToX(position);
    if (px >= 0 && px <= W) {
      ctx.strokeStyle = "#e4ff8f";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(198,255,63,0.8)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [peaks, duration, a, b, position, viewStart, viewEnd, size, tToX]);

  // ---- interaction ----
  const HANDLE_HIT = 10;

  const pointerPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return e.clientX - rect.left;
  };

  const onDown = (e: React.PointerEvent) => {
    const x = pointerPos(e);
    const ax = tToX(a);
    const bx = tToX(b);
    canvasRef.current?.setPointerCapture(e.pointerId);

    if (e.shiftKey || e.button === 1) {
      panRef.current = { x: e.clientX, vs: viewStart, ve: viewEnd };
      setDrag("pan");
      return;
    }
    if (Math.abs(x - ax) <= HANDLE_HIT) {
      setDrag("a");
      return;
    }
    if (Math.abs(x - bx) <= HANDLE_HIT) {
      setDrag("b");
      return;
    }
    // click in region -> scrub; outside region we still scrub (move playhead)
    const t = clamp(xToT(x), 0, duration);
    onScrub(t);
    setDrag("scrub");
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    if (drag === "pan" && panRef.current) {
      const dxT = ((panRef.current.x - e.clientX) / size.w) * span;
      let vs = panRef.current.vs + dxT;
      let ve = panRef.current.ve + dxT;
      if (vs < 0) {
        ve -= vs;
        vs = 0;
      }
      if (ve > duration) {
        vs -= ve - duration;
        ve = duration;
      }
      onViewChange(Math.max(0, vs), Math.min(duration, ve));
      return;
    }
    const x = pointerPos(e);
    const t = clamp(xToT(x), 0, duration);
    if (drag === "a") onSetA(Math.min(t, b - 0.05));
    else if (drag === "b") onSetB(Math.max(t, a + 0.05));
    else if (drag === "scrub") onScrub(t);
  };

  const onUp = (e: React.PointerEvent) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);
    panRef.current = null;
    setDrag(null);
  };

  // wheel to zoom around cursor
  const onWheel = (e: React.WheelEvent) => {
    if (duration <= 0) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const focus = xToT(x);
    const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18;
    let newSpan = clamp(span * factor, Math.min(0.25, duration), duration);
    let vs = focus - ((focus - viewStart) / span) * newSpan;
    let ve = vs + newSpan;
    if (vs < 0) {
      vs = 0;
      ve = newSpan;
    }
    if (ve > duration) {
      ve = duration;
      vs = duration - newSpan;
    }
    onViewChange(Math.max(0, vs), Math.min(duration, ve));
  };

  const cursor =
    drag === "pan"
      ? "grabbing"
      : drag === "a" || drag === "b"
        ? "ew-resize"
        : "crosshair";

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden rounded-lg bg-rack-deep shadow-well ring-1 ring-rack-line"
    >
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor, touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      />
    </div>
  );
}

function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  h: number,
  color: string,
  label: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
  // flag at top
  ctx.fillRect(x - 1, 0, 2, h);
  const w = 18;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + (label === "A" ? -w : w), 0);
  ctx.lineTo(x + (label === "A" ? -w : w), 14);
  ctx.lineTo(x, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0c0e10";
  ctx.font = "700 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + (label === "A" ? -9 : 9), 7);
  ctx.restore();
}
