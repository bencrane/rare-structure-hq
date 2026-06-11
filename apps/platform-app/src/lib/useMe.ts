/**
 * useMe — fetches the signed-in user's resolved identity (`GET /api/v1/me`), including org
 * affiliation. The portal's brand (AppShell top-left, Account "Organization") reflects
 * `me.org.name`. Coarse operator/client gating stays on the JWT (`useAuth().isOperator`);
 * this is purely the org-identity enrichment.
 *
 * Returns `null` until resolved, when unauthenticated, or under the DEV mock session (whose
 * "dev" token the BFF can't verify) — callers fall back to the house brand in those cases.
 */
import { useEffect, useState } from "react";

import type { Me } from "@rare-structure-hq/shared";

import { useAuth } from "./auth";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export function useMe(): { me: Me | null; loading: boolean } {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No real session, or the DEV mock token the BFF can't verify → skip the call.
    if (!token || token === "dev") {
      setMe(null);
      return;
    }
    let active = true;
    setLoading(true);
    fetch(`${API_BASE}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .then((d) => {
        if (active) setMe(d);
      })
      .catch(() => {
        if (active) setMe(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  return { me, loading };
}
