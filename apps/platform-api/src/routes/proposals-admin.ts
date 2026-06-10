/**
 * Proposal instantiation routes — the one-click-instantiate surface.
 *
 *   POST /api/v1/proposals          (operator)  instantiate a record → { ref, path }
 *   GET  /api/v1/proposals          (operator)  the operator's recent proposals
 *   GET  /api/v1/proposals/:ref     (public)    the lean shell projection
 *   POST /api/v1/proposals/:ref/send (operator) email the shell link to the client
 *   GET  /api/v1/proposal-templates (operator)  the non-revealing posture list
 *
 * Document rendering + e-signature are owned by core-x edge_api (DocRaptor → Documenso);
 * this BFF only brokers create/list/read/send across the auth boundary.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import {
  type ProposalShell,
  type ProposalStatus,
  type ProposalSummary,
  type ProposalTemplateMeta,
  createProposalInputSchema,
} from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { db } from "../lib/db.ts";
import {
  DOCUMENSO_APP_URL,
  EdgeError,
  EdgePaymentNotReady,
  edgeCreatePaymentIntent,
  edgeCreateProposal,
  edgeGetPayment,
  edgeGetProposal,
  edgeListProposals,
  edgeTemplateList,
  postureMonthlyFeeCents,
} from "../lib/edge.ts";
import { sendProposalLink } from "../lib/email.ts";

export const proposalAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// Billing-cadence enum → operator-/client-facing label for the headline.
function cadenceLabel(cadence: string): string {
  switch (cadence) {
    case "upfront_in_full":
      return "Upfront, in full";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    default:
      return cadence;
  }
}

// edge_api lifecycle (draft|sent|opened|signed|completed|rejected|voided) → the shell's
// enum (created|sent|signed|paid). "paid" stays reserved for an actual payment event.
function mapStatus(s: string, paymentStatus?: string): ProposalStatus {
  if (paymentStatus === "succeeded") return "paid"; // a settled ACH debit is the only "paid" trigger
  switch (s) {
    case "draft":
      return "created";
    case "signed":
    case "completed":
      return "signed";
    default:
      return "sent"; // sent | opened | rejected | voided all read as "in flight"
  }
}

const EXEC_SUMMARY =
  "Rare Structure originates and structures off-market deal flow against your investment " +
  "mandate. This engagement deploys dedicated sourcing infrastructure on a success-based fee " +
  "schedule — the transaction success fee below applies only to capital that closes and funds.";

// POST /api/v1/proposals — operator instantiates a proposal. Auth-gated. Delegates to the
// core-x engine (edge_api), which renders the legal PDF (DocRaptor) and creates the Documenso
// envelope. The posture selects the (hardcoded) monthly infrastructure fee; the signer identity
// rides through.
proposalAdminRoutes.post("/", requireUser, async (c) => {
  const parsed = createProposalInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
  }
  const input = parsed.data;
  const signerName = input.client.name.trim();
  const email =
    input.client.email?.trim() || `noreply+${encodeURIComponent(signerName)}@rarestructure.com`;

  try {
    const r = await edgeCreateProposal({
      // The intake form collects one identity; it doubles as the institutional entity and the
      // signer until a distinct firm/entity field is added to the form.
      clientName: signerName,
      clientSignerName: signerName,
      clientEmail: email,
      clientTitle: input.client.title,
      // Forward the selected template id; a published template's body + fee win in the engine.
      // postureMonthlyFeeCents is the fallback fee (seed postures + any template without one).
      templateId: input.templateId,
      monthlyFeeCents: postureMonthlyFeeCents(input.templateId),
    });
    return c.json({ data: { ref: r.ref, path: r.path } }, 201);
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// GET /api/v1/proposals — operator-facing list (most recent first), for the cockpit Proposals
// tab. Auth-gated. Delegates to the engine.
proposalAdminRoutes.get("/", requireUser, async (c) => {
  try {
    const rows = await edgeListProposals();
    const list: ProposalSummary[] = rows.map((r) => ({
      ref: r.ref,
      clientName: r.client_name,
      templateLabel: "Strategic Origination Mandate",
      status: mapStatus(r.status),
      createdAt: r.created_at ?? new Date().toISOString(),
    }));
    return c.json({ data: list });
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// GET /api/v1/proposals/:ref — public, ref-scoped read for the client shell. The ref is the
// capability credential, so no auth. Maps the engine's public projection (incl. the Documenso
// signing token) onto the lean shell the client page renders.
proposalAdminRoutes.get("/:ref", async (c) => {
  const ref = c.req.param("ref");
  let p: Awaited<ReturnType<typeof edgeGetProposal>>;
  try {
    p = await edgeGetProposal(ref);
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
  if (!p) throw new HTTPException(404, { message: "proposal not found" });

  const headline = [
    { label: "Infrastructure Fee", value: `${p.monthly_fee} / month` },
    { label: "Term", value: `${p.duration_months} months` },
    { label: "Billing", value: cadenceLabel(p.billing_cadence) },
    { label: "Total", value: p.total },
    ...p.success_fee_tiers.map((t) => ({ label: t.tier, value: t.rate })),
  ];
  const shell: ProposalShell = {
    ref: p.ref,
    status: mapStatus(p.status, p.payment_status),
    templateLabel: p.template_label,
    client: { name: p.client.name, title: p.client.title ?? undefined },
    execSummary: EXEC_SUMMARY,
    headline,
    createdAt: p.created_at ?? new Date().toISOString(),
    signingToken: p.signing_token ?? undefined,
    documensoHost: DOCUMENSO_APP_URL,
    effectiveDate: p.effective_date,
  };
  return c.json({ data: shell });
});

// POST /api/v1/proposals/:ref/send — operator emails the shell link to the
// client (the "instantiate and send" path). Auth-gated. Advances status to
// 'sent' without downgrading an already signed/paid record.
proposalAdminRoutes.post("/:ref/send", requireUser, async (c) => {
  const ref = c.req.param("ref");
  const { data: rec, error } = await db()
    .from("proposals")
    .select("ref,client_name,client_email,template_label,status")
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message });
  if (!rec) throw new HTTPException(404, { message: "proposal not found" });
  if (!rec.client_email) {
    throw new HTTPException(400, { message: "this proposal has no client email" });
  }

  const base = (process.env.PROPOSAL_BASE_URL ?? "").replace(/\/$/, "");
  const result = await sendProposalLink({
    to: rec.client_email,
    clientName: rec.client_name,
    ref,
    url: `${base}/p/${ref}`,
    templateLabel: rec.template_label,
  });
  if (!result.sent) throw new HTTPException(502, { message: `send failed: ${result.error}` });

  const nextStatus = rec.status === "created" ? "sent" : rec.status;
  const { error: upErr } = await db()
    .from("proposals")
    .update({ status: nextStatus, sent_at: new Date().toISOString() })
    .eq("ref", ref);
  if (upErr) throw new HTTPException(500, { message: `persist failed: ${upErr.message}` });

  return c.json({ data: { sent: true, id: result.id } });
});

// POST /api/v1/proposals/:ref/payment-intent — PUBLIC (the ref is the capability). Mints/reuses the
// ACH PaymentIntent in edge_api (amount resolved server-side from the proposal) and returns the
// client_secret + publishable key the pay page needs for Stripe Elements. No card — ACH only.
proposalAdminRoutes.post("/:ref/payment-intent", async (c) => {
  const ref = c.req.param("ref");
  try {
    const p = await edgeCreatePaymentIntent(ref);
    return c.json({
      data: {
        clientSecret: p.client_secret,
        publishableKey: p.publishable_key,
        amountCents: p.amount_cents,
        currency: p.currency,
        paymentStatus: p.payment_status,
      },
    });
  } catch (e) {
    if (e instanceof EdgePaymentNotReady) throw new HTTPException(409, { message: e.message });
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// GET /api/v1/proposals/:ref/payment — PUBLIC; the authoritative (webhook-driven) payment state the
// pay page polls after confirm (ACH settles 1-3 business days after the browser hands off).
proposalAdminRoutes.get("/:ref/payment", async (c) => {
  const ref = c.req.param("ref");
  let s: Awaited<ReturnType<typeof edgeGetPayment>>;
  try {
    s = await edgeGetPayment(ref);
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
  if (!s) throw new HTTPException(404, { message: "proposal not found" });
  return c.json({
    data: {
      paymentStatus: s.payment_status,
      amountCents: s.amount_cents,
      currency: s.currency,
      paidAt: s.paid_at,
    },
  });
});

// GET /api/v1/proposal-templates — the operator's engagement picker for the Proposals intake form.
// PUBLISHED templates authored in Settings, SCOPED to the signed-in operator's org: the engine
// filters by the operator's email domain (org.metadata->>'domain'), so an @activeoperators.com
// operator sees only Active Operators templates, @rarestructure.com only Rare Structure, etc.
// Keyed by slug (the value a minted proposal stores as template_id). Returns [] if the registry
// is unreachable — the picker reflects the table, never stale built-in postures.
export const proposalTemplateRoutes = new Hono<{ Variables: AuthVariables }>();
proposalTemplateRoutes.get("/", requireUser, async (c) => {
  const domain = c.get("user").email.split("@")[1]?.toLowerCase() ?? "";
  try {
    const published = await edgeTemplateList(true, domain);
    const data: ProposalTemplateMeta[] = published
      .filter((t) => t.slug)
      .map((t) => ({ id: t.slug as string, label: t.name ?? (t.slug as string), fields: [] }));
    return c.json({ data });
  } catch {
    return c.json({ data: [] });
  }
});
