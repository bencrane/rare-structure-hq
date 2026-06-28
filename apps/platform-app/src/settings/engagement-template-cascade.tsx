/**
 * Engagement-template selection cascade — shared by the two render surfaces under
 * Settings → Engagement Templates: "Create a PDF" (DocRaptor render → PDF) and "Create a Documenso
 * Template" (render-push → Documenso template). Both pick the same (brand, path, archetype, version,
 * style) tuple; they differ only in the action button and result.
 *
 * Brand is the cascade root: two brands can share a (path, archetype, version) tuple, so brand must
 * scope every downstream list AND the `selected` resolve — otherwise a colliding tuple is reachable
 * only for the first brand in find-order, and the render call resolves against the wrong content
 * root (edge_api keys templates on brand/path/archetype/version).
 *
 * Single-sourced here so a cascade fix lands once, not once per surface.
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { Stack, Text } from "@rare-structure-hq/ui";

import { Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  type EngagementTemplate,
  listEngagementTemplates,
} from "@/settings/engagement-templates-api";

type LoadState = "loading" | "ready" | "error";

export interface EngagementTemplateCascade {
  state: LoadState;
  error: string | null;
  templatesCount: number;
  brand: string;
  path: string;
  archetype: string;
  version: string;
  style: string;
  brands: string[];
  paths: string[];
  archetypes: string[];
  versions: string[];
  selected: EngagementTemplate | null;
  setBrand: (b: string) => void;
  setPath: (p: string) => void;
  setArchetype: (a: string) => void;
  setVersion: (v: string) => void;
  setStyle: (s: string) => void;
}

/** Load the template tree and drive the brand → path → archetype → version → style cascade. */
export function useEngagementTemplateCascade(): EngagementTemplateCascade {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EngagementTemplate[]>([]);

  const [brand, setBrand] = useState("");
  const [path, setPath] = useState("");
  const [archetype, setArchetype] = useState("");
  const [version, setVersion] = useState("");
  const [style, setStyle] = useState("");

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

  // derived, cascading option lists — brand scopes every downstream list and the `selected` resolve.
  const brands = useMemo(() => [...new Set(templates.map((t) => t.brand))].sort(), [templates]);
  const paths = useMemo(
    () => [...new Set(templates.filter((t) => t.brand === brand).map((t) => t.path))].sort(),
    [templates, brand],
  );
  const archetypes = useMemo(
    () =>
      [
        ...new Set(
          templates.filter((t) => t.brand === brand && t.path === path).map((t) => t.archetype),
        ),
      ].sort(),
    [templates, brand, path],
  );
  const versions = useMemo(
    () =>
      [
        ...new Set(
          templates
            .filter((t) => t.brand === brand && t.path === path && t.archetype === archetype)
            .map((t) => t.version),
        ),
      ].sort(),
    [templates, brand, path, archetype],
  );
  const selected = useMemo(
    () =>
      templates.find(
        (t) =>
          t.brand === brand &&
          t.path === path &&
          t.archetype === archetype &&
          t.version === version,
      ) ?? null,
    [templates, brand, path, archetype, version],
  );

  // keep each selection valid as its parent changes (and seed the first option)
  useEffect(() => {
    if (brands.length && !brands.includes(brand)) setBrand(brands[0]);
  }, [brands, brand]);
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
      setStyle((s) => (selected.styles_available.includes(s) ? s : selected.default_style));
    }
  }, [selected]);

  return {
    state,
    error,
    templatesCount: templates.length,
    brand,
    path,
    archetype,
    version,
    style,
    brands,
    paths,
    archetypes,
    versions,
    selected,
    setBrand,
    setPath,
    setArchetype,
    setVersion,
    setStyle,
  };
}

/**
 * Loading / error / empty gate for a cascade surface. Renders the standard placeholder Panels until
 * the tree is loaded and non-empty, then renders `children` (the cascade fields + the page action).
 */
export function EngagementTemplateCascadeGate({
  cascade,
  children,
}: {
  cascade: EngagementTemplateCascade;
  children: ReactNode;
}) {
  if (cascade.state === "loading") {
    return (
      <Panel>
        <div className={msgCls}>Loading…</div>
      </Panel>
    );
  }
  if (cascade.state === "error") {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <Text size="body-sm">Couldn’t load templates</Text>
          <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
            {cascade.error}
          </Text>
        </div>
      </Panel>
    );
  }
  if (cascade.templatesCount === 0) {
    return (
      <Panel>
        <div className="px-5 py-16 text-center">
          <Text size="body-sm" color="muted">
            No engagement templates found.
          </Text>
        </div>
      </Panel>
    );
  }
  return <>{children}</>;
}

/** The brand → path → archetype → version → style select grid (+ the resolved template name). */
export function EngagementTemplateCascadeFields({
  cascade,
}: { cascade: EngagementTemplateCascade }) {
  const {
    brand,
    path,
    archetype,
    version,
    style,
    brands,
    paths,
    archetypes,
    versions,
    selected,
    setBrand,
    setPath,
    setArchetype,
    setVersion,
    setStyle,
  } = cascade;

  return (
    <Section label="Template">
      <Panel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Brand">
            <select className={selectCls} value={brand} onChange={(e) => setBrand(e.target.value)}>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Path">
            <select className={selectCls} value={path} onChange={(e) => setPath(e.target.value)}>
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
            <select className={selectCls} value={style} onChange={(e) => setStyle(e.target.value)}>
              {(selected?.styles_available ?? []).map((s) => (
                <option key={s} value={s}>
                  {s === selected?.default_style ? `${s} (default)` : s}
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

const labelCls =
  "flex items-center gap-2 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

const inputCls =
  "w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-sans text-[color:var(--color-text-primary)] text-body-sm outline-none transition-colors focus:border-[color:var(--color-text-accent)]";

const selectCls = `${inputCls} mt-1.5 cursor-pointer`;

const msgCls =
  "px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase";
