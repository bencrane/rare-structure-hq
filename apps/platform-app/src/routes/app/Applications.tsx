/**
 * Applications — the operator cockpit tab. Lists pipeline OPPORTUNITIES; opening one routes to its
 * per-opportunity mandate STAGING page (`/app/applications/:opportunityId`), where the operator picks
 * the engagement (archetype → template) and enters the per-deal values off-screen, ahead of the call.
 *
 * Reuses the Pipeline tab's read-only data source (`listOpportunities`); it does NOT touch the
 * Pipeline table — this is an independent table on its own surface.
 */
import { ChevronRight, ClipboardList } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { OpportunitySummary } from "@rare-structure-hq/shared";
import { Badge, Inline, Text } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  type EngagementPackage,
  type MandateState,
  generateMandate,
  getMandate,
  listEngagementPackages,
  listOpportunities,
} from "@/pipeline/api";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE.format(d);
}

function fullName(o: OpportunitySummary): string {
  const n = [o.firstName, o.lastName].filter(Boolean).join(" ").trim();
  return n || "—";
}

function statusTone(status: string): "info" | "warn" | "success" {
  if (/cancel|lost/i.test(status)) return "warn";
  if (/open|booked/i.test(status)) return "info";
  return "success";
}

export default function Applications() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [list, setList] = useState<OpportunitySummary[] | null>(null);
  const [packages, setPackages] = useState<EngagementPackage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setError(null);
    setList(null);
    listOpportunities(token)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load opportunities"));
    listEngagementPackages(token)
      .then(setPackages)
      .catch(() => setPackages([]));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Open this opportunity's mandate staging page (pick engagement + enter the per-deal values).
  const openRow = (o: OpportunitySummary) =>
    navigate(`/app/applications/${encodeURIComponent(o.opportunityId)}`);

  return (
    <CockpitPage
      title="Applications"
      description="Select an opportunity to stage its engagement mandate — pick the engagement and lock the price + term."
    >
      <Section label="Opportunities">
        <Panel padded={false}>
          {error ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <Text size="body-sm" color="default">
                Couldn’t load opportunities
              </Text>
              <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
                {error}
              </Text>
              <button type="button" onClick={refresh} className={secondaryBtnCls}>
                Retry
              </button>
            </div>
          ) : list === null ? (
            <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
              Loading…
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No opportunities yet"
              description="Opportunities you advance in the pipeline land here to be staged into an engagement mandate."
            />
          ) : (
            <>
              <div className="border-[color:var(--color-border-subtle)] border-b px-4 py-2.5">
                <Text size="mono-xs" mono color="subtle">
                  {list.length} opportunit{list.length === 1 ? "y" : "ies"}
                </Text>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-[color:var(--color-border-subtle)] border-b">
                      <Th>Opportunity ID</Th>
                      <Th>Prospect</Th>
                      <Th>Company</Th>
                      <Th>Title</Th>
                      <Th>Status</Th>
                      <Th>Booked</Th>
                      <Th>Mandate</Th>
                      <th className="w-10" aria-hidden />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                    {list.map((o) => (
                      <tr
                        key={o.opportunityId}
                        onClick={() => openRow(o)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openRow(o);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Stage mandate for ${o.companyName ?? fullName(o)}`}
                        className="group cursor-pointer outline-none transition-colors hover:bg-[color:var(--color-surface-raised)] focus-visible:bg-[color:var(--color-surface-raised)]"
                      >
                        <td className="px-4 py-3">
                          <Text
                            size="mono-xs"
                            mono
                            color="subtle"
                            className="block max-w-[18ch] truncate"
                            title={o.opportunityId}
                          >
                            {o.opportunityId}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <Text size="body-sm" color="primary" className="block truncate">
                              {fullName(o)}
                            </Text>
                            <Text size="mono-xs" mono color="subtle" className="block truncate">
                              {o.email ?? "—"}
                            </Text>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <Text size="body-sm" color="default" className="block truncate">
                              {o.companyName ?? "—"}
                            </Text>
                            <Text size="mono-xs" mono color="subtle" className="block truncate">
                              {o.domain ?? "—"}
                            </Text>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="body-sm" color="muted" className="block truncate">
                            {o.title ?? "—"}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="mono-xs" mono color="subtle">
                            {formatDate(o.bookedAt ?? o.createdAt)}
                          </Text>
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <MandateAction
                            opportunityId={o.opportunityId}
                            packages={packages}
                            token={token}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className="ml-auto size-3.5 text-[color:var(--color-text-subtle)] opacity-0 transition-opacity group-hover:opacity-100" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </Section>
    </CockpitPage>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className={thCls}>{children}</th>;
}

const thCls =
  "px-4 py-2.5 text-left font-mono font-normal text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const secondaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]";

// ── Mandate action — the PARALLEL "lock the price + term" control (AO term-only HTML → DocRaptor) ──
// Pick a preset package and stage it: the BFF → edge_api binds the opportunity + package into the
// static AO HTML and renders a plain PDF via DocRaptor (through a Trigger.dev task). Distinct from the
// row-click, which opens the staging-draft → Documenso page.

function mandateTone(status: string): "info" | "warn" | "success" {
  if (/fail/i.test(status)) return "warn";
  if (/rendered/i.test(status)) return "success";
  return "info"; // pending / rendering
}

function MandateAction({
  opportunityId,
  packages,
  token,
}: {
  opportunityId: string;
  packages: EngagementPackage[];
  token: string;
}) {
  const [pkg, setPkg] = useState("");
  const [state, setState] = useState<MandateState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Default the dropdown to the first package once they load.
  useEffect(() => {
    setPkg((cur) => cur || packages[0]?.key || "");
  }, [packages]);

  // Surface any mandate already staged for this opportunity.
  useEffect(() => {
    let alive = true;
    getMandate(token, opportunityId)
      .then((m) => {
        if (alive) setState(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [opportunityId, token]);

  const stage = async () => {
    if (!pkg) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await generateMandate(token, opportunityId, pkg);
      setState((s) => ({
        id: r.mandate_id,
        term_fee_cents: s?.term_fee_cents ?? 0,
        duration_months: s?.duration_months ?? 0,
        pdf_bytes: s?.pdf_bytes ?? null,
        error: null,
        status: r.status,
        package_key: r.package_key,
      }));
      // Poll briefly until the Trigger render flips it to 'rendered' / 'failed'.
      let tries = 0;
      const iv = setInterval(async () => {
        tries += 1;
        const m = await getMandate(token, opportunityId).catch(() => null);
        if (m) setState(m);
        if (!m || m.status === "rendered" || m.status === "failed" || tries >= 15) {
          clearInterval(iv);
        }
      }, 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to stage");
    } finally {
      setBusy(false);
    }
  };

  if (packages.length === 0) {
    return (
      <Text size="mono-xs" mono color="subtle">
        —
      </Text>
    );
  }

  return (
    <Inline gap="2" align="center">
      <select
        value={pkg}
        onChange={(e) => setPkg(e.target.value)}
        className={mandateSelectCls}
        aria-label="Engagement package"
      >
        {packages.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={stage} disabled={busy || !pkg} className={mandateBtnCls}>
        {busy ? "…" : state?.status === "rendered" ? "Re-stage" : "Stage"}
      </button>
      {state ? <Badge tone={mandateTone(state.status)}>{state.status}</Badge> : null}
      {err ? (
        <Text size="mono-xs" mono color="muted" className="max-w-[20ch] truncate" title={err}>
          {err}
        </Text>
      ) : null}
    </Inline>
  );
}

const mandateSelectCls =
  "border border-[color:var(--color-border-default)] bg-transparent px-2 py-1.5 font-mono text-[color:var(--color-text-default)] text-mono-xs focus:border-[color:var(--color-text-accent)] focus:outline-none";

const mandateBtnCls =
  "border border-[color:var(--color-border-default)] px-3 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)] disabled:opacity-50";
