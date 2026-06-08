/**
 * Anvil completion webhook — Phase 2 of the e-sign flow.
 *
 * Anvil POSTs this URL when an Etch packet completes (the client signs). We
 * verify a shared secret (constant-time), flip the proposal to 'signed', and
 * deliver the countersigned copy. The endpoint is public (Anvil is the caller),
 * so the SECRET is the gate — configure the Anvil webhook URL as
 *   https://<api-host>/api/v1/webhooks/anvil?key=<ANVIL_WEBHOOK_SECRET>
 * (Anvil's source IPs 35.233.165.3 / 34.148.239.131 are not enforced here —
 * behind a proxy the source IP is the proxy's, so the secret is the real gate.)
 *
 * Idempotent: a re-delivered webhook for an already-signed record is a 200 no-op.
 * Returns 200 fast on a valid secret; document-delivery failures are logged, not
 * surfaced to Anvil (which would otherwise retry the webhook indefinitely).
 */
import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";

import { downloadProposalDocuments } from "../lib/anvil.ts";
import { db } from "../lib/db.ts";
import { sendSignedCopy } from "../lib/email.ts";

export const anvilWebhookRoutes = new Hono();

function secretOk(provided: string | undefined): boolean {
  const expected = process.env.ANVIL_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// etchPacketComplete / signerComplete / documentGroupComplete all carry "complete".
function isComplete(action: unknown): boolean {
  return String(action ?? "")
    .toLowerCase()
    .includes("complete");
}

anvilWebhookRoutes.post("/anvil", async (c) => {
  const key = c.req.query("key") ?? c.req.header("x-webhook-secret") ?? undefined;
  if (!secretOk(key)) return c.json({ error: "unauthorized" }, 401);

  // biome-ignore lint/suspicious/noExplicitAny: Anvil's webhook payload is loosely shaped.
  const body = (await c.req.json().catch(() => ({}))) as Record<string, any>;
  const action = body.action ?? body.type ?? body?.data?.action;
  const data = body.data ?? body;
  const signerEid: string | undefined = data.signerEid ?? data?.signer?.eid;
  const etchPacketEid: string | undefined = data.etchPacketEid ?? data?.eid;
  const documentGroupEid: string | undefined =
    data.documentGroupEid ?? data?.documentGroup?.eid ?? data?.signer?.documentGroupEid;

  if (!isComplete(action)) return c.json({ ok: true, ignored: action ?? null });

  // Resolve the record by whichever eid Anvil included.
  const filters: Array<[string, string]> = [];
  if (signerEid) filters.push(["signer_eid", signerEid]);
  if (etchPacketEid) filters.push(["etch_packet_eid", etchPacketEid]);
  if (documentGroupEid) filters.push(["document_group_eid", documentGroupEid]);
  if (!filters.length) return c.json({ ok: true, ignored: "no resolvable eid" });

  // biome-ignore lint/suspicious/noExplicitAny: row shape is the selected columns.
  let rec: any = null;
  for (const [col, val] of filters) {
    const { data: r } = await db()
      .from("proposals")
      .select("ref,status,client_name,client_email,document_group_eid")
      .eq(col, val)
      .maybeSingle();
    if (r) {
      rec = r;
      break;
    }
  }
  if (!rec) return c.json({ ok: true, ignored: "no matching proposal" });

  // Idempotent: already signed/paid → no-op.
  if (rec.status === "signed" || rec.status === "paid") {
    return c.json({ ok: true, status: rec.status });
  }

  await db()
    .from("proposals")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("ref", rec.ref);

  // Best-effort signed-copy delivery — never fail the webhook on a delivery error.
  if (rec.client_email && rec.document_group_eid) {
    try {
      const pdf = await downloadProposalDocuments(rec.document_group_eid);
      const res = await sendSignedCopy({
        to: rec.client_email,
        clientName: rec.client_name,
        ref: rec.ref,
        pdf,
      });
      if (!res.sent) {
        // eslint-disable-next-line no-console
        console.error(`signed-copy delivery failed for ${rec.ref}: ${res.error}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`signed-copy delivery threw for ${rec.ref}:`, e);
    }
  }

  return c.json({ ok: true, status: "signed", ref: rec.ref });
});
