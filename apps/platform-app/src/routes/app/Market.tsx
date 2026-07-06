/**
 * Market — the operator's audience builder (the Market tab).
 *
 * Left rail compiles the frozen AudienceFilters shape; Apply runs
 * entities/count (StatCards: entities · people · per-enrichment-state) +
 * entities/query (paged 50) against the BFF's /api/v1/market/* proxy. A row
 * click opens the entity's SAM-people drawer; "Push to Close" runs the
 * dry-run → confirm → live-push → poll flow in PushDialog. All state is
 * route-local (house style — no global store); geometry lives in the
 * src/market/ composites, so this file stays geometry-free.
 */
import { Building2, Link2, Mail, Phone, UserX, Users } from "lucide-react";
import { useCallback, useState } from "react";

import { Button, Grid, Text } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel, StatCard } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { EntitiesTable } from "@/market/EntitiesTable";
import { EMPTY_DRAFT, type FilterDraft, FilterRail, buildFilters } from "@/market/FilterRail";
import { MarketSplit } from "@/market/MarketSplit";
import { PeopleDrawer } from "@/market/PeopleDrawer";
import { PushDialog } from "@/market/PushDialog";
import {
  type AudienceCounts,
  type AudienceFilters,
  type EntityPage,
  countEntities,
  queryEntities,
} from "@/market/api";

const LIMIT = 50;

const ENRICHMENT_CARDS = [
  { state: "dialable", label: "Dialable", icon: Phone },
  { state: "emailable", label: "Emailable", icon: Mail },
  { state: "bridged_no_contacts", label: "Bridged · no contacts", icon: Link2 },
  { state: "unbridged", label: "Unbridged", icon: UserX },
] as const;

const fmt = (n: number | undefined): string => (n ?? 0).toLocaleString("en-US");

export default function Market() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_DRAFT);
  const [applied, setApplied] = useState<AudienceFilters | null>(null);
  const [counts, setCounts] = useState<AudienceCounts | null>(null);
  const [page, setPage] = useState<EntityPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<{ uei: string; name: string } | null>(null);
  const [pushOpen, setPushOpen] = useState(false);

  const runQuery = useCallback(
    async (filters: AudienceFilters, off: number, withCounts: boolean) => {
      if (!token) return;
      setBusy(true);
      setError(null);
      try {
        if (withCounts) {
          const [c, p] = await Promise.all([
            countEntities(token, filters),
            queryEntities(token, filters, LIMIT, off),
          ]);
          setCounts(c);
          setPage(p);
        } else {
          setPage(await queryEntities(token, filters, LIMIT, off));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Query failed");
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  const apply = () => {
    const filters = buildFilters(draft);
    setApplied(filters);
    setOffset(0);
    setDrawer(null);
    setCounts(null);
    setPage(null);
    void runQuery(filters, 0, true);
  };

  const onPage = (next: number) => {
    if (!applied) return;
    setOffset(next);
    void runQuery(applied, next, false);
  };

  const retry = () => {
    if (applied) void runQuery(applied, offset, counts === null);
  };

  const canPush = !!applied && !!counts && counts.total > 0;

  return (
    <CockpitPage
      title="Market"
      description="Build an audience over the federal-vendor universe, preview its people, and push the cohort to Close."
      width="wide"
      actions={
        <Button variant="primary" size="sm" disabled={!canPush} onClick={() => setPushOpen(true)}>
          Push to Close
        </Button>
      }
    >
      <MarketSplit
        rail={<FilterRail draft={draft} onDraft={setDraft} onApply={apply} busy={busy} />}
      >
        <div className="flex flex-col gap-6">
          {counts ? (
            <Grid cols={2} mdCols={3} lgCols={6} gap="4">
              <StatCard icon={Building2} label="Entities" value={fmt(counts.total)} />
              <StatCard icon={Users} label="People" value={fmt(counts.totalPeople)} />
              {ENRICHMENT_CARDS.map((c) => (
                <StatCard
                  key={c.state}
                  icon={c.icon}
                  label={c.label}
                  value={fmt(counts.byEnrichmentState?.[c.state])}
                />
              ))}
            </Grid>
          ) : null}

          {error ? (
            <Panel>
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Text size="body-sm" color="default">
                  Couldn’t query the audience
                </Text>
                <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
                  {error}
                </Text>
                <button
                  type="button"
                  onClick={retry}
                  className="flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)]"
                >
                  Retry
                </button>
              </div>
            </Panel>
          ) : applied === null ? (
            <Panel padded={false}>
              <EmptyState
                icon={Building2}
                title="No audience yet"
                description="Set the filters and hit Apply — the cohort, its people counts, and the entity table land here."
              />
            </Panel>
          ) : page === null ? (
            <Panel padded={false}>
              <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
                Querying the market…
              </div>
            </Panel>
          ) : (
            <EntitiesTable
              page={page}
              offset={offset}
              limit={LIMIT}
              selectedUei={drawer?.uei ?? null}
              onSelect={(row) =>
                setDrawer({ uei: row.uei, name: row.legal_business_name ?? row.uei })
              }
              onPage={onPage}
              paging={busy}
            />
          )}
        </div>
      </MarketSplit>

      {drawer && applied ? (
        <PeopleDrawer
          uei={drawer.uei}
          entityName={drawer.name}
          filters={applied}
          onClose={() => setDrawer(null)}
        />
      ) : null}

      {pushOpen && applied ? (
        <PushDialog filters={applied} onClose={() => setPushOpen(false)} />
      ) : null}
    </CockpitPage>
  );
}
