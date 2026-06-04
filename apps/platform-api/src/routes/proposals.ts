/**
 * Public proposal e-sign routes — Anvil Etch embedded signing.
 *
 * The `:ref` is the capability credential (an unguessable proposal reference),
 * so these are UNAUTHENTICATED (no requireUser) — unlike the sam-opps surface.
 *
 *   POST /:ref/packet    → create an embedded Etch packet, return signerEid
 *   POST /:ref/sign-url  → generate the embedded signing URL for a signer
 *
 * The Anvil API key stays server-side; the Vite frontend only ever receives the
 * signerEid and the short-lived sign URL.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { AnvilError, createProposalPacket, generateProposalSignUrl } from "../lib/anvil.ts";

export const proposalRoutes = new Hono();

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// Create the Etch packet for this proposal. Signer identity comes from the
// client (which holds the deal); falls back to neutral defaults.
proposalRoutes.post("/:ref/packet", async (c) => {
  const ref = c.req.param("ref");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.signerName) ?? "Authorized Signer";
  const email = str(body.signerEmail) ?? `noreply+${encodeURIComponent(ref)}@rarestructure.com`;
  const title = str(body.signerTitle);
  try {
    const packet = await createProposalPacket(ref, { name, email, title });
    return c.json({ data: packet });
  } catch (e) {
    if (e instanceof AnvilError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});

// Mint the embedded signing URL for a signer created by /packet.
proposalRoutes.post("/:ref/sign-url", async (c) => {
  const ref = c.req.param("ref");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const signerEid = str(body.signerEid);
  if (!signerEid) throw new HTTPException(400, { message: "signerEid is required" });
  try {
    const url = await generateProposalSignUrl(signerEid, ref); // ref doubles as clientUserId
    return c.json({ data: { url } });
  } catch (e) {
    if (e instanceof AnvilError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
