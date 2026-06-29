/**
 * DocumensoTemplateMirror — Settings → Documenso → Template Mirror
 * (`/app/settings/documenso-template-mirror`).
 *
 * The projected mirror of the live Documenso template envelopes (core-x business.documenso_envelopes,
 * via the BFF → edge_api). One row per envelope: title · documenso_id · field/recipient counts ·
 * status · last-synced. Each row's "Re-grab" re-pulls that one envelope through edge_api's EXISTING
 * projector (verbatim semantics — the Documenso response is stored as returned, status/type lowercased
 * only); "Re-grab all" re-pulls every envelope. Re-grab refreshes the projection only — it never edits
 * the templates and never touches the template configs. Composes CockpitPage — no route geometry.
 */
import { FileSignature, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { Badge, type BadgeTone, Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  type TemplateMirrorRow,
  listTemplateMirror,
  resyncAllTemplates,
  resyncTemplate,
} from "@/settings/documenso-template-mirror-api";

function statusTone(status: string | null): BadgeTone {
  if (!status) return "default";
  if (status === "completed") return "success";
  if (status === "pending" || status === "draft") return "info";
  if (status === "cancelled" || status === "rejected") return "warn";
  return "default";
}

/** ISO timestamp → compact local date-time, or an em-dash when never synced. */
function formatSynced(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DocumensoTemplateMirror() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [list, setList] = useState<TemplateMirrorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The documenso_id currently being re-grabbed (single-flight per row); "all" while re-grabbing all.
  const [resyncing, setResyncing] = useState<number | "all" | null>(null);
  const [resyncError, setResyncError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setError(null);
    setList(null);
    listTemplateMirror(token)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load templates"));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const regrab = useCallback(
    (documensoId: number) => {
      if (resyncing != null) return;
      setResyncing(documensoId);
      setResyncError(null);
      resyncTemplate(token, documensoId)
        .then((r) => {
          if (!r.synced && r.error) setResyncError(`#${documensoId}: ${r.error}`);
          refresh();
        })
        .catch((e) => setResyncError(e instanceof Error ? e.message : "Re-grab failed"))
        .finally(() => setResyncing(null));
    },
    [token, resyncing, refresh],
  );

  const regrabAll = useCallback(() => {
    if (resyncing != null) return;
    setResyncing("all");
    setResyncError(null);
    resyncAllTemplates(token)
      .then((r) => {
        const failed = r.results.filter((x) => !x.synced);
        if (failed.length > 0) {
          setResyncError(`${failed.length} of ${r.requested} failed to re-grab`);
        }
        refresh();
      })
      .catch((e) => setResyncError(e instanceof Error ? e.message : "Re-grab all failed"))
      .finally(() => setResyncing(null));
  }, [token, resyncing, refresh]);

  const busy = resyncing != null;

  return (
    <CockpitPage
      title="Documenso Templates"
      description="The projected mirror of your live Documenso template envelopes. Re-grab re-pulls an envelope through the projector to refresh its fields, recipients, and status — it never edits the template."
      actions={
        <button
          type="button"
          onClick={regrabAll}
          disabled={busy || !list || list.length === 0}
          className={regrabBtnCls}
        >
          <RefreshCw className={`size-3.5 ${resyncing === "all" ? "animate-spin" : ""}`} />
          {resyncing === "all" ? "Re-grabbing…" : "Re-grab all"}
        </button>
      }
    >
      <BackLink to="/app/settings/documenso" label="Documenso" />
      <Section label="Mirror">
        <Panel padded={false}>
          {error ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <Text size="body-sm" color="default">
                Couldn’t load templates
              </Text>
              <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
                {error}
              </Text>
            </div>
          ) : list === null ? (
            <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
              Loading…
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No templates"
              description="No Documenso template envelopes are mirrored yet. Re-grab all to pull them from Documenso."
            />
          ) : (
            <>
              <div className="flex items-center justify-between border-[color:var(--color-border-subtle)] border-b px-4 py-2.5">
                <Text size="mono-xs" mono color="subtle">
                  {list.length} template{list.length === 1 ? "" : "s"}
                </Text>
                {resyncError ? (
                  <Text size="mono-xs" mono color="subtle" className="max-w-md truncate text-right">
                    {resyncError}
                  </Text>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-[color:var(--color-border-subtle)] border-b">
                      <Th>Name</Th>
                      <Th>Documenso ID</Th>
                      <Th>Fields</Th>
                      <Th>Recipients</Th>
                      <Th>Status</Th>
                      <Th>Last synced</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                    {list.map((t) => {
                      const rowBusy = resyncing === t.documenso_id;
                      return (
                        <tr
                          key={t.documenso_id}
                          className="transition-colors hover:bg-[color:var(--color-surface-raised)]"
                        >
                          <td className="px-4 py-3">
                            <Text size="body-sm" color="primary" className="block truncate">
                              {t.title?.trim() || "Untitled"}
                            </Text>
                          </td>
                          <td className="px-4 py-3">
                            <Text size="mono-xs" mono color="subtle">
                              {t.documenso_id}
                            </Text>
                          </td>
                          <td className="px-4 py-3">
                            <Text size="body-sm" color="default" className="tabular-nums">
                              {t.field_count}
                            </Text>
                          </td>
                          <td className="px-4 py-3">
                            <Text size="body-sm" color="default" className="tabular-nums">
                              {t.recipient_count}
                            </Text>
                          </td>
                          <td className="px-4 py-3">
                            {t.status ? (
                              <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                            ) : (
                              <Text size="body-sm" color="muted">
                                —
                              </Text>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Text size="mono-xs" mono color="subtle" className="whitespace-nowrap">
                              {formatSynced(t.synced_at)}
                            </Text>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => regrab(t.documenso_id)}
                              disabled={busy}
                              className={rowBtnCls}
                            >
                              <RefreshCw className={`size-3.5 ${rowBusy ? "animate-spin" : ""}`} />
                              {rowBusy ? "Re-grabbing…" : "Re-grab"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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

function Th({ children }: { children?: ReactNode }) {
  return <th className={thCls}>{children}</th>;
}

const thCls =
  "px-4 py-2.5 text-left font-mono font-normal text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const regrabBtnCls =
  "inline-flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-4 py-2 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-50";

const rowBtnCls =
  "inline-flex items-center justify-center gap-1.5 border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] px-3 py-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";
