/**
 * Proposal instantiation routes — the NEW one-click-instantiate surface.
 *
 * Kept separate from the legacy `routes/proposals.ts` (`:ref/packet`,
 * `:ref/sign-url`), which backs the original `/proposal/:ref` page and is left
 * untouched. Mounted alongside it at the same base in index.ts.
 *
 *   POST /api/v1/proposals        (operator)  instantiate a record → { ref, path }
 *   GET  /api/v1/proposals/:ref   (public)    the lean shell projection
 *   GET  /api/v1/proposal-templates (operator) the non-revealing posture list
 *
 * The Anvil packet is NOT created here — it is minted lazily at sign time
 * (record-aware, Phase 3) so the ~2h embedded sign URL never goes stale.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import {
  type ProposalShell,
  type ProposalStatus,
  type ProposalSummary,
  createProposalInputSchema,
} from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { AnvilError, createPacketFromTemplate, generateProposalSignUrl } from "../lib/anvil.ts";
import { db } from "../lib/db.ts";
import {
  DOCUMENSO_APP_URL,
  EdgeError,
  edgeCreateProposal,
  edgeGetProposal,
  edgeListProposals,
  postureMonthlyFeeCents,
} from "../lib/edge.ts";
import { sendProposalLink } from "../lib/email.ts";
import { getTemplate, listTemplateMeta } from "../lib/proposal-templates.ts";

export const proposalAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// edge_api lifecycle (draft|sent|opened|signed|completed|rejected|voided) → the shell's
// enum (created|sent|signed|paid). "paid" stays reserved for an actual payment event.
function mapStatus(s: string): ProposalStatus {
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
// rides through. The Anvil path stays intact but is not used here.
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
    { label: "Quarterly · 3 mo. advance", value: p.quarterly_total },
    ...p.success_fee_tiers.map((t) => ({ label: t.tier, value: t.rate })),
  ];
  const shell: ProposalShell = {
    ref: p.ref,
    status: mapStatus(p.status),
    templateLabel: p.template_label,
    client: { name: p.client.name, title: p.client.title ?? undefined },
    execSummary: EXEC_SUMMARY,
    headline,
    createdAt: p.created_at ?? new Date().toISOString(),
    signingToken: p.signing_token ?? undefined,
    documensoHost: DOCUMENSO_APP_URL,
  };
  return c.json({ data: shell });
});

// POST /api/v1/proposals/:ref/sign-session — public, record-aware. Mints a fresh
// embedded sign URL for this proposal: creates the Anvil packet once from the
// posture + stored field_values (the success-fee tiers + client identity), then
// reuses the signer on re-opens (the URL itself expires ~2h, so it is re-minted
// each call). The ref is the capability credential, so no auth.
proposalAdminRoutes.post("/:ref/sign-session", async (c) => {
  const ref = c.req.param("ref");
  const { data: rec, error } = await db()
    .from("proposals")
    .select("ref,template_id,client_name,client_email,client_title,field_values,signer_eid")
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message });
  if (!rec) throw new HTTPException(404, { message: "proposal not found" });

  const template = getTemplate(rec.template_id);
  if (!template) throw new HTTPException(500, { message: `template missing: ${rec.template_id}` });

  let signerEid = rec.signer_eid as string | null;
  if (!signerEid) {
    const signer = {
      name: rec.client_name as string,
      email:
        (rec.client_email as string | null) ??
        `noreply+${encodeURIComponent(ref)}@rarestructure.com`,
      title: (rec.client_title as string | null) ?? undefined,
    };
    let packet: Awaited<ReturnType<typeof createPacketFromTemplate>>;
    try {
      packet = await createPacketFromTemplate(
        ref,
        { castEid: template.castEid, clientSignerFieldIds: template.clientSignerFieldIds },
        rec.field_values as Record<string, string>,
        signer,
      );
    } catch (e) {
      if (e instanceof AnvilError) throw new HTTPException(502, { message: e.message });
      throw e;
    }
    signerEid = packet.signerEid;
    const { error: upErr } = await db()
      .from("proposals")
      .update({
        etch_packet_eid: packet.etchPacketEid,
        document_group_eid: packet.documentGroupEid,
        signer_eid: packet.signerEid,
      })
      .eq("ref", ref);
    if (upErr) throw new HTTPException(500, { message: `persist failed: ${upErr.message}` });
  }

  try {
    const url = await generateProposalSignUrl(signerEid, ref); // ref doubles as clientUserId
    return c.json({ data: { url } });
  } catch (e) {
    if (e instanceof AnvilError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
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

// GET /api/v1/proposal-templates — operator-facing posture list (non-revealing).
export const proposalTemplateRoutes = new Hono<{ Variables: AuthVariables }>();
proposalTemplateRoutes.get("/", requireUser, (c) => c.json({ data: listTemplateMeta() }));
