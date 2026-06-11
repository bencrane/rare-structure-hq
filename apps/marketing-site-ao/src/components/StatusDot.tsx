import { cx } from "../lib/cx";

type DotTone = "success" | "accent" | "error" | "subtle";

interface StatusDotProps {
  tone?: DotTone;
  pulse?: boolean;
  className?: string;
}

const dotTone: Record<DotTone, string> = {
  success: "bg-[color:var(--color-state-success)]",
  accent: "bg-[color:var(--color-text-accent)]",
  error: "bg-[color:var(--color-state-error)]",
  subtle: "bg-[color:var(--color-text-subtle)]",
};

/**
 * Small square status indicator. `pulse` opacity-pulses; the pulse is stilled
 * under prefers-reduced-motion via the `.ao-live-dot` CSS media query.
 */
export function StatusDot({ tone = "success", pulse = false, className }: StatusDotProps) {
  return (
    <span
      className={cx(
        "inline-block h-1.5 w-1.5 shrink-0",
        dotTone[tone],
        pulse && "ao-live-dot",
        className,
      )}
      aria-hidden="true"
    />
  );
}
