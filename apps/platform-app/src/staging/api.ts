/**
 * Engagement options client — the template picker's data source.
 *
 * AUTHENTICATED: the Supabase session access_token rides as a Bearer; the BFF validates it
 * (requireUser) then brokers the read to core-x edge_api (engagement_mappings). Feeds the Documenso
 * field-defaults editor's template picker.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** An engagement option: a Documenso template + its archetype (the form's shape) + the template's
 * declared merge fields (the form's inputs). */
export interface EngagementOption {
  /** documenso_template_id — the originate value. */
  id: string;
  label: string;
  archetypeKey: string | null;
  archetypeName: string | null;
  performanceFeeBasis: string | null;
  /** The template's text_fields — the exact inputs the value form renders. */
  textFields: string[];
}

/** The operator-org's engagement options (archetype + template + value fields) for the picker. */
export async function listEngagementOptions(token: string): Promise<EngagementOption[]> {
  const res = await fetch(`${API_BASE}/api/v1/engagement-mappings/options`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`engagement options failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as EngagementOption[];
}
