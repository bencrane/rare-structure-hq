/**
 * Visual primitives — the surface sub-layer.
 *
 * Text, Card, Badge, Button. These carry type treatment, brand color, and
 * surface styling. They are kept distinct from the LAYOUT primitives
 * (`layout.tsx`): a visual primitive never owns page geometry (no `max-w-*`, no
 * route-level padding), and a layout primitive never carries a brand color.
 *
 * Every color/size prop is a token NAME mapped through `utils.ts` — no visual
 * primitive accepts a raw hex value or an arbitrary type size.
 */

import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, forwardRef } from "react";
import { type FontSizeProp, type TextColorProp, cx, fontSize, textColor } from "./utils";

// ────────────── Text — the typographic primitive ──────────────

export interface TextProps extends Omit<HTMLAttributes<HTMLElement>, "color"> {
  /** Type-scale token. */
  size?: FontSizeProp;
  /** Semantic text-color role. */
  color?: TextColorProp;
  /** Rendered element. */
  as?: "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "label";
  /** Render with the mono label treatment (uppercase + tracking). */
  mono?: boolean;
  /**
   * Font face. `display` = the brand display face (Geist Mono) for headings and
   * brand lockups; `mono` = mono; `sans` = body. Omitted → inherits the page
   * sans face, or mono when the `mono` shorthand is set. Additive: existing
   * callers are unaffected.
   */
  face?: "sans" | "mono" | "display";
  children?: ReactNode;
}

const faceClass = { sans: "font-sans", mono: "font-mono", display: "font-display" } as const;

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { size = "body-md", color = "default", as: As = "p", mono, face, className, children, ...rest },
  ref,
) {
  // `face` wins; `mono` is the eyebrow shorthand (mono family + uppercase).
  const family = face ? faceClass[face] : mono ? "font-mono" : undefined;
  return (
    <As
      // forwardRef on a polymorphic intrinsic — ref type is widened to HTMLElement.
      ref={ref as React.Ref<never>}
      className={cx(fontSize[size], textColor[color], family, mono && "uppercase", className)}
      {...rest}
    >
      {children}
    </As>
  );
});

// ────────────── Card — the surface primitive ──────────────

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised";
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", interactive, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        "rounded-xl border",
        variant === "raised"
          ? "bg-[color:var(--color-surface-raised)]"
          : "bg-[color:var(--color-surface-raised-translucent)] backdrop-blur-sm",
        "border-[color:var(--color-border-subtle)]",
        interactive && "transition-colors hover:border-[color:var(--color-border-default)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

// ────────────── Badge — the mono-label primitive ──────────────

export type BadgeTone = "default" | "accent" | "info" | "success" | "warn" | "error";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const badgeTones: Record<BadgeTone, string> = {
  default:
    "border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] text-[color:var(--color-text-default)]",
  accent:
    "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]",
  info: "border-[color:rgba(96,165,250,0.4)] bg-[color:rgba(96,165,250,0.12)] text-[color:var(--color-state-info)]",
  success:
    "border-[color:var(--color-border-accent)] bg-[color:var(--color-state-successSoft)] text-[color:var(--color-state-success)]",
  warn: "border-[color:rgba(251,191,36,0.4)] bg-[color:var(--color-state-warnSoft)] text-[color:var(--color-state-warn)]",
  error:
    "border-[color:var(--color-state-error)] bg-[color:var(--color-state-errorSoft)] text-[color:var(--color-state-error)]",
};

export function Badge({ tone = "default", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-none border px-2 py-0.5",
        "font-mono text-mono-xs uppercase",
        badgeTones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

// ────────────── Button — the action primitive ──────────────

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-accent-primary)] text-[color:var(--color-text-onAccent)] hover:bg-[color:var(--color-accent-primaryHover)] active:bg-[color:var(--color-accent-primaryActive)]",
  secondary:
    "border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] text-[color:var(--color-text-default)] hover:border-[color:var(--color-border-strong)]",
  ghost:
    "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-raised)] hover:text-[color:var(--color-text-default)]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-body-sm",
  md: "h-10 px-4 text-body-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", type = "button", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-none font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent-primary)]",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
