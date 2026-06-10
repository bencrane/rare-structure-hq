/**
 * ProposalIntakeForm — the operator's instantiate form (posture + client identity).
 *
 * On "Generate proposal" it mints a DRAFT record and routes the operator straight into the mandate
 * editor (`/app/m/:ref`) — the same path the Dossier's "Originate" takes — where the terms are
 * edited, signed, and confirmed (confirm is what provisions the PDF + Documenso envelope). It
 * deliberately surfaces NO share/send panel: a fresh draft has no signing envelope yet, so there is
 * no client link to hand out until confirm.
 *
 * Container-agnostic and rendered inline on the operator Proposals tab. The caller guarantees a
 * valid operator token (the `/app` cockpit is auth-gated), so there is no sign-in fallback here.
 * The commercial substance rides in the posture; the client fields are cosmetic-bespoke.
 */
import type { ProposalTemplateMeta } from "@rare-structure-hq/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createProposal, listTemplates } from "./api";

export function ProposalIntakeForm({ token }: { token: string }) {
  const [templates, setTemplates] = useState<ProposalTemplateMeta[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    listTemplates(token)
      .then((t) => {
        if (!active) return;
        setTemplates(t);
        setTemplateId((cur) => cur || t[0]?.id || "");
      })
      .catch(
        (e) => active && setError(e instanceof Error ? e.message : "Failed to load templates"),
      );
    return () => {
      active = false;
    };
  }, [token]);

  const template = templates?.find((t) => t.id === templateId);

  async function generate() {
    if (!name.trim() || !templateId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createProposal(token, {
        templateId,
        client: {
          name: name.trim(),
          email: email.trim() || undefined,
          title: title.trim() || undefined,
        },
        fieldValues,
      });
      // Land the operator in the mandate editor (/app/m/:ref) to edit terms, sign, and confirm —
      // the same path the Dossier's "Originate" takes. The fresh record is a DRAFT (no signing
      // envelope yet), so there is no client link to share until confirm provisions it.
      navigate(`/app/m/${res.ref}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate proposal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Field label="Engagement">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className={inputCls}
          disabled={!templates}
        >
          {!templates && <option>Loading…</option>}
          {templates?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Client / signer name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="James Whitfield"
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Email (optional)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jw@firm.com"
            className={inputCls}
          />
        </Field>
        <Field label="Title (optional)">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Managing Director"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Template-driven dynamic vars (empty for the seed postures). */}
      {template?.fields.map((f) => (
        <Field key={f.alias} label={f.label}>
          <input
            value={fieldValues[f.alias] ?? ""}
            onChange={(e) => setFieldValues((v) => ({ ...v, [f.alias]: e.target.value }))}
            placeholder={f.placeholder ?? ""}
            className={inputCls}
          />
        </Field>
      ))}

      {error && (
        <p className="mt-1 mb-2 text-[color:var(--color-state-warn)] text-mono-xs">{error}</p>
      )}

      <button
        type="button"
        onClick={generate}
        disabled={submitting || !name.trim() || !templateId}
        className={primaryBtnCls}
      >
        {submitting ? "Generating…" : "Generate proposal"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: wraps its control via children.
    <label className="mb-3 block">
      <span className="mb-1.5 block font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]";

const primaryBtnCls =
  "mt-4 w-full border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-3 text-center font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40";
