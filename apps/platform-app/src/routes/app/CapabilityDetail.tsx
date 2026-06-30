/**
 * CapabilityDetail — the per-firm capability profile card, addressed by UEI.
 *
 * Server-of-record read (dumb BFF -> catalyst /entities/{uei}/capability-profile): identity +
 * designations + sub/prime activity + evidence-tiered recommended NAICS+PSC lanes (each lane
 * names the primes who sub it out). The on-call view and the shareable leave-behind. Authors no
 * geometry — composes CockpitPage + cockpit primitives.
 */
import { Building2, Landmark, TrendingUp, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { Badge, Grid, Inline, Stack, Text } from "@rare-structure-hq/ui";

import { BackLink, CockpitPage, DataRow, Panel, Section, StatCard } from "@/app/cockpit";
import { type CapabilityProfile, fetchEntityCapabilityProfile } from "@/demo/federalApi";

type Phase = "loading" | "ready" | "notfound" | "error";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const fmtUsd = (n: number | null | undefined): string => (n == null ? "—" : usd.format(n));
const fmtNum = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("en-US");

const TIER_TONE: Record<string, "accent" | "info" | "default"> = {
  "primed-direct": "accent",
  "subbed-hop": "info",
  "primed-hop": "default",
  declared: "default",
};
const TIER_LABEL: Record<string, string> = {
  "primed-direct": "Primed · direct",
  "subbed-hop": "Subbed · adjacent",
  "primed-hop": "Primed · adjacent",
  declared: "Declared",
};

export default function CapabilityDetail() {
  const { uei = "" } = useParams();
  const [profile, setProfile] = useState<CapabilityProfile | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!uei) return;
    setPhase("loading");
    setError(null);
    fetchEntityCapabilityProfile(uei)
      .then((data) => {
        setProfile(data);
        setPhase("ready");
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load capability profile";
        if (/\b404\b/.test(msg)) {
          setPhase("notfound");
        } else {
          setError(msg);
          setPhase("error");
        }
      });
  }, [uei]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const back = <BackLink to="/app/overview" label="Overview" />;

  if (phase === "loading") {
    return (
      <CockpitPage title="Capability profile" description="Loading…">
        {back}
      </CockpitPage>
    );
  }
  if (phase === "notfound") {
    return (
      <CockpitPage
        title="Capability profile not found"
        description={`No profile for UEI ${uei} — no subaward history, and not a DSBS with recommended lanes.`}
      >
        {back}
      </CockpitPage>
    );
  }
  if (phase === "error" || !profile) {
    return (
      <CockpitPage title="Capability profile" description="Couldn't load this profile.">
        {back}
        <Panel>
          <Text size="mono-xs" mono color="subtle">
            {error}
          </Text>
        </Panel>
      </CockpitPage>
    );
  }

  const sub = profile.subActivity;
  const prime = profile.primeActivity;
  const statusLabel =
    profile.federalStatus === "active_sub"
      ? "Active sub"
      : profile.federalStatus === "dsbs_prospect"
        ? "DSBS prospect"
        : "Federal";
  const meta = [profile.uei, profile.stateCode, statusLabel].filter(Boolean).join(" · ");

  return (
    <CockpitPage
      title={profile.firmName ?? profile.uei ?? "Capability profile"}
      description={meta}
      width="wide"
    >
      {back}

      {profile.isDsbs || profile.designations.length > 0 ? (
        <Inline gap="2" align="center" wrap>
          {profile.isDsbs ? <Badge tone="accent">DSBS</Badge> : null}
          {profile.designations.map((d) => (
            <Badge key={d}>{d}</Badge>
          ))}
        </Inline>
      ) : null}

      <Section label="Federal footprint">
        <Grid cols={1} mdCols={3} gap="4">
          {sub ? (
            <>
              <StatCard icon={TrendingUp} label="Subaward $ (5y)" value={fmtUsd(sub.amount5y)} />
              <StatCard
                icon={Building2}
                label="Subawards (5y)"
                value={fmtNum(sub.subawards5y)}
                hint={`${fmtNum(sub.distinctPrimes5y)} primes`}
              />
              <StatCard
                icon={Users}
                label="Recent (90d)"
                value={fmtNum(sub.recentSubawards90d)}
                hint={fmtUsd(sub.recentSubawardAmount90d)}
              />
            </>
          ) : null}
          {prime ? (
            <>
              <StatCard icon={Landmark} label="Prime $ (5y)" value={fmtUsd(prime.obligated5y)} />
              <StatCard
                icon={Landmark}
                label="Prime awards (5y)"
                value={fmtNum(prime.awards5y)}
                hint={`${fmtNum(prime.competedAwards5y)} competed`}
              />
            </>
          ) : null}
        </Grid>
      </Section>

      {sub ? (
        <Section label="Recent sub activity">
          <Panel>
            <Stack gap="0">
              <DataRow
                label="Top prime partner"
                value={sub.recentTopPrimeName ?? sub.topPrimePartners[0]?.name ?? "—"}
              />
              <DataRow label="Latest action" value={sub.recentLatestActionDate ?? "—"} />
              <DataRow label="Recent scope" value={sub.recentSubawardScope ?? "—"} />
              <DataRow
                label="Top NAICS"
                value={
                  sub.topNaics
                    .slice(0, 3)
                    .map((n) => n.code)
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
            </Stack>
          </Panel>
        </Section>
      ) : null}

      {prime ? (
        <Section label="Prime-side capability">
          <Panel>
            <Stack gap="0">
              <DataRow
                label="Prime NAICS"
                value={
                  prime.topNaics
                    .slice(0, 3)
                    .map((n) => n.code)
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <DataRow
                label="Prime PSC"
                value={
                  prime.topPsc
                    .slice(0, 3)
                    .map((n) => n.code)
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <DataRow label="Top agency" value={prime.topAgencies[0]?.agency ?? "—"} />
            </Stack>
          </Panel>
        </Section>
      ) : null}

      <Section label={`Recommended lanes (${fmtNum(profile.nRecommendedLanes)})`}>
        {profile.recommendedLanes.length === 0 ? (
          <Panel>
            <Text size="body-sm" color="muted">
              No recommended lanes for this firm.
            </Text>
          </Panel>
        ) : (
          <Stack gap="3">
            {profile.recommendedLanes.map((lane) => (
              <Panel key={`${lane.naics}-${lane.psc}-${lane.rank}`}>
                <Stack gap="3">
                  <Inline justify="between" align="center" wrap gap="2">
                    <Inline gap="2" align="center" wrap>
                      <Text size="mono-sm" mono color="accent">
                        {lane.naics} · {lane.psc}
                      </Text>
                      <Badge tone={TIER_TONE[lane.evidenceTier ?? "declared"] ?? "default"}>
                        {TIER_LABEL[lane.evidenceTier ?? ""] ?? lane.evidenceTier ?? "—"}
                      </Badge>
                    </Inline>
                    <Text size="mono-xs" mono color="subtle">
                      {fmtNum(lane.lanePrimes)} primes · {fmtUsd(lane.laneMedianAmount)} median
                    </Text>
                  </Inline>
                  <Text size="body-sm" color="default">
                    {lane.naicsDescription} — {lane.pscDescription}
                  </Text>
                  {lane.topPrimes.length > 0 ? (
                    <Text size="mono-xs" mono color="muted">
                      Buyers: {lane.topPrimes.slice(0, 3).join(" · ")}
                    </Text>
                  ) : null}
                </Stack>
              </Panel>
            ))}
          </Stack>
        )}
      </Section>
    </CockpitPage>
  );
}
