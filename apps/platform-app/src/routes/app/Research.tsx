/**
 * Research — the operator cockpit tab. Lists DEALS; opening one routes to its Deal Details
 * editor (`/app/deals/:handle`) where deal_details (contacts + attached template) are editable.
 *
 * Reuses the Pipeline tab's read-only data source (`listDeals`); it does NOT touch the
 * Pipeline table — this is an independent table on its own surface.
 */
import { Check, ChevronRight, Circle, CircleDot, ClipboardList, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { DealSummary } from "@rare-structure-hq/shared";
import { Badge, Text, cx } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useActiveDeal } from "@/lib/activeDeal";
import { useAuth } from "@/lib/auth";
import { listDeals } from "@/pipeline/api";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE.format(d);
}

function fullName(o: DealSummary): string {
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

  const [list, setList] = useState<DealSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The global "meeting I'm on" pointer + the row staged for confirmation. Selecting a row stages it
  // (pending); confirming commits it to the pointer. One active deal at a time; off until set.
  const { activeDeal, setActiveDeal } = useActiveDeal();
  const [pending, setPending] = useState<DealSummary | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setError(null);
    setList(null);
    listDeals(token)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load deals"));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Open this deal's Deal Details editor (by its 8-char handle).
  const openRow = (o: DealSummary) => navigate(`/app/deals/${encodeURIComponent(o.handle)}`);

  return (
    <CockpitPage
      title="Research"
      description="Deals advancing toward an engagement. Open one to review its company profile."
    >
      <Section label="Deals">
        <Panel padded={false}>
          {error ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <Text size="body-sm" color="default">
                Couldn’t load deals
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
              title="No deals yet"
              description="Deals you advance in the pipeline land here."
            />
          ) : (
            <>
              <div className="border-[color:var(--color-border-subtle)] border-b px-4 py-2.5">
                <Text size="mono-xs" mono color="subtle">
                  {list.length} deal{list.length === 1 ? "" : "s"}
                </Text>
              </div>
              {/* Confirm gate — staging a row raises this bar; committing writes the global pointer. */}
              {pending ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-[color:var(--color-border-accent)] border-b bg-[color:var(--color-accent-soft)] px-4 py-3">
                  <span className="min-w-0 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.12em]">
                    Set {pending.companyName ?? pending.handle} as the active meeting?
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDeal({ handle: pending.handle, companyName: pending.companyName });
                        setPending(null);
                      }}
                      className={confirmBtnCls}
                    >
                      <Check className="size-3.5" />
                      Confirm active
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending(null)}
                      className={secondaryBtnCls}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-[color:var(--color-border-subtle)] border-b">
                      <Th>Active</Th>
                      <Th>Deal ID</Th>
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
                        key={o.dealId}
                        onClick={() => openRow(o)}
                        onKeyDown={(e) => {
                          // Only the row itself navigates; keypresses on the Active controls don't bubble up.
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openRow(o);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Open ${o.companyName ?? fullName(o)}`}
                        className="group cursor-pointer outline-none transition-colors hover:bg-[color:var(--color-surface-raised)] focus-visible:bg-[color:var(--color-surface-raised)]"
                      >
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <ActiveCell
                            isActive={activeDeal?.handle === o.handle}
                            isPending={pending?.handle === o.handle}
                            onSelect={() => setPending(o)}
                            onClear={() => setActiveDeal(null)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Text
                            size="mono-xs"
                            mono
                            color="subtle"
                            className="block max-w-[18ch] truncate"
                            title={o.dealId}
                          >
                            {o.dealId}
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

// Active-meeting selector for a row: a radio when off (click → stage for confirm), a highlighted ring
// when staged (pending), and the persistent ACTIVE badge + clear when it's the committed pointer.
function ActiveCell({
  isActive,
  isPending,
  onSelect,
  onClear,
}: {
  isActive: boolean;
  isPending: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] px-2 py-0.5 font-mono text-[0.5625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.16em]">
          <CircleDot className="size-3" />
          Active
        </span>
        <button
          type="button"
          onClick={onClear}
          title="Clear active meeting"
          aria-label="Clear active meeting"
          className="flex items-center justify-center text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-state-warn)]"
        >
          <X className="size-3.5" />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      title="Set as active meeting"
      aria-label="Set as active meeting"
      aria-pressed={isPending}
      className={cx(
        "flex size-6 items-center justify-center border transition-colors",
        isPending
          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
          : "border-[color:var(--color-border-default)] text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]",
      )}
    >
      <Circle className="size-3" />
    </button>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className={thCls}>{children}</th>;
}

const thCls =
  "px-4 py-2.5 text-left font-mono font-normal text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const secondaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]";

const confirmBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-4 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]";
