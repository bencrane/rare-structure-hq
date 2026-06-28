/**
 * EngagementTemplatesRender — Settings → Engagement Templates → "Create a PDF"
 * (`/app/settings/engagement-templates`).
 *
 * Pick a repo-resident template (brand → path → archetype → version), choose a style (plain by
 * default), and render it to a clean PDF via DocRaptor. The PDF opens in a new tab; nothing is sent
 * to Documenso. To also create a Documenso template from the PDF, use the sibling "Create a
 * Documenso Template" surface.
 */
import { ExternalLink, FileDown } from "lucide-react";
import { useCallback, useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  EngagementTemplateCascadeFields,
  EngagementTemplateCascadeGate,
  useEngagementTemplateCascade,
} from "@/settings/engagement-template-cascade";
import { renderEngagementTemplate } from "@/settings/engagement-templates-api";

export default function EngagementTemplatesRender() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const cascade = useEngagementTemplateCascade();
  const { selected, brand, path, archetype, version, style } = cascade;

  const [rendering, setRendering] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const render = useCallback(() => {
    if (!selected) return;
    setRendering(true);
    setPdfUrl(null);
    setRenderError(null);
    renderEngagementTemplate(token, {
      brand,
      path,
      archetype,
      version,
      style: style || selected.default_style,
    })
      .then((r) => {
        setPdfUrl(r.pdf_url);
        window.open(r.pdf_url, "_blank", "noopener");
      })
      .catch((e) => setRenderError(e instanceof Error ? e.message : "Render failed"))
      .finally(() => setRendering(false));
  }, [token, selected, brand, path, archetype, version, style]);

  return (
    <CockpitPage
      title="Create a PDF"
      description="Render a repo-resident engagement template to a clean PDF via DocRaptor. The PDF opens in a new tab — affix the Documenso fields in the editor afterward."
    >
      <BackLink to="/app/settings/engagement" label="Engagement Templates" />

      <EngagementTemplateCascadeGate cascade={cascade}>
        <div className="flex flex-col gap-6">
          <EngagementTemplateCascadeFields cascade={cascade} />

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={render}
              disabled={rendering || !selected}
              className={renderCls}
            >
              <FileDown className="size-3.5" />
              {rendering ? "Rendering…" : "Render PDF"}
            </button>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em]"
              >
                <ExternalLink className="size-3.5" />
                Open PDF
              </a>
            )}
            {renderError && (
              <Text size="mono-xs" mono color="subtle" className="break-words">
                {renderError}
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
