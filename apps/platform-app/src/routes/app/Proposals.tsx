/**
 * Proposals — the operator cockpit tab. Generate an engagement proposal (the
 * intake form) and track recent ones with their status + shareable link. The
 * `/app` cockpit is auth-gated, so the form runs with the operator's session
 * token directly (no sign-in step). Authors no geometry — composes CockpitPage.
 */
import type { ProposalStatus, ProposalSummary } from "@rare-structure-hq/shared";
import { Badge, Grid, Text } from "@rare-structure-hq/ui";
import { ExternalLink, FileSignature } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CockpitPage, EmptyState, Panel, Section } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { ProposalIntakeForm } from "@/proposals/ProposalIntakeForm";
import { listProposals } from "@/proposals/api";

const STATUS_TONE: Record<ProposalStatus, "default" | "info" | "success" | "accent"> = {
  created: "default",
  sent: "info",
  signed: "success",
  paid: "accent",
};

export default function Proposals() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [list, setList] = useState<ProposalSummary[] | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    listProposals(token)
      .then(setList)
      .catch(() => setList([]));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CockpitPage
      title="Proposals"
      description="Generate an engagement proposal and share the signing link — on the call or by email."
    >
      <Grid cols={1} lgCols={2} gap="4">
        <Section label="New proposal">
          <Panel>
            <ProposalIntakeForm token={token} />
          </Panel>
        </Section>

        <Section label="Recent">
          <Panel padded={false}>
            {list === null ? (
              <div className="px-5 py-6 text-center font-mono text-mono-xs uppercase text-[color:var(--color-text-subtle)]">
                Loading…
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={FileSignature}
                title="No proposals yet"
                description="Generate one with the form — it'll show here with its status and link."
              />
            ) : (
              <ul className="divide-y divide-[color:var(--color-border-subtle)]">
                {list.map((p) => (
                  <li key={p.ref} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Text size="body-sm" color="primary" className="block truncate">
                        {p.clientName}
                      </Text>
                      <Text size="mono-xs" mono color="subtle" className="block truncate">
                        {p.templateLabel} · {p.ref}
                      </Text>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                      <a
                        href={`/p/${p.ref}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        title="Open the client shell"
                        className="text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text-accent)]"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Section>
      </Grid>
    </CockpitPage>
  );
}
