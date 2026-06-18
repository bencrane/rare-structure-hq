/**
 * Documenso public surface — the prospect-facing direct-to-documenso endpoints for `/p/m/:opp/:doc`.
 *
 *   GET  /api/v1/documenso/sign/:opportunityId/:documentId/token           (PUBLIC) embed signer token
 *   GET  /api/v1/documenso/sign/:opportunityId/:documentId/state           (PUBLIC) signed-state poll
 *   POST /api/v1/documenso/sign/:opportunityId/:documentId/payment-intent  (PUBLIC) mint/reuse ACH intent
 *   GET  /api/v1/documenso/sign/:opportunityId/:documentId/payment         (PUBLIC) payment-state poll
 *
 * These mirror edge_api's own `documenso/*` namespace (sign-token / sign-state / payment-intent /
 * payment) one-for-one, so the frontend → BFF → edge_api chain reads as ONE namespace end to end.
 * They were lifted out of the legacy `engagement-mandate-drafts` router (which still owns the
 * operator-authenticated mandate-DRAFT CRUD); the `(opportunityId, documentId)` pair is the capability,
 * so none of these carry an operator session (no `requireUser`), exactly like the proposal `ref` reads.
 *
 * NOTE: `index.ts` also mounts this router under the legacy `/api/v1/engagement-mandate-drafts` prefix
 * as a transitional alias, so an in-flight SPA bundle calling the old path keeps working across the
 * independent platform-app / platform-api deploys. Drop that alias once the new bundle is fully live.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AuthVariables } from "../auth.ts";
import {
  EdgeError,
  edgeCreateDocumentPaymentIntent,
  edgeGetDocumentPaymentState,
  edgeGetSignState,
  edgeGetSignToken,
} from "../lib/edge.ts";

export const documensoPublicRoutes = new Hono<{ Variables: AuthVariables }>();

// PUBLIC — the prospect's embed-load TOKEN read for `/p/m/:opportunityId/:documentId`. edge_api
// makes ONE live Documenso read and PAIR-GATES (the document's externalId must equal opportunityId)
// before returning the signer token; a guessed document id under a wrong/missing UUID → 404. The
// opportunity UUID is the capability; the numeric document id is only a disambiguator behind it.
documensoPublicRoutes.get("/sign/:opportunityId/:documentId/token", async (c) => {
  const opportunityId = c.req.param("opportunityId");
  const documentId = c.req.param("documentId");
  try {
    const tok = await edgeGetSignToken(opportunityId, documentId);
    if (!tok) throw new HTTPException(404, { message: "document not found" });
    return c.json({
      data: {
        signingToken: tok.signing_token,
        documensoHost: tok.documenso_host,
        status: tok.status,
      },
    });
  } catch (e) {
    if (e instanceof HTTPException) throw e;
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// PUBLIC — the prospect poll for `/p/m/:opportunityId/:documentId`. While the embed is shown
// DocumentSignPage polls this; `signed` flips true once a terminal DOCUMENT_COMPLETED webhook lands
// for the (opportunity, document) PAIR, and the page advances to the signed-confirmation view.
// edge_api derives this FULLY OFFLINE from the raw webhook capture — ZERO Documenso calls in the
// poll loop. The pair gate means a guessed document id with a wrong UUID returns signed:false.
documensoPublicRoutes.get("/sign/:opportunityId/:documentId/state", async (c) => {
  const opportunityId = c.req.param("opportunityId");
  const documentId = c.req.param("documentId");
  try {
    const state = await edgeGetSignState(opportunityId, documentId);
    if (!state) throw new HTTPException(404, { message: "document not found" });
    return c.json({
      data: {
        opportunityId: state.opportunity_id,
        documentId: state.document_id,
        signed: state.signed,
        latestEvent: state.latest_event,
        status: state.status,
      },
    });
  } catch (e) {
    if (e instanceof HTTPException) throw e;
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// PUBLIC — mint/reuse the ACH PaymentIntent for `/p/m/:opportunityId/:documentId/pay`. Pure
// pass-through to edge_api, which gates on the document being signed (409 until then) and resolves the
// amount server-side from fee_amount. The edge HTTP status is propagated verbatim so the SPA can
// branch (409 → "sign first"). camelCase the snake_case edge body for the SPA.
documensoPublicRoutes.post("/sign/:opportunityId/:documentId/payment-intent", async (c) => {
  const opportunityId = c.req.param("opportunityId");
  const documentId = c.req.param("documentId");
  try {
    const init = await edgeCreateDocumentPaymentIntent(opportunityId, documentId);
    return c.json({
      data: {
        clientSecret: init.client_secret,
        publishableKey: init.publishable_key,
        amountCents: init.amount_cents,
        currency: init.currency,
        paymentStatus: init.payment_status,
      },
    });
  } catch (e) {
    if (e instanceof HTTPException) throw e;
    if (e instanceof EdgeError) {
      const status = (e as EdgeError & { status?: number }).status ?? 502;
      throw new HTTPException(status as 400 | 404 | 409 | 422 | 502 | 503, { message: e.message });
    }
    throw e;
  }
});

// PUBLIC — the prospect's payment-state poll for `/p/m/:opportunityId/:documentId/pay`. Pass-through
// to edge_api; `paid` (payment_status === "succeeded") advances only via the Stripe webhook.
documensoPublicRoutes.get("/sign/:opportunityId/:documentId/payment", async (c) => {
  const opportunityId = c.req.param("opportunityId");
  const documentId = c.req.param("documentId");
  try {
    const state = await edgeGetDocumentPaymentState(opportunityId, documentId);
    return c.json({
      data: {
        paymentStatus: state.payment_status,
        amountCents: state.amount_cents,
        currency: state.currency,
        paidAt: state.paid_at,
        rail: state.rail,
      },
    });
  } catch (e) {
    if (e instanceof HTTPException) throw e;
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
