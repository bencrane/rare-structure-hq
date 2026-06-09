/**
 * Proposal-template authoring client (operator-only).
 *
 * All calls are AUTHENTICATED — the Supabase session access_token rides as a Bearer; the BFF
 * (`/api/v1/proposal-templates/manage/*`) validates it and brokers to core-x edge_api with the
 * service token. The engine owns markdown→HTML, the DocRaptor preview (→ R2 presigned link), and
 * the publish registry; this client is a thin typed wrapper.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
const MANAGE = `${API_BASE}/api/v1/proposal-templates/manage`;

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return (await res.json()).data as T;
}

export type TemplateStatus = "draft" | "published";

export interface TemplateSummary {
  id: string;
  slug: string | null;
  name: string | null;
  status: TemplateStatus;
  monthly_fee_cents: number | null;
  updated_at: string | null;
}

export interface TemplateRow extends TemplateSummary {
  markdown: string;
  apply_brand: boolean;
  token_manifest: string[];
  created_by: string | null;
  created_at: string | null;
  published_at: string | null;
}

export interface ConvertResult {
  html: string;
  detected_tokens: string[];
}

export interface PreviewResult {
  pdf_url: string;
  expires_seconds: number;
  detected_tokens: string[];
}

export async function listTemplates(token: string): Promise<TemplateSummary[]> {
  return unwrap<TemplateSummary[]>(await fetch(MANAGE, { headers: authHeaders(token) }));
}

export async function getTemplate(token: string, id: string): Promise<TemplateRow> {
  return unwrap<TemplateRow>(
    await fetch(`${MANAGE}/${encodeURIComponent(id)}`, { headers: authHeaders(token) }),
  );
}

export async function createTemplate(
  token: string,
  body: { markdown: string; apply_brand: boolean; name?: string | null },
): Promise<TemplateRow> {
  return unwrap<TemplateRow>(
    await fetch(MANAGE, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}

export async function updateTemplate(
  token: string,
  id: string,
  body: { markdown?: string; apply_brand?: boolean; name?: string | null },
): Promise<TemplateRow> {
  return unwrap<TemplateRow>(
    await fetch(`${MANAGE}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}

export async function convertTemplate(
  token: string,
  body: { markdown: string; apply_brand: boolean },
): Promise<ConvertResult> {
  return unwrap<ConvertResult>(
    await fetch(`${MANAGE}/convert`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}

export async function previewTemplate(
  token: string,
  body: { markdown: string; apply_brand: boolean; token_values: Record<string, string> },
): Promise<PreviewResult> {
  return unwrap<PreviewResult>(
    await fetch(`${MANAGE}/preview`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}

export async function publishTemplate(
  token: string,
  id: string,
  body: { name: string; slug?: string | null; monthly_fee_cents?: number | null },
): Promise<TemplateRow> {
  return unwrap<TemplateRow>(
    await fetch(`${MANAGE}/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}
