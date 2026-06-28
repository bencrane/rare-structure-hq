/**
 * DocumensoTemplatesManage — Settings → Documenso → Manage Templates
 * (`/app/settings/documenso/templates`).
 *
 * Read-only table of EVERY Documenso template for the operator's org (active AND archived), from
 * core-x `business.documenso_templates` via the BFF. Distinct from the field-defaults editor
 * (`/app/settings/documenso-templates`) and the prospect picker (visible + mapped + active only).
 * Composes CockpitPage — no route geometry.
 */
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import type { DocumensoTemplateSummary } from "@rare-structure-hq/shared";
import { Badge, Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { listDocumensoTemplates } from "@/settings/documenso-templates-api";

function statusTone(status: string): "info" | "warn" | "success" {
  return status === "archived" ? "warn" : "success";
}

export default function DocumensoTemplatesManage() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [list, setList] = useState<DocumensoTemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    setError(null);
    setList(null);
    listDocumensoTemplates(token)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load templates"));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CockpitPage
      title="Manage Templates"
      description="Every Documenso template registered for your org — active and archived. Read-only."
    >
      <BackLink to="/app/settings/documenso" label="Documenso" />
      <Section label="Templates">
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
              icon={FileText}
              title="No templates"
              description="No Documenso templates are registered for your org yet."
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
                      <Th>Template ID</Th>
                      <Th>Name</Th>
                      <Th>Archetype</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                    {list.map((t) => (
                      <tr
                        key={t.id}
                        className="transition-colors hover:bg-[color:var(--color-surface-raised)]"
                      >
                        <td className="px-4 py-3">
                          <Text size="mono-xs" mono color="subtle">
                            {t.id}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Text size="body-sm" color="primary" className="block truncate">
                            {t.name}
                          </Text>
                          {t.slug ? (
                            <Text size="mono-xs" mono color="subtle" className="block truncate">
                              {t.slug}
                            </Text>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <Text size="body-sm" color="muted">
                            {t.archetypeName ?? "—"}
                          </Text>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(t.status)}>{t.status}</Badge>
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

function Th({ children }: { children?: ReactNode }) {
  return <th className={thCls}>{children}</th>;
}

const thCls =
  "px-4 py-2.5 text-left font-mono font-normal text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";
