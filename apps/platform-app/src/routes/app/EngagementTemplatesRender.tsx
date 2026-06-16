/**
 * EngagementTemplatesRender — Settings → Engagement Templates (`/app/settings/engagement-templates`).
 *
 * Pick a repo-resident template (path → archetype → version), choose a style (plain by default), and
 * render it to a clean PDF via DocRaptor. The PDF opens in a new tab; nothing is sent to Documenso —
 * the operator affixes the signature/date/value fields in the Documenso editor afterward.
 */
import { ArrowLeft, ExternalLink, FileDown } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Stack, Text } from "@rare-structure-hq/ui";

import { CockpitPage, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  type EngagementTemplate,
  listEngagementTemplates,
  renderEngagementTemplate,
} from "@/settings/engagement-templates-api";

type LoadState = "loading" | "ready" | "error";

export default function EngagementTemplatesRender() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EngagementTemplate[]>([]);

  const [path, setPath] = useState("");
  const [archetype, setArchetype] = useState("");
  const [version, setVersion] = useState("");
  const [style, setStyle] = useState("");

  const [rendering, setRendering] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // load the selectable templates
  useEffect(() => {
    if (!token) return;
    let active = true;
    setState("loading");
    listEngagementTemplates(token)
      .then((ts) => {
        if (!active) return;
        setTemplates(ts);
        setState("ready");
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load templates");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [token]);

  // derived, cascading option lists
  const paths = useMemo(() => [...new Set(templates.map((t) => t.path))].sort(), [templates]);
  const archetypes = useMemo(
    () => [...new Set(templates.filter((t) => t.path === path).map((t) => t.archetype))].sort(),
    [templates, path],
  );
  const versions = useMemo(
    () =>
      [
        ...new Set(
          templates
            .filter((t) => t.path === path && t.archetype === archetype)
            .map((t) => t.version),
        ),
      ].sort(),
    [templates, path, archetype],
  );
  const selected = useMemo(
    () =>
      templates.find(
        (t) => t.path === path && t.archetype === archetype && t.version === version,
      ) ?? null,
    [templates, path, archetype, version],
  );

  // keep each selection valid as its parent changes (and seed the first option)
  useEffect(() => {
    if (paths.length && !paths.includes(path)) setPath(paths[0]);
  }, [paths, path]);
  useEffect(() => {
    if (archetypes.length && !archetypes.includes(archetype)) setArchetype(archetypes[0]);
  }, [archetypes, archetype]);
  useEffect(() => {
    if (versions.length && !versions.includes(version)) setVersion(versions[0]);
  }, [versions, version]);
  useEffect(() => {
    // default the style to the template's default (plain) whenever the selection changes
    if (selected) {
      setStyle((s) => (selected.stylesAvailable.includes(s) ? s : selected.defaultStyle));
    }
  }, [selected]);

  const render = useCallback(() => {
    if (!selected) return;
    setRendering(true);
    setPdfUrl(null);
    setRenderError(null);
    renderEngagementTemplate(token, {
      path,
      archetype,
      version,
      style: style || selected.defaultStyle,
    })
      .then((r) => {
        setPdfUrl(r.pdfUrl);
        window.open(r.pdfUrl, "_blank", "noopener");
      })
      .catch((e) => setRenderError(e instanceof Error ? e.message : "Render failed"))
      .finally(() => setRendering(false));
  }, [token, selected, path, archetype, version, style]);

  return (
    <CockpitPage
      title="Engagement Templates"
      description="Render a repo-resident engagement template to a clean PDF via DocRaptor. The PDF opens in a new tab — affix the Documenso fields in the editor afterward."
    >
      <button type="button" onClick={() => navigate("/app/settings")} className={backCls}>
        <ArrowLeft className="size-3.5" />
        Settings
      </button>

      {state === "loading" ? (
        <Panel>
          <div className={msgCls}>Loading…</div>
        </Panel>
      ) : state === "error" ? (
        <Panel>
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <Text size="body-sm">Couldn’t load templates</Text>
            <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
              {error}
            </Text>
          </div>
        </Panel>
      ) : templates.length === 0 ? (
        <Panel>
          <div className="px-5 py-16 text-center">
            <Text size="body-sm" color="muted">
              No engagement templates found.
            </Text>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-6">
          <Section label="Template">
            <Panel>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Path">
                  <select
                    className={selectCls}
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                  >
                    {paths.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Archetype">
                  <select
                    className={selectCls}
                    value={archetype}
                    onChange={(e) => setArchetype(e.target.value)}
                  >
                    {archetypes.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Version">
                  <select
                    className={selectCls}
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  >
                    {versions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Style">
                  <select
                    className={selectCls}
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                  >
                    {(selected?.stylesAvailable ?? []).map((s) => (
                      <option key={s} value={s}>
                        {s === selected?.defaultStyle ? `${s} (default)` : s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {selected && (
                <Text size="mono-xs" mono color="subtle" className="mt-3 block">
                  {selected.name}
                </Text>
              )}
            </Panel>
          </Section>

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
      )}
    </CockpitPage>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap="2">
      <span className={labelCls}>{label}</span>
      {children}
    </Stack>
  );
}

const backCls =
  "mb-4 inline-flex items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:text-[color:var(--color-text-accent)]";

const labelCls =
  "flex items-center gap-2 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const inputCls =
  "w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-sans text-[color:var(--color-text-primary)] text-body-sm outline-none transition-colors focus:border-[color:var(--color-text-accent)]";

const selectCls = `${inputCls} mt-1.5 cursor-pointer`;

const msgCls =
  "px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase";

const renderCls =
  "inline-flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-5 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-50";
