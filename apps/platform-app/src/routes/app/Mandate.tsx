/**
 * Mandate — the originate surface, opened from an Application by the deal's 8-char handle. Reads the
 * deal's attached Documenso template + signatory contact (read-only; both are set in Deal Details)
 * and originates a prefilled, PENDING Documenso document, surfacing the /p/m prospect sign link.
 * Authors no geometry — composes CockpitPage. Payment is a later phase; this stops at originate → sign.
 */
import { Check, ChevronLeft, Copy, ExternalLink, FileSignature } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Badge, Text } from "@rare-structure-hq/ui";

import { CockpitPage, Panel, Section } from "@/app/cockpit";
import {
  type DealOriginated,
  type DealDetails as DealDetailsData,
  getDealDetails,
  originateDeal,
} from "@/deals/api";
import { useAuth } from "@/lib/auth";

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
  const [copied, setCopied] = useState(false);

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

  const back = (
    <Link to={`/app/applications/${handle}`} className={backCls}>
      <ChevronLeft className="size-3.5" />
      Application
    </Link>
  );

  if (phase === "loading") {
    return (
      <CockpitPage title="Mandate" description="Loading…">
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
      <CockpitPage title="Mandate" description="Couldn’t load this deal.">
        {back}
        <Panel>
          <Text size="mono-xs" mono color="subtle" className="break-words">
            {error}
          </Text>
        </Panel>
      </CockpitPage>
    );
  }

  // The signatory is set in Deal Details (deal_contacts.is_signatory). One prospect slot per template,
  // so originate binds the FIRST signatory; surface all flagged here for transparency.
  const signatories = data.contacts.filter((c) => c.is_signatory);
  const signatoryWithEmail = signatories.find((c) => !!c.email);
  const attachedTemplate =
    data.availableTemplates.find((t) => t.templateUuid === data.defaultTemplateUuid) ?? null;

  // Mirror the edge 422 preconditions so the button explains itself instead of round-tripping a 422.
  const blockReason = !data.defaultTemplateUuid
    ? "No Documenso template is attached. Attach one in Deal Details first."
    : !signatoryWithEmail
      ? "No signatory contact with an email. Set a signatory in Deal Details first."
      : null;
  const canOriginate = blockReason === null;

  const signUrl = originated ? `${window.location.origin}${originated.signLink}` : "";

  async function copyLink() {
    if (!signUrl) return;
    try {
      await navigator.clipboard.writeText(signUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the link is still visible to copy by hand */
    }
  }

  return (
    <CockpitPage
      title="Mandate"
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

      <Section label="Signatory">
        <Panel>
          {signatories.length === 0 ? (
            <Text size="body-sm" color="subtle">
              No signatory on this deal. Set one in Deal Details.
            </Text>
          ) : (
            <div className="flex flex-col gap-4">
              {signatories.map((c, i) => (
                <div
                  key={c.contact_id ?? `sig-${i}`}
                  className="grid gap-3 border-[color:var(--color-border-subtle)] border-b pb-4 last:border-0 last:pb-0 sm:grid-cols-3"
                >
                  <Field label="Full name">
                    <ReadonlyValue>{c.full_name || "—"}</ReadonlyValue>
                  </Field>
                  <Field label="Email">
                    <ReadonlyValue>{c.email || "—"}</ReadonlyValue>
                  </Field>
                  <Field label="Title">
                    <ReadonlyValue>{c.title || "—"}</ReadonlyValue>
                  </Field>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Section>

      <Section label="Documenso template">
        <Panel>
          <Field label="Attached template">
            <div className="flex items-center justify-between gap-3 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5">
              <Text
                size="body-sm"
                color={attachedTemplate ? "primary" : "subtle"}
                className="truncate"
              >
                {attachedTemplate?.name ?? attachedTemplate?.documensoTemplateId ?? "None attached"}
              </Text>
              {attachedTemplate ? (
                <Badge tone={data.templateOrigin === "operator" ? "warn" : "info"}>
                  {data.templateOrigin === "operator" ? "Custom" : "Org default"}
                </Badge>
              ) : null}
            </div>
          </Field>
        </Panel>
      </Section>

      <Section label="Originate">
        <Panel>
          <div className="flex flex-col gap-4">
            {originated ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 text-[color:var(--color-text-accent)]" />
                  <Text size="mono-xs" mono color="primary">
                    Mandate originated — document #{originated.documentId} ({originated.status})
                  </Text>
                </div>
                <Field label="Prospect signing link">
                  <div className="flex items-center gap-2">
                    <a
                      href={signUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 truncate border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-accent)] text-body-sm hover:underline"
                    >
                      {signUrl}
                    </a>
                    <button
                      type="button"
                      onClick={copyLink}
                      aria-label="Copy signing link"
                      className={iconBtnCls}
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <a href={signUrl} target="_blank" rel="noreferrer" className={iconBtnCls}>
                      <ExternalLink className="size-3.5" />
                      Open
                    </a>
                  </div>
                </Field>
              </div>
            ) : (
              <Text size="body-sm" color="subtle">
                Originating mints a prefilled, PENDING Documenso document from the attached template
                and binds the signatory as the prospect. No email is sent — share the returned link.
              </Text>
            )}

            {blockReason ? (
              <Text size="mono-xs" mono color="subtle">
                {blockReason}
              </Text>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              {originateError ? (
                <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
                  {originateError}
                </Text>
              ) : null}
              <button
                type="button"
                onClick={originate}
                disabled={originating || !canOriginate}
                className={originateBtnCls}
              >
                <FileSignature className="size-3.5" />
                {originating
                  ? "Originating…"
                  : originated
                    ? "Originate again"
                    : "Originate Mandate"}
              </button>
            </div>
          </div>
        </Panel>
      </Section>
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

const iconBtnCls =
  "flex shrink-0 items-center gap-1.5 border border-[color:var(--color-border-default)] px-3 py-2.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.12em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]";

const originateBtnCls =
  "flex shrink-0 items-center justify-center gap-2 border border-[color:var(--color-border-default)] px-6 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)] disabled:opacity-50 disabled:hover:border-[color:var(--color-border-default)] disabled:hover:text-[color:var(--color-text-muted)]";
