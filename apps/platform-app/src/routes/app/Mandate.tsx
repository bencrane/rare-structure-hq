/**
 * Mandate — the operator's deal-keyed mandate surface at /app/m/:handle, rendered as a document
 * (the shared DocumentFrame letterhead) so it reads as the engagement itself when screenshared to the
 * prospect on the call — NOT an operator console. Loads the deal's signatory + attached Documenso
 * template (both read-only here; set in Deal Details), then "Confirm & Originate" mints the prefilled
 * PENDING Documenso document and reveals the /p/m share link.
 *
 * Deal-keyed: the template (and its baked terms) ride on the deal via deal_details.default_template_uuid,
 * so only the deal handle is keyed. Per-deal pricing edits are a later phase (the price is baked into
 * the template document, not an editable field), so the terms render read-only here.
 */
import { Check, Copy, ExternalLink, FileSignature, Lock, LockOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  type DealOriginated,
  type DealDetails as DealDetailsData,
  getDealDetails,
  originateDeal,
} from "@/deals/api";
import { useAuth } from "@/lib/auth";
import { DocumentFrame } from "@/proposals/DocumentFrame";

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

  // Lock/edit: the header lock toggles the engagement values between read-only and editable. Edits are
  // local-only for now (no persistence wired) — overrides null until the operator types into a field.
  const [locked, setLocked] = useState(true);
  const [mandateOverride, setMandateOverride] = useState<string | null>(null);
  const [termsOverride, setTermsOverride] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token || !handle) return;
    setPhase("loading");
    setError(null);
    getDealDetails(token, handle)
      .then((d) => {
        setData(d);
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

  if (phase === "loading") return <Note>Loading mandate…</Note>;
  if (phase === "notfound") return <Note>This deal could not be found.</Note>;
  if (phase === "error" || !data) return <Note>{error ?? "Couldn’t load this deal."}</Note>;

  // The signatory is set in Deal Details (deal_contacts.is_signatory). One prospect slot per template,
  // so originate binds the first signatory; show that contact as "prepared for".
  const signatory = data.contacts.find((c) => c.is_signatory) ?? data.contacts[0] ?? null;
  const attached =
    data.availableTemplates.find((t) => t.templateUuid === data.defaultTemplateUuid) ?? null;

  // The template label encodes the engagement + its terms ("… — $30,000 / 2.0%"); split on the em dash
  // for a headline/terms pair, degrading to the whole label when there is no separator.
  const [engagementTitle, engagementTerms] = splitEngagement(attached?.name ?? null);
  // Displayed values fall back to the derived template values until the operator edits them.
  const mandateValue = mandateOverride ?? engagementTitle ?? "";
  const termsValue = termsOverride ?? engagementTerms ?? "";

  // Mirror the edge 422 preconditions so the action explains itself instead of round-tripping a 422.
  const blockReason = !data.defaultTemplateUuid
    ? "No engagement template is attached. Attach one in Deal Details first."
    : !signatory?.email
      ? "No signatory contact with an email. Set a signatory in Deal Details first."
      : null;
  const canOriginate = blockReason === null;

  const signUrl = originated ? `${window.location.origin}${originated.signLink}` : "";

  return (
    <DocumentFrame
      title="Engagement Agreement"
      housing="cockpit"
      headerAccessory={<LockToggle locked={locked} onToggle={() => setLocked((l) => !l)} />}
    >
      <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
        <Link to={`/app/applications/${handle}`} className={backCls}>
          ← Application
        </Link>

        {/* Prepared for — the prospect signatory bound at originate. */}
        <div className="mt-6 mb-8 border-[color:var(--color-border-subtle)] border-b pb-5">
          <Eyebrow>Prepared for</Eyebrow>
          <div className="text-[0.9375rem] text-[color:var(--color-text-primary)]">
            {signatory?.full_name || "—"}
            {data.companyName ? (
              <span className="text-[color:var(--color-text-muted)]"> · {data.companyName}</span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[0.8125rem] text-[color:var(--color-text-muted)]">
            {signatory?.title ? <span>{signatory.title}</span> : null}
            {signatory?.email ? <span className="tabular-nums">{signatory.email}</span> : null}
          </div>
        </div>

        {/* Engagement — the attached template + its baked terms (read-only; set in Deal Details). */}
        <div className="mb-10">
          <Eyebrow accent>Engagement</Eyebrow>
          <TermRow label="Mandate">
            {locked ? (
              <TermVal>{mandateValue || "None attached"}</TermVal>
            ) : (
              <input
                value={mandateValue}
                onChange={(e) => setMandateOverride(e.target.value)}
                className={editCls}
              />
            )}
          </TermRow>
          {termsValue || !locked ? (
            <TermRow label="Terms">
              {locked ? (
                <TermVal>{termsValue}</TermVal>
              ) : (
                <input
                  value={termsValue}
                  onChange={(e) => setTermsOverride(e.target.value)}
                  className={editCls}
                />
              )}
            </TermRow>
          ) : null}
          <TermRow label="Template">
            <span className="flex items-center gap-2">
              <TermVal>{attached?.documensoTemplateId ? `#${attached.documensoTemplateId}` : "—"}</TermVal>
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
        </div>

        {/* Execution — Confirm & Originate, then the share link. */}
        {originated ? (
          <ReadyBar signUrl={signUrl} documentId={originated.documentId} status={originated.status} />
        ) : (
          <div>
            {blockReason ? (
              <p className="mb-3 text-center font-mono text-[0.5625rem] text-[color:var(--color-state-warn)] uppercase tracking-[0.14em]">
                {blockReason}
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

// Header lock — toggles the engagement values between read-only and editable. Locked by default.
function LockToggle({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={locked ? "Unlock to edit" : "Lock"}
      className={`flex shrink-0 items-center justify-center border px-2.5 py-1 transition-colors ${
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

const backCls =
  "inline-flex w-fit items-center font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em] transition-colors hover:text-[color:var(--color-text-accent)]";

// Inline editable value — matches TermVal typography, right-aligned, faint surface for affordance,
// NO border/underline (per the operator: no underscore under the field when it becomes editable).
const editCls =
  "flex-1 bg-[color:var(--color-surface-raised)] px-2 py-0.5 text-right text-[0.9375rem] text-[color:var(--color-text-primary)] outline-none";

// "Engagement Title — $terms" → [title, terms]; no separator → [whole, null].
function splitEngagement(name: string | null): [string | null, string | null] {
  if (!name) return [null, null];
  const idx = name.indexOf("—");
  if (idx === -1) return [name.trim(), null];
  const title = name.slice(0, idx).trim();
  const terms = name.slice(idx + 1).trim();
  return [title || name.trim(), terms || null];
}
