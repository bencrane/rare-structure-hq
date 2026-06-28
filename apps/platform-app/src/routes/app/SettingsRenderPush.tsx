/**
 * SettingsRenderPush — Settings → Create Documenso Template via Render-Push
 * (`/app/settings/render-push`).
 *
 * A table of the repo-resident engagement templates (brand · path · archetype · version · name).
 * Each row has a two-tap confirm button that runs the existing render-push lane: compile the
 * template's HTML, render the PDF via DocRaptor, and create it in Documenso as a reusable template.
 * The created documenso template id appears inline on the row. Single-flight: while one push is in
 * flight every row's button is disabled, so DocRaptor/Documenso load stays serialized.
 *
 * No Documenso fields are placed here — the push creates the template; the operator affixes the
 * signature/date/value fields in the Documenso editor afterward.
 */
import { Check, FileSignature, Inbox } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, EmptyState, Panel } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  type EngagementTemplate,
  type EngagementTemplateRenderPush,
  listEngagementTemplates,
  renderPushTemplate,
} from "@/settings/engagement-templates-api";

type LoadState = "loading" | "ready" | "error";

const rowKey = (t: EngagementTemplate) => `${t.brand}/${t.path}/${t.archetype}/${t.version}`;

export default function SettingsRenderPush() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<EngagementTemplate[]>([]);

  // per-row action state, keyed by rowKey
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, EngagementTemplateRenderPush>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    let active = true;
    setState("loading");
    listEngagementTemplates(token)
      .then((ts) => {
        if (!active) return;
        setRows(ts);
        setState("ready");
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load templates");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          a.brand.localeCompare(b.brand) ||
          a.path.localeCompare(b.path) ||
          a.archetype.localeCompare(b.archetype) ||
          a.version.localeCompare(b.version),
      ),
    [rows],
  );

  const createTemplate = useCallback(
    (t: EngagementTemplate) => {
      const key = rowKey(t);
      // Two-tap confirm: first tap arms, second fires. No modal — the cockpit has no dialog primitive.
      if (armedKey !== key) {
        setArmedKey(key);
        return;
      }
      setArmedKey(null);
      setBusyKey(key);
      setRowErrors((m) => {
        const next = { ...m };
        delete next[key];
        return next;
      });
      renderPushTemplate(token, {
        brand: t.brand,
        path: t.path,
        archetype: t.archetype,
        version: t.version,
      })
        .then((r) => setResults((m) => ({ ...m, [key]: r })))
        .catch((e) =>
          setRowErrors((m) => ({ ...m, [key]: e instanceof Error ? e.message : "Create failed" })),
        )
        .finally(() => setBusyKey((k) => (k === key ? null : k)));
    },
    [armedKey, token],
  );

  return (
    <CockpitPage
      title="Create Documenso Template via Render-Push"
      description="Compile a repo-resident template's HTML, render the PDF via DocRaptor, and create it in Documenso as a template. The created documenso template id appears inline per row."
    >
      <BackLink to="/app/settings" label="Settings" />

      {state === "loading" && (
        <Panel>
          <div className={msgCls}>Loading…</div>
        </Panel>
      )}

      {state === "error" && (
        <Panel>
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <Text size="body-sm">Couldn’t load templates</Text>
            {error && (
              <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
                {error}
              </Text>
            )}
          </div>
        </Panel>
      )}

      {state === "ready" && sorted.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No engagement templates"
          description="No repo-resident templates were found under the content tree."
        />
      )}

      {state === "ready" && sorted.length > 0 && (
        <Panel>
          <div className="border-[color:var(--color-border-subtle)] border-b px-4 py-2.5">
            <Text size="mono-xs" mono color="subtle">
              {sorted.length} template{sorted.length === 1 ? "" : "s"}
            </Text>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-[color:var(--color-border-subtle)] border-b">
                  <th scope="col" className={thCls}>
                    Brand
                  </th>
                  <th scope="col" className={thCls}>
                    Path
                  </th>
                  <th scope="col" className={thCls}>
                    Archetype
                  </th>
                  <th scope="col" className={thCls}>
                    Version
                  </th>
                  <th scope="col" className={thCls}>
                    Name
                  </th>
                  <th scope="col" className={`${thCls} text-right`}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                {sorted.map((t) => {
                  const key = rowKey(t);
                  const busy = busyKey === key;
                  const armed = armedKey === key;
                  const result = results[key];
                  const err = rowErrors[key];
                  const anyBusy = busyKey !== null;
                  return (
                    <tr
                      key={key}
                      className="transition-colors hover:bg-[color:var(--color-surface-raised)]"
                    >
                      <td className="px-4 py-3">
                        <Text size="mono-xs" mono color="subtle">
                          {t.brand}
                        </Text>
                      </td>
                      <td className="px-4 py-3">
                        <Text size="mono-xs" mono color="subtle">
                          {t.path}
                        </Text>
                      </td>
                      <td className="px-4 py-3">
                        <Text size="mono-xs" mono color="subtle">
                          {t.archetype}
                        </Text>
                      </td>
                      <td className="px-4 py-3">
                        <Text size="mono-xs" mono color="subtle">
                          {t.version}
                        </Text>
                      </td>
                      <td className="px-4 py-3">
                        <Text size="body-sm">{t.name}</Text>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {result ? (
                          <output className="inline-flex flex-col items-end gap-1.5">
                            <span className={createdCls}>
                              <Check className="size-3.5" />
                              Created
                            </span>
                            <Text size="mono-xs" mono color="subtle" className="block break-all">
                              {result.documenso_template_id}
                              {result.documenso_numeric_id != null
                                ? ` · #${result.documenso_numeric_id}`
                                : ""}
                            </Text>
                          </output>
                        ) : (
                          <div className="inline-flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => createTemplate(t)}
                              disabled={anyBusy}
                              aria-busy={busy}
                              aria-pressed={armed}
                              aria-label={`Create Documenso template for ${t.brand} / ${t.archetype} ${t.version}`}
                              title={
                                anyBusy && !busy ? "Another template is being created" : undefined
                              }
                              className={armed ? renderArmedCls : renderCls}
                            >
                              <FileSignature className="size-3.5" />
                              {busy
                                ? "Creating…"
                                : armed
                                  ? "Confirm — create"
                                  : "Create Documenso Template"}
                            </button>
                            {err && (
                              <output className="block max-w-xs">
                                <Text
                                  size="mono-xs"
                                  mono
                                  color="subtle"
                                  className="block break-words"
                                >
                                  {err}
                                </Text>
                              </output>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </CockpitPage>
  );
}

const msgCls =
  "px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase";

const thCls =
  "px-4 py-2.5 text-left font-mono font-normal text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const createdCls =
  "inline-flex items-center gap-2 border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] px-3 py-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em]";

const renderCls =
  "inline-flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-5 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-50";

// Armed (confirm) state — a heavier accent ring so the two-tap arm is visible, not label-only.
const renderArmedCls = `${renderCls} ring-1 ring-[color:var(--color-accent-primary)] ring-offset-1 ring-offset-[color:var(--color-surface-base)]`;
