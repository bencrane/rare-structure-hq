/**
 * MapView — the cockpit's home surface: the Catalyst Origination Terminal.
 *
 * The base layer is a real cartographic US (state geometry from `us-geo.ts`)
 * with a faint graticule and a scatter field — the ambient firehose of the
 * market. When the operator runs a map-query command, the matching companies
 * light up the map as clickable dots, swept in west-to-east. Clicking a dot
 * opens that company's profile.
 *
 * Token CSS variables fill every SVG stroke/fill — utility classes do not
 * reach into SVG.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { CommandPill, TerminalHeader } from "./components/TerminalChrome";
import { industryLabel } from "./data";
import { fmtUsd } from "./format";
import type { Company, MapQuery } from "./types";
import { GEO_SCATTER_BANDS, GEO_VIEW, STATE_PATHS } from "./us-geo";

export function MapView({
  query,
  results,
  selectedId,
  onSelectCompany,
  onInvokeCommand,
}: {
  query: MapQuery | null;
  results: Company[];
  selectedId: string | null;
  onSelectCompany: (company: Company) => void;
  onInvokeCommand: () => void;
}) {
  const reduced = !!useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const queryKey = query ? `${query.industry}:${query.minAward}` : "none";

  return (
    <motion.div
      className="relative flex h-screen w-full flex-col overflow-hidden"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Ambient depth — faint accent glow + terminal scanlines. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 64% 56% at 50% 48%, var(--color-accent-soft), transparent 74%)",
        }}
      />
      <div className="rs-scanlines pointer-events-none absolute inset-0 opacity-60" />

      <TerminalHeader reduced={reduced} />

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-6">
        <svg
          viewBox={`0 0 ${GEO_VIEW.w} ${GEO_VIEW.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full max-w-[1480px]"
          role="img"
          aria-label="Map of companies across the United States"
        >
          <defs>
            <radialGradient id="rs-map-landglow" cx="50%" cy="48%" r="62%">
              <stop offset="0%" stopColor="var(--color-surface-raised)" />
              <stop offset="100%" stopColor="var(--color-surface-sunken)" />
            </radialGradient>
            <filter id="rs-map-hotglow" x="-160%" y="-160%" width="420%" height="420%">
              <feGaussianBlur stdDeviation="3.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <Graticule reduced={reduced} />

          {/* ── Cartographic base: real US geometry ────────────────── */}
          <motion.g
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {STATE_PATHS.map((s) => (
              <path key={`fill-${s.id}`} d={s.d} fill="url(#rs-map-landglow)" />
            ))}
            {STATE_PATHS.map((s, i) => (
              <motion.path
                key={`line-${s.id}`}
                d={s.d}
                fill="none"
                stroke="var(--color-border-default)"
                strokeWidth={0.7}
                strokeLinejoin="round"
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  duration: reduced ? 0 : 0.9,
                  delay: reduced ? 0 : 0.1 + (i % 12) * 0.018,
                  ease: "easeInOut",
                }}
              />
            ))}
            {STATE_PATHS.map((s) => (
              <path
                key={`edge-${s.id}`}
                d={s.d}
                fill="none"
                stroke="var(--color-text-muted)"
                strokeOpacity={0.28}
                strokeWidth={0.5}
                strokeLinejoin="round"
              />
            ))}
          </motion.g>

          {/* ── Scatter field: the ambient market volume ────────────── */}
          {GEO_SCATTER_BANDS.map((band, b) => (
            <motion.g
              key={`band-${band[0]?.id ?? b}`}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: reduced ? 0 : 0.5 + b * 0.12 }}
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

          {/* ── The query result: companies light up the map ────────── */}
          {query && !reduced && <ScanSweep key={`sweep-${queryKey}`} />}
          <g key={`dots-${queryKey}`}>
            {results.map((company) => (
              <CompanyDot
                key={company.id}
                company={company}
                reduced={reduced}
                selected={company.id === selectedId}
                showLabel={company.id === hovered || company.id === selectedId}
                onHover={() => setHovered(company.id)}
                onLeave={() => setHovered((h) => (h === company.id ? null : h))}
                onSelect={() => onSelectCompany(company)}
              />
            ))}
          </g>
        </svg>

        <InsetLabels reduced={reduced} />

        {query && <ResultBanner query={query} results={results} reduced={reduced} />}
      </div>

      <CommandPill reduced={reduced} idle={!query} onClick={onInvokeCommand} />
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Graticule — a faint lat/lon grid behind the map, terminal texture.
// ───────────────────────────────────────────────────────────────────

function Graticule({ reduced }: { reduced: boolean }) {
  const cols = 9;
  const rows = 5;
  const lines: React.ReactNode[] = [];
  for (let c = 1; c < cols; c++) {
    const x = (GEO_VIEW.w / cols) * c;
    lines.push(
      <line
        key={`gv-${c}`}
        x1={x}
        y1={0}
        x2={x}
        y2={GEO_VIEW.h}
        stroke="var(--color-border-subtle)"
        strokeWidth={0.5}
      />,
    );
  }
  for (let r = 1; r < rows; r++) {
    const y = (GEO_VIEW.h / rows) * r;
    lines.push(
      <line
        key={`gh-${r}`}
        x1={0}
        y1={y}
        x2={GEO_VIEW.w}
        y2={y}
        stroke="var(--color-border-subtle)"
        strokeWidth={0.5}
      />,
    );
  }
  return (
    <motion.g
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 0.5 }}
      transition={{ duration: 0.8 }}
    >
      {lines}
    </motion.g>
  );
}

// ───────────────────────────────────────────────────────────────────
// Scan sweep — a one-pass accent line when a query lights up the map.
// ───────────────────────────────────────────────────────────────────

function ScanSweep() {
  return (
    <motion.rect
      y={0}
      width={2}
      height={GEO_VIEW.h}
      fill="var(--color-accent-primary)"
      initial={{ x: 0, opacity: 0 }}
      animate={{ x: GEO_VIEW.w, opacity: [0, 0.75, 0.75, 0] }}
      transition={{ duration: 0.95, ease: "easeInOut" }}
    />
  );
}

// ───────────────────────────────────────────────────────────────────
// Inset labels — name the AK / HI insets so the map reads as deliberate.
// ───────────────────────────────────────────────────────────────────

function InsetLabels({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute bottom-6 left-6 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase sm:bottom-8 sm:left-10"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 0.7 }}
      transition={{ duration: 0.5, delay: reduced ? 0 : 1.4 }}
    >
      AK · HI shown as insets
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Result banner — the query readout, floating below the header.
// ───────────────────────────────────────────────────────────────────

function ResultBanner({
  query,
  results,
  reduced,
}: {
  query: MapQuery;
  results: Company[];
  reduced: boolean;
}) {
  const total = results.reduce((sum, c) => sum + c.totalAwarded, 0);
  return (
    <motion.div
      className="-translate-x-1/2 absolute top-2 left-1/2 z-10"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reduced ? 0 : 0.2 }}
    >
      <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
        <BannerCell label="Vertical" value={industryLabel(query.industry)} accent />
        <BannerCell label="Companies" value={String(results.length)} />
        <BannerCell label="Federal awards" value={fmtUsd(total)} />
      </div>
    </motion.div>
  );
}

function BannerCell({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border-[color:var(--color-border-subtle)] border-r px-5 py-2.5 last:border-r-0">
      <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
        {label}
      </div>
      <div
        className={`mt-0.5 font-display font-semibold text-body-sm uppercase tracking-tight tabular-nums ${
          accent
            ? "text-[color:var(--color-text-accent)]"
            : "text-[color:var(--color-text-primary)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Company dot — a clickable plotted company; reveals a label on hover.
// ───────────────────────────────────────────────────────────────────

function CompanyDot({
  company,
  reduced,
  selected,
  showLabel,
  onHover,
  onLeave,
  onSelect,
}: {
  company: Company;
  reduced: boolean;
  selected: boolean;
  showLabel: boolean;
  onHover: () => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  const { x, y } = company;
  const enterDelay = reduced ? 0 : (x / GEO_VIEW.w) * 0.5;

  return (
    // biome-ignore lint/a11y/useSemanticElements: this is an SVG <g>, not HTML — it cannot be a <button>; role="button" + tabIndex + onKeyDown is the keyboard-accessible pattern for an interactive SVG group.
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`Company — ${company.name}`}
      initial={reduced ? false : { opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: enterDelay, ease: "easeOut" }}
      style={{ cursor: "pointer", transformOrigin: `${x}px ${y}px` }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
    >
      {/* Pulse ring — signals "clickable / live". */}
      {!reduced && (
        <motion.circle
          cx={x}
          cy={y}
          r={5}
          fill="none"
          stroke="var(--color-accent-primary)"
          strokeWidth={1.2}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0.5, 0, 0.5], scale: [1, 2.8, 1] }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeOut",
            delay: enterDelay + 0.3,
          }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}

      <circle
        cx={x}
        cy={y}
        r={selected ? 7 : 5}
        fill={selected ? "var(--color-accent-primaryHover)" : "var(--color-accent-primary)"}
        filter={showLabel ? "url(#rs-map-hotglow)" : undefined}
        style={{ transition: "r 0.18s ease" }}
      />

      {/* Invisible larger hit target. */}
      <circle cx={x} cy={y} r={16} fill="transparent" />

      {showLabel && <DotLabel company={company} />}
    </motion.g>
  );
}

function DotLabel({ company }: { company: Company }) {
  const sub = `${company.city}, ${company.state}`;
  const w = Math.max(company.name.length, sub.length) * 6.1 + 24;
  const h = 38;
  const below = company.y < 96;
  const top = below ? company.y + 14 : company.y - 14 - h;
  const x = Math.min(Math.max(company.x - w / 2, 6), GEO_VIEW.w - w - 6);

  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={x}
        y={top}
        width={w}
        height={h}
        fill="var(--color-surface-raised)"
        stroke="var(--color-accent-primary)"
        strokeWidth={1}
      />
      <rect x={x} y={top} width={3} height={h} fill="var(--color-accent-primary)" />
      <text
        x={x + 13}
        y={top + 16}
        style={{
          fontSize: 12,
          fontWeight: 600,
          fill: "var(--color-text-primary)",
          fontFamily: "var(--font-display)",
        }}
      >
        {company.name}
      </text>
      <text
        x={x + 13}
        y={top + 29}
        style={{
          fontSize: 9.5,
          fill: "var(--color-text-muted)",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {sub}
      </text>
    </g>
  );
}
