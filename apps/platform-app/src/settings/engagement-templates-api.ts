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

/** A selectable template — one (path, archetype, version) triple under the content tree. */
export interface EngagementTemplate {
  path: string;
  archetype: string;
  version: string;
  name: string;
  defaultStyle: string;
  stylesAvailable: string[];
}

export interface EngagementTemplateRender {
  pdfUrl: string;
  expiresSeconds: number;
  path: string;
  archetype: string;
  version: string;
  style: string;
  pdfBytes: number;
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
  input: { path: string; archetype: string; version: string; style?: string },
): Promise<EngagementTemplateRender> {
  const res = await fetch(`${API_BASE}${BASE}/render`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`render failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as EngagementTemplateRender;
}
