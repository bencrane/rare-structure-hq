/**
 * Mandate staging client — the per-opportunity prep page's data source.
 *
 * AUTHENTICATED: the Supabase session access_token rides as a Bearer; the BFF validates it
 * (requireUser) then brokers the read/write to core-x edge_api. Mirrors the pipeline/proposals
 * clients. The operator stages a mandate off-screen here (pick the engagement → enter the per-deal
 * values); "Confirm & originate" later stamps those values into the Documenso document.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** An engagement the operator can stage: a Documenso template + its archetype (the form's shape) +
 * the template's declared merge fields (the form's inputs). */
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

/** The opportunity's staged mandate (selected template + entered values), as loaded for editing. */
export interface StagingDraft {
  id: string;
  documensoTemplateId: string | null;
  archetypeId: string | null;
  prefillValues: Record<string, string>;
  status: string | null;
}

const DRAFTS = "/api/v1/engagement-mandate-drafts";

/** The operator-org's engagement options (archetype + template + value fields) for the picker. */
export async function listEngagementOptions(token: string): Promise<EngagementOption[]> {
  const res = await fetch(`${API_BASE}${DRAFTS}/options`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`engagement options failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as EngagementOption[];
}

/** The opportunity's staged mandate, or null when nothing is staged yet. */
export async function getStagingDraft(
  token: string,
  opportunityId: string,
): Promise<StagingDraft | null> {
  const res = await fetch(
    `${API_BASE}${DRAFTS}/by-opportunity/${encodeURIComponent(opportunityId)}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`staging load failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as StagingDraft | null;
}

/** Create-or-update the opportunity's staging draft (selected template + entered per-deal values). */
export async function saveStagingDraft(
  token: string,
  opportunityId: string,
  input: { documensoTemplateId: string; prefillValues: Record<string, string> },
): Promise<{ id: string }> {
  const res = await fetch(
    `${API_BASE}${DRAFTS}/by-opportunity/${encodeURIComponent(opportunityId)}`,
    { method: "PUT", headers: authHeaders(token), body: JSON.stringify(input) },
  );
  if (!res.ok) throw new Error(`staging save failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as { id: string };
}
