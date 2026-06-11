import { cx } from "../lib/cx";

type DotTone = "success" | "accent" | "error" | "subtle";

interface StatusDotProps {
  tone?: DotTone;
  className?: string;
}

const dotTone: Record<DotTone, string> = {
  success: "bg-[color:var(--color-state-success)]",
  accent: "bg-[color:var(--color-text-accent)]",
  error: "bg-[color:var(--color-state-error)]",
  subtle: "bg-[color:var(--color-text-subtle)]",
};

/** Small static square status indicator. */
export function StatusDot({ tone = "success", className }: StatusDotProps) {
  return (
    <span
      className={cx("inline-block h-1.5 w-1.5 shrink-0", dotTone[tone], className)}
      aria-hidden="true"
    />
  );
}
