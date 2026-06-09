/**
 * Pipeline — the operator cockpit tab. Lists cal.com bookings advancing from
 * catalyst signal toward an engagement. Each row is a booked prospect; opening
 * one routes to that company's dossier (keyed by `domain` — the canonical
 * resolution key). Loads the live list from the BFF (/api/v1/bookings →
 * edge_api → corex.bookings). Authors no geometry — composes CockpitPage.
 */
import { ChevronRight, Workflow } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { BookingSummary } from "@rare-structure-hq/shared";
import { Badge, Text } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { listBookings } from "@/pipeline/api";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE.format(d);
}

function fullName(b: BookingSummary): string {
  const n = [b.firstName, b.lastName].filter(Boolean).join(" ").trim();
  return n || "—";
}

function statusTone(status: string): "info" | "warn" | "success" {
  if (/cancel/i.test(status)) return "warn";
  return status === "booked" ? "info" : "success";
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [list, setList] = useState<BookingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setError(null);
    setList(null);
    listBookings(token)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load bookings"));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The dossier is the COMPANY's profile, keyed by domain (the canonical resolution
  // key). Fall back to the booking id when a row has no domain resolved yet.
  const openRow = (b: BookingSummary) =>
    navigate(`/app/dossier/${encodeURIComponent(b.domain ?? b.bookingId)}`);

  return (
    <CockpitPage title="Pipeline" description="Deals advancing from catalyst signal to engagement.">
      <Section label="Bookings">
        <Panel padded={false}>
          {error ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <Text size="body-sm" color="default">
                Couldn’t load bookings
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
              icon={Workflow}
              title="No deals in pipeline"
              description="Catalyst signals you advance from the map will stage here as deals move toward an engagement."
            />
          ) : (
            <>
              <div className="border-[color:var(--color-border-subtle)] border-b px-4 py-2.5">
                <Text size="mono-xs" mono color="subtle">
                  {list.length} booking{list.length === 1 ? "" : "s"}
                </Text>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-[color:var(--color-border-subtle)] border-b">
                      <Th>Prospect</Th>
                      <Th>Company</Th>
                      <Th>Title</Th>
                      <Th>Status</Th>
                      <Th>Booked</Th>
                      <th className="w-10" aria-hidden />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                    {list.map((b) => (
                      <tr
                        key={b.bookingId}
                        onClick={() => openRow(b)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openRow(b);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Open dossier for ${b.companyName ?? fullName(b)}`}
                        className="group cursor-pointer outline-none transition-colors hover:bg-[color:var(--color-surface-raised)] focus-visible:bg-[color:var(--color-surface-raised)]"
                      >
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <Text size="body-sm" color="primary" className="block truncate">
                              {fullName(b)}
                            </Text>
                            <Text size="mono-xs" mono color="subtle" className="block truncate">
                              {b.email ?? "—"}
                            </Text>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <Text size="body-sm" color="default" className="block truncate">
                              {b.companyName ?? "—"}
                            </Text>
                            <Text size="mono-xs" mono color="subtle" className="block truncate">
                              {b.domain ?? "—"}
                            </Text>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="body-sm" color="muted" className="block truncate">
                            {b.title ?? "—"}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="mono-xs" mono color="subtle">
                            {formatDate(b.createdAt)}
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
