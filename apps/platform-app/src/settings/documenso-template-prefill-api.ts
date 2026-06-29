/**
 * Documenso template prefill config client — the "Manage Documenso Templates" editor's data source.
 *
 * AUTHENTICATED: the Supabase session access_token rides as a Bearer; the BFF (requireUser) brokers
 * the call to core-x edge_api, which reads the template's fields from the MIRROR
 * (business.documenso_envelopes, type='template') and reads/writes the OPERATOR-OWNED prefill config
 * (business.documenso_template_document_prefill_configs). This editor is that table's ONLY writer —
 * the webhook projector / mirror resync NEVER touch it.
 *
 * `field_settings` is keyed by field LABEL; each value is an ARBITRARY object (Phase 2 adds "source").
 * Phase 1 sets per label `{ default_document_field_value, read_only }`. The default lives HERE and is
 * applied at originate LATER (model B: deal override ?? default) — it is NOT baked onto the Documenso
 * template. Shapes mirror edge_api verbatim (snake_case) — the BFF renames nothing; we unwrap `.data`.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const BASE = "/api/v1/documenso-template-prefill";

/** One template field from the mirror — the row source for the editor. */
export interface TemplatePrefillField {
  label: string;
  type: string;
  required: boolean;
  read_only: boolean;
  recipient_id: number | null;
}

/** A template's mirror-sourced fields + the operator-owned field_settings (label → arbitrary dict). */
export interface TemplatePrefillConfig {
  documenso_id: number;
  fields: TemplatePrefillField[];
  field_settings: Record<string, Record<string, unknown>>;
}

/** Read the fields + saved field_settings for one template. */
export async function getPrefillConfig(
  token: string,
  documensoId: number,
): Promise<TemplatePrefillConfig> {
  const res = await fetch(`${API_BASE}${BASE}/${encodeURIComponent(documensoId)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`prefill config failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as TemplatePrefillConfig;
}

/** Write the operator-owned field_settings for one template; the caller refetches after. */
export async function savePrefillConfig(
  token: string,
  documensoId: number,
  fieldSettings: Record<string, Record<string, unknown>>,
): Promise<{ documenso_id: number; field_settings: Record<string, Record<string, unknown>> }> {
  const res = await fetch(`${API_BASE}${BASE}/${encodeURIComponent(documensoId)}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ field_settings: fieldSettings }),
  });
  if (!res.ok) throw new Error(`prefill save failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as {
    documenso_id: number;
    field_settings: Record<string, Record<string, unknown>>;
  };
}
