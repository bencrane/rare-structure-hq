/**
 * InstantiateProposalDialog — the operator's one-click proposal surface.
 *
 * Opened from the ⌘K palette ("Generate engagement proposal…"). The operator
 * picks a posture (non-revealing label), fills the minimal client identity, and
 * one click mints a proposal record → a shareable `/p/:ref` link they can drop
 * live on the call or open themselves. The commercial substance rides in the
 * posture; the client fields are cosmetic-bespoke.
 *
 * Auth: instantiating is operator-only. If there is no Supabase session the
 * dialog falls back to an inline magic-link sign-in (one-time; the session
 * persists, so on a live call the operator is already authed and it's instant).
 *
 * Styling + motion mirror the cockpit's CommandPalette.
 */
import type { CreateProposalResult, ProposalTemplateMeta } from "@rare-structure-hq/shared";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, ExternalLink, FileSignature } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createProposal, listTemplates } from "./api";

export function InstantiateProposalDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const reduced = !!useReducedMotion();
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-6 pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[color:var(--color-surface-overlay)] backdrop-blur-sm"
          />
          {/* biome-ignore lint/a11y/useSemanticElements: animated modal needs role+aria, not native <dialog>. */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Generate engagement proposal"
            className="relative w-full max-w-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-2xl shadow-black/60"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reduced ? { duration: 0.12 } : { duration: 0.2 }}
          >
            <div className="flex items-center gap-3 border-[color:var(--color-border-subtle)] border-b px-5 py-4">
              <FileSignature className="size-4 shrink-0 text-[color:var(--color-text-accent)]" />
              <span className="flex-1 font-mono text-[color:var(--color-text-primary)] text-body-sm uppercase tracking-[0.14em]">
                Engagement Proposal
              </span>
              <kbd className="border border-[color:var(--color-border-default)] px-1.5 py-0.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs leading-none">
                esc
              </kbd>
            </div>

            {token ? <ProposalForm token={token} onClose={onClose} /> : <SignInPanel />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Inline magic-link sign-in (operator establishes a session once) ──────────
function SignInPanel() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!email.trim()) return;
    setState("sending");
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/map` },
    });
    if (err) {
      setError(err.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <div className="px-5 py-8 text-center">
        <Check className="mx-auto mb-3 size-6 text-[color:var(--color-text-accent)]" />
        <p className="text-[color:var(--color-text-primary)] text-body-sm">Check your email</p>
        <p className="mt-1 text-[color:var(--color-text-muted)] text-body-sm">
          A sign-in link is on its way to {email}. Open it, then reopen this dialog.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-6">
      <p className="mb-3 text-[color:var(--color-text-muted)] text-body-sm">
        Sign in to generate proposals. One-time — your session persists.
      </p>
      <Field label="Operator email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="you@rarestructure.com"
          // biome-ignore lint/a11y/noAutofocus: focus the only field on open.
          autoFocus
          className={inputCls}
        />
      </Field>
      {error && <p className="mt-2 text-[color:var(--color-state-warn)] text-mono-xs">{error}</p>}
      <button type="button" onClick={send} disabled={state === "sending"} className={primaryBtnCls}>
        {state === "sending" ? "Sending…" : "Send sign-in link"}
      </button>
    </div>
  );
}

// ── The instantiate form (authed) ────────────────────────────────────────────
function ProposalForm({ token, onClose }: { token: string; onClose: () => void }) {
  const [templates, setTemplates] = useState<ProposalTemplateMeta[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateProposalResult | null>(null);

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
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate proposal");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <ReadyPanel result={result} onClose={onClose} />;

  return (
    <div className="max-h-[64vh] overflow-y-auto px-5 py-5">
      <Field label="Engagement">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: Field wraps the select. */}
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
          // biome-ignore lint/a11y/noAutofocus: focus the first real field on open.
          autoFocus
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
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

// ── Ready: the link is live ──────────────────────────────────────────────────
function ReadyPanel({ result, onClose }: { result: CreateProposalResult; onClose: () => void }) {
  const url = `${window.location.origin}${result.path}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="px-5 py-6">
      <div className="mb-1 flex items-center gap-2 text-[color:var(--color-text-accent)]">
        <Check className="size-4" />
        <span className="font-mono text-mono-xs uppercase tracking-[0.16em]">Proposal ready</span>
      </div>
      <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm">
        Drop this link on the call, or open it yourself.
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
          onClick={() => window.open(result.path, "_blank", "noopener")}
          className={secondaryBtnCls}
        >
          <ExternalLink className="size-3.5" />
          Open live
        </button>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em] hover:text-[color:var(--color-text-muted)]"
      >
        Done
      </button>
    </div>
  );
}

// ── Small styled primitives (kept local; match the design system) ────────────
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
