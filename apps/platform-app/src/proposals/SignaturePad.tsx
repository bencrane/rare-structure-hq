/**
 * SignaturePad — a lightweight canvas signature pad (no deps) and a modal overlay around it.
 *
 * Performative, in-the-moment signing for the operator's draft: draw → Apply → the stroke is
 * captured as a PNG data URL. Stroke is the steel-blue accent so it reads as ink on the dark
 * surface and rhymes with the pre-signed originator mark elsewhere.
 */
import { Eraser, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STROKE = "#7b9fd4"; // text.accent

export function SignatureOverlay({
  onApply,
  onCancel,
}: {
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel signing"
        onClick={onCancel}
        className="absolute inset-0 bg-[color:var(--color-surface-overlay)]"
      />
      <div className="relative w-full max-w-[520px] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-6 shadow-[0_24px_64px_-32px_rgba(0,0,0,0.85)]">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
            Sign the mandate
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text-default)]"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm">
          Draw your signature below — this is your originator mark on the mandate.
        </p>
        <SignaturePad onApply={onApply} />
      </div>
    </div>
  );
}

function SignaturePad({ onApply }: { onApply: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Size the backing store to the displayed box × DPR for a crisp line.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = STROKE;
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  }

  function up() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasInk(false);
  }

  function apply() {
    const canvas = canvasRef.current;
    if (canvas && hasInk) onApply(canvas.toDataURL("image/png"));
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="h-[180px] w-full touch-none border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)]"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:text-[color:var(--color-text-muted)]"
        >
          <Eraser className="size-3.5" />
          Clear
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!hasInk}
          className="border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-6 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.16em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40"
        >
          Apply signature
        </button>
      </div>
    </div>
  );
}
