/**
 * Settings — proposal-template authoring (operator cockpit).
 *
 * Author a proposal body in markdown (the ~85% canonical legal text) with inline {{handlebars}}
 * merge tokens. The right pane is a live render of the branded HTML (edge_api owns the conversion);
 * the editor scans for tokens and collects a test value for each. "Send to DocRaptor" renders a
 * real PDF and returns a presigned link to open. Save keeps a draft; Publish names it and makes it
 * selectable in the Proposals intake picker. The brand shell + signature block are applied by the
 * engine — never authored here.
 */
import { Check, ExternalLink, FileCog, FilePlus2, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge, Grid, Text } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import * as api from "@/settings/api";

const STARTER_MD = `# Strategic Origination Mandate

This Agreement is entered into as of {{effective_date}} between Rare Structure LLC and {{client_name}}.

## 1. Scope of Mandate

Rare Structure deploys specialized data-engineering infrastructure to originate off-market deal flow.

**Infrastructure Fee:** {{monthly_fee}} per month, invoiced quarterly ({{quarterly_total}} per period).

## 2. Term

This Agreement has an initial committed term of six (6) months from the date of execution.
`;

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export default function Settings() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [list, setList] = useState<api.TemplateSummary[] | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [markdown, setMarkdown] = useState(STARTER_MD);
  const [applyBrand, setApplyBrand] = useState(true);
  const [tokens, setTokens] = useState<string[]>([]);
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [feeDollars, setFeeDollars] = useState("");
  const [status, setStatus] = useState<api.TemplateStatus | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "saving" | "previewing" | "publishing">("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    api
      .listTemplates(token)
      .then(setList)
      .catch(() => setList([]));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Debounced markdown → branded HTML + token detection (single source of conversion: the engine).
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      api
        .convertTemplate(token, { markdown, apply_brand: applyBrand })
        .then((r) => {
          setPreviewHtml(r.html);
          setTokens(r.detected_tokens);
          setTokenValues((prev) => {
            const next: Record<string, string> = {};
            for (const tok of r.detected_tokens) next[tok] = prev[tok] ?? "";
            return next;
          });
        })
        .catch(() => {});
    }, 450);
    return () => clearTimeout(t);
  }, [token, markdown, applyBrand]);

  function newTemplate() {
    setId(null);
    setName("");
    setMarkdown(STARTER_MD);
    setApplyBrand(true);
    setStatus(null);
    setPdfUrl(null);
    setFeeDollars("");
    setError(null);
  }

  async function open(tid: string) {
    setError(null);
    setPdfUrl(null);
    try {
      const row = await api.getTemplate(token, tid);
      setId(row.id);
      setName(row.name ?? "");
      setMarkdown(row.markdown);
      setApplyBrand(row.apply_brand);
      setStatus(row.status);
      setFeeDollars(row.monthly_fee_cents ? String(row.monthly_fee_cents / 100) : "");
    } catch (e) {
      setError(msg(e));
    }
  }

  async function save(): Promise<string | null> {
    setBusy("saving");
    setError(null);
    try {
      const row = id
        ? await api.updateTemplate(token, id, {
            markdown,
            apply_brand: applyBrand,
            name: name || null,
          })
        : await api.createTemplate(token, {
            markdown,
            apply_brand: applyBrand,
            name: name || null,
          });
      setId(row.id);
      setStatus(row.status);
      refresh();
      return row.id;
    } catch (e) {
      setError(msg(e));
      return null;
    } finally {
      setBusy("");
    }
  }

  async function sendToDocRaptor() {
    setBusy("previewing");
    setError(null);
    setPdfUrl(null);
    try {
      const r = await api.previewTemplate(token, {
        markdown,
        apply_brand: applyBrand,
        token_values: tokenValues,
      });
      setPdfUrl(r.pdf_url);
      window.open(r.pdf_url, "_blank", "noopener");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }

  async function publish() {
    if (!name.trim()) {
      setError("Name the template before publishing.");
      return;
    }
    setBusy("publishing");
    setError(null);
    try {
      const tid = id ?? (await save());
      if (!tid) return;
      const fee = feeDollars.trim() ? Math.round(Number(feeDollars) * 100) : null;
      const row = await api.publishTemplate(token, tid, {
        name: name.trim(),
        monthly_fee_cents: Number.isFinite(fee as number) ? fee : null,
      });
      setStatus(row.status);
      refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <CockpitPage
      title="Settings"
      description="Author proposal templates in markdown, preview them as a sealed PDF, and publish."
    >
      <Grid cols={1} lgCols={3} gap="4">
        {/* Template list + New */}
        <Section label="Proposal templates">
          <Panel padded={false}>
            <div className="border-[color:var(--color-border-subtle)] border-b p-3">
              <button type="button" onClick={newTemplate} className={primaryBtnCls}>
                <FilePlus2 className="size-3.5" />
                New template
              </button>
            </div>
            {list === null ? (
              <div className="px-5 py-6 text-center font-mono text-mono-xs uppercase text-[color:var(--color-text-subtle)]">
                Loading…
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={FileCog}
                title="No templates yet"
                description="Create one — author the body in markdown, preview, then publish."
              />
            ) : (
              <ul className="divide-y divide-[color:var(--color-border-subtle)]">
                {list.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => open(t.id)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--color-surface-raised)] ${
                        t.id === id ? "bg-[color:var(--color-accent-soft)]" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <Text size="body-sm" color="primary" className="block truncate">
                          {t.name || "Untitled draft"}
                        </Text>
                        <Text size="mono-xs" mono color="subtle" className="block truncate">
                          {t.slug ?? t.id}
                        </Text>
                      </span>
                      <Badge tone={t.status === "published" ? "success" : "default"}>
                        {t.status}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Section>

        {/* Editor */}
        <div className="lg:col-span-2">
          <Section label="Editor">
            <Panel>
              {/* Meta row: name · brand toggle · status */}
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="min-w-[14rem] flex-1">
                  <span className="mb-1.5 block font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
                    Template name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Standard Engagement"
                    className={inputCls}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={applyBrand}
                    onChange={(e) => setApplyBrand(e.target.checked)}
                    className="size-4 accent-[color:var(--color-accent-primary)]"
                  />
                  <Text size="mono-xs" mono color="muted" className="uppercase tracking-[0.12em]">
                    Rare Structure brand
                  </Text>
                </label>
                {status && (
                  <Badge tone={status === "published" ? "success" : "default"}>{status}</Badge>
                )}
              </div>

              {/* Split: markdown | live preview */}
              <Grid cols={1} lgCols={2} gap="3">
                <div>
                  <div className="mb-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
                    Markdown · use {"{{token}}"} for merge fields
                  </div>
                  <textarea
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                    spellCheck={false}
                    className="h-[58vh] w-full resize-none border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] p-3 font-mono text-[0.8125rem] text-[color:var(--color-text-primary)] leading-[1.5] outline-none focus:border-[color:var(--color-text-accent)]"
                  />
                </div>
                <div>
                  <div className="mb-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
                    Live preview (approximate · DocRaptor is the truth)
                  </div>
                  <iframe
                    title="template preview"
                    srcDoc={previewHtml}
                    className="h-[58vh] w-full border border-[color:var(--color-border-default)] bg-white"
                  />
                </div>
              </Grid>

              {/* Token test values */}
              {tokens.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
                    Merge fields detected — enter a test value to preview
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {tokens.map((tok) => (
                      <label key={tok} className="flex items-center gap-2">
                        <span className="w-[10rem] shrink-0 truncate font-mono text-[0.6875rem] text-[color:var(--color-text-muted)]">
                          {`{{${tok}}}`}
                        </span>
                        <input
                          value={tokenValues[tok] ?? ""}
                          onChange={(e) => setTokenValues((v) => ({ ...v, [tok]: e.target.value }))}
                          className={inputCls}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-3 text-[color:var(--color-state-warn)] text-mono-xs">{error}</p>
              )}

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy !== ""}
                  className={secondaryBtnCls}
                >
                  {busy === "saving" ? "Saving…" : id ? "Save draft" : "Save as draft"}
                </button>
                <button
                  type="button"
                  onClick={sendToDocRaptor}
                  disabled={busy !== ""}
                  className={secondaryBtnCls}
                >
                  <Send className="size-3.5" />
                  {busy === "previewing" ? "Rendering…" : "Send to DocRaptor"}
                </button>
                <label className="flex items-center gap-2">
                  <span className="font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.12em]">
                    Fee $/mo
                  </span>
                  <input
                    value={feeDollars}
                    onChange={(e) => setFeeDollars(e.target.value)}
                    placeholder="25000"
                    inputMode="numeric"
                    className={`${inputCls} w-[7rem]`}
                  />
                </label>
                <button
                  type="button"
                  onClick={publish}
                  disabled={busy !== ""}
                  className={primaryBtnCls}
                >
                  <Check className="size-3.5" />
                  {busy === "publishing" ? "Publishing…" : "Publish"}
                </button>
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.12em] hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    Open preview PDF
                  </a>
                )}
              </div>
            </Panel>
          </Section>
        </div>
      </Grid>
    </CockpitPage>
  );
}

const inputCls =
  "w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]";

const primaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-4 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:opacity-40";

const secondaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)] disabled:opacity-40";
