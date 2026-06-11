/**
 * SignatureOverlay — type-your-name → stylized signature, in the modal aesthetic of the rest of the
 * cockpit. The operator types their full name; a live cursive preview renders it; "Apply signature"
 * rasterizes that to a PNG data URL — the same `draft.signature` contract the execution block shows
 * via <img>. Performative/cosmetic: never sent to the backend (the real originator counter-signature
 * is Documenso's).
 *
 * Cursive via the system script face (Snell Roundhand on macOS, then Brush/Segoe Script) so it reads
 * as a real signature on the dark surface, accent-inked to rhyme with the pre-signed originator mark.
 */
import { X } from "lucide-react";
import { useState } from "react";

const INK = "#7b9fd4"; // text.accent
const SIG_FAMILY = '"Snell Roundhand", "Brush Script MT", "Segoe Script", cursive';

export function SignatureOverlay({
  onApply,
  onCancel,
}: {
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  function apply() {
    if (!trimmed) return;
    onApply(renderSignature(trimmed));
  }

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
          Type your full name — it renders as your originator mark on the mandate.
        </p>

        {/* Live stylized preview */}
        <div className="flex h-[120px] w-full items-center justify-center overflow-hidden border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-5">
          {trimmed ? (
            <span
              className="max-w-full truncate"
              style={{
                fontFamily: SIG_FAMILY,
                fontStyle: "italic",
                fontSize: "2.75rem",
                lineHeight: 1.1,
                color: INK,
              }}
            >
              {trimmed}
            </span>
          ) : (
            <span className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
              Your signature
            </span>
          )}
        </div>

        {/* Name field */}
        <input
          // biome-ignore lint/a11y/noAutofocus: a signing modal should land focus on the field.
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
          placeholder="James Whitfield"
          className="mt-3 w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
        />

        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={apply}
            disabled={!trimmed}
            className="border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-6 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.16em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40"
          >
            Apply signature
          </button>
        </div>
      </div>
    </div>
  );
}

/** Rasterize the typed name in the cursive face to a transparent PNG data URL (4:1 box, DPR-crisp,
 *  font shrunk to fit width). Matches the `draft.signature` contract rendered via <img>. */
function renderSignature(name: string): string {
  const dpr = window.devicePixelRatio || 1;
  const W = 480;
  const H = 120;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.scale(dpr, dpr);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Shrink the face until the name fits the box width.
  let size = 60;
  const maxW = W - 32;
  ctx.font = `italic ${size}px ${SIG_FAMILY}`;
  while (ctx.measureText(name).width > maxW && size > 18) {
    size -= 2;
    ctx.font = `italic ${size}px ${SIG_FAMILY}`;
  }
  ctx.fillText(name, W / 2, H / 2 + size * 0.06);
  return canvas.toDataURL("image/png");
}
