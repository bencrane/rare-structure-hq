/**
 * Settings → New Deal (`/app/settings/new-deal`) — the MANUAL deal lane.
 *
 * The operator-authored parallel to the Cal.com booking producer: author the company + signatory,
 * mint the deal (POST /api/v1/deals), attach a Documenso template and set its field values, then
 * "Generate Document" — the SAME chain the Mandate editor's "Confirm & Originate" runs (PUT details
 * → POST originate), yielding the /p/m sign link to email after (no email is sent by the system).
 *
 * Two phases on one page:
 *   1. Create — company + signatory form (signatory REQUIRED, parity with the booking lane).
 *   2. Document — template dropdown (deal-attachable mirror templates), per-label field values
 *      (labels + defaults from the template's prefill config; the input holds the deal OVERRIDE,
 *      the config default rides as the placeholder — model B, same as Mandate), then Generate.
 *
 * One deal per account: creating against a company that already carries a deal collapses onto it
 * (action "updated") — surfaced in the UI rather than hidden.
 */
import { Check, Copy, ExternalLink, FileSignature } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useId, useMemo, useState } from "react";

import { Grid, Stack } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, Panel, Section } from "@/app/cockpit";
import {
  type DealCreated,
  type DealDetails,
  type DealOriginated,
  createDeal,
  getDealDetails,
  originateDeal,
  updateDealDetails,
} from "@/deals/api";
import { useAuth } from "@/lib/auth";
import {
  type TemplatePrefillConfig,
  getPrefillConfig,
} from "@/settings/documenso-template-prefill-api";

export default function SettingsNewDeal() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  // Phase 1 — the create form.
  const [form, setForm] = useState({
    companyName: "",
    domain: "",
    firstName: "",
    lastName: "",
    email: "",
    title: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<DealCreated | null>(null);

  // Phase 2 — the document config for the created deal.
  const [details, setDetails] = useState<DealDetails | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [prefill, setPrefill] = useState<TemplatePrefillConfig | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [originated, setOriginated] = useState<DealOriginated | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const formValid =
    form.companyName.trim() !== "" &&
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    /\S+@\S+\.\S+/.test(form.email.trim());

  async function create() {
    setCreating(true);
    setCreateError(null);
    try {
      const r = await createDeal(token, {
        companyName: form.companyName.trim(),
        domain: form.domain.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        title: form.title.trim(),
      });
      setCreated(r);
      const d = await getDealDetails(token, r.dealHandle);
      setDetails(d);
      // Preselect the deal's attached template (the org default rides on it when set); the operator
      // can switch — attaching a different template archives/replaces the active config on save.
      setTemplateId(
        d.templateDocumensoId ?? d.availableTemplates.find((t) => t.isDefault)?.documensoId ?? null,
      );
      setFieldValues(toStringRecord(d.fieldValues));
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Could not create the deal");
    } finally {
      setCreating(false);
    }
  }

  // The chosen template's prefill config — labels + per-label defaults for the value editor.
  useEffect(() => {
    if (!token || templateId === null) {
      setPrefill(null);
      return;
    }
    let cancelled = false;
    getPrefillConfig(token, templateId)
      .then((p) => {
        if (!cancelled) setPrefill(p);
      })
      .catch(() => {
        if (!cancelled) setPrefill(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, templateId]);

  // The editable labels for the chosen template: every labelled mirror field, unioned with the
  // prefill-config keys (a config label whose field vanished still surfaces rather than hides).
  const labels = useMemo<string[]>(() => {
    if (!prefill) return [];
    const out = new Set<string>();
    for (const f of prefill.fields) if (f.label) out.add(f.label);
    for (const k of Object.keys(prefill.field_settings)) out.add(k);
    return [...out];
  }, [prefill]);

  const defaults = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (!prefill) return out;
    for (const [label, s] of Object.entries(prefill.field_settings)) {
      const d = s.default_document_field_value;
      if (typeof d === "string") out[label] = d;
    }
    return out;
  }, [prefill]);

  // Generate Document — the SAME chain as Mandate's "Confirm & Originate": persist the config
  // (template + field values, contacts passed through) via PUT details, then POST originate.
  async function generate() {
    if (!details || !created) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      await updateDealDetails(token, created.dealHandle, {
        contacts: details.contacts
          .filter((c) => !!c.contact_id)
          .map((c) => ({
            contact_id: c.contact_id as string,
            is_signatory: c.is_signatory ?? true,
          })),
        fieldValues: prunedValues(fieldValues),
        templateDocumensoId: templateId,
      });
      const r = await originateDeal(token, created.dealHandle);
      setOriginated(r);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Could not generate the document");
    } finally {
      setGenerating(false);
    }
  }

  const signatory = details?.contacts.find((c) => c.is_signatory) ?? details?.contacts[0] ?? null;
  const blockReason = !templateId
    ? "Choose a Documenso template to attach."
    : !signatory?.email
      ? "The deal has no signatory contact with an email."
      : null;

  const signUrl = originated ? `${window.location.origin}${originated.signLink}` : "";

  return (
    <CockpitPage
      title="New Deal"
      description="Create a deal without a booking — attach a Documenso template, set its values, and generate the signing document to email after."
    >
      <BackLink to="/app/settings" label="Settings" />
      <Stack gap="4">
        {/* ── Phase 1: company + signatory ─────────────────────────────────── */}
        <Section label="Company & Signatory">
          <Panel>
            <Grid cols={1} mdCols={2} gap="4">
              <Field label="Company name *">
                <input
                  value={form.companyName}
                  onChange={set("companyName")}
                  disabled={!!created}
                  placeholder="Acme Industries"
                  className={inputCls}
                />
              </Field>
              <Field label="Company domain">
                <input
                  value={form.domain}
                  onChange={set("domain")}
                  disabled={!!created}
                  placeholder="acme.com"
                  className={inputCls}
                />
              </Field>
              <Field label="Signatory first name *">
                <input
                  value={form.firstName}
                  onChange={set("firstName")}
                  disabled={!!created}
                  placeholder="Jane"
                  className={inputCls}
                />
              </Field>
              <Field label="Signatory last name *">
                <input
                  value={form.lastName}
                  onChange={set("lastName")}
                  disabled={!!created}
                  placeholder="Doe"
                  className={inputCls}
                />
              </Field>
              <Field label="Signatory email *">
                <input
                  value={form.email}
                  onChange={set("email")}
                  disabled={!!created}
                  placeholder="jane@acme.com"
                  type="email"
                  className={inputCls}
                />
              </Field>
              <Field label="Signatory title">
                <input
                  value={form.title}
                  onChange={set("title")}
                  disabled={!!created}
                  placeholder="Managing Director"
                  className={inputCls}
                />
              </Field>
            </Grid>
            {!created ? (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={create}
                  disabled={creating || !formValid}
                  className={primaryBtnCls}
                >
                  {creating ? "Creating…" : "Create Deal"}
                </button>
                {createError ? <ErrorLine>{createError}</ErrorLine> : null}
              </div>
            ) : (
              <p className="mt-4 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.16em]">
                {created.action === "updated"
                  ? `This company already carried a deal — reusing #${created.dealHandle} (one deal per account).`
                  : `Deal #${created.dealHandle} created (${created.status}).`}
              </p>
            )}
          </Panel>
        </Section>

        {/* ── Phase 2: template + values + generate ─────────────────────────── */}
        {created && details ? (
          <Section label="Engagement Document">
            <Panel>
              <Stack gap="4">
                <Field label="Documenso template">
                  <select
                    value={templateId ?? ""}
                    disabled={!!originated}
                    onChange={(e) =>
                      setTemplateId(e.target.value === "" ? null : Number(e.target.value))
                    }
                    className={inputCls}
                  >
                    <option value="">— choose a template —</option>
                    {details.availableTemplates.map((t) => (
                      <option key={t.documensoId} value={t.documensoId}>
                        {t.name || `#${t.documensoId}`}
                        {t.isDefault ? " (org default)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                {templateId !== null && labels.length > 0 ? (
                  <div>
                    <div className="mb-2 font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.2em]">
                      Field values — blank keeps the template default
                    </div>
                    <Grid cols={1} mdCols={2} gap="4">
                      {labels.map((label) => (
                        <Field key={label} label={label}>
                          <input
                            value={fieldValues[label] ?? ""}
                            placeholder={defaults[label] ?? ""}
                            disabled={!!originated}
                            onChange={(e) =>
                              setFieldValues((fv) => ({ ...fv, [label]: e.target.value }))
                            }
                            className={inputCls}
                          />
                        </Field>
                      ))}
                    </Grid>
                  </div>
                ) : templateId !== null && prefill ? (
                  <p className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
                    This template has no labelled fields to fill.
                  </p>
                ) : null}

                {originated ? (
                  <ReadyBar
                    signUrl={signUrl}
                    documentId={originated.documentId}
                    status={originated.status}
                  />
                ) : (
                  <div>
                    {blockReason ? (
                      <p className="mb-3 font-mono text-[0.5625rem] text-[color:var(--color-state-warn)] uppercase tracking-[0.14em]">
                        {blockReason}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={generate}
                      disabled={generating || blockReason !== null}
                      className={primaryBtnCls}
                    >
                      <FileSignature className="size-4" />
                      {generating ? "Generating…" : "Generate Document"}
                    </button>
                    {generateError ? <ErrorLine>{generateError}</ErrorLine> : null}
                  </div>
                )}
              </Stack>
            </Panel>
          </Section>
        ) : null}
      </Stack>
    </CockpitPage>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-mono text-[0.625rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.14em]"
      >
        {label}
      </label>
      {/* The single input/select child picks up the label's htmlFor. */}
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 font-mono text-[0.5625rem] text-[color:var(--color-state-warn)] uppercase tracking-[0.14em]">
      {children}
    </p>
  );
}

// The generated document's sign link — the artifact the operator emails to the signatory.
function ReadyBar({
  signUrl,
  documentId,
  status,
}: {
  signUrl: string;
  documentId: number | null;
  status: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(signUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the link stays visible to copy by hand.
    }
  }
  return (
    <div className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-5">
      <div className="mb-3 flex items-center gap-2 text-[color:var(--color-text-accent)]">
        <span className="size-1.5 rounded-full bg-[color:var(--color-state-success)]" />
        <span className="font-mono text-mono-xs uppercase tracking-[0.16em]">
          Document generated{documentId ? ` — #${documentId}` : ""} ({status})
        </span>
      </div>
      <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm leading-[1.5]">
        The signing document is ready. Email this link to the signatory — no email was sent.
      </p>
      <div className="mb-3 truncate border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-accent)] text-body-sm">
        {signUrl}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={copy}
          className="flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={signUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
        >
          <ExternalLink className="size-3.5" />
          Open as signer
        </a>
      </div>
    </div>
  );
}

const inputCls =
  "w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2 text-[0.875rem] text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-border-accent)] disabled:opacity-60";

const primaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-6 py-3 font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40 disabled:hover:bg-[color:var(--color-accent-soft)] disabled:hover:text-[color:var(--color-text-accent)]";

// Coerce the stored field_values (jsonb; values may be any) into a string map for the inputs.
function toStringRecord(r: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)]));
}

// Drop blank overrides so an untouched input keeps the template default (model B) instead of
// persisting an empty-string override that would mask it.
function prunedValues(fv: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(fv).filter(([, v]) => v.trim() !== ""));
}
