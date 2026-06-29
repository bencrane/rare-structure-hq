/**
 * EngagementTemplateToDocumenso — Settings → Engagement Templates → "Create a Documenso Template"
 * (`/app/settings/engagement-templates/documenso`).
 *
 * Same brand → path → archetype → version → style cascade as the "Create a PDF" surface, but the
 * action runs the render-push lane: compile the template's HTML, render the PDF via DocRaptor, and
 * create it in Documenso as a reusable TEMPLATE. No Documenso fields are placed — the operator affixes
 * the signature/date/value fields in the Documenso editor afterward.
 *
 * A tokenized template (one whose catalog entry declares `inputs`, e.g. government-contracted
 * prepaid-introductions) shows a Values form: the operator enters amount / # introductions / # days;
 * those are baked into the PDF text at render time (price-per-introduction is derived server-side).
 */
import { Check, ExternalLink, FileSignature } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";

import { Stack, Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  EngagementTemplateCascadeFields,
  EngagementTemplateCascadeGate,
  useEngagementTemplateCascade,
} from "@/settings/engagement-template-cascade";
import {
  type EngagementTemplateRenderPush,
  renderPushTemplate,
} from "@/settings/engagement-templates-api";

export default function EngagementTemplateToDocumenso() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const cascade = useEngagementTemplateCascade();
  const { selected, brand, path, archetype, version, style } = cascade;
  const needsValues = (selected?.inputs?.length ?? 0) > 0;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [introductions, setIntroductions] = useState("");
  const [termDays, setTermDays] = useState("");

  const amountNum = Number.parseFloat(amount);
  const introNum = Number.parseFloat(introductions);
  const daysNum = Number.parseFloat(termDays);
  const valuesValid =
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    Number.isInteger(introNum) &&
    introNum > 0 &&
    Number.isInteger(daysNum) &&
    daysNum > 0;
  // Live preview only — edge_api does the authoritative derivation + formatting.
  const ppiPreview = valuesValid ? formatUsd(amountNum / introNum) : "—";

  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<EngagementTemplateRenderPush | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const create = useCallback(() => {
    if (!selected || (needsValues && !valuesValid)) return;
    setCreating(true);
    setResult(null);
    setCreateError(null);
    // Heavy multi-hop (BFF → edge_api → DocRaptor + Documenso); renderPushTemplate bounds it at 120s.
    const trimmedName = name.trim();
    renderPushTemplate(token, {
      brand,
      path,
      archetype,
      version,
      style: style || selected.default_style,
      name: trimmedName || undefined,
      values: needsValues
        ? { amount: amountNum, introductions: introNum, term_days: daysNum }
        : undefined,
    })
      .then((r) => setResult(r))
      .catch((e) => setCreateError(e instanceof Error ? e.message : "Create failed"))
      .finally(() => setCreating(false));
  }, [
    token,
    selected,
    brand,
    path,
    archetype,
    version,
    style,
    name,
    needsValues,
    valuesValid,
    amountNum,
    introNum,
    daysNum,
  ]);

  return (
    <CockpitPage
      title="Create a Documenso Template"
      description="Render a repo-resident engagement template to a PDF via DocRaptor and create it in Documenso as a reusable template. No fields are placed — affix the Documenso fields in the editor afterward."
    >
      <BackLink to="/app/settings/engagement" label="Engagement Templates" />

      <EngagementTemplateCascadeGate cascade={cascade}>
        <div className="flex flex-col gap-6">
          <EngagementTemplateCascadeFields cascade={cascade} />

          <Section label="Template Name">
            <Panel>
              <ValueField label="Documenso template name (optional)">
                <input
                  type="text"
                  placeholder={selected?.name ?? "Engagement Template"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={numCls}
                />
              </ValueField>
            </Panel>
          </Section>

          {needsValues && (
            <Section label="Values">
              <Panel>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <ValueField label="Amount paid (USD)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="25000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={numCls}
                    />
                  </ValueField>
                  <ValueField label="# of introductions">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="25"
                      value={introductions}
                      onChange={(e) => setIntroductions(e.target.value)}
                      className={numCls}
                    />
                  </ValueField>
                  <ValueField label="# of days">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="90"
                      value={termDays}
                      onChange={(e) => setTermDays(e.target.value)}
                      className={numCls}
                    />
                  </ValueField>
                </div>
                <Text size="mono-xs" mono color="subtle" className="mt-3 block">
                  Price per introduction (derived): {ppiPreview}
                </Text>
              </Panel>
            </Section>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={create}
              disabled={creating || !selected || (needsValues && !valuesValid)}
              className={renderCls}
            >
              <FileSignature className="size-3.5" />
              {creating ? "Creating…" : "Create Documenso Template"}
            </button>
            {result && (
              <output className="inline-flex flex-col gap-1.5">
                <span className={createdCls}>
                  <Check className="size-3.5" />
                  Created
                </span>
                <Text size="mono-xs" mono color="subtle" className="block break-all">
                  {result.documenso_template_id}
                  {result.documenso_numeric_id != null ? ` · #${result.documenso_numeric_id}` : ""}
                </Text>
              </output>
            )}
            {result?.pdf_url && (
              <a
                href={result.pdf_url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em]"
              >
                <ExternalLink className="size-3.5" />
                Open PDF
              </a>
            )}
            {createError && (
              <Text size="mono-xs" mono color="subtle" className="break-words">
                {createError}
              </Text>
            )}
          </div>
        </div>
      </EngagementTemplateCascadeGate>
    </CockpitPage>
  );
}

function ValueField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap="2">
      <span className={labelCls}>{label}</span>
      {children}
    </Stack>
  );
}

/** Plain-USD preview, mirroring edge_api's formatter: quantize to cents first (HALF_UP, matching the
 *  server), then drop the cents when the rounded value is whole. */
function formatUsd(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(r) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

const labelCls =
  "flex items-center gap-2 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const numCls =
  "mt-1.5 w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-sans text-[color:var(--color-text-primary)] text-body-sm outline-none transition-colors focus:border-[color:var(--color-text-accent)]";

const renderCls =
  "inline-flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-5 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-50";

const createdCls =
  "inline-flex items-center gap-2 border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] px-3 py-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em]";
