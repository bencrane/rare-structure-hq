/**
 * MandateBrief — the FIRMOGRAPHIC-BRIEF VARIANT of the deal-keyed mandate surface, at
 * /app/m/:handle/brief. A template example alongside the original Mandate (which keeps
 * /app/m/:handle and its editable commercial terms) — this variant does not replace it.
 *
 * Rendered as a document (the shared DocumentFrame letterhead) so it reads as the engagement
 * itself when screenshared to the prospect on the call — NOT an operator console. The body
 * presents read-only company context (the prospect account) + the signatory, then
 * "Confirm & Originate" mints the prefilled PENDING Documenso document off the deal's attached
 * template and reveals the /p/m share link. Commercial terms are NOT shown here — the attached
 * template + its field defaults resolve server-side at originate.
 */
import { Check, Copy, ExternalLink, FileSignature } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { Inline } from "@rare-structure-hq/ui";

import {
  type DealDetails as DealDetailsData,
  type DealOriginated,
  getDealDetails,
  originateDeal,
} from "@/deals/api";
import { useAuth } from "@/lib/auth";
import { DocumentFrame } from "@/proposals/DocumentFrame";

export default function MandateBrief() {
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
  // so originate binds the first signatory; show that contact as the engagement's signatory.
  const signatory = data.contacts.find((c) => c.is_signatory) ?? data.contacts[0] ?? null;
  const fm = data.firmographics ?? {};

  // Mirror the edge 422 preconditions so the action explains itself instead of round-tripping a 422.
  const notice = !data.templateDocumensoId
    ? "No engagement template is attached. Attach one in Deal Details first."
    : !signatory?.email
      ? "No signatory contact with an email. Set a signatory in Deal Details first."
      : null;
  const canOriginate = notice === null;

  const signUrl = originated ? `${window.location.origin}${originated.signLink}` : "";

  // Company facts, two-column. Empty values are dropped so the grid only shows what we have.
  const facts: { label: string; value: string | null | undefined }[] = [
    { label: "Industry", value: fm.industry },
    { label: "Sector", value: fm.sector },
    { label: "Headquarters", value: fm.headquarters },
    { label: "Employees", value: fm.employees },
    { label: "Founded", value: fm.founded },
    { label: "Annual Revenue", value: fm.annualRevenue },
    { label: "Ownership", value: fm.ownership },
    { label: "Entity Type", value: fm.entityType },
    { label: "NAICS", value: fm.naics },
    { label: "Website", value: data.companyDomain },
  ].filter((f) => f.value && String(f.value).trim() !== "");

  return (
    <DocumentFrame title="Engagement Agreement" housing="cockpit">
      <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
        {/* Prepared for — the prospect's company (the engagement reads as theirs on screenshare). */}
        <div className="mb-8 border-[color:var(--color-border-subtle)] border-b pb-5">
          <Eyebrow>Prepared for</Eyebrow>
          <div className="text-[1.375rem] text-[color:var(--color-text-primary)] leading-tight tracking-tight">
            {data.companyName || "—"}
          </div>
          {data.companyDomain ? (
            <div className="mt-1.5 font-mono text-[0.6875rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
              {data.companyDomain}
            </div>
          ) : null}
          {fm.description ? (
            <p className="mt-4 max-w-[46ch] text-[0.875rem] text-[color:var(--color-text-muted)] leading-[1.6]">
              {fm.description}
            </p>
          ) : null}
        </div>

        {/* Company — read-only firmographic context on the prospect account. */}
        {facts.length > 0 ? (
          <div className="mb-10">
            <Eyebrow accent>Company</Eyebrow>
            <dl className="grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
              {facts.map((f) => (
                <Fact key={f.label} label={f.label} value={f.value as string} />
              ))}
            </dl>
          </div>
        ) : null}

        {/* Signatory — who executes on the prospect side (set in Deal Details). */}
        {signatory ? (
          <div className="mb-10">
            <Eyebrow>Signatory</Eyebrow>
            <div className="border-[color:var(--color-border-subtle)] border-b py-3">
              <div className="text-[0.9375rem] text-[color:var(--color-text-primary)]">
                {signatory.full_name || "—"}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.12em]">
                {signatory.title ? <span>{signatory.title}</span> : null}
                {signatory.title && signatory.email ? (
                  <span className="text-[color:var(--color-border-default)]">·</span>
                ) : null}
                {signatory.email ? (
                  <span className="lowercase tracking-normal">{signatory.email}</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Execution — Confirm & Originate, then the share link. */}
        {originated ? (
          <ReadyBar
            signUrl={signUrl}
            documentId={originated.documentId}
            status={originated.status}
          />
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

// A single firmographic fact — label above value, sitting in the two-column company grid.
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Inline
      gap="4"
      align="baseline"
      justify="between"
      py="3"
      unsafe_className="border-[color:var(--color-border-subtle)] border-b"
    >
      <dt className="font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.12em]">
        {label}
      </dt>
      <dd className="text-right text-[0.9375rem] text-[color:var(--color-text-primary)]">
        {value}
      </dd>
    </Inline>
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
