/**
 * Documenso template mirror client — the Settings "Documenso Templates" mirror surface's data source.
 *
 * AUTHENTICATED: the Supabase session access_token rides as a Bearer; the BFF (requireUser) brokers
 * the call to core-x edge_api, which reads the projected mirror of the live Documenso template
 * envelopes and re-pulls them on demand through its existing projector. The mirror is read-only here —
 * re-grab refreshes the projection; it never edits the templates themselves.
 *
 * Shapes mirror edge_api verbatim (snake_case) — the BFF is a pass-through and renames nothing.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const BASE = "/api/v1/documenso-template-mirror";

/** One projected template-envelope row in the mirror. */
export interface TemplateMirrorRow {
  documenso_id: number;
  title: string | null;
  status: string | null;
  field_count: number;
  recipient_count: number;
  synced_at: string | null;
}

/** The result of re-grabbing one template envelope through the projector. */
export interface TemplateResyncResult {
  documenso_id: number;
  field_count: number;
  synced: boolean;
  error?: string;
}

/** The result of re-grabbing every template envelope. */
export interface TemplateResyncAllResult {
  requested: number;
  synced: number;
  results: TemplateResyncResult[];
}

/** The projected mirror of every Documenso template envelope — the table source. */
export async function listTemplateMirror(token: string): Promise<TemplateMirrorRow[]> {
  const res = await fetch(`${API_BASE}${BASE}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`template mirror failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as TemplateMirrorRow[];
}

/** Re-grab ONE template envelope through the projector; the caller refetches the list after. */
export async function resyncTemplate(
  token: string,
  documensoId: number,
): Promise<TemplateResyncResult> {
  const res = await fetch(`${API_BASE}${BASE}/${encodeURIComponent(documensoId)}/resync`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`resync failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as TemplateResyncResult;
}

/** Re-grab EVERY template envelope through the projector; the caller refetches the list after. */
export async function resyncAllTemplates(token: string): Promise<TemplateResyncAllResult> {
  const res = await fetch(`${API_BASE}${BASE}/resync-all`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`resync-all failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as TemplateResyncAllResult;
}
