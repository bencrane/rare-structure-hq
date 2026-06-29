/**
 * Deal Details API client — the editor opened from a Research row.
 *
 *   GET /api/v1/deals/:handle/details   load the deal's deal_details + the org's templates
 *   PUT /api/v1/deals/:handle/details   save the edited contacts + content + attached template
 *
 * Brokered by the platform-api BFF to core-x (business.deal_details). The `contacts` array is the
 * free-form deal_details.contacts jsonb (snake_case keys); it passes through verbatim.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export interface DealContact {
  contact_id?: string;
  full_name?: string;
  email?: string;
  title?: string;
  // Whether this contact signs the deal's document. Defaults to true (all contacts are signatories
  // until toggled off). Lives in the deal_details.contacts jsonb (opaque to the BFF/edge).
  is_signatory?: boolean;
}

export interface TemplateOption {
  templateUuid: string;
  documensoTemplateId: string;
  name: string | null;
  isDefault: boolean;
}

export interface DealDetails {
  dealId: string;
  dealHandle: string;
  companyName: string | null;
  companyDomain: string | null;
  contacts: DealContact[];
  content: Record<string, unknown>;
  defaultTemplateUuid: string | null;
  templateOrigin: string;
  availableTemplates: TemplateOption[];
}

export interface DealDetailsInput {
  contacts: DealContact[];
  content: Record<string, unknown>;
  defaultTemplateUuid: string | null;
}

export async function getDealDetails(token: string, handle: string): Promise<DealDetails> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${encodeURIComponent(handle)}/details`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`deal details failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as DealDetails;
}

export async function updateDealDetails(
  token: string,
  handle: string,
  input: DealDetailsInput,
): Promise<DealDetails> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${encodeURIComponent(handle)}/details`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as DealDetails;
}
