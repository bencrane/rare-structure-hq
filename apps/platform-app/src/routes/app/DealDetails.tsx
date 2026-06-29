/**
 * DealDetails — editable deal_details, opened from a Research row by the deal's 8-char handle.
 * Shows the deal's contacts (name / email / title) and the attached Documenso template as modifiable
 * fields and saves them back to business.deal_details. Authors no geometry — composes CockpitPage.
 */
import { Check, ChevronLeft, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Badge, Text } from "@rare-structure-hq/ui";

import { CockpitPage, Panel, Section } from "@/app/cockpit";
import {
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
  const [templateUuid, setTemplateUuid] = useState<string>("");
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
        setContacts(d.contacts ?? []);
        setTemplateUuid(d.defaultTemplateUuid ?? "");
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

  const setContact = (i: number, patch: Partial<DealContact>) =>
    setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const removeContact = (i: number) => setContacts((cs) => cs.filter((_, j) => j !== i));
  const addContact = () => setContacts((cs) => [...cs, { full_name: "", email: "", title: "" }]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const fresh = await updateDealDetails(token, handle, {
        contacts,
        content: data?.content ?? {},
        defaultTemplateUuid: templateUuid || null,
      });
      setData(fresh);
      setContacts(fresh.contacts ?? []);
      setTemplateUuid(fresh.defaultTemplateUuid ?? "");
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
                  key={c.contact_id ?? `new-${i}`}
                  className="grid items-end gap-3 border-[color:var(--color-border-subtle)] border-b pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <Field label="Full name">
                    <BoxedInput
                      value={c.full_name ?? ""}
                      onChange={(v) => setContact(i, { full_name: v })}
                      placeholder="Full name"
                    />
                  </Field>
                  <Field label="Email">
                    <BoxedInput
                      value={c.email ?? ""}
                      onChange={(v) => setContact(i, { email: v })}
                      placeholder="name@company.com"
                      type="email"
                    />
                  </Field>
                  <Field label="Title">
                    <BoxedInput
                      value={c.title ?? ""}
                      onChange={(v) => setContact(i, { title: v })}
                      placeholder="Title"
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => removeContact(i)}
                    aria-label="Remove contact"
                    className="flex size-[42px] items-center justify-center border border-[color:var(--color-border-default)] text-[color:var(--color-text-subtle)] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))
            )}
            <button type="button" onClick={addContact} className={secondaryBtnCls}>
              <Plus className="size-3.5" />
              Add contact
            </button>
          </div>
        </Panel>
      </Section>

      <Section label="Documenso template">
        <Panel>
          <Field label="Attached template">
            <select
              value={templateUuid}
              onChange={(e) => setTemplateUuid(e.target.value)}
              className="w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm outline-none focus:border-[color:var(--color-text-accent)]"
            >
              <option value="">— None —</option>
              {data.availableTemplates.map((t) => (
                <option key={t.templateUuid} value={t.templateUuid}>
                  {(t.name ?? t.documensoTemplateId) + (t.isDefault ? "  ·  org default" : "")}
                </option>
              ))}
            </select>
          </Field>
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

function BoxedInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
    />
  );
}

const backCls =
  "inline-flex w-fit items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.12em] transition-colors hover:text-[color:var(--color-text-accent)]";

const secondaryBtnCls =
  "flex w-fit items-center justify-center gap-2 border border-[color:var(--color-border-default)] px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]";

function saveBtnCls(justSaved: boolean): string {
  return `flex shrink-0 items-center justify-center gap-2 border px-6 py-2.5 font-mono text-mono-xs uppercase tracking-[0.14em] transition-colors disabled:opacity-50 ${
    justSaved
      ? "border-[color:var(--color-text-accent)] text-[color:var(--color-text-accent)]"
      : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
  }`;
}
