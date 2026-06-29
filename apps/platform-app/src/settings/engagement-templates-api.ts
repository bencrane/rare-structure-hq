/**
 * Engagement templates client — the Settings "Engagement Templates" render surface's data source.
 *
 * AUTHENTICATED: the Supabase session access_token rides as a Bearer; the BFF (requireUser) brokers
 * the call to core-x edge_api, which lists the repo-resident template tree and renders one to a clean
 * PDF via DocRaptor (plain by default) → R2 presigned URL. No Documenso — the operator affixes the
 * signature/date/value fields in the editor by hand.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const BASE = "/api/v1/engagement-templates";

// Shapes mirror edge_api verbatim (snake_case) — the BFF is a pass-through and renames nothing.

/** A selectable template — one (path, archetype, version) triple under the content tree. */
export interface EngagementTemplate {
  brand: string;
  path: string;
  archetype: string;
  version: string;
  name: string;
  default_style: string;
  styles_available: string[];
  /** Operator-entered values this template bakes in at render time (empty = none). */
  inputs: string[];
}

export interface EngagementTemplateRender {
  pdf_url: string;
  expires_seconds: number;
  path: string;
  archetype: string;
  version: string;
  style: string;
  pdf_bytes: number;
}

/** The selectable templates for the path → archetype → version dropdowns. */
export async function listEngagementTemplates(token: string): Promise<EngagementTemplate[]> {
  const res = await fetch(`${API_BASE}${BASE}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`engagement templates failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as EngagementTemplate[];
}

/** Render the selected template to a clean PDF (plain by default) → presigned URL. No Documenso. */
export async function renderEngagementTemplate(
  token: string,
  input: { brand: string; path: string; archetype: string; version: string; style?: string },
): Promise<EngagementTemplateRender> {
  const res = await fetch(`${API_BASE}${BASE}/render`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`render failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as EngagementTemplateRender;
}

/** The render-push result — a freshly created Documenso template from the rendered PDF. */
export interface EngagementTemplateRenderPush {
  documenso_template_id: string;
  documenso_numeric_id: number | null;
  brand: string;
  path: string;
  archetype: string;
  version: string;
  style: string;
  source_kind: string;
  pdf_bytes: number;
  pdf_url: string | null;
}

/**
 * Render the selected catalog template and create a Documenso template from the PDF. Returns the
 * created documensoTemplateId (and numeric id). Bearer-gated; the BFF brokers the service-token call.
 */
export async function renderPushTemplate(
  token: string,
  input: {
    brand: string;
    path: string;
    archetype: string;
    version: string;
    style?: string;
    /** Operator-set name for the created Documenso template (omit to let edge_api default it). */
    name?: string;
    /** Operator inputs a tokenized template bakes in; edge_api derives price-per-introduction. */
    values?: { amount: number; introductions: number; term_days: number };
  },
): Promise<EngagementTemplateRenderPush> {
  // Heavy multi-hop call (BFF → edge_api → DocRaptor + Documenso). Bound it so a wedged upstream
  // rejects instead of leaving the row's in-flight state (and the table's single-flight lock) stuck.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${API_BASE}${BASE}/render-push`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`render-push failed: ${res.status} ${await res.text()}`);
    return (await res.json()).data as EngagementTemplateRenderPush;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("render-push timed out after 120s");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
