/**
 * Deal API client — the Deal Details editor (from Research) and the Mandate editor (from Application).
 *
 *   GET  /api/v1/deals/:handle/details    load field_values + the org's templates + the deal's contacts
 *   PUT  /api/v1/deals/:handle/details    save field_values + attached template + reconcile contacts
 *   POST /api/v1/deals/:handle/originate  mint the prospect signing document from the attached template
 *
 * Brokered by the platform-api BFF to core-x. The `contacts` array is the business.deal_contacts
 * junction (membership + is_signatory, person fields joined read-only from business.contacts) — NOT a
 * deal_details column. The PUT reconciles that junction by {contact_id, is_signatory}.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// DEV-only fixture so the Mandate/Deal editors render fully populated on localhost without the BFF —
// the same philosophy as auth.devSignIn (import.meta.env.DEV is statically false in prod, so this whole
// branch is tree-shaken out and can never serve mock data in a production build). Keyed on the "dev"
// mock token; a real session never hits it.
const DEV_DEAL: DealDetails = {
  dealId: "013ca823-dev-mock-0000-0000-000000000000",
  dealHandle: "013ca823",
  companyName: "Environmental Logistics",
  companyDomain: "envlogs.com",
  firmographics: {
    description:
      "Regional provider of hazardous-waste transport and remediation logistics for industrial and municipal operators across the Gulf Coast.",
    industry: "Environmental Services",
    sector: "Waste Management & Remediation",
    headquarters: "Houston, TX",
    employees: "120–250",
    founded: "2009",
    annualRevenue: "$25M–$50M",
    ownership: "Private — founder-owned",
    entityType: "C-Corp",
    naics: "562910",
  },
  contacts: [
    {
      contact_id: "dev-contact-1",
      full_name: "Eddie Andrus",
      email: "eddie@envlogs.com",
      title: "Managing Director",
      is_signatory: true,
    },
  ],
  availableContacts: [],
  fieldValues: { IntroNum: "30", PrepaidFee: "$45,000", PricePerIntro: "$1500" },
  templateDocumensoId: 14503,
  templateOrigin: "org",
  availableTemplates: [{ documensoId: 14503, name: "Rare Structure - GC - v3", isDefault: true }],
};

const isDev = (token: string) => import.meta.env.DEV && token === "dev";

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
  // The envelope's documenso_id — the attach key the dropdown matches and saves.
  documensoId: number;
  name: string | null;
  isDefault: boolean;
}

// Company firmographics — read-only context on the prospect account, surfaced on the Mandate document
// so it reads as an engagement brief on screenshare. Optional/nullable throughout: absent fields render
// as "—" and the section degrades gracefully until the BFF supplies them.
export interface Firmographics {
  description?: string | null;
  industry?: string | null;
  sector?: string | null;
  headquarters?: string | null;
  employees?: string | null;
  founded?: string | null;
  annualRevenue?: string | null;
  ownership?: string | null;
  entityType?: string | null;
  naics?: string | null;
}

export interface DealDetails {
  dealId: string;
  dealHandle: string;
  companyName: string | null;
  companyDomain: string | null;
  firmographics?: Firmographics | null;
  contacts: DealContact[];
  availableContacts: AvailableContact[];
  fieldValues: Record<string, unknown>;
  templateDocumensoId: number | null; // the template attached to this deal (documenso_envelopes.documenso_id)
  templateOrigin: string;
  availableTemplates: TemplateOption[];
}

export interface DealDetailsInput {
  // Junction reconciliation payload — only the resolution key + signatory flag (no person fields).
  contacts: { contact_id: string; is_signatory: boolean }[];
  fieldValues: Record<string, unknown>;
  templateDocumensoId: number | null;
}

// The MANUAL deal lane (Settings → New Deal): mint a deal from an operator payload with no booking
// upstream — the parallel to the Cal.com producer. Signatory required (first/last/email). `action`
// is "updated" when the company's account already carried a deal (one deal per account — the manual
// lane collapses onto it, same as a repeat booking).
export interface DealCreateInput {
  companyName: string;
  domain: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
}

export interface DealCreated {
  action: string;
  dealId: string;
  dealHandle: string;
  status: string;
}

export async function createDeal(token: string, input: DealCreateInput): Promise<DealCreated> {
  if (isDev(token)) {
    return {
      action: "created",
      dealId: DEV_DEAL.dealId,
      dealHandle: DEV_DEAL.dealHandle,
      status: "draft",
    };
  }
  const res = await fetch(`${API_BASE}/api/v1/deals`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`deal create failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as DealCreated;
}

export async function getDealDetails(token: string, handle: string): Promise<DealDetails> {
  if (isDev(token)) return { ...DEV_DEAL, dealHandle: handle || DEV_DEAL.dealHandle };
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
  if (isDev(token))
    return {
      ...DEV_DEAL,
      dealHandle: handle || DEV_DEAL.dealHandle,
      fieldValues: input.fieldValues,
      templateDocumensoId: input.templateDocumensoId,
    };
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
  if (isDev(token)) {
    const h = handle || DEV_DEAL.dealHandle;
    return {
      envelopeId: "dev-envelope",
      documentId: 90210,
      dealHandle: h,
      signingToken: "dev-token",
      signLink: `/p/m/${h}/90210`,
      status: "PENDING",
      documensoHost: "https://sign.dev",
    };
  }
  const res = await fetch(`${API_BASE}/api/v1/deals/${encodeURIComponent(handle)}/originate`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`originate failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as DealOriginated;
}
