import { motion, useReducedMotion } from "framer-motion";
import type { BriefingPhase, ContractPoint } from "@/data/briefing-data";
import { FOCUS_STATE_IDS, CA_CONTRACT_POINTS } from "@/data/briefing-data";
import { GEO_SCATTER_BANDS, GEO_VIEW, STATE_PATHS } from "@/data/us-geo";

interface BriefingMapProps {
  phase: BriefingPhase;
}

function getStateStyle(
  stateId: string,
  phase: BriefingPhase,
): { fillOpacity: number; strokeOpacity: number; stroke: string } {
  const isFocus = FOCUS_STATE_IDS.has(stateId);
  const isCA = stateId === "06";

  switch (phase) {
    case "national":
      return { fillOpacity: 0.35, strokeOpacity: 0.7, stroke: "var(--color-border-default)" };
    case "state-focus":
      return isFocus
        ? { fillOpacity: 0.55, strokeOpacity: 1, stroke: "var(--color-accent-primary)" }
        : { fillOpacity: 0.06, strokeOpacity: 0.2, stroke: "var(--color-border-subtle)" };
    case "sector-drill":
    case "cross-ref":
      return isCA
        ? { fillOpacity: 0.55, strokeOpacity: 1, stroke: "var(--color-accent-primary)" }
        : { fillOpacity: 0.04, strokeOpacity: 0.12, stroke: "var(--color-border-subtle)" };
    case "cta":
      return { fillOpacity: 0.03, strokeOpacity: 0.08, stroke: "var(--color-border-subtle)" };
  }
}

function Graticule({ reduced }: { reduced: boolean }) {
  const cols = 9;
  const rows = 5;
  const lines: React.ReactNode[] = [];
  for (let c = 1; c < cols; c++) {
    const x = (GEO_VIEW.w / cols) * c;
    lines.push(
      <line key={`gv-${c}`} x1={x} y1={0} x2={x} y2={GEO_VIEW.h} stroke="var(--color-border-subtle)" strokeWidth={0.5} />,
    );
  }
  for (let r = 1; r < rows; r++) {
    const y = (GEO_VIEW.h / rows) * r;
    lines.push(
      <line key={`gh-${r}`} x1={0} y1={y} x2={GEO_VIEW.w} y2={y} stroke="var(--color-border-subtle)" strokeWidth={0.5} />,
    );
  }
  return (
    <motion.g
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 0.4 }}
      transition={{ duration: 0.8 }}
    >
      {lines}
    </motion.g>
  );
}

function ContractDots({
  phase,
  reduced,
}: {
  phase: BriefingPhase;
  reduced: boolean;
}) {
  const showDots = phase === "sector-drill" || phase === "cross-ref";
  if (!showDots) return null;

  return (
    <g>
      {CA_CONTRACT_POINTS.map((pt: ContractPoint, i: number) => {
        const isUCC = pt.hasUCC && phase === "cross-ref";
        const fill = isUCC ? "var(--color-accent-primary)" : "var(--color-text-muted)";
        const r = 2.5 + (pt.value / 8) * 2;
        return (
          <g key={pt.id}>
            {isUCC && !reduced && (
              <motion.circle
                cx={pt.x}
                cy={pt.y}
                r={r}
                fill="none"
                stroke="var(--color-accent-primary)"
                strokeWidth={1}
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: [0.5, 0, 0.5], scale: [1, 2.8, 1] }}
                transition={{
                  duration: 2.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeOut",
                  delay: i * 0.12,
                }}
                style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
              />
            )}
            <motion.circle
              cx={pt.x}
              cy={pt.y}
              r={r}
              fill={fill}
              fillOpacity={isUCC ? 0.9 : 0.5}
              filter={isUCC ? "url(#rs-briefing-glow)" : undefined}
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: reduced ? 0 : 0.05 + i * 0.04,
              }}
            />
          </g>
        );
      })}
    </g>
  );
}

export function BriefingMap({ phase }: BriefingMapProps) {
  const reduced = !!useReducedMotion();
  const mapOpacity = phase === "cta" ? 0.2 : 1;

  return (
    <motion.div
      className="flex h-full w-full items-center justify-center"
      animate={{ opacity: mapOpacity }}
      transition={{ duration: 0.8 }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 64% 56% at 50% 48%, var(--color-accent-soft), transparent 74%)",
        }}
      />
      <div className="rs-scanlines pointer-events-none absolute inset-0 opacity-40" />

      <svg
        viewBox={`0 0 ${GEO_VIEW.w} ${GEO_VIEW.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full max-w-[1480px] px-6"
        role="img"
        aria-label="US federal contract activity map"
      >
        <defs>
          <radialGradient id="rs-briefing-landglow" cx="50%" cy="48%" r="62%">
            <stop offset="0%" stopColor="var(--color-surface-raised)" />
            <stop offset="100%" stopColor="var(--color-surface-sunken)" />
          </radialGradient>
          <filter id="rs-briefing-glow" x="-160%" y="-160%" width="420%" height="420%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <Graticule reduced={reduced} />

        {/* State outlines — phase-driven fill + stroke. */}
        <g>
          {STATE_PATHS.map((s) => (
            <path key={`fill-${s.id}`} d={s.d} fill="url(#rs-briefing-landglow)" />
          ))}
          {STATE_PATHS.map((s) => {
            const style = getStateStyle(s.id, phase);
            return (
              <motion.path
                key={`line-${s.id}`}
                d={s.d}
                fill="none"
                animate={{
                  stroke: style.stroke,
                  strokeOpacity: style.strokeOpacity,
                  fillOpacity: style.fillOpacity,
                }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                strokeWidth={0.7}
                strokeLinejoin="round"
              />
            );
          })}
          {/* Faint outer edge. */}
          {STATE_PATHS.map((s) => {
            const style = getStateStyle(s.id, phase);
            return (
              <motion.path
                key={`edge-${s.id}`}
                d={s.d}
                fill="var(--color-surface-raised)"
                animate={{ fillOpacity: style.fillOpacity * 0.8 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                stroke="none"
              />
            );
          })}
        </g>

        {/* Scatter field — national volume cue. */}
        {GEO_SCATTER_BANDS.map((band, b) => (
          <motion.g
            key={`band-${band[0]?.id ?? b}`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: phase === "cta" ? 0.1 : 1 }}
            transition={{ duration: 0.5, delay: reduced ? 0 : 0.3 + b * 0.12 }}
          >
            {band.map((d) => (
              <circle
                key={d.id}
                cx={d.x}
                cy={d.y}
                r={d.r}
                fill="var(--color-text-subtle)"
                fillOpacity={d.opacity}
              />
            ))}
          </motion.g>
        ))}

        {/* Contract dots — appear in sector-drill and cross-ref. */}
        <ContractDots phase={phase} reduced={reduced} />
      </svg>
    </motion.div>
  );
}
