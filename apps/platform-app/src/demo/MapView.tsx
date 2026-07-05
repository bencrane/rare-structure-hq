/**
 * MapView — the cockpit's home surface: the Catalyst Origination Terminal.
 *
 * The base layer is a real cartographic US (state geometry from `us-geo.ts`)
 * with a faint graticule and a scatter field — the ambient firehose of the
 * market. When the operator runs a map-query command, the matching companies
 * light up the map as fine clickable dots, swept in west-to-east. Clicking a
 * dot opens that company's profile side panel.
 *
 * Token CSS variables fill every SVG stroke/fill — utility classes do not
 * reach into SVG.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import {
  CommandPill,
  CompactDatasetToggle,
  type ResultView,
  TerminalHeader,
} from "./components/TerminalChrome";
import { resultScopeCell } from "./data";
import { promoteDossier } from "./dossierCache";
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

// A company that carries map coordinates — the only kind the dot layer plots.
// (Entities whose address did not geocode have no x/y; they are filtered out.)
type PlottedCompany = Company & { x: number; y: number };

export function MapView({
  query,
  results,
  loading = false,
  error = null,
  total,
  notApplied = [],
  interpretedTitle = null,
  profileAsOfDate = null,
  selectedId,
  onSelectCompany,
  onInvokeCommand,
  onDismiss,
  embedded = false,
  resultView,
  onResultView,
  onDataset,
  defaultView,
  onDefaultView,
  onWorkbench,
}: {
  query: MapQuery | null;
  results: Company[];
  loading?: boolean;
  error?: string | null;
  total?: number;
  /** NL-query constraints the compiler could not express — rendered as "not applied". */
  notApplied?: string[];
  /** The `/ask` compiler's interpretation of an NL query — the banner's "Scope" value. */
  interpretedTitle?: string | null;
  profileAsOfDate?: string | null;
  selectedId: string | null;
  onSelectCompany: (company: Company) => void;
  onInvokeCommand: () => void;
  onDismiss?: () => void;
  embedded?: boolean;
  resultView: ResultView;
  onResultView: (v: ResultView) => void;
  /** Flip the serving table the NL /ask query is routed to (only meaningful for `query.nl`). */
  onDataset?: (d: NonNullable<MapQuery["dataset"]>) => void;
  /** The persisted GLOBAL default view + its setter. Surfaced as the header toggle
   * pre-query; post-query the same header slot shows the active-view toggle (resultView). */
  defaultView: ResultView;
  onDefaultView: (v: ResultView) => void;
  /** Opens the deterministic query workbench (the header toggle's third segment). */
  onWorkbench?: () => void;
}) {
  const reduced = !!useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const queryKey = query
    ? `${query.industry ?? query.naicsPrefix ?? "all"}:${query.minAward}`
    : "none";

  // Only plot results that carry coordinates. ~85% of the live federal universe geocodes
  // (serving snapshot ⋈ geocode_xwalk); the rest carry no x/y and are served through the
  // result banner + table, never as a dot at a bogus position.
  const plottable = results.filter(
    (c): c is Company & { x: number; y: number } => c.x != null && c.y != null,
  );

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

      <TerminalHeader
        reduced={reduced}
        showBrand={!embedded}
        defaultView={query ? undefined : defaultView}
        onDefaultView={query ? undefined : onDefaultView}
        view={query ? resultView : undefined}
        onView={query ? onResultView : undefined}
        onClear={query && onDismiss ? onDismiss : undefined}
        onWorkbench={onWorkbench}
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-6">
        {/* No off-panel dismiss: with live geo-dots the map area is interactive (clicking a
            dot opens its profile), so a full-area backdrop would swallow dot clicks and clear
            the query. The result set is cleared only via the header Clear button (and Esc). */}
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
                lit={company.id === hovered || company.id === selectedId}
                onHover={() => {
                  setHovered(company.id);
                  promoteDossier(company.id); // warm the drawer before the click lands
                }}
                onLeave={() => setHovered((h) => (h === company.id ? null : h))}
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
            notApplied={notApplied}
            interpretedTitle={interpretedTitle}
            plottedCount={plottable.length}
            profileAsOfDate={profileAsOfDate}
            reduced={reduced}
            onResultView={onResultView}
            onDataset={onDataset}
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
  notApplied,
  interpretedTitle,
  plottedCount,
  profileAsOfDate,
  reduced,
  onResultView,
  onDataset,
}: {
  query: MapQuery;
  results: Company[];
  total: number;
  loading: boolean;
  error: string | null;
  notApplied: string[];
  interpretedTitle: string | null;
  plottedCount: number;
  profileAsOfDate: string | null;
  reduced: boolean;
  onResultView: (v: ResultView) => void;
  onDataset?: (d: NonNullable<MapQuery["dataset"]>) => void;
}) {
  const awards = results.reduce((sum, c) => sum + c.totalAwarded, 0);
  const scope = resultScopeCell(query, interpretedTitle);
  // Map mode with nothing plotted (live entities have no coords yet — geo deferred): rather than
  // an overlay list, nudge to the Table view, which owns the full result rendering now.
  const geoPending = plottedCount === 0 && results.length > 0 && !loading && !error;

  return (
    <motion.div
      className="-translate-x-1/2 absolute top-2 left-1/2 z-10 flex flex-col items-center gap-1.5"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reduced ? 0 : 0.2 }}
    >
      <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
        <BannerCell label={scope.label} value={scope.value} accent />
        <BannerCell
          label="Companies"
          value={loading ? "…" : error ? "—" : total.toLocaleString("en-US")}
        />
        <BannerCell label="Federal awards" value={loading ? "…" : error ? "—" : fmtUsd(awards)} />
        {profileAsOfDate && <BannerCell label="Data as of" value={profileAsOfDate} />}
      </div>

      {/* The dataset toggle only affects NL /ask queries — canned commands never set query.nl. */}
      {query.nl && onDataset && (
        <CompactDatasetToggle value={query.dataset ?? "auto"} onChange={onDataset} />
      )}

      {error && (
        <div className="border border-[color:var(--color-status-danger,var(--color-border-strong))] bg-[color:var(--color-surface-raised)] px-3 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
          Live federal feed unavailable
        </div>
      )}

      {/* The honesty signal: a query constraint the compiler could not run. */}
      {!loading && !error && notApplied.length > 0 && (
        <div className="border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase shadow-lg shadow-black/40">
          Not applied: {notApplied.join(" · ")}
        </div>
      )}

      {geoPending && (
        <button
          type="button"
          onClick={() => onResultView("table")}
          className="border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase shadow-lg shadow-black/40 transition-colors hover:text-[color:var(--color-text-accent)]"
        >
          {total.toLocaleString("en-US")} matches · map pins pending geo-resolution — view as Table
        </button>
      )}
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
// Company dot — a fine plotted point. A click (or Enter) opens the
// company's profile side panel. No pulse; no on-map callout.
// ───────────────────────────────────────────────────────────────────

function CompanyDot({
  company,
  reduced,
  lit,
  onHover,
  onLeave,
  onOpenProfile,
}: {
  company: PlottedCompany;
  reduced: boolean;
  lit: boolean;
  onHover: () => void;
  onLeave: () => void;
  onOpenProfile: () => void;
}) {
  const { x, y } = company;
  const enterDelay = reduced ? 0 : (x / GEO_VIEW.w) * 0.5;

  return (
    // biome-ignore lint/a11y/useSemanticElements: this is an SVG <g>, not HTML — it cannot be a <button>; role="button" + tabIndex + onKeyDown is the keyboard-accessible pattern for an interactive SVG group.
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`Open profile — ${company.name}`}
      initial={reduced ? false : { opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: enterDelay, ease: "easeOut" }}
      style={{ cursor: "pointer", transformOrigin: `${x}px ${y}px` }}
      onClick={onOpenProfile}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenProfile();
        }
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
    >
      {/* A fine point — grows a touch and glows on hover/selection. */}
      <circle
        cx={x}
        cy={y}
        r={lit ? 3 : 2}
        fill={lit ? "var(--color-accent-primaryHover)" : "var(--color-accent-primary)"}
        filter={lit ? "url(#rs-map-hotglow)" : undefined}
        style={{ transition: "r 0.18s ease" }}
      />

      {/* Invisible larger hit target — keeps the fine dot easy to click. */}
      <circle cx={x} cy={y} r={10} fill="transparent" />
    </motion.g>
  );
}
