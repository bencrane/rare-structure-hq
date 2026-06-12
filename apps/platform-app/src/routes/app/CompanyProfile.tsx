/**
 * CompanyProfile — the company dossier page. Opened from a Pipeline row; shows the
 * cal.com-derived booking we have today (prospect, company, meeting window, status). The
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
import { type DossierSeed, ProspectDossierBoard } from "@/proposals/ProspectDossierBoard";

function fullName(b: BookingDetail): string {
  const n = [b.firstName, b.lastName].filter(Boolean).join(" ").trim();
  return n || "—";
}

function statusTone(status: string): "info" | "warn" | "success" {
  if (/cancel/i.test(status)) return "warn";
  return status === "booked" ? "info" : "success";
}

export default function CompanyProfile() {
  const { bookingId = "" } = useParams();
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  // The opportunity for this booking (1:1 via source_booking_id) — its id is stamped on the page.
  const [oppId, setOppId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token || !bookingId) return;
    setPhase("loading");
    setError(null);
    setOppId(null);
    listOpportunities(token)
      .then((opps) =>
        setOppId(opps.find((o) => o.sourceBookingId === bookingId)?.opportunityId ?? null),
      )
      .catch(() => setOppId(null));
    getBooking(token, bookingId)
      .then((data) => {
        setBooking(data);
        setPhase("ready");
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load booking";
        if (/\b404\b/.test(msg)) {
          setPhase("notfound");
        } else {
          setError(msg);
          setPhase("error");
        }
      });
  }, [token, bookingId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const back = (
    <Link to="/app/pipeline" className={backCls}>
      <ChevronLeft className="size-3.5" />
      Pipeline
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
  // company dossier (`profile`) resolved by domain. This page IS the Dossier.
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
      title="Dossier"
      description={oppId ? oppId.slice(0, 8) : "—"}
      width="wide"
      actions={<Badge tone={statusTone(b.status)}>{b.status}</Badge>}
    >
      {back}
      {/* key=bookingId remounts the board so it re-seeds when navigating between bookings. */}
      <ProspectDossierBoard key={bookingId} token={token} seed={seed} />
    </CockpitPage>
  );
}

const backCls =
  "inline-flex w-fit items-center gap-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.12em] transition-colors hover:text-[color:var(--color-text-accent)]";
