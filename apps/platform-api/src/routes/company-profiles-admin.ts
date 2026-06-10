/**
 * Company profiles — the Dossier's "Save Profile" surface.
 *
 *   POST /api/v1/company-profiles/:domain/snapshots  (operator)  append one dossier snapshot
 *
 * APPEND-ONLY: each save appends an immutable, timestamped row to
 * `business.company_profile_snapshots` (the canonical `company_profiles` is untouched). The read
 * (latest snapshot) rides the booking-profile detail. This BFF only brokers the operator session
 * to edge_api with the service token — it NEVER reaches the DB directly.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import {
  type CompanyProfileSnapshot,
  saveCompanyProfileSnapshotInputSchema,
} from "@rare-structure-hq/shared";

import { type AuthVariables, requireUser } from "../auth.ts";
import { EdgeError, edgeSaveCompanyProfileSnapshot } from "../lib/edge.ts";

export const companyProfileRoutes = new Hono<{ Variables: AuthVariables }>();

// POST /api/v1/company-profiles/:domain/snapshots — operator appends the verified dossier.
// Auth-gated. Delegates to the engine, which inserts an immutable row keyed by domain.
companyProfileRoutes.post("/:domain/snapshots", requireUser, async (c) => {
  const domain = c.req.param("domain").trim().toLowerCase();
  if (!domain) throw new HTTPException(400, { message: "domain required" });

  const parsed = saveCompanyProfileSnapshotInputSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
  }
  const input = parsed.data;

  try {
    const row = await edgeSaveCompanyProfileSnapshot(domain, {
      company: input.company,
      signer_name: input.signerName,
      title: input.title,
      email: input.email,
      hq: input.hq,
      headcount: input.headcount,
      est_revenue_range: input.estRevenueRange,
      overview: input.overview,
      focus: input.focus,
      industries: input.industries,
      geographies: input.geographies,
      verified: input.verified,
      saved_by: c.get("user").email,
    });
    const snapshot: CompanyProfileSnapshot = {
      id: row.id,
      domain: row.domain,
      company: row.company,
      signerName: row.signer_name,
      title: row.title,
      email: row.email,
      hq: row.hq,
      headcount: row.headcount,
      estRevenueRange: row.est_revenue_range,
      overview: row.overview,
      focus: row.focus ?? [],
      industries: row.industries ?? [],
      geographies: row.geographies ?? [],
      verified: row.verified ?? {},
      savedBy: row.saved_by,
      createdAt: row.created_at ?? new Date().toISOString(),
    };
    return c.json({ data: snapshot }, 201);
  } catch (e) {
    if (e instanceof EdgeError) throw new HTTPException(502, { message: e.message });
    throw e;
  }
});
