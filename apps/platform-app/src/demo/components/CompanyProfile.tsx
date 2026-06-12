/**
 * CompanyProfile — the right-side drawer that opens when a company dot on the
 * map is clicked. It is the "click a dot, it opens up to the company" moment.
 *
 * The drawer is an intelligence dossier, not an echo of the query row: on open it
 * FETCHES the entity's composed dossier by UEI (BFF `/federal/entity/:uei/dossier`
 * → catalyst point-lookups over gold + award-summary + the rolling-90d award feed)
 * and renders Identity, Federal posture, Recent award activity and Points of
 * contact on top of the existing Capital Catalysts. If the fetch fails the drawer
 * gracefully degrades to exactly the row-mapped view it rendered before — never
 * emptier than today.
 *
 * Styled on the `@rare-structure-hq` design system. Closes on X / backdrop
 * (Esc is handled globally by `DemoApp`).
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, CalendarClock, Landmark, Receipt, X } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import { industryLabel } from "../data";
import { getDossier, peekDossier } from "../dossierCache";
import type { EntityDossier } from "../federalApi";
import { fmtDate, fmtUsd, fmtUsdFull } from "../format";
import type { CapitalCatalyst, CatalystKind, Company } from "../types";

// A 12-char SAM UEI — the only ids the dossier fetch fires for (seed/demo rows
// whose id is a name fall through to the row-mapped view).
const UEI_RE = /^[A-Z0-9]{12}$/i;

const CATALYST_ICON: Record<CatalystKind, ComponentType<{ className?: string }>> = {
  usaspending: Landmark,
  ucc_debt: Receipt,
  bdc_maturity: CalendarClock,
};

const TONE_COLOR: Record<CapitalCatalyst["tone"], string> = {
  accent: "var(--color-accent-primary)",
  warn: "var(--color-state-warn)",
  info: "var(--color-state-info)",
};

export function CompanyProfile({
  company,
  onClose,
}: {
  company: Company | null;
  onClose: () => void;
}) {
  const reduced = !!useReducedMotion();

  return (
    <AnimatePresence>
      {company && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="Close company profile"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[color:var(--color-surface-overlay)]"
          />

          {/* biome-ignore lint/a11y/useSemanticElements: an animated drawer needs role="dialog" + aria-modal; native <dialog> conflicts with framer-motion AnimatePresence. */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Profile — ${company.name}`}
            className="relative flex h-screen w-full flex-col border-[color:var(--color-border-strong)] border-l bg-[color:var(--color-surface-raised)] shadow-2xl shadow-black/60 sm:w-[460px]"
            initial={reduced ? { opacity: 0 } : { x: "100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={
              reduced ? { duration: 0.14 } : { type: "spring", stiffness: 380, damping: 38 }
            }
          >
            <ProfileHeader company={company} onClose={onClose} />
            <ProfileBody company={company} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfileHeader({ company, onClose }: { company: Company; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-[color:var(--color-border-subtle)] border-b px-6 py-4">
      <div className="flex items-center gap-2 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase">
        <Building2 className="size-3.5" />
        Federal entity · {company.id}
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="-mr-1 text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function ProfileBody({ company }: { company: Company }) {
  // The dossier is EAGERLY prefetched when the query result lands (dossierCache), so
  // the normal open is a SYNCHRONOUS cache hit — content renders in the same frame as
  // the drawer, no effect round-trip. A true miss (prefetch not landed yet / evicted /
  // non-UEI id) falls back to the deduped single fetch with the loading marker; any
  // failure degrades to the row-mapped view — never emptier than before.
  const isUei = UEI_RE.test(company.id);
  const peeked = isUei ? peekDossier(company.id) : undefined;
  const hasSyncHit = peeked !== undefined;
  const [fetched, setFetched] = useState<{
    id: string;
    dossier: EntityDossier | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!isUei || hasSyncHit) return; // sync hit (or non-UEI): nothing to fetch
    let cancelled = false;
    setLoading(true);
    getDossier(company.id)
      .then((d) => {
        if (!cancelled) setFetched({ id: company.id, dossier: d });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id, isUei, hasSyncHit]);
  const dossier = hasSyncHit
    ? peeked
    : fetched && fetched.id === company.id
      ? fetched.dossier
      : null;

  const identity = dossier?.identity;
  const posture = dossier?.posture;
  const address = identity?.address;
  const addressLine = address
    ? [address.street, address.city, address.state, address.zip].filter(Boolean).join(", ")
    : null;
  const isActive = identity ? identity.isActive : company.activeAward;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      {/* Identity */}
      <h2 className="font-display font-semibold text-[color:var(--color-text-primary)] text-display-sm uppercase leading-tight tracking-tight">
        {identity?.legalBusinessName ?? company.name}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
        <span className="text-[color:var(--color-text-accent)]">
          {industryLabel(company.industry)}
        </span>
        {(company.city || company.state) && (
          <>
            <span aria-hidden="true">·</span>
            <span>{[company.city, company.state].filter(Boolean).join(", ")}</span>
          </>
        )}
        {isActive && (
          <span className="border border-[color:var(--color-accent-primary)] px-1.5 py-0.5 text-[color:var(--color-text-accent)] leading-none">
            {identity ? "Active registration" : "Active award"}
          </span>
        )}
        {loading && <span className="text-[color:var(--color-text-subtle)]">Loading dossier…</span>}
      </div>

      {/* Identity facts — the dossier adds DBA / CAGE / full HQ address; live entities
          without a dossier (fetch failed, non-UEI id) keep the row-mapped facts. */}
      <div className="mt-5 grid grid-cols-2 gap-px border border-[color:var(--color-border-subtle)] bg-[color:var(--color-border-subtle)]">
        <IdentityFact
          label="NAICS"
          value={
            company.naicsLabel
              ? `${company.naics} · ${company.naicsLabel}`
              : (identity?.primaryNaics ?? company.naics) || "—"
          }
          wide={!identity?.cageCode}
        />
        {identity?.cageCode && <IdentityFact label="CAGE" value={identity.cageCode} />}
        {identity?.dbaName && <IdentityFact label="DBA" value={identity.dbaName} wide />}
        {addressLine && <IdentityFact label="HQ address" value={addressLine} wide />}
        {company.founded != null && (
          <IdentityFact label="Founded" value={String(company.founded)} />
        )}
        {company.employees && <IdentityFact label="Employees" value={company.employees} />}
      </div>

      {/* Federal posture — the dossier's lifetime/active split + recency + top agency. */}
      {posture && (
        <>
          <SectionHeader title="Federal posture" />
          <div className="grid grid-cols-2 gap-px border border-[color:var(--color-border-subtle)] bg-[color:var(--color-border-subtle)]">
            <IdentityFact
              label="Lifetime obligations"
              value={
                posture.totalLifetimeObligations != null
                  ? fmtUsdFull(posture.totalLifetimeObligations)
                  : "—"
              }
            />
            <IdentityFact
              label="Active obligations"
              value={
                posture.totalActiveObligations != null
                  ? fmtUsdFull(posture.totalActiveObligations)
                  : "—"
              }
            />
            <IdentityFact
              label="Awards"
              value={
                posture.awardCount != null
                  ? `${posture.awardCount} lifetime · ${posture.activeAwardCount ?? 0} active`
                  : "—"
              }
            />
            <IdentityFact
              label="Last award action"
              value={
                posture.latestActionDate
                  ? `${fmtDate(posture.latestActionDate)}${
                      posture.daysSinceLastAction != null
                        ? ` · ${posture.daysSinceLastAction}d ago`
                        : ""
                    }`
                  : "—"
              }
            />
            {posture.topAgencies.length > 0 && (
              <IdentityFact
                label="Top agency"
                value={`${posture.topAgencies[0].name} · ${fmtUsd(posture.topAgencies[0].dollars)}`}
                wide
              />
            )}
          </div>
        </>
      )}

      {/* Recent award activity — per-action feed; the window label keeps it honest. */}
      {dossier && (
        <>
          <SectionHeader
            title="Recent award activity"
            right={`rolling ${dossier.recentActivity.windowDays}d`}
          />
          {dossier.recentActivity.actions.length === 0 ? (
            <div className="border border-[color:var(--color-border-subtle)] px-4 py-3 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
              No award actions in the rolling {dossier.recentActivity.windowDays}-day window
            </div>
          ) : (
            <div className="flex flex-col gap-px border border-[color:var(--color-border-subtle)] bg-[color:var(--color-border-subtle)]">
              {dossier.recentActivity.actions.map((a) => (
                <div
                  key={a.awardId ?? `${a.actionDate}-${a.amount}`}
                  className="bg-[color:var(--color-surface-raised)] px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                      {a.actionDate ? fmtDate(a.actionDate) : "—"}
                    </span>
                    <span className="font-display font-semibold text-[color:var(--color-text-accent)] text-body-sm tabular-nums">
                      {a.amount != null ? fmtUsdFull(a.amount) : "—"}
                    </span>
                  </div>
                  <div className="mt-1 text-[color:var(--color-text-primary)] text-body-sm leading-snug">
                    {a.awardingSubAgency ?? a.awardingAgency ?? "—"}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                    {(a.popCity || a.popState) && (
                      <span>Work: {[a.popCity, a.popState].filter(Boolean).join(", ")}</span>
                    )}
                    {a.setAside && a.setAside !== "NONE" && (
                      <span className="border border-[color:var(--color-border-default)] px-1.5 py-0.5 leading-none">
                        {a.setAside}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Points of contact — public SAM record; names/titles only (no email/phone at source). */}
      {dossier && dossier.pocs.length > 0 && (
        <>
          <SectionHeader title="Points of contact" />
          <div className="flex flex-col gap-px border border-[color:var(--color-border-subtle)] bg-[color:var(--color-border-subtle)]">
            {dossier.pocs.map((p) => (
              <div
                key={`${p.type}-${p.pocSlotNo}-${p.fullName}`}
                className="flex items-baseline justify-between gap-3 bg-[color:var(--color-surface-raised)] px-4 py-3"
              >
                <div>
                  <div className="text-[color:var(--color-text-primary)] text-body-sm leading-snug">
                    {p.fullName ?? "—"}
                  </div>
                  <div className="mt-0.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                    {[p.title, [p.city, p.state].filter(Boolean).join(", ")]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
                {p.type && (
                  <span className="shrink-0 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
                    {p.type.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Capital Catalysts */}
      <div className="mt-7 mb-3 flex items-baseline justify-between">
        <h3 className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.16em]">
          Capital Catalysts
        </h3>
        <span className="font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
          {company.catalysts.length} signal{company.catalysts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {company.catalysts.map((catalyst) => (
          <CatalystCard key={catalyst.kind} catalyst={catalyst} />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <div className="mt-7 mb-3 flex items-baseline justify-between">
      <h3 className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.16em]">
        {title}
      </h3>
      {right && (
        <span className="font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
          {right}
        </span>
      )}
    </div>
  );
}

function IdentityFact({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`bg-[color:var(--color-surface-raised)] p-3.5 ${wide ? "col-span-2" : ""}`}>
      <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
        {label}
      </div>
      <div className="mt-1 text-[color:var(--color-text-primary)] text-body-sm leading-snug">
        {value}
      </div>
    </div>
  );
}

function CatalystCard({ catalyst }: { catalyst: CapitalCatalyst }) {
  const Icon = CATALYST_ICON[catalyst.kind];
  const tone = TONE_COLOR[catalyst.tone];

  return (
    <motion.div
      className="border-[color:var(--color-border-subtle)] border-y border-r bg-[color:var(--color-surface-base)]"
      style={{ borderLeft: `3px solid ${tone}` }}
      // The card renders in its final position immediately — no entrance drift. The drawer
      // itself still slides in (motion.aside); only this inner stagger/slide is removed.
      initial={false}
    >
      <div className="px-4 py-4">
        {/* Card header */}
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center border border-[color:var(--color-border-default)]"
            style={{ color: tone }}
          >
            <Icon className="size-3.5" />
          </span>
          <span className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.12em]">
            {catalyst.label}
          </span>
        </div>

        {/* Headline + summary */}
        <div className="mt-3 font-display font-semibold text-[color:var(--color-text-primary)] text-body-md uppercase leading-snug tracking-tight">
          {catalyst.headline}
        </div>
        <p className="mt-2 text-[color:var(--color-text-muted)] text-body-sm leading-relaxed">
          {catalyst.summary}
        </p>

        {/* Facts */}
        <div className="mt-3.5 grid grid-cols-2 gap-px border border-[color:var(--color-border-subtle)] bg-[color:var(--color-border-subtle)]">
          {catalyst.facts.map((fact) => (
            <div key={fact.label} className="bg-[color:var(--color-surface-base)] p-3">
              <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                {fact.label}
              </div>
              <div className="mt-1 text-[color:var(--color-text-primary)] text-body-sm leading-snug">
                {fact.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
