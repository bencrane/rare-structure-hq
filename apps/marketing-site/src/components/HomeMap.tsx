import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { GEO_SCATTER_BANDS, GEO_VIEW, STATE_PATHS } from "@/data/us-geo";

const DATA_SOURCES = [
  "USAspending · Federal Contracts",
  "SBA 7(a) / 504 · Borrower Lending",
  "UCC-1 Filings · Commercial Liens",
  "SEC Form ADV · Registered Advisors",
  "SAM.gov · Federal Contractor Registry",
  "FMCSA · Motor Carrier Census",
  "GLEIF · Legal Entity Identifiers",
  "CA / FL Secretary of State · Corporate Filings",
  "SEC EDGAR · Material Events",
  "HMDA · Mortgage Disclosure",
  "DOL Form 5500 · ERISA Plans",
  "USPTO · Trademark Filings",
] as const;

function Graticule() {
  const cols = 9;
  const rows = 5;
  const lines: React.ReactNode[] = [];
  for (let c = 1; c < cols; c++) {
    const x = (GEO_VIEW.w / cols) * c;
    lines.push(
      <line key={`gv-${c}`} x1={x} y1={0} x2={x} y2={GEO_VIEW.h} stroke="var(--color-border-subtle)" strokeWidth={0.4} />,
    );
  }
  for (let r = 1; r < rows; r++) {
    const y = (GEO_VIEW.h / rows) * r;
    lines.push(
      <line key={`gh-${r}`} x1={0} y1={y} x2={GEO_VIEW.w} y2={y} stroke="var(--color-border-subtle)" strokeWidth={0.4} />,
    );
  }
  return <g opacity={0.3}>{lines}</g>;
}

function DataSourceCycle() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % DATA_SOURCES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-5 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          className="block font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
        >
          {DATA_SOURCES[idx]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function HomeMap() {
  const reduced = !!useReducedMotion();

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 52% at 50% 50%, var(--color-accent-soft), transparent 72%)",
        }}
      />
      <div className="rs-scanlines pointer-events-none absolute inset-0 opacity-30" />

      <svg
        viewBox={`0 0 ${GEO_VIEW.w} ${GEO_VIEW.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full max-w-[1600px] px-4 opacity-60"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="rs-home-landglow" cx="50%" cy="48%" r="62%">
            <stop offset="0%" stopColor="var(--color-surface-raised)" />
            <stop offset="100%" stopColor="var(--color-surface-sunken)" />
          </radialGradient>
        </defs>

        <Graticule />

        {/* State outlines */}
        <motion.g
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        >
          {STATE_PATHS.map((s) => (
            <path key={`fill-${s.id}`} d={s.d} fill="url(#rs-home-landglow)" />
          ))}
          {STATE_PATHS.map((s, i) => (
            <motion.path
              key={`line-${s.id}`}
              d={s.d}
              fill="none"
              stroke="var(--color-border-default)"
              strokeWidth={0.6}
              strokeLinejoin="round"
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{
                duration: reduced ? 0 : 1.2,
                delay: reduced ? 0 : 0.2 + (i % 12) * 0.02,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.g>

        {/* Scatter field — the data volume cue */}
        {GEO_SCATTER_BANDS.map((band, b) => (
          <motion.g
            key={`band-${band[0]?.id ?? b}`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: reduced ? 0 : 0.8 + b * 0.15 }}
          >
            {band.map((d) => (
              <circle
                key={d.id}
                cx={d.x}
                cy={d.y}
                r={d.r}
                fill="var(--color-text-subtle)"
                fillOpacity={d.opacity * 0.7}
              />
            ))}
          </motion.g>
        ))}
      </svg>

      {/* Vignette to ground the wordmark */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 48% 44% at 50% 48%, transparent 32%, var(--color-surface-base) 100%)",
        }}
      />
    </div>
  );
}

export { DataSourceCycle };
