/**
 * DealDetails — editable deal_details, opened from a Research row by the deal's 8-char handle.
 * Shows the deal's contacts (name / email / title) and the attached Documenso template as modifiable
 * fields and saves them back to business.deal_details. Authors no geometry — composes CockpitPage.
 */
import { Check, ChevronLeft, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Badge, Text } from "@rare-structure-hq/ui";

import { CockpitPage, Panel, Section } from "@/app/cockpit";
import {
  type AvailableContact,
  type DealContact,
  type DealDetails as DealDetailsData,
  getDealDetails,
  updateDealDetails,
} from "@/deals/api";
import { useAuth } from "@/lib/auth";

export default function DealDetails() {
  // The URL carries the deal's 8-char public handle (DealSummary.handle).
  const { handle = "" } = useParams();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [data, setData] = useState<DealDetailsData | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  // Editable working copy.
  const [contacts, setContacts] = useState<DealContact[]>([]);
  // The add pool — account contacts not yet on the deal (mutated locally as we add/unlink).
  const [available, setAvailable] = useState<AvailableContact[]>([]);
  const [templateDocumensoId, setTemplateDocumensoId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token || !handle) return;
    setPhase("loading");
    setError(null);
    getDealDetails(token, handle)
      .then((d) => {
        setData(d);
        setContacts(withSignatoryDefault(d.contacts));
        setAvailable(d.availableContacts ?? []);
        setTemplateDocumensoId(d.templateDocumensoId ?? null);
        setPhase("ready");
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load deal details";
        if (/\b404\b/.test(msg)) setPhase("notfound");
        else {
          setError(msg);
          setPhase("error");
        }
      });
  }, [token, handle]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Person fields are display-only; only is_signatory is editable on a linked contact.
  const setSignatory = (i: number, on: boolean) =>
    setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, is_signatory: on } : c)));
  // Unlink = remove from this deal: drop from the local contacts array (and return to the add pool).
  const unlinkContact = (i: number) =>
    setContacts((cs) => {
      const removed = cs[i];
      const removedId = removed?.contact_id;
      if (removedId) {
        setAvailable((av) =>
          av.some((a) => a.contactId === removedId)
            ? av
            : [
                ...av,
                {
                  contactId: removedId,
                  fullName: removed?.full_name ?? null,
                  email: removed?.email ?? null,
                  title: removed?.title ?? null,
                },
              ],
        );
      }
      return cs.filter((_, j) => j !== i);
    });
  // Add from the pool: append { contact_id, …person, is_signatory: true } and remove from available.
  const addFromAvailable = (contactId: string) => {
    const picked = available.find((a) => a.contactId === contactId);
    if (!picked) return;
    setContacts((cs) => [
      ...cs,
      {
        contact_id: picked.contactId,
        full_name: picked.fullName,
        email: picked.email,
        title: picked.title,
        is_signatory: true,
      },
    ]);
    setAvailable((av) => av.filter((a) => a.contactId !== contactId));
  };

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const fresh = await updateDealDetails(token, handle, {
        // Junction payload — only the resolution key + signatory flag (drop the display fields).
        contacts: contacts
          .filter((c) => !!c.contact_id)
          .map((c) => ({ contact_id: c.contact_id as string, is_signatory: c.is_signatory ?? true })),
        fieldValues: data?.fieldValues ?? {},
        templateDocumensoId: templateDocumensoId,
      });
      setData(fresh);
      setContacts(withSignatoryDefault(fresh.contacts));
      setAvailable(fresh.availableContacts ?? []);
      setTemplateDocumensoId(fresh.templateDocumensoId ?? null);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the deal details");
    } finally {
      setSaving(false);
    }
  }

  const back = (
    <Link to="/app/research" className={backCls}>
      <ChevronLeft className="size-3.5" />
      Research
    </Link>
  );

  if (phase === "loading") {
    return (
      <CockpitPage title="Deal Details" description="Loading…">
        {back}
      </CockpitPage>
    );
  }
  if (phase === "notfound") {
    return (
      <CockpitPage title="Deal not found" description="This deal no longer exists.">
        {back}
      </CockpitPage>
    );
  }
  if (phase === "error" || !data) {
    return (
      <CockpitPage title="Deal Details" description="Couldn’t load this deal.">
        {back}
        <Panel>
          <Text size="mono-xs" mono color="subtle" className="break-words">
            {error}
          </Text>
        </Panel>
      </CockpitPage>
    );
  }

  const nameFor = (id: number | null) =>
    data.availableTemplates.find((t) => t.documensoId === id)?.name ?? null;
  const currentTemplateName = nameFor(data.templateDocumensoId); // the SAVED attachment
  const pendingTemplateName = nameFor(templateDocumensoId); // the dropdown's working selection
  const templateDirty = templateDocumensoId !== (data.templateDocumensoId ?? null);

  return (
    <CockpitPage
      title="Deal Details"
      description={data.companyName ?? handle}
      actions={
        <Badge tone={data.templateOrigin === "operator" ? "warn" : "info"}>
          {data.templateOrigin === "operator" ? "custom template" : "default template"}
        </Badge>
      }
    >
      {back}

      <Section label="Company">
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <ReadonlyValue>{data.companyName ?? "—"}</ReadonlyValue>
            </Field>
            <Field label="Domain">
              <ReadonlyValue>{data.companyDomain ?? "—"}</ReadonlyValue>
            </Field>
          </div>
        </Panel>
      </Section>

      <Section label="Contacts">
        <Panel>
          <div className="flex flex-col gap-4">
            {contacts.length === 0 ? (
              <Text size="body-sm" color="subtle">
                No contacts on this deal yet.
              </Text>
            ) : (
              contacts.map((c, i) => (
                <div
                  key={c.contact_id ?? `row-${i}`}
                  className="grid items-end gap-3 border-[color:var(--color-border-subtle)] border-b pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_1fr_1fr_auto_auto]"
                >
                  {/* Person identity is sourced from business.contacts — display-only here. */}
                  <Field label="Full name">
                    <ReadonlyValue>{c.full_name || "—"}</ReadonlyValue>
                  </Field>
                  <Field label="Email">
                    <ReadonlyValue>{c.email || "—"}</ReadonlyValue>
                  </Field>
                  <Field label="Title">
                    <ReadonlyValue>{c.title || "—"}</ReadonlyValue>
                  </Field>
                  <Field label="Signatory">
                    <button
                      type="button"
                      onClick={() => setSignatory(i, !(c.is_signatory ?? true))}
                      aria-pressed={c.is_signatory ?? true}
                      className={signatoryToggleCls(c.is_signatory ?? true)}
                    >
                      {c.is_signatory ?? true ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                      {c.is_signatory ?? true ? "Yes" : "No"}
                    </button>
                  </Field>
                  <Field label="Remove">
                    <button
                      type="button"
                      onClick={() => unlinkContact(i)}
                      aria-label="Remove contact from this deal"
                      className={removeBtnCls}
                    >
                      <X className="size-3.5" />
                      Remove
                    </button>
                  </Field>
                </div>
              ))
            )}
            {available.length > 0 ? (
              <Field label="Add contact">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addFromAvailable(e.target.value);
                  }}
                  className="w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm outline-none focus:border-[color:var(--color-text-accent)]"
                >
                  <option value="">— Add an account contact —</option>
                  {available.map((a) => (
                    <option key={a.contactId} value={a.contactId}>
                      {[a.fullName, a.email].filter(Boolean).join("  ·  ") || a.contactId}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Text size="mono-xs" mono color="subtle">
                No more account contacts available to add.
              </Text>
            )}
          </div>
        </Panel>
      </Section>

      <Section label="Documenso template">
        <Panel>
          <div className="flex flex-col gap-4">
            {/* Currently attached — the SAVED template on this deal_details (not the dropdown's
                working selection), so it stays a stable source of truth while you browse options. */}
            <Field label="Currently attached">
              <div className="flex items-center justify-between gap-3 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5">
                <Text size="body-sm" color={currentTemplateName ? "primary" : "subtle"} className="truncate">
                  {currentTemplateName ?? "None attached"}
                </Text>
                {currentTemplateName ? (
                  <Badge tone={data.templateOrigin === "operator" ? "warn" : "info"}>
                    {data.templateOrigin === "operator" ? "Custom" : "Org default"}
                  </Badge>
                ) : null}
              </div>
            </Field>

            <Field label="Change template">
              <select
                value={templateDocumensoId ?? ""}
                onChange={(e) => setTemplateDocumensoId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm outline-none focus:border-[color:var(--color-text-accent)]"
              >
                <option value="">— None —</option>
                {data.availableTemplates.map((t) => (
                  <option key={t.documensoId} value={t.documensoId}>
                    {(t.name ?? String(t.documensoId)) + (t.isDefault ? "  ·  org default" : "")}
                  </option>
                ))}
              </select>
            </Field>

            {templateDirty ? (
              <Text size="mono-xs" mono color="subtle">
                Unsaved — “Save details” to attach {pendingTemplateName ?? "None"}.
              </Text>
            ) : null}
          </div>
        </Panel>
      </Section>

      <div className="flex items-center justify-end gap-3">
        {saveError ? (
          <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
            {saveError}
          </Text>
        ) : null}
        <button type="button" onClick={save} disabled={saving} className={saveBtnCls(justSaved)}>
          {justSaved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
          {justSaved ? "Saved" : saving ? "Saving…" : "Save details"}
        </button>
      </div>
    </CockpitPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ReadonlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-muted)] text-body-sm">
      {children}
    </div>
  );
}

const backCls =
  "inline-flex w-fit items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.12em] transition-colors hover:text-[color:var(--color-text-accent)]";

const removeBtnCls =
  "flex h-[42px] items-center justify-center gap-1.5 border border-[color:var(--color-border-default)] px-3 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.12em] transition-colors hover:border-[color:var(--color-text-danger,var(--color-text-accent))] hover:text-[color:var(--color-text-danger,var(--color-text-accent))]";

// Contacts are not deleted — each carries an is_signatory flag (default true: all are signatories
// until toggled off). Normalize on load/save so the persisted jsonb always carries an explicit boolean.
function withSignatoryDefault(contacts: DealContact[] | undefined): DealContact[] {
  return (contacts ?? []).map((c) => ({ ...c, is_signatory: c.is_signatory ?? true }));
}

function signatoryToggleCls(on: boolean): string {
  return `flex h-[42px] w-full items-center justify-center gap-1.5 border px-3 font-mono text-mono-xs uppercase tracking-[0.12em] transition-colors ${
    on
      ? "border-[color:var(--color-text-accent)] text-[color:var(--color-text-accent)]"
      : "border-[color:var(--color-border-default)] text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-text-muted)]"
  }`;
}

function saveBtnCls(justSaved: boolean): string {
  return `flex shrink-0 items-center justify-center gap-2 border px-6 py-2.5 font-mono text-mono-xs uppercase tracking-[0.14em] transition-colors disabled:opacity-50 ${
    justSaved
      ? "border-[color:var(--color-text-accent)] text-[color:var(--color-text-accent)]"
      : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
  }`;
}
