/**
 * useProposalShell — shared loader for the public proposal shell, used by the executive summary
 * (`/p/:ref`) and the full-page signing view (`/p/:ref/sign`). The `ref` is the capability, so the
 * fetch is unauthenticated; a missing ref or a 404 collapses to "notfound".
 */
import type { ProposalShell } from "@rare-structure-hq/shared";
import { useEffect, useState } from "react";

type LoadState = "loading" | "ready" | "notfound";

export function useProposalShell(
  ref: string | undefined,
  fetcher: (ref: string) => Promise<ProposalShell | null>,
): { shell: ProposalShell | null; state: LoadState } {
  const [shell, setShell] = useState<ProposalShell | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!ref) {
      setState("notfound");
      return;
    }
    let active = true;
    setState("loading");
    fetcher(ref)
      .then((s) => {
        if (!active) return;
        if (!s) {
          setState("notfound");
          return;
        }
        setShell(s);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("notfound");
      });
    return () => {
      active = false;
    };
  }, [ref, fetcher]);

  return { shell, state };
}
