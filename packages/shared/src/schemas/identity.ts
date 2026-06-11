/**
 * Identity / org-affiliation types for the authenticated portal.
 *
 * The shape returned by the BFF `GET /api/v1/me`. The portal reads coarse persona
 * (operator vs client) from the Supabase JWT (`app_metadata.role`); this payload
 * carries the resolved ORG identity — name, slug, domain, the user's org_role —
 * sourced from the `business.*` tables via the BFF. The portal's brand (top-left,
 * Account) reflects `org.name`; the legal entity on contracts is a separate concern.
 */

/** The signed-in user's organization, resolved through membership. `null` when unaffiliated. */
export interface OrgIdentity {
  id: string;
  name: string;
  /** url-safe handle, e.g. "active-operators". */
  slug: string | null;
  /** email domain that keys the org, e.g. "activeoperators.com". */
  domain: string | null;
  /** the user's role WITHIN the org, e.g. "owner". */
  role: string | null;
}

/** `GET /api/v1/me` — the resolved identity for the signed-in user. */
export interface Me {
  userId: string;
  email: string;
  appEnv: string;
  /** platform-level role from `business.users`, e.g. "platform_operator". */
  platformRole: string | null;
  /** resolved org affiliation, or `null` when the user has no active membership. */
  org: OrgIdentity | null;
}
