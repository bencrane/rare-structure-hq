/**
 * Documenso template defaults client — the Settings "Documenso Templates" editor's data source.
 *
 * AUTHENTICATED: the Supabase session access_token rides as a Bearer; the BFF (requireUser) brokers
 * the read/write to core-x edge_api, which reads/writes the LIVE Documenso template's fields. The
 * field set + current defaults come straight from Documenso, so the editor never drifts.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const BASE = "/api/v1/documenso-template-fields";

/** An editable Documenso template field + its current baked-in default. */
export interface DocumensoTemplateField {
  /** The Documenso field id — the key a default is written against. */
  id: number;
  /** TEXT | NUMBER | DROPDOWN. */
  type: string;
  label: string | null;
  recipientId: number | null;
  page: number | null;
  default: string | null;
}

/** The template's editable fields (+ current defaults), live from Documenso. */
export async function listDocumensoTemplateFields(
  token: string,
  documensoTemplateId: string,
): Promise<DocumensoTemplateField[]> {
  const qs = new URLSearchParams({ documensoTemplateId }).toString();
  const res = await fetch(`${API_BASE}${BASE}?${qs}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`template fields failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as DocumensoTemplateField[];
}

/** Write per-field default values onto the template; returns the refreshed field list. */
export async function saveDocumensoTemplateDefaults(
  token: string,
  documensoTemplateId: string,
  defaults: { id: number; value: string }[],
): Promise<DocumensoTemplateField[]> {
  const res = await fetch(`${API_BASE}${BASE}/defaults`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ documensoTemplateId, defaults }),
  });
  if (!res.ok) throw new Error(`save defaults failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as DocumensoTemplateField[];
}
