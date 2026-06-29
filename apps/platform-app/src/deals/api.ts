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
  // Person identity (display-only — sourced from business.contacts via the deal_contacts junction).
  contact_id?: string;
  full_name?: string | null;
  email?: string | null;
  title?: string | null;
  // Whether this contact signs the deal's document. Defaults to true (all contacts are signatories
  // until toggled off). Lives in the deal_contacts junction (reconciled by the PUT, not opaque jsonb).
  is_signatory?: boolean;
}

// An account contact NOT yet on the deal — the "Add contact" pool.
export interface AvailableContact {
  contactId: string;
  fullName: string | null;
  email: string | null;
  title: string | null;
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
  availableContacts: AvailableContact[];
  fieldValues: Record<string, unknown>;
  defaultTemplateUuid: string | null;
  templateOrigin: string;
  availableTemplates: TemplateOption[];
}

export interface DealDetailsInput {
  // Junction reconciliation payload — only the resolution key + signatory flag (no person fields).
  contacts: { contact_id: string; is_signatory: boolean }[];
  fieldValues: Record<string, unknown>;
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

// The originate result — a prefilled, PENDING Documenso document minted from the deal's attached
// template. `signLink` is the relative /p/m/{dealHandle}/{documentId} prospect signing path.
export interface DealOriginated {
  envelopeId: string;
  documentId: number | null;
  dealHandle: string;
  signingToken: string | null;
  signLink: string;
  status: string;
  documensoHost: string;
}

// POST /api/v1/deals/:handle/originate — mint the prospect signing document for the deal. No body;
// the signatory + template resolve server-side off the deal. Returns the sign link to surface.
export async function originateDeal(token: string, handle: string): Promise<DealOriginated> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${encodeURIComponent(handle)}/originate`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`originate failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as DealOriginated;
}
