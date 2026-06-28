/**
 * Research — the operator cockpit tab. Lists OPPORTUNITIES; opening one routes to its Application
 * company-profile page (`/app/applications/:handle`).
 *
 * Reuses the Pipeline tab's read-only data source (`listOpportunities`); it does NOT touch the
 * Pipeline table — this is an independent table on its own surface.
 */
import { ChevronRight, ClipboardList } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { OpportunitySummary } from "@rare-structure-hq/shared";
import { Badge, Text } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { listOpportunities } from "@/pipeline/api";

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

export default function Research() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [list, setList] = useState<OpportunitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setError(null);
    setList(null);
    listOpportunities(token)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load opportunities"));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Open this opportunity's Application company-profile page (by its 8-char handle).
  const openRow = (o: OpportunitySummary) =>
    navigate(`/app/applications/${encodeURIComponent(o.handle)}`);

  return (
    <CockpitPage
      title="Research"
      description="Opportunities advancing toward an engagement. Open one to review its company profile."
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
              description="Opportunities you advance in the pipeline land here."
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
                        aria-label={`Open ${o.companyName ?? fullName(o)}`}
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
