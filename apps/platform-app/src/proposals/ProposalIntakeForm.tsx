/**
 * ProposalIntakeForm — the operator's instantiate form (posture + client
 * identity) and the "ready" panel (Copy link / Open live / Send to client).
 *
 * Container-agnostic and rendered inline on the operator Proposals tab. The
 * caller guarantees a valid operator token (the `/app` cockpit is auth-gated),
 * so there is no sign-in fallback here. The commercial substance rides in the
 * posture; the client fields are cosmetic-bespoke.
 */
import type { CreateProposalResult, ProposalTemplateMeta } from "@rare-structure-hq/shared";
import { Check, Copy, ExternalLink, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { createProposal, listTemplates, sendProposal } from "./api";

export function ProposalIntakeForm({
  token,
  onCreated,
}: {
  token: string;
  onCreated?: () => void;
}) {
  const [templates, setTemplates] = useState<ProposalTemplateMeta[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ res: CreateProposalResult; email: string } | null>(null);

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
      setResult({ res, email: email.trim() });
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate proposal");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setName("");
    setEmail("");
    setTitle("");
    setFieldValues({});
  }

  if (result) {
    return (
      <ReadyPanel result={result.res} token={token} clientEmail={result.email} onReset={reset} />
    );
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

function ReadyPanel({
  result,
  token,
  clientEmail,
  onReset,
}: {
  result: CreateProposalResult;
  token: string;
  clientEmail: string;
  onReset: () => void;
}) {
  const url = `${window.location.origin}/p/${result.ref}`;
  const [copied, setCopied] = useState(false);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function send() {
    setSendState("sending");
    setSendError(null);
    try {
      await sendProposal(token, result.ref);
      setSendState("sent");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Send failed");
      setSendState("error");
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[color:var(--color-text-accent)]">
        <Check className="size-4" />
        <span className="font-mono text-mono-xs uppercase tracking-[0.16em]">Proposal ready</span>
      </div>
      <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm">
        Drop this link on the call, send it, or open it yourself.
      </p>

      <div className="mb-4 flex items-center gap-2 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5">
        <span className="flex-1 truncate font-mono text-[color:var(--color-text-primary)] text-mono-xs">
          {url}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={copy} className={secondaryBtnCls}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => window.open(`/p/${result.ref}`, "_blank", "noopener")}
          className={secondaryBtnCls}
        >
          <ExternalLink className="size-3.5" />
          Open live
        </button>
      </div>

      <button
        type="button"
        onClick={send}
        disabled={!clientEmail || sendState === "sending" || sendState === "sent"}
        title={clientEmail ? `Email the link to ${clientEmail}` : "Add a client email to send"}
        className={`${primaryBtnCls} flex items-center justify-center gap-2`}
      >
        {sendState === "sent" ? <Check className="size-3.5" /> : <Send className="size-3.5" />}
        {sendState === "sending"
          ? "Sending…"
          : sendState === "sent"
            ? `Sent to ${clientEmail}`
            : clientEmail
              ? "Send to client"
              : "Send — no client email"}
      </button>
      {sendError && (
        <p className="mt-2 text-[color:var(--color-state-warn)] text-mono-xs">{sendError}</p>
      )}

      <button
        type="button"
        onClick={onReset}
        className="mt-4 w-full text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em] hover:text-[color:var(--color-text-muted)]"
      >
        New proposal
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

const secondaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]";
