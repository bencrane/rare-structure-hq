/**
 * Documenso template DEFAULT picker client — the Settings "Set Template as Default" data source.
 *
 * AUTHENTICATED: the Supabase session access_token rides as a Bearer; the BFF (requireUser) brokers the
 * call to core-x edge_api, which reads the projected MIRROR (business.documenso_envelopes, type=
 * 'template') and the operator-owned default store (business.documenso_template_defaults). Replaces the
 * LEGACY documenso-templates registry picker — mirror-path templates (e.g. 14503) aren't in that
 * registry. Shapes edge_api verbatim (snake_case); the BFF is a pass-through and renames nothing.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const BASE = "/api/v1/documenso-template-defaults";

/** One mirror template flagged with whether it is the operator's Confirm & Originate default. */
export interface TemplateDefaultRow {
  documenso_id: number;
  title: string | null;
  status: string | null;
  is_default: boolean;
}

/** Every MIRROR template (non-deleted), each flagged is_default — the picker table source. */
export async function listTemplateDefaults(token: string): Promise<TemplateDefaultRow[]> {
  const res = await fetch(`${API_BASE}${BASE}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`template defaults failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as TemplateDefaultRow[];
}

/** Mark one mirror template as the org's Confirm & Originate default (by numeric documenso_id). */
export async function setTemplateDefault(token: string, documensoId: number): Promise<void> {
  const res = await fetch(`${API_BASE}${BASE}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ documensoId }),
  });
  if (!res.ok) throw new Error(`set default failed: ${res.status} ${await res.text()}`);
}
