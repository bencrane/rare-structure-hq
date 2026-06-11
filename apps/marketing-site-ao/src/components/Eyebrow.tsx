import { cx } from "../lib/cx";

type EyebrowTone = "subtle" | "accent" | "success" | "error";

interface EyebrowProps {
  label: string;
  tone?: EyebrowTone;
  className?: string;
}

const textTone: Record<EyebrowTone, string> = {
  subtle: "text-[color:var(--color-text-subtle)]",
  accent: "text-[color:var(--color-text-accent)]",
  success: "text-[color:var(--color-text-default)]",
  error: "text-[color:var(--color-state-error)]",
};

const squareTone: Record<EyebrowTone, string> = {
  subtle: "bg-[color:var(--color-text-subtle)]",
  accent: "bg-[color:var(--color-text-accent)]",
  success: "bg-[color:var(--color-state-success)]",
  error: "bg-[color:var(--color-state-error)]",
};

/** Mono "▪ LABEL" eyebrow with a small leading square, top-aligned for wraps. */
export function Eyebrow({ label, tone = "accent", className }: EyebrowProps) {
  return (
    <span
      className={cx(
        "flex items-start gap-2 font-mono text-[0.625rem] uppercase leading-[1.6] tracking-[0.22em]",
        textTone[tone],
        className,
      )}
    >
      <span
        className={cx("mt-[0.35em] inline-block h-1.5 w-1.5 shrink-0", squareTone[tone])}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
