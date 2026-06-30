/**
 * Applications / Research list surface — sourced from DEALS (`business.deals`).
 *
 *   GET /api/v1/deals   (operator)  pipeline list, most recent first
 *
 * The data is brokered from the core-x deals surface (edge_api `GET /api/v1/deals`) and mapped
 * onto the DealSummary shape (deal_id->dealId, deal_handle->handle, last_booking_id->lastBookingId).
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { DealSummary } from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import {
  type EdgeDealDetails,
  type EdgeDealOriginated,
  EdgeError,
  edgeGetDealDetails,
  edgeListDeals,
  edgeOriginateDeal,
  edgeSaveDealDetails,
} from "../lib/edge.ts";

export const dealAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// GET /api/v1/deals — operator-facing list (most recent first) for the Pipeline tab.
// Auth-gated. Delegates to the engine (edge_api → business.deals).
dealAdminRoutes.get("/", requireUser, async (c) => {
  try {
    const rows = await edgeListDeals();
    const list: DealSummary[] = rows.map((r) => ({
      dealId: r.deal_id,
      // deal_handle is already the public 8-char key (LEFT(id,8)) — no slice needed.
      handle: r.deal_handle,
      status: r.status,
      createdAt: r.created_at ?? new Date().toISOString(),
      companyName: r.company_name,
      domain: r.domain,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      title: r.title,
      // The deal's most-recent booking — the detail page resolves handle -> booking -> company profile.
      lastBookingId: r.last_booking_id,
      bookedAt: r.booked_at,
    }));
    return c.json({ data: list });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// Map the edge deal_details (snake_case) onto the SPA shape (camelCase). The `contacts` jsonb array
// passes through verbatim (deal_contacts junction rows: {contact_id, full_name, email, title,
// is_signatory}); `available_contacts` is the add pool (account contacts not yet on the deal).
function toDealDetails(r: EdgeDealDetails) {
  return {
    dealId: r.deal_id,
    dealHandle: r.deal_handle,
    companyName: r.company_name,
    companyDomain: r.company_domain,
    contacts: r.contacts,
    availableContacts: (r.available_contacts ?? []).map((a) => ({
      contactId: a.contact_id,
      fullName: a.full_name,
      email: a.email,
      title: a.title,
    })),
    fieldValues: r.field_values,
    defaultTemplateUuid: r.default_template_uuid,
    defaultTemplateDocumensoId: r.default_template_documenso_id,
    templateOrigin: r.template_origin,
    availableTemplates: (r.available_templates ?? []).map((t) => ({
      documensoId: t.documenso_id,
      templateUuid: t.template_uuid,
      documensoTemplateId: t.documenso_template_id,
      name: t.name,
      isDefault: t.is_default,
    })),
  };
}

// GET /api/v1/deals/:handle/details — the deal's editable deal_details + the deal-org's templates.
dealAdminRoutes.get("/:handle/details", requireUser, async (c) => {
  try {
    const r = await edgeGetDealDetails(c.req.param("handle"));
    return c.json({ data: toDealDetails(r) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// PUT /api/v1/deals/:handle/details — reconcile the deal_contacts junction (by contact_id +
// is_signatory) + field_values + attached template. Person identity is NOT edited via this PUT;
// `contacts` is an array of {contact_id, is_signatory} and passes through to edge as-is.
dealAdminRoutes.put("/:handle/details", requireUser, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    contacts?: unknown;
    fieldValues?: unknown;
    defaultTemplateDocumensoId?: unknown;
  };
  try {
    const r = await edgeSaveDealDetails(c.req.param("handle"), {
      contacts: Array.isArray(body.contacts) ? body.contacts : [],
      field_values:
        body.fieldValues && typeof body.fieldValues === "object" && !Array.isArray(body.fieldValues)
          ? (body.fieldValues as Record<string, unknown>)
          : {},
      default_template_documenso_id:
        typeof body.defaultTemplateDocumensoId === "number" ? body.defaultTemplateDocumensoId : null,
    });
    return c.json({ data: toDealDetails(r) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// Map the edge originate result (snake_case) onto the SPA shape (camelCase).
function toDealOriginated(r: EdgeDealOriginated) {
  return {
    envelopeId: r.envelope_id,
    documentId: r.document_id,
    dealHandle: r.deal_handle,
    signingToken: r.signing_token,
    signLink: r.sign_link,
    status: r.status,
    documensoHost: r.documenso_host,
  };
}

// POST /api/v1/deals/:handle/originate — mint a prefilled, PENDING Documenso document for the deal
// from its attached template (edge resolves the signatory + template off the deal). Returns the
// /p/m/{deal_handle}/{document_id} sign link. No request body; payment is a later phase.
dealAdminRoutes.post("/:handle/originate", requireUser, async (c) => {
  try {
    const r = await edgeOriginateDeal(c.req.param("handle"));
    return c.json({ data: toDealOriginated(r) });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
