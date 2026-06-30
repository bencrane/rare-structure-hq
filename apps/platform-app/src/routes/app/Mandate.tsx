/**
 * Mandate — the operator's deal-keyed mandate surface at /app/m/:handle, rendered as a document
 * (the shared DocumentFrame letterhead) so it reads as the engagement itself when screenshared to the
 * prospect on the call — NOT an operator console. Loads the deal's signatory + attached Documenso
 * template (both read-only here; set in Deal Details), then "Confirm & Originate" mints the prefilled
 * PENDING Documenso document and reveals the /p/m share link.
 *
 * Deal-keyed: the template (and its baked terms) ride on the deal via the active
 * deal_document_configs.template_documenso_id (the mirror attach), so only the deal handle is keyed.
 * Per-deal pricing edits are a later phase (the price is baked into
 * the template document, not an editable field), so the terms render read-only here.
 */
import { Check, Copy, ExternalLink, FileSignature, Lock, LockOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  type DealOriginated,
  type DealDetails as DealDetailsData,
  getDealDetails,
  originateDeal,
  updateDealDetails,
} from "@/deals/api";
import { useAuth } from "@/lib/auth";
import { DocumentFrame } from "@/proposals/DocumentFrame";
import {
  getPrefillConfig,
  type TemplatePrefillConfig,
} from "@/settings/documenso-template-prefill-api";

export default function Mandate() {
  // The URL carries the deal's 8-char public handle (DealSummary.handle).
  const { handle = "" } = useParams();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [data, setData] = useState<DealDetailsData | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const [originating, setOriginating] = useState(false);
  const [originated, setOriginated] = useState<DealOriginated | null>(null);
  const [originateError, setOriginateError] = useState<string | null>(null);

  // Lock/edit: the header lock toggles the engagement TERMS between read-only and editable, and locking
  // PERSISTS the edits (the save action). Unlock to edit, lock to write the edited field_values back to
  // the deal's active deal_document_configs — the same append-only path Deal Details writes via PUT.
  const [locked, setLocked] = useState(true);
  // The deal's per-field OVERRIDES (label → value), working copy edited while unlocked. Mirrors the Deal
  // Details editor: the input holds the override; the config default rides as the placeholder.
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // The attached template's prefill config — its per-label defaults resolve the LOCKED display value
  // (override ?? default), so the page shows exactly what originate will bake in (model B).
  const [prefill, setPrefill] = useState<TemplatePrefillConfig | null>(null);
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
        setFieldValues(toStringRecord(d.fieldValues));
        setPhase("ready");
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load this deal";
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

  // Fetch the attached template's prefill config so the LOCKED display can resolve override ?? default
  // (the value originate actually bakes). Cleared when no template is attached.
  const templateDocumensoId = data?.templateDocumensoId ?? null;
  useEffect(() => {
    if (!token || templateDocumensoId === null) {
      setPrefill(null);
      return;
    }
    let cancelled = false;
    getPrefillConfig(token, templateDocumensoId)
      .then((p) => {
        if (!cancelled) setPrefill(p);
      })
      .catch(() => {
        if (!cancelled) setPrefill(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, templateDocumensoId]);

  // Per-label config defaults from the prefill config (the default that backs each override). Computed
  // above the phase early-returns so this hook runs unconditionally (Rules of Hooks); empty until load.
  const defaults = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (!prefill) return out;
    for (const [label, s] of Object.entries(prefill.field_settings)) {
      const d = s.default_document_field_value;
      if (typeof d === "string") out[label] = d;
    }
    return out;
  }, [prefill]);

  async function originate() {
    setOriginating(true);
    setOriginateError(null);
    try {
      const r = await originateDeal(token, handle);
      setOriginated(r);
    } catch (e) {
      setOriginateError(e instanceof Error ? e.message : "Could not originate the mandate");
    } finally {
      setOriginating(false);
    }
  }

  // Persist the edited engagement terms to the deal's active deal_document_configs via PUT details — the
  // SAME append-only path Deal Details uses. Contacts + attached template are passed through unchanged
  // (the PUT reconciles the junction; passing the current set is a no-op), so only field_values change.
  async function persistTerms() {
    if (!data) return;
    setSaving(true);
    setSaveError(null);
    try {
      const fresh = await updateDealDetails(token, handle, {
        contacts: data.contacts
          .filter((c) => !!c.contact_id)
          .map((c) => ({ contact_id: c.contact_id as string, is_signatory: c.is_signatory ?? true })),
        fieldValues,
        templateDocumensoId: data.templateDocumensoId,
      });
      setData(fresh);
      setFieldValues(toStringRecord(fresh.fieldValues));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the engagement terms");
    } finally {
      setSaving(false);
    }
  }

  // Header lock: unlock → edit; lock → persist. Locking IS the save action.
  function toggleLock() {
    if (saving) return;
    if (locked) {
      setSaveError(null);
      setLocked(false);
    } else {
      setLocked(true);
      void persistTerms();
    }
  }

  if (phase === "loading") return <Note>Loading mandate…</Note>;
  if (phase === "notfound") return <Note>This deal could not be found.</Note>;
  if (phase === "error" || !data) return <Note>{error ?? "Couldn’t load this deal."}</Note>;

  // The signatory is set in Deal Details (deal_contacts.is_signatory). One prospect slot per template,
  // so originate binds the first signatory; show that contact as "prepared for".
  const signatory = data.contacts.find((c) => c.is_signatory) ?? data.contacts[0] ?? null;
  const attached =
    data.availableTemplates.find((t) => t.documensoId === data.templateDocumensoId) ?? null;

  // Mirror the edge 422 preconditions so the action explains itself instead of round-tripping a 422.
  // Also require LOCKED (terms committed) before originating, so unsaved edits can't silently ship.
  const blockReason = !data.templateDocumensoId
    ? "No engagement template is attached. Attach one in Deal Details first."
    : !signatory?.email
      ? "No signatory contact with an email. Set a signatory in Deal Details first."
      : null;
  const editingNotice = !locked ? "Lock the terms to save, then originate." : null;
  const canOriginate = blockReason === null && locked;
  const notice = blockReason ?? editingNotice;

  const signUrl = originated ? `${window.location.origin}${originated.signLink}` : "";

  return (
    <DocumentFrame
      title="Engagement Agreement"
      housing="cockpit"
      headerAccessory={<LockToggle locked={locked} saving={saving} onToggle={toggleLock} />}
    >
      <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
        {/* Prepared for — the prospect's company (the engagement reads as theirs on screenshare). */}
        <div className="mb-8 border-[color:var(--color-border-subtle)] border-b pb-5">
          <Eyebrow>Prepared for</Eyebrow>
          <div className="text-[0.9375rem] text-[color:var(--color-text-primary)]">
            {data.companyName || "—"}
          </div>
        </div>

        {/* Engagement — the attached mandate + its commercial terms. The three terms ARE the deal's
            field_values overrides (operator-chosen labels mapping to IntroNum / PrepaidFee / PricePerIntro);
            unlock to edit, lock to persist. Mandate name + Template are read-only (set in Deal Details). */}
        <div className="mb-10">
          <Eyebrow accent>Engagement</Eyebrow>
          <TermRow label="Mandate">
            <TermVal>{attached?.name || "None attached"}</TermVal>
          </TermRow>
          {MANDATE_TERMS.map(({ key, label }) => {
            const override = fieldValues[key] ?? "";
            const fallback = defaults[key] ?? "";
            const resolved = override.trim() !== "" ? override : fallback;
            return (
              <TermRow key={key} label={label}>
                {locked ? (
                  <TermVal>{resolved || "—"}</TermVal>
                ) : (
                  <input
                    value={override}
                    placeholder={fallback}
                    onChange={(e) => setFieldValues((fv) => ({ ...fv, [key]: e.target.value }))}
                    className={editCls}
                  />
                )}
              </TermRow>
            );
          })}
          <TermRow label="Template">
            <span className="flex items-center gap-2">
              <TermVal>{attached?.documensoId ? `#${attached.documensoId}` : "—"}</TermVal>
              {attached ? (
                <span
                  className={`shrink-0 border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.16em] ${
                    data.templateOrigin === "operator"
                      ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
                      : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)]"
                  }`}
                >
                  {data.templateOrigin === "operator" ? "Custom" : "Org default"}
                </span>
              ) : null}
            </span>
          </TermRow>
          {/* Lock-to-persist feedback. */}
          {saveError ? (
            <p className="mt-3 text-right font-mono text-[0.5625rem] text-[color:var(--color-state-warn)] uppercase tracking-[0.14em]">
              {saveError}
            </p>
          ) : saving ? (
            <p className="mt-3 text-right font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
              Saving…
            </p>
          ) : justSaved ? (
            <p className="mt-3 text-right font-mono text-[0.5625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.14em]">
              Saved
            </p>
          ) : null}
        </div>

        {/* Execution — Confirm & Originate, then the share link. */}
        {originated ? (
          <ReadyBar signUrl={signUrl} documentId={originated.documentId} status={originated.status} />
        ) : (
          <div>
            {notice ? (
              <p className="mb-3 text-center font-mono text-[0.5625rem] text-[color:var(--color-state-warn)] uppercase tracking-[0.14em]">
                {notice}
              </p>
            ) : null}
            <button
              type="button"
              onClick={originate}
              disabled={originating || !canOriginate}
              className="flex w-full items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-3 font-mono text-[0.8125rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40 disabled:hover:bg-[color:var(--color-accent-soft)] disabled:hover:text-[color:var(--color-text-accent)]"
            >
              <FileSignature className="size-4" />
              {originating ? "Originating…" : "Confirm & Originate"}
            </button>
            {originateError ? (
              <p className="mt-2 text-center font-mono text-[0.5625rem] text-[color:var(--color-state-warn)] uppercase tracking-[0.14em]">
                {originateError}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </DocumentFrame>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.2em]">
        {children}
      </div>
    </div>
  );
}

// Header lock — toggles the engagement terms between read-only and editable; locking PERSISTS the edits
// (the save action). Locked by default; disabled mid-save.
function LockToggle({
  locked,
  saving,
  onToggle,
}: {
  locked: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      aria-label={locked ? "Unlock to edit" : "Lock and save"}
      className={`flex shrink-0 items-center justify-center border px-2.5 py-1 transition-colors disabled:opacity-50 ${
        locked
          ? "border-[color:var(--color-border-default)] text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-accent)]"
          : "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
      }`}
    >
      {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
    </button>
  );
}

function Eyebrow({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className={`mb-3 font-mono text-[0.625rem] uppercase tracking-[0.2em] ${
        accent ? "text-[color:var(--color-text-accent)]" : "text-[color:var(--color-text-subtle)]"
      }`}
    >
      {children}
    </div>
  );
}

function TermRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-[color:var(--color-border-subtle)] border-b py-3">
      <span className="font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.12em]">
        {label}
      </span>
      {children}
    </div>
  );
}

function TermVal({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-right text-[0.9375rem] text-[color:var(--color-text-primary)]">
      {children}
    </span>
  );
}

// The "ready" state — the minted document's prospect signing link, to share on the call.
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
          Mandate originated{documentId ? ` — #${documentId}` : ""} ({status})
        </span>
      </div>
      <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm leading-[1.5]">
        The signing document is ready. Share this link with the signatory — no email was sent.
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

// Inline editable value — matches TermVal typography, right-aligned, faint surface for affordance,
// NO border/underline (per the operator: no underscore under the field when it becomes editable).
const editCls =
  "flex-1 bg-[color:var(--color-surface-raised)] px-2 py-0.5 text-right text-[0.9375rem] text-[color:var(--color-text-primary)] outline-none";

// The three commercial terms shown on the mandate — the operator-chosen prospect-facing words mapped to
// the deal_document_configs field_values keys (the live operator-term labels on the attached template).
const MANDATE_TERMS: { key: string; label: string }[] = [
  { key: "IntroNum", label: "Originated Opportunities" },
  { key: "PrepaidFee", label: "Investment Amount" },
  { key: "PricePerIntro", label: "Price Per Opportunity" },
];

// Coerce the stored field_values (jsonb; values may be any) into a string map for the editable inputs.
function toStringRecord(r: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)]));
}
