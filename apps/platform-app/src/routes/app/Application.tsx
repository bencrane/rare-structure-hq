/**
 * Application — the company profile page, addressed by the opportunity's 8-char handle and
 * resolved to its source booking. Opened from an Applications row; shows the cal.com-derived
 * booking we have today (prospect, company, meeting window, status). The
 * richer dossier intelligence + originate land once enrichment is wired — this page is the
 * surface that will populate. Authors no geometry — composes CockpitPage.
 */
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { BookingDetail } from "@rare-structure-hq/shared";
import { Badge, Text } from "@rare-structure-hq/ui";

import { CockpitPage, Panel } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { getBooking, listOpportunities } from "@/pipeline/api";
import { CompanyProfileBoard, type DossierSeed } from "@/proposals/CompanyProfileBoard";

function fullName(b: BookingDetail): string {
  const n = [b.firstName, b.lastName].filter(Boolean).join(" ").trim();
  return n || "—";
}

function statusTone(status: string): "info" | "warn" | "success" {
  if (/cancel/i.test(status)) return "warn";
  return status === "booked" ? "info" : "success";
}

export default function Application() {
  // The URL carries the opportunity's 8-char public handle (OpportunitySummary.handle);
  // opportunityId is the center node. Resolve handle → opportunity → source booking.
  const { opportunityId: handle = "" } = useParams();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  // The full opportunity UUID for the resolved handle — the key the originate/staging flow needs.
  const [opportunityUuid, setOpportunityUuid] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token || !handle) return;
    setPhase("loading");
    setError(null);
    setOpportunityUuid(null);
    listOpportunities(token)
      .then((opps) => {
        const opp = opps.find((o) => o.handle === handle);
        if (!opp?.sourceBookingId) {
          setPhase("notfound");
          return;
        }
        setOpportunityUuid(opp.opportunityId);
        return getBooking(token, opp.sourceBookingId).then((data) => {
          setBooking(data);
          setPhase("ready");
        });
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load opportunity";
        if (/\b404\b/.test(msg)) {
          setPhase("notfound");
        } else {
          setError(msg);
          setPhase("error");
        }
      });
  }, [token, handle]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const back = (
    <Link to="/app/applications" className={backCls}>
      <ChevronLeft className="size-3.5" />
      Applications
    </Link>
  );

  if (phase === "loading") {
    return (
      <CockpitPage title="Booking" description="Loading…">
        {back}
      </CockpitPage>
    );
  }
  if (phase === "notfound") {
    return (
      <CockpitPage title="Booking not found" description="This booking no longer exists.">
        {back}
      </CockpitPage>
    );
  }
  if (phase === "error" || !booking) {
    return (
      <CockpitPage title="Booking" description="Couldn’t load this booking.">
        {back}
        <Panel>
          <Text size="mono-xs" mono color="subtle" className="break-words">
            {error}
          </Text>
        </Panel>
      </CockpitPage>
    );
  }

  const b = booking;
  const name = fullName(b);
  // The operator's LATEST saved snapshot wins when present (a superset — incl. Main Contact + the
  // Verified map). Otherwise: identity/contact from the cal booking, firmographics + tags from the
  // company dossier (`profile`) resolved by domain. This page IS the Application.
  const p = b.profile;
  const s = b.latestSnapshot;
  const seed: DossierSeed = s
    ? {
        company: s.company ?? b.companyName ?? "",
        domain: s.domain || (b.domain ?? ""),
        signerName: s.signerName ?? "",
        title: s.title ?? "",
        email: s.email ?? "",
        hq: s.hq ?? "",
        headcount: s.headcount ?? "",
        revenue: s.estRevenueRange ?? "",
        overview: s.overview ?? "",
        focus: s.focus ?? [],
        industries: s.industries ?? [],
        geographies: s.geographies ?? [],
        verified: s.verified,
      }
    : {
        company: b.companyName ?? p?.company ?? "",
        domain: b.domain ?? "",
        signerName: name === "—" ? "" : name,
        title: b.title ?? "",
        email: b.email ?? "",
        hq: p?.hq ?? "",
        headcount: p?.headcount ?? "",
        revenue: p?.estRevenueRange ?? "",
        overview: p?.overview ?? "",
        focus: p?.focus ?? [],
        industries: p?.industries ?? [],
        geographies: p?.geographies ?? [],
      };
  return (
    <CockpitPage
      title="Application"
      description={handle || "—"}
      width="wide"
      actions={<Badge tone={statusTone(b.status)}>{b.status}</Badge>}
    >
      {back}
      {/* key=handle remounts the board so it re-seeds when navigating between opportunities. */}
      <CompanyProfileBoard key={handle} token={token} seed={seed} opportunityId={opportunityUuid} />
    </CockpitPage>
  );
}

const backCls =
  "inline-flex w-fit items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.12em] transition-colors hover:text-[color:var(--color-text-accent)]";
