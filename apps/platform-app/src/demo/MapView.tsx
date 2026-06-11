/**
 * MapView — the cockpit's home surface: the Catalyst Origination Terminal.
 *
 * The base layer is a real cartographic US (state geometry from `us-geo.ts`)
 * with a faint graticule and a scatter field — the ambient firehose of the
 * market. When the operator runs a map-query command, the matching companies
 * light up the map as clickable dots, swept in west-to-east.
 *
 * A single click on a company dot opens an on-map callout (a compact intel
 * card); a double click — or a click on the callout — opens the full profile
 * drawer.
 *
 * Token CSS variables fill every SVG stroke/fill — utility classes do not
 * reach into SVG.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CommandPill, TerminalHeader } from "./components/TerminalChrome";
import { industryLabel } from "./data";
import { fmtUsd } from "./format";
import type { Company, MapQuery } from "./types";
import { GEO_SCATTER_BANDS, GEO_VIEW, STATE_PATHS } from "./us-geo";

// AK and HI are baked into the Albers-USA composite oversized and crowding the
// lower-48 (AK's panhandle reaches Texas; HI sits on top of it). Re-place them
// as small lower-left insets with a render transform (scale + translate) rather
// than rewriting the path coordinates.
const INSET_IDS = new Set(["02", "15"]);
const INSET_TRANSFORM: Record<string, string> = {
  // Both insets share one scale (0.65) so AK:HI keep their true relative size.
  // The SW states bottom out at y~440, leaving clean room below for full-size
  // insets — Alaska ~1.4x California, Hawaii snug to its right.
  "02": "translate(-3.1 193.4) scale(0.65)", // Alaska — bottom-left, below the SW
  "15": "translate(-15.4 176.7) scale(0.65)", // Hawaii — nestled just below-right of AK
};
const CONTINENTAL = STATE_PATHS.filter((s) => !INSET_IDS.has(s.id));
const INSETS = STATE_PATHS.filter((s) => INSET_IDS.has(s.id));

// A company that carries map coordinates — the only kind the dot/callout layer plots.
// (Live federal entities have no x/y until the geo layer lands; they are filtered out.)
type PlottedCompany = Company & { x: number; y: number };

export function MapView({
  query,
  results,
  loading = false,
  error = null,
  total,
  profileAsOfDate = null,
  selectedId,
  onSelectCompany,
  onInvokeCommand,
  onDismiss,
  embedded = false,
}: {
  query: MapQuery | null;
  results: Company[];
  loading?: boolean;
  error?: string | null;
  total?: number;
  profileAsOfDate?: string | null;
  selectedId: string | null;
  onSelectCompany: (company: Company) => void;
  onInvokeCommand: () => void;
  onDismiss?: () => void;
  embedded?: boolean;
}) {
  const reduced = !!useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const [callouts, setCallouts] = useState<ReadonlySet<string>>(() => new Set());
  const queryKey = query
    ? `${query.industry ?? query.naicsPrefix ?? "all"}:${query.minAward}`
    : "none";

  // GEO DEFERRED. Live federal entities carry no x/y (the real lat/long coordinate layer
  // is a later pass — no geocode this cycle). Only plot dots for results that DO carry
  // coordinates; everything else is served through the result banner + list, never as a
  // crashing dot. Today the live universe has no coords, so this is empty and the dot
  // layer is dormant — but the moment coordinates land, the same code lights them up.
  const plottable = results.filter(
    (c): c is Company & { x: number; y: number } => c.x != null && c.y != null,
  );

  // A new query resets the open callouts — the prior result set is gone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on queryKey, not the setter.
  useEffect(() => {
    setCallouts(new Set());
  }, [queryKey]);

  function toggleCallout(id: string) {
    setCallouts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

      <TerminalHeader reduced={reduced} showBrand={!embedded} />

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-6">
        {/* Off-panel click dismisses the result overlay (map only). The dot layer is
            dormant while geo is deferred, so a full-area backdrop is safe; when real
            coordinates land and dots return, move dismissal to the SVG background +
            stopPropagation on the dots. The result panel sits above this at z-10. */}
        {query && onDismiss ? (
          <button
            type="button"
            aria-label="Dismiss results"
            onClick={onDismiss}
            className="absolute inset-0 z-0 cursor-default"
          />
        ) : null}
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
            {CONTINENTAL.map((s) => (
              <path key={`fill-${s.id}`} d={s.d} fill="url(#rs-map-landglow)" />
            ))}
            {CONTINENTAL.map((s, i) => (
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
            {CONTINENTAL.map((s) => (
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

            {/* AK / HI insets — re-placed small in the lower-left. */}
            {INSETS.map((s) => (
              <g key={`inset-${s.id}`} transform={INSET_TRANSFORM[s.id]}>
                <path d={s.d} fill="url(#rs-map-landglow)" />
                <path
                  d={s.d}
                  fill="none"
                  stroke="var(--color-border-default)"
                  strokeWidth={0.7}
                  strokeLinejoin="round"
                />
                <path
                  d={s.d}
                  fill="none"
                  stroke="var(--color-text-muted)"
                  strokeOpacity={0.28}
                  strokeWidth={0.5}
                  strokeLinejoin="round"
                />
              </g>
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
          {/* Only PLOTTABLE results (those carrying x/y) render as dots. Live federal
              entities have no coordinates yet (geo deferred), so this layer stays dormant
              for them and the result banner carries the readout instead. */}
          {query && !reduced && plottable.length > 0 && <ScanSweep key={`sweep-${queryKey}`} />}
          <g key={`dots-${queryKey}`}>
            {plottable.map((company) => (
              <CompanyDot
                key={company.id}
                company={company}
                reduced={reduced}
                lit={
                  company.id === hovered || callouts.has(company.id) || company.id === selectedId
                }
                calloutOpen={callouts.has(company.id)}
                onHover={() => setHovered(company.id)}
                onLeave={() => setHovered((h) => (h === company.id ? null : h))}
                onToggleCallout={() => toggleCallout(company.id)}
                onOpenProfile={() => onSelectCompany(company)}
              />
            ))}
          </g>
        </svg>

        {query && (
          <ResultBanner
            query={query}
            results={results}
            total={total ?? results.length}
            loading={loading}
            error={error}
            plottedCount={plottable.length}
            profileAsOfDate={profileAsOfDate}
            onSelectCompany={onSelectCompany}
            reduced={reduced}
          />
        )}
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
// Result banner — the query readout, floating below the header.
// ───────────────────────────────────────────────────────────────────

function ResultBanner({
  query,
  results,
  total,
  loading,
  error,
  plottedCount,
  profileAsOfDate,
  onSelectCompany,
  reduced,
}: {
  query: MapQuery;
  results: Company[];
  total: number;
  loading: boolean;
  error: string | null;
  plottedCount: number;
  profileAsOfDate: string | null;
  onSelectCompany: (company: Company) => void;
  reduced: boolean;
}) {
  const awards = results.reduce((sum, c) => sum + c.totalAwarded, 0);
  // Geo is deferred, so nothing plots as a dot — surface the live result set as a
  // compact ranked list under the banner so the operator can still read + open them.
  const geoPending = plottedCount === 0 && results.length > 0;

  return (
    <motion.div
      className="-translate-x-1/2 absolute top-2 left-1/2 z-10 flex flex-col items-center gap-1.5"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reduced ? 0 : 0.2 }}
    >
      <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
        <BannerCell label="Vertical" value={industryLabel(query.industry)} accent />
        <BannerCell
          label="Companies"
          value={loading ? "…" : error ? "—" : total.toLocaleString("en-US")}
        />
        <BannerCell label="Federal awards" value={loading ? "…" : error ? "—" : fmtUsd(awards)} />
        {profileAsOfDate && <BannerCell label="Data as of" value={profileAsOfDate} />}
      </div>

      {error && (
        <div className="border border-[color:var(--color-status-danger,var(--color-border-strong))] bg-[color:var(--color-surface-raised)] px-3 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
          Live federal feed unavailable
        </div>
      )}

      {geoPending && <GeoPendingList results={results} onSelectCompany={onSelectCompany} />}
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Geo-pending list — until the coordinate layer lands, the live result set
// has no map dots, so the top matches surface as a compact, openable ranked
// list. This is the documented "geo pending" state, NOT state-centroid plotting.
// ───────────────────────────────────────────────────────────────────

const GEO_LIST_MAX = 12;

function GeoPendingList({
  results,
  onSelectCompany,
}: {
  results: Company[];
  onSelectCompany: (company: Company) => void;
}) {
  const top = results.slice(0, GEO_LIST_MAX);
  return (
    <div className="max-h-[58vh] w-[min(92vw,560px)] overflow-y-auto border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
      <div className="flex items-center justify-between border-[color:var(--color-border-subtle)] border-b px-3 py-1.5">
        <span className="font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.16em]">
          Top matches
        </span>
        <span className="font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
          map pins pending geo-resolution
        </span>
      </div>
      <ul>
        {top.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelectCompany(c)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[color:var(--color-surface-base)]"
            >
              <span className="w-5 shrink-0 text-right font-mono text-[color:var(--color-text-subtle)] text-mono-xs tabular-nums">
                {i + 1}
              </span>
              <span className="flex-1 truncate text-[color:var(--color-text-primary)] text-body-sm">
                {c.name}
                {c.state ? (
                  <span className="ml-2 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                    {c.city ? `${c.city}, ` : ""}
                    {c.state}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-display font-semibold text-[color:var(--color-text-accent)] text-body-sm tabular-nums">
                {fmtUsd(c.totalAwarded)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
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
// Company dot — a clickable plotted company. Single click toggles the
// on-map callout; double click opens the full profile drawer.
// ───────────────────────────────────────────────────────────────────

function CompanyDot({
  company,
  reduced,
  lit,
  calloutOpen,
  onHover,
  onLeave,
  onToggleCallout,
  onOpenProfile,
}: {
  company: PlottedCompany;
  reduced: boolean;
  lit: boolean;
  calloutOpen: boolean;
  onHover: () => void;
  onLeave: () => void;
  onToggleCallout: () => void;
  onOpenProfile: () => void;
}) {
  const { x, y } = company;
  const enterDelay = reduced ? 0 : (x / GEO_VIEW.w) * 0.5;

  // Single click toggles the callout; a double click opens the profile. A
  // short timer disambiguates the two — the second click cancels the timer.
  const clickTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
    },
    [],
  );

  function handleClick() {
    if (clickTimer.current !== null) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onOpenProfile();
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      onToggleCallout();
    }, 220);
  }

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
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleCallout();
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
        r={lit ? 7 : 5}
        fill={lit ? "var(--color-accent-primaryHover)" : "var(--color-accent-primary)"}
        filter={lit ? "url(#rs-map-hotglow)" : undefined}
        style={{ transition: "r 0.18s ease" }}
      />

      {/* Invisible larger hit target. */}
      <circle cx={x} cy={y} r={16} fill="transparent" />

      {calloutOpen && <CompanyCallout company={company} reduced={reduced} onOpen={onOpenProfile} />}
    </motion.g>
  );
}

// ───────────────────────────────────────────────────────────────────
// Company callout — connector line + compact intel card, shown when a
// company dot is single-clicked. Clicking the card opens the full profile.
// ───────────────────────────────────────────────────────────────────

const CALLOUT_CONNECTOR = 38;
const CALLOUT_W = 300;
const CALLOUT_H = 78;

function CompanyCallout({
  company,
  reduced,
  onOpen,
}: {
  company: PlottedCompany;
  reduced: boolean;
  onOpen: () => void;
}) {
  // Extend the card toward map center so it stays on-canvas.
  const right = company.x < GEO_VIEW.w / 2;
  const connectorEndX = right ? company.x + CALLOUT_CONNECTOR : company.x - CALLOUT_CONNECTOR;
  const cardX = right ? connectorEndX : connectorEndX - CALLOUT_W;
  const cardY = company.y - CALLOUT_H / 2;
  const textX = cardX + 15;

  // Clicking the callout opens the full profile. stopPropagation keeps the
  // click off the dot's toggle handler underneath.
  return (
    // biome-ignore lint/a11y/useSemanticElements: this is an SVG <g>, not HTML — it cannot be a <button>; role="button" + tabIndex + onKeyDown is the keyboard-accessible pattern for an interactive SVG group.
    <g
      role="button"
      tabIndex={0}
      aria-label={`Open profile — ${company.name}`}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
    >
      <motion.line
        x1={company.x}
        y1={company.y}
        x2={connectorEndX}
        y2={company.y}
        stroke="var(--color-accent-primary)"
        strokeWidth={1.2}
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />
      <circle cx={connectorEndX} cy={company.y} r={2.5} fill="var(--color-accent-primary)" />

      <motion.g
        initial={reduced ? false : { opacity: 0, x: right ? -8 : 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: 0.14, ease: "easeOut" }}
      >
        <rect
          x={cardX}
          y={cardY}
          width={CALLOUT_W}
          height={CALLOUT_H}
          fill="var(--color-surface-raised)"
          stroke="var(--color-accent-primary)"
          strokeWidth={1}
        />
        <rect x={cardX} y={cardY} width={3} height={CALLOUT_H} fill="var(--color-accent-primary)" />
        <text
          x={textX}
          y={cardY + 22}
          style={{
            fontSize: 9.5,
            fill: "var(--color-text-accent)",
            letterSpacing: "0.14em",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
          }}
        >
          {company.city}, {company.state} · {industryLabel(company.industry)}
        </text>
        <text
          x={textX}
          y={cardY + 45}
          style={{
            fontSize: 14,
            fontWeight: 600,
            fill: "var(--color-text-primary)",
            fontFamily: "var(--font-display)",
          }}
        >
          {company.name}
        </text>
        <text
          x={textX}
          y={cardY + 63}
          style={{
            fontSize: 10.5,
            fill: "var(--color-text-muted)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {fmtUsd(company.totalAwarded)} in federal awards · double-click for profile
        </text>
      </motion.g>
    </g>
  );
}
