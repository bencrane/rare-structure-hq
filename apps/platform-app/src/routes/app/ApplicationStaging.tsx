/**
 * ApplicationStaging — the per-opportunity mandate prep page (`/app/applications/:opportunityId`).
 *
 * Reached by opening an opportunity on the Applications tab. The operator stages the mandate here,
 * off-screen, ahead of the call: pick the engagement (the archetype's template) and enter the
 * per-deal values (term, fee). The value form's inputs ARE the selected template's `text_fields`;
 * the archetype is the shape above them. Saving upserts one editable staging draft per opportunity
 * (persisted), so it can be resumed; "Confirm & originate" later stamps the values into the document.
 */
import { ArrowLeft, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { OpportunitySummary } from "@rare-structure-hq/shared";
import { Text } from "@rare-structure-hq/ui";

import { CockpitPage, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { listOpportunities } from "@/pipeline/api";
import {
  type EngagementOption,
  getStagingDraft,
  listEngagementOptions,
  saveStagingDraft,
} from "@/staging/api";

function humanize(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function fullName(o: OpportunitySummary): string {
  return [o.firstName, o.lastName].filter(Boolean).join(" ").trim() || "—";
}

type LoadState = "loading" | "ready" | "error";

export default function ApplicationStaging() {
  const navigate = useNavigate();
  const { opportunityId = "" } = useParams<{ opportunityId: string }>();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<EngagementOption[]>([]);
  const [opp, setOpp] = useState<OpportunitySummary | null>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !opportunityId) return;
    let active = true;
    setState("loading");
    setError(null);
    Promise.all([
      listEngagementOptions(token),
      getStagingDraft(token, opportunityId),
      listOpportunities(token).catch(() => [] as OpportunitySummary[]),
    ])
      .then(([opts, draft, opps]) => {
        if (!active) return;
        setOptions(opts);
        setOpp(opps.find((o) => o.opportunityId === opportunityId) ?? null);
        // Resume a prior staging if present; else default to the first option.
        setTemplateId(draft?.documensoTemplateId ?? opts[0]?.id ?? "");
        setValues(draft?.prefillValues ?? {});
        setState("ready");
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load staging");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [token, opportunityId]);

  const selected = useMemo(
    () => options.find((o) => o.id === templateId) ?? null,
    [options, templateId],
  );

  const setField = useCallback((field: string, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const save = useCallback(() => {
    if (!templateId) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    saveStagingDraft(token, opportunityId, {
      documensoTemplateId: templateId,
      prefillValues: values,
    })
      .then(() => setSaved(true))
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Save failed"))
      .finally(() => setSaving(false));
  }, [token, opportunityId, templateId, values]);

  return (
    <CockpitPage
      title="Stage mandate"
      description={
        opp
          ? `${opp.companyName ?? fullName(opp)} · ${opp.email ?? opportunityId}`
          : `Opportunity ${opportunityId}`
      }
    >
      <button type="button" onClick={() => navigate("/app/applications")} className={backCls}>
        <ArrowLeft className="size-3.5" />
        Applications
      </button>

      {/* Opportunity-id stamp — the staging context the originate flow carries through (the draft is
          keyed by it; surfaced here so the pass-through is visible while the real wiring lands). */}
      <div className={stampCls}>
        <span className="text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          Opportunity ID
        </span>
        <span className="text-[color:var(--color-text-accent)]">{opportunityId}</span>
      </div>

      {state === "loading" ? (
        <Panel>
          <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
            Loading…
          </div>
        </Panel>
      ) : state === "error" ? (
        <Panel>
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <Text size="body-sm">Couldn’t load staging</Text>
            <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
              {error}
            </Text>
          </div>
        </Panel>
      ) : options.length === 0 ? (
        <Panel>
          <div className="px-5 py-16 text-center">
            <Text size="body-sm" color="muted">
              No engagement templates are available for your org yet.
            </Text>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Engagement picker — grouped by archetype (the economic shape). */}
          <Section label="Engagement">
            <Panel>
              <label className={labelCls} htmlFor="engagement">
                Archetype · template
              </label>
              <select
                id="engagement"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setSaved(false);
                }}
                className={selectCls}
              >
                {groupByArchetype(options).map(([archetype, opts]) => (
                  <optgroup key={archetype} label={archetype}>
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {selected && (
                <Text size="mono-xs" mono color="subtle" className="mt-2 block">
                  {selected.archetypeName ?? "Unclassified"}
                  {selected.performanceFeeBasis ? ` · fee: ${selected.performanceFeeBasis}` : ""}
                </Text>
              )}
            </Panel>
          </Section>

          {/* Value form — the selected template's text_fields are the inputs. */}
          <Section label="Pre-fill values">
            <Panel>
              {!selected || selected.textFields.length === 0 ? (
                <Text size="body-sm" color="muted">
                  This template declares no pre-fill fields.
                </Text>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {selected.textFields.map((field) => (
                    <div key={field} className="flex flex-col gap-1.5">
                      <label className={labelCls} htmlFor={`f-${field}`}>
                        {humanize(field)}
                      </label>
                      <input
                        id={`f-${field}`}
                        type="text"
                        value={values[field] ?? ""}
                        onChange={(e) => setField(field, e.target.value)}
                        className={inputCls}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </Section>

          {/* Save — persists the staging draft (resume-able; originate stamps it later). */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={save}
              disabled={saving || !templateId}
              className={saveCls}
            >
              {saving ? "Saving…" : saved ? "Saved" : "Save staging"}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em]">
                <Check className="size-3.5" />
                Staged
              </span>
            )}
            {saveError && (
              <Text size="mono-xs" mono color="subtle" className="break-words">
                {saveError}
              </Text>
            )}
          </div>
        </div>
      )}
    </CockpitPage>
  );
}

/** Group options by archetype name (stable insertion order — the read is already archetype-sorted). */
function groupByArchetype(options: EngagementOption[]): [string, EngagementOption[]][] {
  const groups = new Map<string, EngagementOption[]>();
  for (const o of options) {
    const key = o.archetypeName ?? "Unclassified";
    const arr = groups.get(key);
    if (arr) arr.push(o);
    else groups.set(key, [o]);
  }
  return [...groups.entries()];
}

const backCls =
  "mb-4 inline-flex items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:text-[color:var(--color-text-accent)]";

const stampCls =
  "mb-6 inline-flex items-center gap-2 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 font-mono text-mono-xs";

const labelCls =
  "font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const inputCls =
  "w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-sans text-[color:var(--color-text-primary)] text-body-sm outline-none transition-colors focus:border-[color:var(--color-text-accent)]";

const selectCls = `${inputCls} mt-1.5 cursor-pointer`;

const saveCls =
  "inline-flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-5 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-50";
