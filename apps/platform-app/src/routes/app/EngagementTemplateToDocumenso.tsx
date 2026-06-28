/**
 * EngagementTemplateToDocumenso — Settings → Engagement Templates → "Create a Documenso Template"
 * (`/app/settings/engagement-templates/documenso`).
 *
 * Same brand → path → archetype → version → style cascade as the "Create a PDF" surface, but the
 * action runs the render-push lane: compile the template's HTML, render the PDF via DocRaptor, and
 * create it in Documenso as a reusable TEMPLATE. No Documenso fields are placed — the operator
 * affixes the signature/date/value fields in the Documenso editor afterward. The created documenso
 * template id appears inline on success.
 */
import { Check, ExternalLink, FileSignature } from "lucide-react";
import { useCallback, useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage } from "@/app/cockpit";
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

  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<EngagementTemplateRenderPush | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const create = useCallback(() => {
    if (!selected) return;
    setCreating(true);
    setResult(null);
    setCreateError(null);
    // Heavy multi-hop (BFF → edge_api → DocRaptor + Documenso); renderPushTemplate bounds it at 120s.
    renderPushTemplate(token, {
      brand,
      path,
      archetype,
      version,
      style: style || selected.defaultStyle,
    })
      .then((r) => setResult(r))
      .catch((e) => setCreateError(e instanceof Error ? e.message : "Create failed"))
      .finally(() => setCreating(false));
  }, [token, selected, brand, path, archetype, version, style]);

  return (
    <CockpitPage
      title="Create a Documenso Template"
      description="Render a repo-resident engagement template to a PDF via DocRaptor and create it in Documenso as a reusable template. No fields are placed — affix the Documenso fields in the editor afterward."
    >
      <BackLink to="/app/settings/engagement" label="Engagement Templates" />

      <EngagementTemplateCascadeGate cascade={cascade}>
        <div className="flex flex-col gap-6">
          <EngagementTemplateCascadeFields cascade={cascade} />

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={create}
              disabled={creating || !selected}
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
                  {result.documensoTemplateId}
                  {result.documensoNumericId != null ? ` · #${result.documensoNumericId}` : ""}
                </Text>
              </output>
            )}
            {result?.pdfUrl && (
              <a
                href={result.pdfUrl}
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

const renderCls =
  "inline-flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-5 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-50";

const createdCls =
  "inline-flex items-center gap-2 border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)] px-3 py-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em]";
