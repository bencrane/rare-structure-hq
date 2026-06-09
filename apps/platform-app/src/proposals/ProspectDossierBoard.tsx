/**
 * ProspectDossierBoard — the "verify the prospect, then originate" surface (the Dossier tab).
 *
 * A research-driven alternative to the bare intake form: the operator lands in what reads as the
 * prospect's profile (firmographics + focus areas the operator pulled via Parallel/Exa out of band),
 * verifies / edits each field on the call ("is this right?"), then originates — which runs the SAME
 * create → DocRaptor → Documenso path as the intake form and materializes the executive-summary
 * proposal at `/p/:ref`.
 *
 * The dossier enrichment (overview, focus areas, industries, geos, firmographics) is the evaluation
 * surface; it is intentionally NOT wired into the legal agreement (the agreement is the fixed
 * DocRaptor template + posture fee + client identity). Only identity + posture drive the create.
 *
 * Lives in `proposals/` (not `routes/`) so it owns its own geometry; the Dossier route stays a
 * thin CockpitPage composition.
 */
import type { ProposalTemplateMeta } from "@rare-structure-hq/shared";
import {
  Banknote,
  Building2,
  Check,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createProposal, listTemplates } from "./api";

type SectionKey = "identity" | "signer" | "overview" | "focus" | "industries" | "geographies";

const SECTION_LABELS: Record<SectionKey, string> = {
  identity: "Identity",
  signer: "Main contact",
  overview: "Overview",
  focus: "Focus areas",
  industries: "Industries",
  geographies: "Geographies",
};

export function ProspectDossierBoard({ token }: { token: string }) {
  // Identity + the only fields that drive the create.
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [signerName, setSignerName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");

  // Firmographics + enrichment — the evaluation surface (cosmetic to the agreement).
  const [hq, setHq] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [capital, setCapital] = useState("");
  const [overview, setOverview] = useState("");
  const [focus, setFocus] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [geographies, setGeographies] = useState<string[]>([]);

  const [verified, setVerified] = useState<Record<SectionKey, boolean>>({
    identity: false,
    signer: false,
    overview: false,
    focus: false,
    industries: false,
    geographies: false,
  });

  const [templates, setTemplates] = useState<ProposalTemplateMeta[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [pulled, setPulled] = useState(false);
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
      .catch((e) => active && setError(e instanceof Error ? e.message : "Failed to load postures"));
    return () => {
      active = false;
    };
  }, [token]);

  const toggleVerified = (k: SectionKey) => setVerified((v) => ({ ...v, [k]: !v[k] }));
  const verifiedCount = Object.values(verified).filter(Boolean).length;

  // Enrichment seam — wire Parallel/Exa here. For now it scaffolds an editable DRAFT the operator
  // verifies on the call; suggestions are generic capital-partner categories, never asserted facts.
  function pullResearch() {
    setPulled(true);
    setVerified({
      identity: false,
      signer: false,
      overview: false,
      focus: false,
      industries: false,
      geographies: false,
    });
    setFocus((f) => (f.length ? f : ["Buyout", "Growth equity"]));
    setIndustries((i) => (i.length ? i : ["Private Equity", "Private Credit"]));
    setGeographies((g) => (g.length ? g : ["North America"]));
  }

  const identityName = company.trim() || signerName.trim();
  const canOriginate = !!identityName && !!templateId && !submitting;

  async function originate() {
    if (!canOriginate) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createProposal(token, {
        templateId,
        client: {
          name: identityName,
          email: email.trim() || undefined,
          title: title.trim() || undefined,
        },
        fieldValues: {},
      });
      // Land the operator in the proposal — signed in, it opens as their editable draft.
      navigate(`/p/${res.ref}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not originate the mandate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ── Profile (left, 2/3) ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        {/* Identity header */}
        <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 font-mono text-[0.5625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
              <Building2 className="size-3.5" />
              Prospect Dossier
            </div>
            <div className="flex items-center gap-2">
              {pulled && (
                <span className="border border-[color:var(--color-border-default)] px-2 py-1 font-mono text-[0.5rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.16em]">
                  Draft · verify
                </span>
              )}
              <span className="font-mono text-[0.5rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
                {verifiedCount}/6 verified
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex size-14 shrink-0 items-center justify-center border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] font-display font-semibold text-[1.25rem] text-[color:var(--color-text-accent)]">
              {(identityName || "—").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <GhostInput
                value={company}
                onChange={setCompany}
                placeholder="Whitfield Capital Partners, LP"
                className="pb-0.5 font-display font-semibold text-[1.1875rem] text-[color:var(--color-text-primary)] leading-tight"
              />
              <GhostInput
                value={domain}
                onChange={setDomain}
                placeholder="whitfieldcap.com"
                className="mt-1.5 font-mono text-[0.75rem] text-[color:var(--color-text-subtle)]"
              />
            </div>
            <VerifyToggle on={verified.identity} onToggle={() => toggleVerified("identity")} />
          </div>

          {/* Firmographic stat strip */}
          <div className="mt-7 grid grid-cols-1 gap-px border border-[color:var(--color-border-subtle)] bg-[color:var(--color-border-subtle)] sm:grid-cols-3">
            <Stat
              icon={MapPin}
              label="Headquarters"
              value={hq}
              onChange={setHq}
              placeholder="New York, NY"
            />
            <Stat
              icon={Users}
              label="Headcount"
              value={headcount}
              onChange={setHeadcount}
              placeholder="40–60"
            />
            <Stat
              icon={Banknote}
              label="Capital / AUM"
              value={capital}
              onChange={setCapital}
              placeholder="$1.2B"
            />
          </div>
        </div>

        {/* Signer */}
        <SectionCard
          label={SECTION_LABELS.signer}
          verified={verified.signer}
          onToggle={() => toggleVerified("signer")}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Name">
              <BoxedInput
                value={signerName}
                onChange={setSignerName}
                placeholder="James Whitfield"
              />
            </Field>
            <Field label="Title">
              <BoxedInput value={title} onChange={setTitle} placeholder="Managing Director" />
            </Field>
            <Field label="Email">
              <BoxedInput
                value={email}
                onChange={setEmail}
                placeholder="jw@whitfieldcap.com"
                type="email"
              />
            </Field>
          </div>
        </SectionCard>

        {/* Overview */}
        <SectionCard
          label={SECTION_LABELS.overview}
          verified={verified.overview}
          onToggle={() => toggleVerified("overview")}
        >
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            rows={3}
            placeholder="A short, on-the-record description of the firm — strategy, posture, why they're a fit for the mandate."
            className="w-full resize-y border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm leading-[1.6] outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
          />
        </SectionCard>

        {/* Focus / Industries / Geographies */}
        <SectionCard
          label={SECTION_LABELS.focus}
          verified={verified.focus}
          onToggle={() => toggleVerified("focus")}
        >
          <TagEditor tags={focus} onChange={setFocus} placeholder="Add a focus area" />
        </SectionCard>
        <SectionCard
          label={SECTION_LABELS.industries}
          verified={verified.industries}
          onToggle={() => toggleVerified("industries")}
        >
          <TagEditor tags={industries} onChange={setIndustries} placeholder="Add an industry" />
        </SectionCard>
        <SectionCard
          label={SECTION_LABELS.geographies}
          verified={verified.geographies}
          onToggle={() => toggleVerified("geographies")}
        >
          <TagEditor tags={geographies} onChange={setGeographies} placeholder="Add a geography" />
        </SectionCard>
      </div>

      {/* ── Origination (right, 1/3) ─────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] p-5">
          <div className="mb-1 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
            Originate
          </div>
          <p className="mb-4 text-[color:var(--color-text-muted)] text-body-sm leading-[1.5]">
            On save the agreement is rendered and the executive summary materializes at its link —
            no separate "create a proposal" step.
          </p>

          <button
            type="button"
            onClick={pullResearch}
            className="mb-4 flex w-full items-center justify-center gap-2 border border-[color:var(--color-border-default)] py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
          >
            <Sparkles className="size-3.5" />
            {pulled ? "Re-pull research" : "Pull research"}
          </button>

          <label className="mb-4 block">
            <span className="mb-1.5 block font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
              Engagement
            </span>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: label wraps the select. */}
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={!templates}
              className="w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm outline-none focus:border-[color:var(--color-text-accent)]"
            >
              {!templates && <option>Loading…</option>}
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mb-4 flex items-center justify-between gap-2 border-[color:var(--color-border-subtle)] border-t border-b py-3 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-[color:var(--color-text-accent)]" />
              Verified
            </span>
            <span className="text-[color:var(--color-text-muted)]">
              {verifiedCount} of 6 sections
            </span>
          </div>

          {error && (
            <p className="mb-3 text-[color:var(--color-state-warn)] text-mono-xs">{error}</p>
          )}

          <button
            type="button"
            onClick={originate}
            disabled={!canOriginate}
            className="flex w-full items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] py-3 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.16em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40"
          >
            {submitting ? "Originating…" : "Originate Mandate →"}
          </button>
          {!identityName && (
            <p className="mt-2 text-center font-mono text-[0.5rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
              Add the prospect to originate
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

function SectionCard({
  label,
  verified,
  onToggle,
  children,
}: {
  label: string;
  verified: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          {label}
        </span>
        <VerifyToggle on={verified} onToggle={onToggle} />
      </div>
      {children}
    </div>
  );
}

function VerifyToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={on ? "Verified" : "Mark verified"}
      className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] transition-colors ${
        on
          ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
          : "border-[color:var(--color-border-default)] text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-muted)]"
      }`}
    >
      <Check className="size-3" />
      {on ? "Verified" : "Verify"}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: wraps its control via children.
    <label className="block">
      <span className="mb-1.5 block font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
        {label}
      </span>
      {children}
    </label>
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

// Ghost input — reads as display text, reveals an accent underline on focus (the "editable profile" feel).
function GhostInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`block w-full border-transparent border-b bg-transparent outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)] ${className}`}
    />
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="bg-[color:var(--color-surface-raised)] px-3 py-3">
      <div className="mb-1 flex items-center gap-1.5 font-mono text-[0.5rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
        <Icon className="size-3" />
        {label}
      </div>
      <GhostInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="text-[0.875rem] text-[color:var(--color-text-primary)]"
      />
    </div>
  );
}

function TagEditor({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v || tags.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...tags, v]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1.5 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] py-1 pr-1.5 pl-2.5 text-[color:var(--color-text-default)] text-body-sm"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            title={`Remove ${t}`}
            className="text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text-accent)]"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <span className="flex items-center gap-1 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] pr-1.5 pl-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          size={Math.max((placeholder?.length ?? 0) + 1, 10)}
          className="min-w-0 bg-transparent py-1 text-[color:var(--color-text-primary)] text-body-sm outline-none placeholder:text-[color:var(--color-text-subtle)]"
        />
        <button
          type="button"
          onClick={add}
          title="Add"
          className="text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text-accent)]"
        >
          <Plus className="size-3.5" />
        </button>
      </span>
    </div>
  );
}
