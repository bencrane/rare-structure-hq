/**
 * Proposal Templates — the register.
 *
 * The managed list of every proposal template (drafts + published), reached from
 * the Settings hub. Loads the real registry from the authoring API
 * (api.listTemplates → /api/v1/proposal-templates/manage, operator-scoped: shows
 * both drafts and published). Rows open the markdown editor; the header action
 * authors a new one.
 *
 * No fee column: the engagement fee is a dynamic {{monthly_fee}} merge token in
 * the template body, not separate row metadata — so it has no place here.
 */
import { ChevronLeft, ChevronRight, FilePlus2, ScrollText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Badge, Text } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import * as api from "@/settings/api";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE.format(d);
}

export default function TemplatesTable() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [list, setList] = useState<api.TemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setError(null);
    setList(null);
    api
      .listTemplates(token)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load templates"));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openRow = (id: string) => navigate(`/app/settings/templates/${id}`);

  return (
    <CockpitPage
      title="Proposal Templates"
      description="The register of every authored template — drafts and published. Open one to edit, or author a new one."
      actions={
        <button
          type="button"
          onClick={() => navigate("/app/settings/templates/new")}
          className={primaryBtnCls}
        >
          <FilePlus2 className="size-3.5" />
          New template
        </button>
      }
    >
      <Link
        to="/app/settings"
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.12em] transition-colors hover:text-[color:var(--color-text-accent)]"
      >
        <ChevronLeft className="size-3.5" />
        Settings
      </Link>

      <Section label="Register">
        <Panel padded={false}>
          {error ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <Text size="body-sm" color="default">
                Couldn’t load templates
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
              icon={ScrollText}
              title="No templates yet"
              description="Author one — write the body in markdown, preview, then publish."
            />
          ) : (
            <>
              <div className="border-[color:var(--color-border-subtle)] border-b px-4 py-2.5">
                <Text size="mono-xs" mono color="subtle">
                  {list.length} template{list.length === 1 ? "" : "s"}
                </Text>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-[color:var(--color-border-subtle)] border-b">
                      <Th>Template</Th>
                      <Th>Status</Th>
                      <Th>Updated</Th>
                      <th className="w-10" aria-hidden />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                    {list.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => openRow(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openRow(t.id);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Open ${t.name ?? "untitled draft"}`}
                        className="group cursor-pointer outline-none transition-colors hover:bg-[color:var(--color-surface-raised)] focus-visible:bg-[color:var(--color-surface-raised)]"
                      >
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <Text size="body-sm" color="primary" className="block truncate">
                              {t.name || "Untitled draft"}
                            </Text>
                            <Text size="mono-xs" mono color="subtle" className="block truncate">
                              {t.slug ?? t.id}
                            </Text>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={t.status === "published" ? "success" : "default"}>
                            {t.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="mono-xs" mono color="subtle">
                            {formatDate(t.updated_at)}
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
  return (
    <th className="px-4 py-2.5 text-left font-mono font-normal text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
      {children}
    </th>
  );
}

const primaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-4 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]";

const secondaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]";
